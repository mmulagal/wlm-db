import Promise from 'bluebird';
import createError from 'http-errors';
import { attempt, isEmpty } from 'lodash-es';
import { STORAGE_TYPE } from '@prisma/client';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { PSSCRIPT, DB_ROWS_COUNT, SSM_QUERY_CONCURRENCY_LIMIT } from './const';
import {
    DATABASES,
    DATABASES_COUNT,
    SERVER_NAME,
    SERVER_GUID,
    SERVER_STATE,
    TABLES_COUNT_QUERY,
    TABLES_QUERY,
    SERVER_IO_LATENCY,
    NATIVE_SQL_BACKUPS,
    PERFORMANCE_METRICS_WITH_LATENCY,
    SQL_BACKUPS,
    DATABASE_NAME_EXISTS,
    SERVER_DETAILS,
    CPU_UTILISATION,
    DB_SIZE,
    DISK_UTILISATION,
    MEMORY_UTILISATION,
    INSTANCE_GUID
} from './queries';
import { callSsmExecution, getSSMConnectionStatus } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';
import { UtilisationResponseBodyInterface } from '../../../routes/types/database.types';
import {
    DatabaseTypes,
    SqlServerDeploymentModel,
    HttpErrorCodes,
    CloudProviders,
    ACCOUNT_ID,
    RESOURCE_RETRIVAL_ERROR,
    WF,
    ServerState,
    DATABASE_METRIC_TYPE
} from '../../../utils/consts';
import { getAsyncLocalStorageResource } from '../../../utils/async-local-storage';
import { createResource, deleteResource, listRelationshipsResources, listResources } from '../../../lib/database/db';
import { generateHash, sqlResponseParsing } from '../../../utils/utils';
import { associateResource } from '../../../lib/cloud-manager/credentials';
import { lookupCredentials } from '../../cloud-manager/credentials-operations';
import { getResources } from '../../database/database-operations';
import { Metadata } from '../../../utils/common-types';
import { INSTANCE_DETAILS, RESOURCE_UTILIZATION } from './ssm-script-utils';

const logger = getLogger();

async function getResourceDetails(resourceId: string) {
    logger.info('Gettng resource details of resource', resourceId);

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    let metadata;
    let region;
    let credentialsId;
    try {
        ({
            items: [{ credentials_id: credentialsId, metadata, region }]
        } = await getResources(accountId, resourceId, undefined, undefined, DatabaseTypes.MS_SQL_SERVER));
    } catch (error) {
        throw createError(HttpErrorCodes.NOT_FOUND, `Error Tenancy resource not found for resource id: ${resourceId}`);
    }
    let node1InstanceId;
    let node2InstanceId;
    if (!isEmpty(metadata)) {
        ({ node1InstanceId, node2InstanceId } = metadata as unknown as Metadata);
    }
    return [credentialsId, region, node1InstanceId, node2InstanceId];
}

async function getDatabasesCount(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instanceName: string = '.'
) {
    logger.info('Fetching databases total count ', credentialsId, region, activeNodeInstanceId);

    const commands = [`sqlcmd -S "${instanceName}" -Q "${DATABASES_COUNT()}" -y 0`];
    const response = await callSsmExecution(credentialsId, region, commands, activeNodeInstanceId);
    logger.debug('Fetching databases count response', response);
    return response ? sqlResponseParsing(response)[0] : undefined;
}

async function getDataBasesSummary(resourceId: string, activeNodeInstanceId?: string, instanceName?: string) {
    logger.info('Get databases summary for resource:', resourceId);

    const [credentialsId, region, node1InstanceId, node2InstanceId] = await getResourceDetails(resourceId);
    if (!credentialsId || !region || !node1InstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get database summary');
    }

    if (!activeNodeInstanceId) {
        ({ activeNodeInstanceId, instanceName } = await getActiveSqlNode(
            credentialsId!,
            region!,
            node1InstanceId,
            node2InstanceId!
        ));
    }

    if (!activeNodeInstanceId || !instanceName) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get active instance information');
    }

    let dbCount = await getDatabasesCount(credentialsId, region, activeNodeInstanceId, instanceName);
    dbCount = dbCount?.totalCount || 0;

    const rowscount = Math.ceil(dbCount / DB_ROWS_COUNT);
    const batchQueries: string[] = [];
    for (let i = 0, offset = 0; i < rowscount; i++) {
        batchQueries.push(`sqlcmd -S "${instanceName}" -Q "${DATABASES(offset, DB_ROWS_COUNT)}" -y 0`);
        offset += DB_ROWS_COUNT;
    }

    const responses = await Promise.map(
        batchQueries,
        async query => callSsmExecution(credentialsId, region, [query], activeNodeInstanceId!),
        { concurrency: SSM_QUERY_CONCURRENCY_LIMIT }
    );
    const dbSummary = `[${responses.join().replace(/\[|\]/g, '')}]`;
    // this type of formatting is done because the responses are in array of strings I am concatinating into 1 string by removing '[' and ']' and appending them again to start and end for proper json formatting
    const cleanDBSummanry = sqlResponseParsing(dbSummary);

    return { databases: cleanDBSummanry };
}

async function getAllResourceUtilisationDetails(
    credentialsId: string,
    region: string,
    activeNodeInstanceId?: string,
    instanceName?: string
) {
    logger.info('Get system resources utilization for resource:', {
        credentialsId,
        region,
        activeNodeInstanceId,
        instanceName
    });

    if (!activeNodeInstanceId || !instanceName) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get active instance information');
    }
    logger.info('Fetching resources utilization from primary', credentialsId, region, activeNodeInstanceId);

    const commands = [RESOURCE_UTILIZATION(instanceName)];
    const resurceUtilizationData = await callSsmExecution(
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        undefined,
        false
    );
    const parsedResourceUtilizationData = resurceUtilizationData ? sqlResponseParsing(resurceUtilizationData) : '';

    const cpuUtilization = sqlResponseParsing(parsedResourceUtilizationData.cpu)[0];
    const [dbSizeData] = sqlResponseParsing(parsedResourceUtilizationData.dbSize);
    const [diskData] = sqlResponseParsing(parsedResourceUtilizationData.disk);
    const memoryUtilization = sqlResponseParsing(parsedResourceUtilizationData.memory)[0];

    let diskError = '';
    if (isEmpty(dbSizeData) || isEmpty(diskData)) {
        diskError = `Disk utilisation data is empty for instance ${activeNodeInstanceId}. Disk utilisation data is empty for instance.`;
        logger.error(diskError);
    }

    const diskUtilization: UtilisationResponseBodyInterface = {
        used: dbSizeData?.TotalSize?.toString() || '0',
        total: diskData?.total?.toString() || '0',
        remaining: (Number(diskData.total) - dbSizeData.TotalSize).toString(),
        percentUsed: Math.round((dbSizeData.TotalSize * 100) / Number(diskData.total)).toString(),
        error: diskError
    };

    return { cpuUtilization, diskUtilization, memoryUtilization };
}

async function getAllResourceUtilisation(resourceId: string, metricType?: string) {
    logger.info('Get system resources utilization for resource: ', {
        resourceId,
        metricType
    });

    const [credentialsId, region, node1InstanceId, node2InstanceId] = await getResourceDetails(resourceId);
    if (!credentialsId || !region || !node1InstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get resource utilisation information');
    }
    const { activeNodeInstanceId, instanceName } = await getActiveSqlNode(
        credentialsId!,
        region!,
        node1InstanceId,
        node2InstanceId!
    );
    return getAllResourceUtilisationDetails(credentialsId, region, activeNodeInstanceId, instanceName);
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
    logger.info(`Get ${metricType} resource utilization for resource: `, {
        resourceId,
        metricType
    });

    const [credentialsId, region, node1InstanceId, node2InstanceId] = await getResourceDetails(resourceId);
    if (!credentialsId || !region || !node1InstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get resource utilisation information');
    }
    const { activeNodeInstanceId, instanceName } = await getActiveSqlNode(
        credentialsId!,
        region!,
        node1InstanceId,
        node2InstanceId!
    );

    return getResourceUtilisationDetails(credentialsId, region, metricType, activeNodeInstanceId!, instanceName);
}

async function getResourceUtilisationDetails(
    credentialsId: string,
    region: string,
    metricType: string,
    activeNodeInstanceId: string,
    instanceName: string = '.'
) {
    logger.info(`Get ${metricType} resource utilization for resource: `, {
        credentialsId,
        region,
        metricType,
        activeNodeInstanceId
    });

    if (!activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get active instance information');
    }
    logger.info('Fetching utilization from primary', credentialsId, region, activeNodeInstanceId, metricType);

    let commands: string[] = [];
    const metricQuery = resourceUtilisationQuery(metricType);
    commands = [`sqlcmd -S "${instanceName}" -Q "${metricQuery}" -y 0`];

    if (metricType === DATABASE_METRIC_TYPE.DISK) {
        const dbSizecommand = [`sqlcmd -S "${instanceName}" -Q "${DB_SIZE}" -y 0`];
        const diskUtilizationCommand = [`sqlcmd -S "${instanceName}" -Q "${DISK_UTILISATION}" -y 0`];

        const [diskdata, size] = await Promise.all([
            callSsmExecution(credentialsId, region, diskUtilizationCommand, activeNodeInstanceId, undefined, false),
            callSsmExecution(credentialsId, region, dbSizecommand, activeNodeInstanceId, undefined, false)
        ]);

        const [sizeValue] = size ? sqlResponseParsing(size) : [];
        const [diskDataValue] = diskdata ? sqlResponseParsing(diskdata) : [];

        let diskError = '';
        if (isEmpty(diskDataValue) || isEmpty(sizeValue)) {
            diskError = `Disk utilisation data is empty for instance ${activeNodeInstanceId}. Reason could be no access to sys.master_files.`;
            logger.error(diskError);
        }
        const diskUtilization: UtilisationResponseBodyInterface = {
            used: sizeValue?.TotalSize?.toString() || '0',
            total: diskDataValue?.total?.toString() || '0',
            remaining: (Number(diskDataValue.total) - sizeValue.TotalSize).toString(),
            percentUsed: Math.round((sizeValue.TotalSize * 100) / Number(diskDataValue.total)).toString(),
            error: diskError
        };
        return diskUtilization;
    }

    try {
        const response = await callSsmExecution(
            credentialsId,
            region,
            commands,
            activeNodeInstanceId,
            undefined,
            false
        );
        logger.debug('Utilization response', metricType, response);
        if (!response) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                ` ${metricType} utilization data response is empty.`
            );
        }
        return sqlResponseParsing(response)[0];
    } catch (error) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching ${metricType} utilization: ${activeNodeInstanceId}. Error: ${error}`
        );
    }
}

async function getTablesCount(
    credentialsId: string,
    region: string,
    databaseName: string,
    activeNodeInstanceId: string
) {
    logger.info('Fetching tables total count ', credentialsId, region, activeNodeInstanceId, databaseName);

    const commands = [`${PSSCRIPT} -Database ${databaseName} -Query "${TABLES_COUNT_QUERY}"`];
    const response = await callSsmExecution(credentialsId, region, commands, activeNodeInstanceId);
    logger.debug('Fetching tables count response', response);
    if (response) {
        return sqlResponseParsing(response)[0];
    }
}

async function getTablesSummary(resourceId: string, databaseName: string) {
    logger.info('Get tables list for resource:', resourceId, databaseName);
    const [credentialsId, region, node1InstanceId, node2InstanceId] = await getResourceDetails(resourceId);

    const { activeNodeInstanceId } = await getActiveSqlNode(
        credentialsId!,
        region!,
        node1InstanceId!,
        node2InstanceId!
    );

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get tables summary');
    }

    const { totalCount: tablesCount = 0 } =
        (await getTablesCount(credentialsId, region, databaseName, activeNodeInstanceId!)) || {};

    const batchCount = Math.ceil(tablesCount / DB_ROWS_COUNT);

    const batchQueries: string[] = [];
    for (let i = 0, offset = 0; i < batchCount; i++) {
        batchQueries.push(`${PSSCRIPT} -Database ${databaseName} -Query "${TABLES_QUERY(offset, DB_ROWS_COUNT)}"`);
        offset += DB_ROWS_COUNT;
    }

    const responses = await Promise.map(
        batchQueries,
        async query => callSsmExecution(credentialsId, region, [query], activeNodeInstanceId!),
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

    const [credentialsId, region, node1InstanceId, node2InstanceId] = await getResourceDetails(resourceId);

    const { activeNodeInstanceId, instanceName } = await getActiveSqlNode(
        credentialsId!,
        region!,
        node1InstanceId!,
        node2InstanceId!
    );
    if (credentialsId && region && activeNodeInstanceId) {
        const response = await getServerDetails(credentialsId, region, activeNodeInstanceId, instanceName);
        return {
            ...response,
            serverId: resourceId
        };
    }
}
async function getServerDetails(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instanceName: string = '.'
) {
    logger.info('Get details of SQL Server database:', { credentialsId, region, activeNodeInstanceId });

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get server summary');
    }

    const command = [`sqlcmd -S "${instanceName}" -Q "${SERVER_DETAILS}" -y 0`];
    const serverAllDetails = await callSsmExecution(credentialsId, region, command, activeNodeInstanceId);

    let [
        {
            serverDetails,
            ServerEdition,
            isClustered,
            activeNode,
            clusterName,
            numberOfConnections,
            clusterNodesInfo,
            totalCount,
            ServerCollation
        }
    ] = serverAllDetails ? sqlResponseParsing(serverAllDetails) : '';
    const serverInfo = serverDetails ? serverDetails?.replaceAll('\r\n', '').split('\t') : '';
    const activeConnections = numberOfConnections;
    const serverStatus = serverInfo ? ServerState.UP : ServerState.DOWN;

    let standbyNode: string = '';
    if (isClustered && clusterNodesInfo) {
        const [node1, node2] = clusterNodesInfo;

        if (node1?.is_current_owner) {
            activeNode = node1?.NodeName;
            standbyNode = node2?.NodeName;
        } else {
            activeNode = node2?.NodeName;
            standbyNode = node1?.NodeName;
        }
    }

    return {
        serverVersion: serverInfo[0].substring(0, serverInfo[0].indexOf('(')).trim(),
        serverEdition: `SQL Server ${ServerEdition?.split(':')?.[0] || 'Standard Edition'}`,
        serverEngine: '', // sending empty string to support blueXP endpoint
        serverStatus,
        activeConnections,
        deploymentModel: isClustered ? SqlServerDeploymentModel.SQL_FCI : SqlServerDeploymentModel.SQL_STANDALONE,
        activeNode,
        ...(isClustered ? { standbyNode, clusterName } : {}),
        operatingSystem: serverDetails.match('Windows Server \\d+')?.[0] || '',
        nodeNames: standbyNode ? [activeNode!, standbyNode!] : [activeNode!],
        dbCount: totalCount,
        collation: ServerCollation
    };
}

async function getSqlServerDetails(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    accountId?: string
) {
    logger.info('Getting SQL server details', { credentialsId, region, activeNodeInstanceId });

    const [resourceIdentifier, name] = await Promise.all([
        callSsmExecution(
            credentialsId,
            region,
            [`${PSSCRIPT} -Query "${SERVER_GUID}"`],
            activeNodeInstanceId,
            accountId
        ),
        callSsmExecution(
            credentialsId,
            region,
            [`${PSSCRIPT} -Query "${SERVER_NAME}"`],
            activeNodeInstanceId,
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

function getMsSqlResourceId(node1InstanceId: string, node2InstanceId?: string) {
    logger.info('Get MS SQL resource ID:', { node1InstanceId, node2InstanceId });
    return node2InstanceId ? generateHash(node1InstanceId + node2InstanceId) : generateHash(node1InstanceId);
}

async function discoverMsSqlServer(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceType: string,
    storageType: STORAGE_TYPE,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string,
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
    const {
        items: [resourceDetails]
    } = await getResources(accountId, resourceId);

    if (!isEmpty(resourceDetails)) {
        throw createError(409, 'MSSQL server already exists in your tenancy account');
    }
    await createResource(accountId, {
        resourceId,
        resourceName,
        credentialsId,
        storageType,
        cloudProviderName: CloudProviders.AWS,
        resourceType,
        coRelationId: fsxId,
        region,
        metadata: {
            node1InstanceId: activeNodeInstanceId,
            node2InstanceId: standbyNodeInstanceId
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

async function getServerIOLatency(resourceId: string, activeNodeInstanceId: string) {
    logger.info('Fetch SQL server IO latency for resource', { resourceId, activeNodeInstanceId });

    const [credentialsId, region] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
    }

    const commands = [`${PSSCRIPT} -Query "${SERVER_IO_LATENCY}"`];
    const response = await callSsmExecution(credentialsId, region, commands, activeNodeInstanceId, undefined, false);

    logger.debug('SQL server IO latency response', response);

    if (response) {
        return sqlResponseParsing(response)[0];
    }
}

async function getActiveSqlInstanceName(credentialsId: string, region: string, nodeIds: string[]) {
    logger.info('Fetch active MSSQL instance Name', { credentialsId, region });

    const commands = [INSTANCE_DETAILS];
    try {
        for (const nodeId of nodeIds) {
            const response = await callSsmExecution(credentialsId, region, commands, nodeId);
            if (response) {
                const parsedResponse = sqlResponseParsing(response);

                const instanceDetails = Array.isArray(parsedResponse) ? parsedResponse : [parsedResponse];
                let defaultInstance = true;
                let selectedInstance = instanceDetails.find(
                    (instance: { instanceState: string; instanceName: string | string[] }) =>
                        instance.instanceState.toLocaleLowerCase() === 'running' && !instance.instanceName.includes('$') // there is a $ present in named instances
                )?.instanceName;

                if (!selectedInstance) {
                    const runningServices = instanceDetails.filter(
                        (instance: { instanceState: string }) =>
                            instance.instanceState.toLocaleLowerCase() === 'running'
                    );
                    selectedInstance = runningServices.length > 0 ? runningServices[0].Name : undefined;
                    defaultInstance = false;
                }
                if (selectedInstance !== undefined) {
                    const instanceName = defaultInstance
                        ? '.'
                        : `$env:computername\\${selectedInstance.replace('MSSQL$', '')}`;
                    return instanceName;
                }

                return selectedInstance;
            }
        }
    } catch (error) {
        logger.error(`Error while fetching SQL node status for node ${nodeIds}`, { error });
    }
}

async function getAllInstanceDetails(credentialsId: string, region: string, nodeIds: string[]) {
    logger.info('Fetch all MSSQL instance details', { credentialsId, region });
    const commands = [INSTANCE_DETAILS];
    try {
        for (const nodeId of nodeIds) {
            const response = await callSsmExecution(credentialsId, region, commands, nodeId);
            if (response) {
                const parsedResponse = sqlResponseParsing(response);
                return parsedResponse;
            }
        }
    } catch (error) {
        logger.error(`Error while fetching SQL node status for node ${nodeIds}`, { error });
    }
}

// TODO: remove if this is not being used

async function getServerState(resourceId: string) {
    logger.info('Fetch SQL server state for resource', resourceId);

    const [credentialsId, region, node1InstanceId, node2InstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region || !node1InstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
    }

    const { activeNodeInstanceId } = await getActiveSqlNode(credentialsId!, region!, node1InstanceId, node2InstanceId!);

    const commands = [`${PSSCRIPT} -Query "${SERVER_STATE}"`];
    const response = await callSsmExecution(credentialsId, region, commands, activeNodeInstanceId!);

    logger.debug('SQL server state response', response);

    return response!.replace(/[\r\n.]/g, '');
}

async function getNativeSQLProtection(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instanceName: string = '.'
) {
    logger.info('Fetch SQL native protection status', { credentialsId, region, activeNodeInstanceId });

    try {
        if (!credentialsId || !region || !activeNodeInstanceId) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
        }
        const response = await callSsmExecution(
            credentialsId,
            region,
            [`sqlcmd -S "${instanceName}" -Q "${NATIVE_SQL_BACKUPS}" -y 0`],
            activeNodeInstanceId
        );

        const cleanedResponse = response?.replaceAll('\r\n', '');
        const parsedResponse = attempt(JSON.parse, cleanedResponse);

        logger.debug('SQL native protection status', parsedResponse);
        return parsedResponse instanceof Error ? undefined : parsedResponse[0].backupCount;
    } catch (err) {
        logger.error('Error getting SQL native protection status', { err });
    }
}

async function getPerformanceMetrics(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instanceName: string = '.'
) {
    logger.info('Fetch SQL server performance metrics (assessment, latency, IOPS, throughput) for resource', {
        credentialsId,
        region,
        activeNodeInstanceId
    });

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
    }

    const commands = [`sqlcmd -S "${instanceName}" -Q "${PERFORMANCE_METRICS_WITH_LATENCY}" -y 0`];
    const response = await callSsmExecution(credentialsId, region, commands, activeNodeInstanceId, undefined, false);

    logger.debug('SQL server performance metrics (latency, IOPS, throughput) response', response);

    if (response) {
        const parsedResponse = sqlResponseParsing(response)[0];
        logger.info(parsedResponse);
        return {
            assessment: parsedResponse.assessment,
            latency: {
                read: parsedResponse.READ_LATENCY,
                write: parsedResponse.WRITE_LATENCY,
                serverIo: parsedResponse.SERVER_IO_LATENCY
            },
            iops: { read: parsedResponse.READ_IOPS, write: parsedResponse.WRITE_IOPS },
            throughput: { read: parsedResponse.READ_THROUGHPUT, write: parsedResponse.WRITE_THROUGHPUT }
        };
    }
}

async function getNativeSQLBackedupDatabases(resourceId: string, activeNodeInstanceId?: string, instanceName?: string) {
    logger.info('Fetch SQL native protection status', { resourceId });

    try {
        const [credentialsId, region] = await getResourceDetails(resourceId);

        if (!credentialsId || !region || !activeNodeInstanceId) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
        }

        const response = await callSsmExecution(
            credentialsId,
            region,
            [`sqlcmd -S "${instanceName}" -Q "${SQL_BACKUPS}" -y 0`],
            activeNodeInstanceId
        );

        const cleanedResponse = response?.replaceAll('\r\n', '');
        const parsedResponse = attempt(JSON.parse, cleanedResponse);

        logger.debug('SQL native protection status', parsedResponse);
        return parsedResponse instanceof Error ? undefined : parsedResponse;
    } catch (err) {
        logger.error('Error getting SQL native protection status', { err });
    }
}

async function getActiveSqlNode(
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    node2InstanceId?: string,
    resourceId?: string
) {
    logger.info('Getting active SQL node', {
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId,
        resourceId
    });
    try {
        let connectionStatus = await getSSMConnectionStatus(credentialsId, region!, node1InstanceId);
        const resourceError = `Resource ID ${resourceId}`;
        let errorMessage = '';
        // Connection to activenode is successful
        if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
            const instanceName = await getActiveSqlInstanceName(credentialsId, region, [node1InstanceId]);
            if (instanceName) {
                return {
                    isSSMConnected: true,
                    activeNodeInstanceId: node1InstanceId,
                    standbyNodeInstanceId: node2InstanceId,
                    instanceName,
                    ssmConnectionSatus: connectionStatus.Status
                };
            }
        } else {
            errorMessage = `SSM connection to node or SQL server status check for ${node1InstanceId} has failed.`;
            errorMessage = resourceId ? errorMessage.concat(resourceError) : errorMessage;
            logger.error(errorMessage, { connectionStatus });
        }

        // Check for connection to standby node
        if (node2InstanceId) {
            connectionStatus = await getSSMConnectionStatus(credentialsId, region!, node2InstanceId);
            if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
                const instanceName = await getActiveSqlInstanceName(credentialsId, region, [node2InstanceId]);
                if (instanceName) {
                    return {
                        isSSMConnected: true,
                        activeNodeInstanceId: node2InstanceId,
                        standbyNodeInstanceId: node1InstanceId,
                        instanceName,
                        ssmConnectionSatus: connectionStatus.Status
                    };
                }
            }
        }

        errorMessage = `SSM connection to nodes and SQL server status check for nodes ${node1InstanceId} ${
            node2InstanceId ? `and ${node1InstanceId}` : ''
        } has failed.`;
        errorMessage = resourceId ? errorMessage.concat(resourceError) : errorMessage;
        logger.error(errorMessage, { connectionStatus });

        return { isSSMConnected: false, ssmConnectionSatus: connectionStatus.Status };
    } catch (error) {
        logger.error(
            `Error while checking SSM connection or SQL server status for resource ID ${resourceId}`,
            { credentialsId, region, node1InstanceId, node2InstanceId },
            error
        );
    }

    return { isSSMConnected: false };
}

async function checkDatabaseExists(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseName: string,
    activeNodeInstanceId: string,
    instanceName: string = '.'
) {
    logger.info('Checking Database name exists', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseName,
        activeNodeInstanceId
    });

    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        const { userDatabase } = ((await listResources(accountId, databaseHostId, credentialsId))[0]?.metadata || {
            userDatabase: undefined
        }) as { userDatabase: any[] };
        return userDatabase?.some(db => db.name === databaseName) ?? false;
    }
    const command = [`sqlcmd -S "${instanceName}" -Q "${DATABASE_NAME_EXISTS(databaseName)}" -y 0`];

    try {
        const checkDatabaseExistsResponse = await callSsmExecution(
            credentialsId,
            region,
            command,
            activeNodeInstanceId,
            accountId,
            false
        );

        logger.debug('checking database name exists done', checkDatabaseExistsResponse);

        const parsedDatabaseExistsResponse = checkDatabaseExistsResponse
            ? sqlResponseParsing(checkDatabaseExistsResponse)
            : {};

        if (parsedDatabaseExistsResponse && parsedDatabaseExistsResponse.length) {
            return true;
        }
        return false;
    } catch (err) {
        const errorMessage = `Checking if database ${databaseName} exists on host ${databaseHostId} failed : ${err}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getSqlServerVersion(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instanceName: string = '.'
) {
    logger.info('Get SQL server version:', { credentialsId, region, activeNodeInstanceId, instanceName });
    const command = [`sqlcmd -S "${instanceName}"-Q "SELECT @@VERSION" -y 0`];
    const sqlServerVersionResponse = await callSsmExecution(credentialsId, region, command, activeNodeInstanceId);
    const serverInfo = sqlServerVersionResponse ? sqlServerVersionResponse?.replaceAll('\r\n', '').split('\t') : ''; // const sqlServerVersion: parsedSqlSeverVersionResponse[0].substring(0, serverInfo[0].indexOf('(')).trim(),
    const sqlServerVersion = serverInfo[0].substring(0, serverInfo[0].indexOf('(')).trim();

    return sqlServerVersion;
}

async function getMssqlInstanceGuid(credentialsId: string, region: string, instanceName: string, nodeIds: string[]) {
    logger.info('Fetching mssql instance id', nodeIds, instanceName);
    const commands = [`sqlcmd -S "${instanceName}" -Q "${INSTANCE_GUID}" -y 0`];
    let response;
    try {
        let sqlInstanceGuid;

        for (const nodeId of nodeIds) {
            logger.info('Fetching MSSQL instance GUID', nodeId);
            response = await callSsmExecution(credentialsId, region, commands, nodeId);
            if (response) {
                [{ instance_guid: sqlInstanceGuid }] = sqlResponseParsing(response);

                return sqlInstanceGuid;
            }
        }

        if (!sqlInstanceGuid) {
            const errorMessage = `Error fetching instance id from nodes: ${nodeIds.join(', ')}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }
    } catch (err) {
        const errorMessage = `Error fetching mssql instance id:,
            ${err},
            ${credentialsId},
            ${region},
            ${instanceName},`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

export {
    getSqlServerDetails,
    getAllResourceUtilisation,
    getAllResourceUtilisationDetails,
    getResourceUtilisation,
    getResourceUtilisationDetails,
    getDataBasesSummary,
    getServerSummary,
    getServerDetails,
    getResourceDetails,
    getDatabasesCount,
    getTablesSummary,
    discoverMsSqlServer,
    getTablesCount,
    getMsSqlResourceId,
    deleteResourceById,
    getServerIOLatency,
    getServerState,
    getNativeSQLProtection,
    getPerformanceMetrics,
    getNativeSQLBackedupDatabases,
    getActiveSqlNode,
    checkDatabaseExists,
    getSqlServerVersion,
    getMssqlInstanceGuid,
    getActiveSqlInstanceName,
    getAllInstanceDetails
};
