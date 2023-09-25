import Promise from 'bluebird';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { resource } from '@prisma/client';
import {
    CPU_UTILISATION,
    DISK_UTILISATION,
    MEMORY_UTILISATION,
    DATABASES,
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    PSSCRIPT,
    DATABASES_COUNT,
    DB_ROWS_COUNT,
    SERVER_NAME,
    SERVER_GUID,
    DB_SIZE,
    SERVER_VERSION_DETAILS,
    NUMBER_OF_CONNECTIONS,
    SERVER_STATE,
    IS_SERVER_CLUSTERED,
    SERVER_NODE,
    CLUSTER_NODES,
    TABLES_COUNT_QUERY,
    TABLES_QUERY,
    SSM_QUERY_CONCURRENCY_LIMIT
} from './const';
import { executeSSMDocument } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';
import { UtilisationResponseBodyInterface } from '../../../routes/types/database.types';
import {
    DatabaseTypes,
    DATABASE_METRIC_TYPE,
    SqlServerDeploymentModel,
    HttpErrorCodes,
    CloudProviders,
    ACCOUNT_ID
} from '../../../utils/consts';
import { getAsyncLocalStorageResource } from '../../../utils/async-local-storage';
import { createResource, listResources } from '../../../lib/database/db';

const logger = getLogger();

function sqlResponseParsing(response: string) {
    try {
        const cleanResponse = response.replaceAll('\r\n', '');
        const jsonResponse = JSON.parse(cleanResponse);
        return jsonResponse;
    } catch (error) {
        logger.error('Error parsing query response:', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error parsing query response, ${error}`);
    }
}

async function getResourceDetails(resourceId: string) {
    logger.info('Gettng resource details of resource', resourceId);

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    const [{ metadata, region }] = (await listResources(
        accountId,
        resourceId,
        DatabaseTypes.MS_SQL_SERVER
    )) as resource[];
    let credentialsId;
    let activeNodeInstanceId;
    let standbyNodeInstanceId;
    if (!isEmpty(metadata)) {
        ({ credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as {
            credentialsId: string;
            activeNodeInstanceId: string;
            standbyNodeInstanceId?: string;
        });
    }
    return [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId];
}

async function callSsmExecution(
    credentialsId: string,
    region: string,
    commands: Array<string>,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string
) {
    logger.info(
        'Calling SSM command execution',
        credentialsId,
        activeNodeInstanceId,
        standbyNodeInstanceId,
        region,
        commands
    );
    let response;
    const defaultParams = {
        DocumentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
        Documentversion: '1',
        Parameters: {
            commands
        }
    };
    let params = {
        ...defaultParams,
        InstanceIds: [activeNodeInstanceId]
    };
    try {
        response = await executeSSMDocument(credentialsId, region, params);
    } catch (error) {
        logger.error('Fetching database summary from primary node failed', activeNodeInstanceId, error);
        if (standbyNodeInstanceId) {
            logger.info('Fetching database summary from secondary', credentialsId, region, standbyNodeInstanceId);
            params = {
                ...defaultParams,
                InstanceIds: [standbyNodeInstanceId]
            };
            try {
                response = await executeSSMDocument(credentialsId, region, params);
            } catch (secondError) {
                logger.error(
                    'Fetching database summary from secondary node failed',
                    standbyNodeInstanceId,
                    secondError
                );
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Query execution failed ${secondError}`);
            }
        } else {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Query execution failed ${error}`);
        }
    }
    if (response?.StandardErrorContent) {
        logger.debug('Error:', response?.StandardErrorContent);
        throw new Error(response?.StandardErrorContent);
    }
    return response?.StandardOutputContent;
}

async function getDatabasesCount(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string
) {
    logger.info('Fetching databases total count ', credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId);

    const commands = [`${PSSCRIPT} -Query "${DATABASES_COUNT()}"`];
    const response = await callSsmExecution(
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );
    logger.debug('Fetching databases count response', response);
    return response ? sqlResponseParsing(response)[0] : undefined;
}

async function getDataBasesSummary(resourceId: string) {
    logger.info('Get databases summary for resource:', resourceId);
    const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get database summary');
    }

    let dbCount = await getDatabasesCount(credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId!);
    dbCount = dbCount?.totalCount || 0;

    const rowscount = Math.ceil(dbCount / DB_ROWS_COUNT);
    const batchQueries: string[] = [];
    for (let i = 0, offset = 0; i < rowscount; i++) {
        batchQueries.push(`${PSSCRIPT} -Query "${DATABASES(offset, DB_ROWS_COUNT)}"`);
        offset += DB_ROWS_COUNT;
    }

    const responses = await Promise.map(
        batchQueries,
        async query => callSsmExecution(credentialsId, region, [query], activeNodeInstanceId, standbyNodeInstanceId!),
        { concurrency: SSM_QUERY_CONCURRENCY_LIMIT }
    );
    const dbSummary = `[${responses.join().replace(/\[|\]/g, '')}]`;
    // this type of formatting is done because the responses are in array of strings I am concatinating into 1 string by removing '[' and ']' and appending them again to start and end for proper json formatting
    const cleanDBSummanry = sqlResponseParsing(dbSummary);

    return { databases: cleanDBSummanry };
}

function resourceUtilisationQuery(metricType: string) {
    switch (metricType) {
        case DATABASE_METRIC_TYPE.CPU:
            return CPU_UTILISATION;
        case DATABASE_METRIC_TYPE.DISK:
            return DISK_UTILISATION;
        case DATABASE_METRIC_TYPE.MEMORY:
            return MEMORY_UTILISATION;
        default:
            return '';
    }
}

async function getResourceUtilisation(resourceId: string, metricType: string) {
    logger.info(`Get ${metricType} resource utilization for resource: `, resourceId);

    const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get resource utilisation information');
    }
    logger.info('Fetching utilization from primary', credentialsId, region, activeNodeInstanceId, metricType);

    let commands: string[] = [];
    const metricQuery = resourceUtilisationQuery(metricType);
    commands = [`${PSSCRIPT} -Query "${metricQuery}"`];

    if (metricType === DATABASE_METRIC_TYPE.DISK) {
        const dbSizecommand = [`${PSSCRIPT} -Query '${DB_SIZE}'`];
        const diskUtilizationCommand = [`${PSSCRIPT} -Query "${DISK_UTILISATION}"`];

        const [diskdata, size] = await Promise.all([
            callSsmExecution(
                credentialsId,
                region,
                diskUtilizationCommand,
                activeNodeInstanceId,
                standbyNodeInstanceId!
            ),
            callSsmExecution(credentialsId, region, dbSizecommand, activeNodeInstanceId, standbyNodeInstanceId!)
        ]);

        const [sizeValue] = size ? sqlResponseParsing(size) : [];
        const [diskDataValue] = diskdata ? sqlResponseParsing(diskdata) : [];
        const diskUtilization: UtilisationResponseBodyInterface = {
            used: sizeValue.TotalSize.toString(),
            total: diskDataValue.total.toString(),
            remaining: (Number(diskDataValue.total) - sizeValue.TotalSize).toString(),
            percentUsed: Math.round((sizeValue.TotalSize * 100) / Number(diskDataValue.total)).toString()
        };
        return diskUtilization;
    }
    const response = await callSsmExecution(
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        standbyNodeInstanceId!
    );
    logger.debug('Fetching  utilization', response);
    if (response) {
        return sqlResponseParsing(response)[0];
    }
}

async function getTablesCount(
    credentialsId: string,
    region: string,
    databaseName: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string
) {
    logger.info('Fetching tables total count ', credentialsId, region, activeNodeInstanceId, databaseName);

    const commands = [`${PSSCRIPT} -Database ${databaseName} -Query "${TABLES_COUNT_QUERY}"`];
    const response = await callSsmExecution(
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );
    logger.debug('Fetching tables count response', response);
    if (response) {
        return sqlResponseParsing(response)[0];
    }
}

async function getTablesSummary(resourceId: string, databaseName: string) {
    logger.info('Get tables list for resource:', resourceId, databaseName);
    const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get tables summary');
    }
    const { totalCount: tablesCount = 0 } =
        (await getTablesCount(credentialsId, region, databaseName, activeNodeInstanceId, standbyNodeInstanceId!)) || {};

    const batchCount = Math.ceil(tablesCount / DB_ROWS_COUNT);

    const batchQueries: string[] = [];
    for (let i = 0, offset = 0; i < batchCount; i++) {
        batchQueries.push(`${PSSCRIPT} -Database ${databaseName} -Query "${TABLES_QUERY(offset, DB_ROWS_COUNT)}"`);
        offset += DB_ROWS_COUNT;
    }

    const responses = await Promise.map(
        batchQueries,
        async query => callSsmExecution(credentialsId, region, [query], activeNodeInstanceId, standbyNodeInstanceId!),
        { concurrency: SSM_QUERY_CONCURRENCY_LIMIT }
    );
    const tablesList = `[${responses.join().replace(/\[|\]/g, '')}]`;
    // this type of formatting is done because the responses are in array of strings I am concatinating into 1 string by removing '[' and ']' and appending them again to start and end for proper json formatting

    const cleanResponses = sqlResponseParsing(tablesList);
    for (const record of cleanResponses) {
        record.databaseName = databaseName;
    }
    return { tables: cleanResponses };
}

async function getServerSummary(resourceId: string) {
    logger.info('Get details of SQL Server database:', { resourceId });

    const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get server summary');
    }

    const [serverDetailsInfo, connectionsInfo, stateInfo, isClusteredInfo, nodeInfo, clusterNodesInfo, serverNameInfo] =
        await Promise.all(
            [
                SERVER_VERSION_DETAILS,
                NUMBER_OF_CONNECTIONS,
                SERVER_STATE,
                IS_SERVER_CLUSTERED,
                SERVER_NODE,
                CLUSTER_NODES,
                SERVER_NAME
            ].map(query =>
                callSsmExecution(
                    credentialsId,
                    region,
                    [`${PSSCRIPT} -Query "${query}"`],
                    activeNodeInstanceId,
                    standbyNodeInstanceId!
                )
            )
        );

    if (serverDetailsInfo && connectionsInfo && stateInfo && isClusteredInfo && nodeInfo) {
        const serverDetails = serverDetailsInfo?.replaceAll('\r\n', '');
        const serverInfo = serverDetails?.split('\t');
        const [serverVersion] = serverInfo[0].match(/\d+\.\d+\.\d+\.\d+/) || '';
        const serverStatus = stateInfo.replace(/[\r\n.]/g, '');
        const [{ numberOfConnections: activeConnections }] = sqlResponseParsing(connectionsInfo);
        let [{ activeNode }] = sqlResponseParsing(nodeInfo);
        const [{ isClustered }] = sqlResponseParsing(isClusteredInfo);
        const [{ serverName: clusterName }] = sqlResponseParsing(serverNameInfo!);

        let standbyNode: string = '';
        if (isClustered && clusterNodesInfo) {
            const [node1, node2] = sqlResponseParsing(clusterNodesInfo);

            if (node1?.is_current_owner === 'True') {
                activeNode = node1?.NodeName;
                standbyNode = node2?.NodeName;
            } else {
                activeNode = node2?.NodeName;
                standbyNode = node1?.NodeName;
            }
        }

        return {
            serverId: resourceId,
            serverVersion,
            serverEdition: serverInfo[0].substring(0, serverInfo[0].indexOf(' - ')).trim(),
            serverEngine: serverInfo[3].substring(0, serverInfo[3].indexOf(' on ')).trim(),
            serverStatus,
            activeConnections,
            deploymentModel: isClustered ? SqlServerDeploymentModel.SQL_FCI : SqlServerDeploymentModel.SQL_STANDALONE,
            activeNode,
            ...(isClustered ? { standbyNode, clusterName } : {})
        };
    }
}

async function getSqlServerDetails(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId: string
) {
    const [resourceIdentifier, name] = await Promise.all([
        callSsmExecution(
            credentialsId,
            region,
            [`${PSSCRIPT} -Query "${SERVER_GUID}"`],
            activeNodeInstanceId,
            standbyNodeInstanceId
        ),
        callSsmExecution(
            credentialsId,
            region,
            [`${PSSCRIPT} -Query "${SERVER_NAME}"`],
            activeNodeInstanceId,
            standbyNodeInstanceId
        )
    ]);

    const resourceId = resourceIdentifier ? sqlResponseParsing(resourceIdentifier)[0] : '';
    const { serverName = '' } = name ? sqlResponseParsing(name)[0] : {};
    const id = resourceId?.serverGuid;
    return {
        id,
        resourceName: serverName
    };
}
async function discoverMsSqlServer(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    activeNodeInstanceName: string,
    standbyNodeInstanceId: string,
    standbyNodeInstanceName: string,
    resourceType: string,
    fsxId?: string
) {
    logger.info('Save SQL Server details in database:', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId,
        resourceType,
        fsxId
    });

    const { id: resourceId, resourceName } = await getSqlServerDetails(
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );
    // const resName = resourceName?.serverName;
    // const workspaceId = getAsyncLocalStorageResource<string>(WORKSPACE_ID);
    // const params: ServiceResourceRequest = {
    //     name: resName,
    //     resourceIdentifier: id,
    //     resourceType,
    //     workspacePublicId: workspaceId,
    //     accountPublicId: accountId,
    //     resourceClass: WLMDB_RESOURCE_CLASS,
    //     metadata: {
    //         propertyName: 'properties',
    //         propertyValue: JSON.stringify({
    //             location: CloudProviders.AWS,
    //             credentialsId,
    //             region,
    //             activeNodeInstanceId: activeNodeInstanceId,
    //             standbyNodeInstanceId: standbyNodeInstanceId,
    //             deploymentState: DeploymentState.SUCCESS
    //         })
    //     }
    // };

    // await registerServiceResource(params); // todo: create resource record; add a new workspace column in resource table
    await createResource(accountId, {
        resourceId,
        resourceName,
        // cloudProviderAccountId?: string;
        cloudProviderName: CloudProviders.AWS,
        resourceType,
        coRelationId: fsxId,
        region,
        metadata: {
            credentialsId,
            activeNodeInstanceId,
            standbyNodeInstanceId,
            activeNodeInstanceName,
            standbyNodeInstanceName // TODO : store active an standby instance IP when available
        }
    });
    return { resourceId, resourceName };
}

export {
    getSqlServerDetails,
    getResourceUtilisation,
    getDataBasesSummary,
    getServerSummary,
    getResourceDetails,
    getDatabasesCount,
    getTablesSummary,
    discoverMsSqlServer,
    callSsmExecution,
    getTablesCount
};
