import Promise from 'bluebird';
import createError from 'http-errors';
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
import { getTenancyResource } from '../../tenancy-operations';
import { UtilisationResponseBodyInterface } from '../../../routes/types/database.types';
import {
    DatabaseTypes,
    DATABASE_METRIC_TYPE,
    SqlServerDeploymentModel,
    HttpErrorCodes,
    WLMDB_RESOURCE_CLASS,
    WORKSPACE_ID,
    CloudProviders,
    DeploymentState
} from '../../../utils/consts';
import { getAsyncLocalStorageResource } from '../../../utils/async-local-storage';
import { ServiceResourceRequest, registerServiceResource } from '../../../lib/cloud-manager/tenancy';

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
    const resourceDetails = await getTenancyResource(DatabaseTypes.MS_SQL_SERVER, resourceId);
    logger.debug('Resource details for resource id:', resourceId, resourceDetails);
    let resourceProperties;
    try {
        resourceProperties = resourceDetails?.metadata?.properties
            ? JSON.parse(resourceDetails?.metadata?.properties)
            : {};
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error parsing resource properties, ${error}`);
    }
    const credentialsId = resourceProperties?.credentialsId || '';
    const region = resourceProperties?.region || '';
    const activeInstanceId = resourceProperties?.activeInstanceId || '';
    const standbyInstanceId = resourceProperties?.standbyInstanceId || '';

    return [credentialsId, region, activeInstanceId, standbyInstanceId];
}

async function callSsmExecution(
    credentialsId: string,
    activeInstanceId: string,
    standbyInstanceId: string,
    region: string,
    commands: Array<string>
) {
    logger.info('Calling SSM command execution', credentialsId, activeInstanceId, standbyInstanceId, region, commands);
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
        InstanceIds: [activeInstanceId]
    };
    try {
        response = await executeSSMDocument(credentialsId, region, params);
    } catch (error) {
        logger.error('Fetching database summary from primary node failed', activeInstanceId, error);
        logger.info('Fetching database summary from secondary', credentialsId, region, standbyInstanceId);
        params = {
            ...defaultParams,
            InstanceIds: [standbyInstanceId]
        };
        try {
            response = await executeSSMDocument(credentialsId, region, params);
        } catch (secondError) {
            logger.error('Fetching database summary from secondary node failed', standbyInstanceId, secondError);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Query execution failed ${secondError}`);
        }
    }
    if (response.StandardErrorContent) {
        logger.debug('Error:', response.StandardErrorContent);
        throw new Error(response.StandardErrorContent);
    }
    return response.StandardOutputContent!;
}

async function getDatabasesCount(
    credentialsId: string,
    region: string,
    activeInstanceId: string,
    standbyInstanceId: string
) {
    logger.info('Fetching databases total count ', credentialsId, region, activeInstanceId);

    const commands = [`${PSSCRIPT} -Query "${DATABASES_COUNT()}"`];
    const response = await callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, commands);
    logger.debug('Fetching databases count response', response);
    return sqlResponseParsing(response)[0];
}

async function getDataBasesSummary(resourceId: string) {
    logger.info('Get databases summary for resource:', resourceId);
    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);

    let dbCount = await getDatabasesCount(credentialsId, region, activeInstanceId, standbyInstanceId);
    dbCount = dbCount?.totalCount || 0;

    const rowscount = Math.ceil(dbCount / DB_ROWS_COUNT);
    const batchQueries: string[] = [];
    for (let i = 0, offset = 0; i < rowscount; i++) {
        batchQueries.push(`${PSSCRIPT} -Query "${DATABASES(offset, DB_ROWS_COUNT)}"`);
        offset += DB_ROWS_COUNT;
    }

    const responses = await Promise.map(
        batchQueries,
        async query => callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, [query]),
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

    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);
    logger.info('Fetching utilization from primary', credentialsId, region, activeInstanceId, metricType);

    let commands: string[] = [];
    const metricQuery = resourceUtilisationQuery(metricType);
    commands = [`${PSSCRIPT} -Query "${metricQuery}"`];

    if (metricType === DATABASE_METRIC_TYPE.DISK) {
        const dbSizecommand = [`${PSSCRIPT} -Query '${DB_SIZE}'`];
        const diskUtilizationCommand = [`${PSSCRIPT} -Query "${DISK_UTILISATION}"`];

        const [diskdata, size] = await Promise.all([
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, diskUtilizationCommand),
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, dbSizecommand)
        ]);

        const [sizeValue] = sqlResponseParsing(size);
        const [diskDataValue] = sqlResponseParsing(diskdata);
        const diskUtilization: UtilisationResponseBodyInterface = {
            used: sizeValue.TotalSize.toString(),
            total: diskDataValue.total.toString(),
            remaining: (Number(diskDataValue.total) - sizeValue.TotalSize).toString(),
            percentUsed: Math.round((sizeValue.TotalSize * 100) / Number(diskDataValue.total)).toString()
        };
        return diskUtilization;
    }
    const response = await callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, commands);
    logger.debug('Fetching  utilization', response);

    return sqlResponseParsing(response)[0];
}

async function getTablesCount(
    credentialsId: string,
    region: string,
    activeInstanceId: string,
    standbyInstanceId: string,
    databaseName: string
) {
    logger.info('Fetching tables total count ', credentialsId, region, activeInstanceId, databaseName);

    const commands = [`${PSSCRIPT} -Database ${databaseName} -Query "${TABLES_COUNT_QUERY}"`];
    const response = await callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, commands);
    logger.debug('Fetching tables count response', response);

    return sqlResponseParsing(response)[0];
}

async function getTablesSummary(resourceId: string, databaseName: string) {
    logger.info('Get tables list for resource:', resourceId, databaseName);
    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);

    const { totalCount: tablesCount = 0 } =
        (await getTablesCount(credentialsId, region, activeInstanceId, standbyInstanceId, databaseName)) || {};

    const batchCount = Math.ceil(tablesCount / DB_ROWS_COUNT);

    const batchQueries: string[] = [];
    for (let i = 0, offset = 0; i < batchCount; i++) {
        batchQueries.push(`${PSSCRIPT} -Database ${databaseName} -Query "${TABLES_QUERY(offset, DB_ROWS_COUNT)}"`);
        offset += DB_ROWS_COUNT;
    }

    const responses = await Promise.map(
        batchQueries,
        async query => callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, [query]),
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

    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);

    const [serverDetailsInfo, connectionsInfo, stateInfo, isClusteredInfo, nodeInfo, clusterNodesInfo] =
        await Promise.all([
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, [
                `${PSSCRIPT} -Query "${SERVER_VERSION_DETAILS}"`
            ]),
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, [
                `${PSSCRIPT} -Query "${NUMBER_OF_CONNECTIONS}"`
            ]),
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, [
                `${PSSCRIPT} -Query "${SERVER_STATE}"`
            ]),
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, [
                `${PSSCRIPT} -Query "${IS_SERVER_CLUSTERED}"`
            ]),
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, [
                `${PSSCRIPT} -Query "${SERVER_NODE}"`
            ]),
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, [
                `${PSSCRIPT} -Query "${CLUSTER_NODES}"`
            ])
        ]);

    const serverDetails = serverDetailsInfo.replaceAll('\r\n', '');
    const serverInfo = serverDetails?.split('\t');
    const [serverVersion] = serverInfo[0].match(/\d+\.\d+\.\d+\.\d+/) || '';
    const serverStatus = stateInfo.replace(/[\r\n.]/g, '');
    const [{ numberOfConnections: activeConnections }] = sqlResponseParsing(connectionsInfo);
    let [{ activeNode }] = sqlResponseParsing(nodeInfo);
    const [{ isClustered }] = sqlResponseParsing(isClusteredInfo);

    let standbyNode: string = '';
    if (isClustered) {
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
        ...(isClustered ? { standbyNode } : {})
    };
}

async function discoverMsSqlServer(
    accountId: string,
    credentialsId: string,
    regionId: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId: string,
    resourceType: string
) {
    logger.info('Save SQL Server details in tenancy:', {
        accountId,
        credentialsId,
        regionId,
        activeInstanceId: activeNodeInstanceId,
        standbyInstanceId: standbyNodeInstanceId,
        resourceType
    });

    const [resourceIdentifier, name] = await Promise.all([
        callSsmExecution(credentialsId, activeNodeInstanceId, standbyNodeInstanceId, regionId, [
            `${PSSCRIPT} -Query "${SERVER_GUID}"`
        ]),
        callSsmExecution(credentialsId, activeNodeInstanceId, standbyNodeInstanceId, regionId, [
            `${PSSCRIPT} -Query "${SERVER_NAME}"`
        ])
    ]);
    const resourceId = sqlResponseParsing(resourceIdentifier)[0];
    const resourceName = sqlResponseParsing(name)[0];
    const id = resourceId?.serverGuid;
    const resName = resourceName?.serverName;
    const workspaceId = getAsyncLocalStorageResource<string>(WORKSPACE_ID);
    const params: ServiceResourceRequest = {
        name: resName,
        resourceIdentifier: id,
        resourceType,
        workspacePublicId: workspaceId,
        accountPublicId: accountId,
        resourceClass: WLMDB_RESOURCE_CLASS,
        metadata: {
            propertyName: 'properties',
            propertyValue: JSON.stringify({
                location: CloudProviders.AWS,
                credentialsId,
                region: regionId,
                activeInstanceId: activeNodeInstanceId,
                standbyInstanceId: standbyNodeInstanceId,
                deploymentState: DeploymentState.SUCCESS
            })
        }
    };

    await registerServiceResource(params);
    return { resourceId: id, resourceName: resName };
}

export {
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
