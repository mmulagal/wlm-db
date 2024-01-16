import Promise from 'bluebird';
import createError from 'http-errors';
import { attempt, isEmpty } from 'lodash-es';
import { resource } from '@prisma/client';
import config from 'config';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC, PSSCRIPT, DB_ROWS_COUNT, SSM_QUERY_CONCURRENCY_LIMIT } from './const';
import {
    CPU_UTILISATION,
    DISK_UTILISATION,
    MEMORY_UTILISATION,
    DATABASES,
    DATABASES_COUNT,
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
    SERVER_IO_LATENCY,
    NATIVE_SQL_BACKUPS,
    SERVER_INSTALL_DATE,
    PERFORMANCE_METRICS,
    SQL_BACKUPS,
    SERVER_EDITION
} from './queries';
import { executeSSMDocument, isSSMConnectionSuccessful } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';
import { UtilisationResponseBodyInterface } from '../../../routes/types/database.types';
import {
    DatabaseTypes,
    DATABASE_METRIC_TYPE,
    SqlServerDeploymentModel,
    HttpErrorCodes,
    CloudProviders,
    ACCOUNT_ID,
    RESOURCE_RETRIVAL_ERROR,
    WF,
    SSM_COMMAND_CACHE_TYPE
} from '../../../utils/consts';
import { getAsyncLocalStorageResource } from '../../../utils/async-local-storage';
import { createResource, deleteResource, listRelationshipsResources } from '../../../lib/database/db';
import { generateHash } from '../../../utils/utils';
import { associateResource } from '../../../lib/cloud-manager/credentials';
import { lookupCredentials } from '../../cloud-manager/credentials-operations';
import { getResources } from '../../database/database-operations';
import { deleteFromCache, hasCache, readFromCacheByKey, writeToCache } from '../../../utils/cache';

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
    let metadata;
    let region;

    try {
        [{ metadata, region }] = (await getResources(accountId, resourceId, DatabaseTypes.MS_SQL_SERVER)) as resource[];
    } catch (error) {
        throw createError(HttpErrorCodes.NOT_FOUND, `Error Tenancy resource not found for resource id: ${resourceId}`);
    }
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
    standbyNodeInstanceId?: string,
    accountId?: string,
    cacheData: boolean = true
) {
    logger.info(
        'Calling SSM command execution',
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );

    // Check SSM Connection status
    const isSSMConnected = await isSSMConnectionSuccessful(
        credentialsId,
        region!,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );

    const cacheHashKey = standbyNodeInstanceId
        ? generateHash(activeNodeInstanceId + standbyNodeInstanceId + commands)
        : generateHash(activeNodeInstanceId + commands);

    if (!isSSMConnected) {
        let errorMessage = `SSM connection to node ${activeNodeInstanceId} is not successful.`;
        if (standbyNodeInstanceId) {
            errorMessage = `SSM connection to active node ${activeNodeInstanceId} and standby node ${standbyNodeInstanceId} is not successful.`;
        }
        if (hasCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey)) {
            logger.info('Deleting from cache', activeNodeInstanceId, standbyNodeInstanceId, cacheHashKey);
            deleteFromCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey);
        }
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }

    if (cacheData && !process.env.TEST && hasCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey)) {
        logger.info('Reading from cache', activeNodeInstanceId, standbyNodeInstanceId, cacheHashKey);
        const cacheResponse = readFromCacheByKey(SSM_COMMAND_CACHE_TYPE, cacheHashKey) as string;
        if(!isEmpty(cacheResponse)){
            return cacheResponse
        }
        logger.info('Cache data is empty. Re-running query.', cacheResponse)
    
    }

    let response;
    const defaultParams = {
        DocumentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
        Documentversion: '1',
        Parameters: {
            // DBS-1449 - Adding execution timeout in sec
            executionTimeout: [config.get<string>('ssm.execution-timeout')],
            commands
        }
    };
    let params = {
        ...defaultParams,
        InstanceIds: [activeNodeInstanceId]
    };
    try {
        logger.debug('SSM query execution from primary node', credentialsId, region, activeNodeInstanceId);
        response = await executeSSMDocument(credentialsId, region, params, accountId);
        if (response?.StandardErrorContent) {
            logger.error(
                'SSM query execution from primary node failed',
                activeNodeInstanceId,
                response?.StandardErrorContent
            );
            throw new Error('SSM query execution from primary node failed');
        }
    } catch (error) {
        if (standbyNodeInstanceId) {
            logger.debug('SSM query execution from secondary node', credentialsId, region, standbyNodeInstanceId);
            params = {
                ...defaultParams,
                InstanceIds: [standbyNodeInstanceId]
            };
            try {
                response = await executeSSMDocument(credentialsId, region, params, accountId);
            } catch (secondError) {
                logger.error('SSM query execution from secondary node failed', standbyNodeInstanceId, secondError);
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Query execution failed ${secondError}`);
            }
        } else {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Query execution failed ${error}`);
        }
    }
    if (response?.StandardErrorContent) {
        logger.debug('Query Execution failed on both nodes. Error:', response?.StandardErrorContent);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Query Execution failed on both nodes. Error:${response?.StandardErrorContent}`
        );
    }
    const output = response?.StandardOutputContent;
    if (cacheData) {
        logger.info('Writing to cache', activeNodeInstanceId, standbyNodeInstanceId, cacheHashKey);
        writeToCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey, output, '600s');
    }
    return output;
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
                standbyNodeInstanceId!,
                undefined,
                false
            ),
            callSsmExecution(
                credentialsId,
                region,
                dbSizecommand,
                activeNodeInstanceId,
                standbyNodeInstanceId!,
                undefined,
                false
            )
        ]);

        const [sizeValue] = size ? sqlResponseParsing(size) : [];
        const [diskDataValue] = diskdata ? sqlResponseParsing(diskdata) : [];
        const diskUtilization: UtilisationResponseBodyInterface = {
            used: sizeValue?.TotalSize?.toString(),
            total: diskDataValue?.total?.toString(),
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
        standbyNodeInstanceId!,
        undefined,
        false
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

    const [
        serverDetailsInfo,
        severEditionInfo,
        connectionsInfo,
        stateInfo,
        isClusteredInfo,
        nodeInfo,
        clusterNodesInfo,
        serverNameInfo,
        serverInstallDate
    ] = await Promise.all(
        [
            SERVER_VERSION_DETAILS,
            SERVER_EDITION,
            NUMBER_OF_CONNECTIONS,
            SERVER_STATE,
            IS_SERVER_CLUSTERED,
            SERVER_NODE,
            CLUSTER_NODES,
            SERVER_NAME,
            SERVER_INSTALL_DATE
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

    if (serverDetailsInfo && connectionsInfo && stateInfo && isClusteredInfo && nodeInfo && severEditionInfo) {
        const serverDetails = serverDetailsInfo?.replaceAll('\r\n', '');
        const [{ ServerEdition }] = sqlResponseParsing(severEditionInfo);
        const serverInfo = serverDetails?.split('\t');
        const serverStatus = stateInfo.replace(/[\r\n.]/g, '');
        const [{ numberOfConnections: activeConnections }] = sqlResponseParsing(connectionsInfo);
        let [{ activeNode }] = sqlResponseParsing(nodeInfo);
        const [{ isClustered }] = sqlResponseParsing(isClusteredInfo);
        const [{ serverName: clusterName }] = sqlResponseParsing(serverNameInfo!);
        const [{ creationDate }] = sqlResponseParsing(serverInstallDate!);

        let standbyNode: string = '';
        if (isClustered && clusterNodesInfo) {
            const [node1, node2] = sqlResponseParsing(clusterNodesInfo);

            if (node1?.is_current_owner) {
                activeNode = node1?.NodeName;
                standbyNode = node2?.NodeName;
            } else {
                activeNode = node2?.NodeName;
                standbyNode = node1?.NodeName;
            }
        }

        return {
            serverId: resourceId,
            serverVersion: serverInfo[0].substring(0, serverInfo[0].indexOf('(')).trim(),
            serverEdition: `SQL Server ${ServerEdition?.split(':')?.[0] || 'Standard Edition'}`,
            serverEngine: '', // sending empty string to support blueXP endpoint
            serverStatus,
            activeConnections,
            deploymentModel: isClustered ? SqlServerDeploymentModel.SQL_FCI : SqlServerDeploymentModel.SQL_STANDALONE,
            activeNode,
            ...(isClustered ? { standbyNode, clusterName } : {}),
            operatingSystem: serverDetails.match('Windows Server \\d+')?.[0] || '',
            creationDate,
            nodeNames: standbyNode ? [activeNode!, standbyNode!] : [activeNode!]
        };
    }
}

async function getSqlServerDetails(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string,
    accountId?: string
) {
    logger.info('Getting SQL server details', { credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId });

    const [resourceIdentifier, name] = await Promise.all([
        callSsmExecution(
            credentialsId,
            region,
            [`${PSSCRIPT} -Query "${SERVER_GUID}"`],
            activeNodeInstanceId,
            standbyNodeInstanceId,
            accountId
        ),
        callSsmExecution(
            credentialsId,
            region,
            [`${PSSCRIPT} -Query "${SERVER_NAME}"`],
            activeNodeInstanceId,
            standbyNodeInstanceId,
            accountId
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

function getMsSqlResourceId(activeNodeInstanceId: string, standbyNodeInstanceId?: string) {
    logger.info('Get MS SQL resource ID:', { activeNodeInstanceId, standbyNodeInstanceId });
    return standbyNodeInstanceId
        ? generateHash(activeNodeInstanceId + standbyNodeInstanceId)
        : generateHash(activeNodeInstanceId);
}

async function discoverMsSqlServer(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceType: string,
    activeNodeInstanceId: string,
    activeNodeInstanceName: string,
    standbyNodeInstanceId?: string,
    standbyNodeInstanceName?: string,
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

    const resourceId = getMsSqlResourceId(activeNodeInstanceId, standbyNodeInstanceId);
    const { resourceName } = await getSqlServerDetails(
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );
    const [resourceDetails] = await getResources(accountId, resourceId);

    if (!isEmpty(resourceDetails)) {
        throw createError(409, 'MSSQL server already exists in your tenancy account');
    }
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
    const { source } = await lookupCredentials(credentialsId);
    if (source === WF) {
        await associateResource(credentialsId, accountId, [
            {
                id: resourceId,
                name: resourceName,
                type: resourceType
            }
        ]);
    }
    return { resourceId, resourceName };
}
async function deleteResourceById(accountId: string, resourceId: string) {
    logger.info('Delete Resource:', { resourceId });

    try {
        const relationshipResp = await listRelationshipsResources(accountId, resourceId);
        if (relationshipResp.length !== 0) {
            const fsxId = relationshipResp[0].co_relation_id;
            const countResp = await listRelationshipsResources(accountId);
            const fsxCount = countResp.filter(obj => obj.co_relation_id === fsxId).length;
            if (fsxCount === 1) {
                await deleteResource(accountId, fsxId!);
            }
        }

        const response = await deleteResource(accountId, resourceId);
        if (response.count === 1) {
            return { message: 'Resource successfully deleted' };
        }

        throw new Error('Resource does not exist for tenancy account');
    } catch (err: any) {
        logger.error('Failed to remove resource. Reason:', err.message);

        const errorMessage = 'Resource does not exist for tenancy account';
        const statusCode =
            err.message === errorMessage ? HttpErrorCodes.NOT_FOUND : HttpErrorCodes.INTERNAL_SERVER_ERROR;
        return createError(statusCode, err.message);
    }
}

async function getServerIOLatency(resourceId: string) {
    logger.info('Fetch SQL server IO latency for resource', resourceId);

    const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
    }

    const commands = [`${PSSCRIPT} -Query "${SERVER_IO_LATENCY}"`];
    const response = await callSsmExecution(
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        standbyNodeInstanceId!,
        undefined,
        false
    );

    logger.debug('SQL server IO latency response', response);

    if (response) {
        return sqlResponseParsing(response)[0];
    }
}

async function getServerState(resourceId: string) {
    logger.info('Fetch SQL server state for resource', resourceId);

    const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
    }

    const commands = [`${PSSCRIPT} -Query "${SERVER_STATE}"`];
    const response = await callSsmExecution(
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        standbyNodeInstanceId!
    );

    logger.debug('SQL server state response', response);

    return response!.replace(/[\r\n.]/g, '');
}

async function getNativeSQLProtection(resourceId: string) {
    logger.info('Fetch SQL native protection status', { resourceId });

    try {
        const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(
            resourceId
        );

        if (!credentialsId || !region || !activeNodeInstanceId) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
        }
        const response = await callSsmExecution(
            credentialsId,
            region,
            [`${PSSCRIPT} -Query "${NATIVE_SQL_BACKUPS}"`],
            activeNodeInstanceId,
            standbyNodeInstanceId!
        );

        const cleanedResponse = response?.replaceAll('\r\n', '');
        const parsedResponse = attempt(JSON.parse, cleanedResponse);

        logger.debug('SQL native protection status', parsedResponse);
        return parsedResponse instanceof Error ? undefined : parsedResponse[0].backupCount;
    } catch (err) {
        logger.error('Error getting SQL native protection status', { err });
    }
}

async function getPerformanceMetrics(resourceId: string) {
    logger.info('Fetch SQL server performance metrics (latency, IOPS, throughput) for resource', resourceId);

    const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
    }

    const commands = [`${PSSCRIPT} -Query "${PERFORMANCE_METRICS}"`];
    const response = await callSsmExecution(
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        standbyNodeInstanceId!,
        undefined,
        false
    );

    logger.debug('SQL server performance metrics (latency, IOPS, throughput) response', response);

    if (response) {
        const parsedResponse = sqlResponseParsing(response)[0];
        logger.info(parsedResponse);
        return {
            latency: { read: parsedResponse.READ_LATENCY, write: parsedResponse.WRITE_LATENCY },
            iops: { read: parsedResponse.READ_IOPS, write: parsedResponse.WRITE_IOPS },
            throughput: { read: parsedResponse.READ_THROUGHPUT, write: parsedResponse.WRITE_THROUGHPUT }
        };
    }
}

async function getNativeSQLBackedupDatabases(resourceId: string) {
    logger.info('Fetch SQL native protection status', { resourceId });

    try {
        const [credentialsId, region, activeNodeInstanceId, standbyNodeInstanceId] = await getResourceDetails(
            resourceId
        );

        if (!credentialsId || !region || !activeNodeInstanceId) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
        }

        const response = await callSsmExecution(
            credentialsId,
            region,
            [`${PSSCRIPT} -Query "${SQL_BACKUPS}"`],
            activeNodeInstanceId,
            standbyNodeInstanceId!
        );

        const cleanedResponse = response?.replaceAll('\r\n', '');
        const parsedResponse = attempt(JSON.parse, cleanedResponse);

        logger.debug('SQL native protection status', parsedResponse);
        return parsedResponse instanceof Error ? undefined : parsedResponse;
    } catch (err) {
        logger.error('Error getting SQL native protection status', { err });
    }
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
    getTablesCount,
    getMsSqlResourceId,
    deleteResourceById,
    getServerIOLatency,
    getServerState,
    getNativeSQLProtection,
    getPerformanceMetrics,
    getNativeSQLBackedupDatabases
};
