import throat from 'throat';
import createError from 'http-errors';
import { attempt, compact, isEmpty } from 'lodash-es';
import { STORAGE_TYPE } from '@prisma/client';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { PSSCRIPT, DB_ROWS_COUNT, SSM_QUERY_CONCURRENCY_LIMIT } from './const';
import {
    DATABASES,
    SERVER_NAME,
    SERVER_GUID,
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
    INSTANCE_GUID,
    DATABASES_COUNT_V2,
    SERVER_VERSION,
    SERVER_VERSION_EDITION_DETAILS
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
    ServerState,
    DATABASE_METRIC_TYPE,
    DEFAULT_MSSQL_INSTANCE_NAME,
    SQL_SERVICE_STATE,
    SSM_PARAM_PREFIX,
    AWS_SSM_PARAMETER,
    DEFAULT_INSTANCE_NAME
} from '../../../utils/consts';
import { getAsyncLocalStorageResource } from '../../../utils/async-local-storage';
import { createResource, deleteResource, listRelationshipsResources, listResources } from '../../../lib/database/db';
import {
    getDatabaseInstanceName,
    sqlResponseParsing,
    getOriginalDatabaseInstanceName,
    generateSqlResourceId,
    parseMultipleCommandResponse,
    IS_DEMO_FLOW
} from '../../../utils/utils';
import { associateResource } from '../../../lib/cloud-manager/credentials';
import { getPaginatedDatabaseInstances, getResources } from '../../database/database-operations';
import {
    DatabaseInstance,
    Metadata,
    ResourceDetails,
    InstanceDetails,
    VolumeSpaceRecord
} from '../../../utils/common-types';
import {
    GET_CLUSTER_NAME,
    GET_FQDN,
    GET_NODE_IP_ADDRESS,
    getMappedOntapVolumesScript,
    INSTANCE_DETAILS,
    RESOURCE_UTILIZATION,
    sqlQueryExecution,
    sqlQueryExecutionWithAuth
} from './ssm-script-utils';
import { getParameter } from '../../../lib/aws/ssm';
import { hasCache, readFromCacheByKey, writeToCache } from '../../../utils/cache';
import { getPgSqlInstanceDetails } from '../pgsql/pgsql-operations';
import { getOracleInstanceDetails } from '../oracle/oracle-operations';
import { SQL_SERVER_VERSION_TO_YEAR } from './discover-consts';

const logger = getLogger();

type activeSqlNodeParams = {
    node1InstanceId: string;
    node2InstanceId?: string;
    resourceId?: string;
    accountId?: string;
    resourceType?: DatabaseTypes;
    sqlDeploymentType?: SqlServerDeploymentModel;
};

async function getResourceDetails(resourceId: string) {
    logger.info('Gettng resource details of resource', resourceId);

    const accountId = getAsyncLocalStorageResource<string>(ACCOUNT_ID);
    let metadata;
    let region;
    let credentialsId;
    try {
        ({
            items: [{ credentials_id: credentialsId, metadata, region }]
        } = await getResources({ accountId, resourceId, resourceType: DatabaseTypes.MS_SQL_SERVER }));
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
    instanceNames: string[] = [],
    isSqlAuthEnabled: boolean = false
) {
    logger.info('Fetching databases total count ', credentialsId, region, activeNodeInstanceId, isSqlAuthEnabled);

    const commands = [sqlQueryExecutionWithAuth(instanceNames, DATABASES_COUNT_V2, isSqlAuthEnabled)];

    const response = await callSsmExecution({
        credentialsId,
        region,
        commands,
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get databases count',
        cacheData: true
    });
    logger.debug('Fetching databases count response', response);
    let parsedResponse = response ? sqlResponseParsing(response) : {};

    if (IS_DEMO_FLOW) {
        parsedResponse = instanceNames.reduce((result: { [key: string]: any }, name) => {
            result[name] = parsedResponse.MSSQLSERVER;
            return result;
        }, {});
    }

    return parsedResponse;
}

async function getDataBasesSummary(
    resourceId: string,
    activeNodeInstanceId?: string,
    sqlAuthEnabled = false,
    accountId?: string,
    credentialsId?: string,
    databaseInstances?: string[]
) {
    logger.info(
        'Get databases summary for resource:',
        resourceId,
        sqlAuthEnabled,
        accountId,
        databaseInstances?.length
    );

    const [resourceDetail] = await listResources({
        accountId,
        resourceId,
        credentialIds: credentialsId,
        includeDatabaseInstances: true
    });
    if (!resourceDetail) {
        throw createError(HttpErrorCodes.NOT_FOUND, `Resource not found for resource id: ${resourceId}`);
    }

    const { region, metadata } = resourceDetail;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
    if (!activeNodeInstanceId && credentialsId && region) {
        let instanceName;
        ({ activeNodeInstanceId, instanceName } = await getActiveSqlNode(credentialsId, region, {
            node1InstanceId,
            node2InstanceId
        }));

        databaseInstances = [instanceName];
    }

    if (!activeNodeInstanceId || !databaseInstances) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get active instance information');
    }

    try {
        sqlAuthEnabled = IS_DEMO_FLOW ? false : sqlAuthEnabled;

        // Changing the logic, as ssm response compression would take care of long responses.
        if (IS_DEMO_FLOW) {
            databaseInstances = [DEFAULT_INSTANCE_NAME];
        }
        const commands = sqlQueryExecutionWithAuth(databaseInstances, DATABASES, sqlAuthEnabled);
        const dbSummary = await callSsmExecution({
            credentialsId: credentialsId!,
            region,
            commands: [commands],
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Get databases summary on node',
            cacheData: true,
            shouldReadFromCloudWatchLogs: true
        });
        const cleanDBSummanry = sqlResponseParsing(dbSummary);
        return { databases: cleanDBSummanry };
    } catch (error: any) {
        logger.error('Failed to get databases summary', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Failed to get databases summary. ${error?.message}`);
    }
}

async function getAllResourceUtilisationDetails(
    credentialsId: string,
    region: string,
    activeNodeInstanceId?: string,
    instanceNames: string[] = [],
    isSqlAuthEnabled: boolean = false
) {
    logger.info('Get system resources utilization for resource:', {
        credentialsId,
        region,
        activeNodeInstanceId,
        isSqlAuthEnabled
    });

    if (!activeNodeInstanceId || isEmpty(instanceNames)) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get active instance information');
    }
    logger.info('Fetching resources utilization from primary', credentialsId, region, activeNodeInstanceId);
    const updatedInstanceNames = IS_DEMO_FLOW ? [DEFAULT_INSTANCE_NAME] : instanceNames;
    const commands = [RESOURCE_UTILIZATION(updatedInstanceNames, isSqlAuthEnabled)];
    const resourceUtilizationData = await callSsmExecution({
        credentialsId,
        region,
        commands,
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get resource utilization for MSSQL instances',
        cacheData: true,
        shouldReadFromCloudWatchLogs: true
    });
    const parsedResourceUtilizationData = resourceUtilizationData ? sqlResponseParsing(resourceUtilizationData) : {};

    const instancesResponse: { [key: string]: any } = {};

    instanceNames.forEach(iName => {
        const originalDatabaseInstanceName = iName;
        iName = IS_DEMO_FLOW ? DEFAULT_INSTANCE_NAME : iName;

        if (
            parsedResourceUtilizationData?.[iName] &&
            !(
                typeof parsedResourceUtilizationData?.[iName] === 'string' &&
                parsedResourceUtilizationData?.[iName].includes('error')
            )
        ) {
            const [cpuUtilization] = sqlResponseParsing(parsedResourceUtilizationData?.[iName]?.cpu) ?? [];
            const [dbSizeData] = sqlResponseParsing(parsedResourceUtilizationData?.[iName]?.dbSize) ?? [];
            const [diskData] = sqlResponseParsing(parsedResourceUtilizationData?.[iName]?.disk) ?? [];
            const [memoryUtilization] = sqlResponseParsing(parsedResourceUtilizationData?.[iName]?.memory) ?? [];

            let diskError = '';
            if (isEmpty(dbSizeData) || isEmpty(diskData)) {
                diskError = `Disk utilisation data is empty for instance ${activeNodeInstanceId}. Disk utilisation data is empty for instance.`;
                logger.error(diskError);
            }

            const diskUtilization: UtilisationResponseBodyInterface = {
                used: dbSizeData?.TotalSize?.toString() || '0',
                total: diskData?.total?.toString() || '0',
                remaining: Number.isNaN(Number(diskData.total) - dbSizeData.TotalSize)
                    ? '0'
                    : (Number(diskData.total) - dbSizeData.TotalSize).toString(),
                percentUsed: Number.isNaN(Math.round((dbSizeData.TotalSize * 100) / Number(diskData.total)))
                    ? '0'
                    : Math.round((dbSizeData.TotalSize * 100) / Number(diskData.total)).toString(),
                error: diskError
            };

            instancesResponse[originalDatabaseInstanceName] = { cpuUtilization, diskUtilization, memoryUtilization };
        }
    });

    return instancesResponse;
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
    const { activeNodeInstanceId, instanceName } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId: node2InstanceId ?? ''
    });

    const sqlServerInstanceName = getOriginalDatabaseInstanceName(instanceName);
    const { [sqlServerInstanceName]: response } = await getAllResourceUtilisationDetails(
        credentialsId,
        region,
        activeNodeInstanceId,
        [sqlServerInstanceName]
    );
    return response;
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
    const { activeNodeInstanceId, instanceName } = await getActiveSqlNode(credentialsId!, region, {
        node1InstanceId,
        node2InstanceId: node2InstanceId ?? ''
    });

    return getResourceUtilisationDetails(credentialsId, region, metricType, activeNodeInstanceId!, instanceName);
}

async function getResourceUtilisationDetails(
    credentialsId: string,
    region: string,
    metricType: string,
    activeNodeInstanceId: string,
    instanceName: string = DEFAULT_MSSQL_INSTANCE_NAME
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
            callSsmExecution({
                credentialsId,
                region,
                commands: diskUtilizationCommand,
                ec2InstanceId: activeNodeInstanceId,
                comment: 'Get disk utilization for MSSQL instance'
            }),
            callSsmExecution({
                credentialsId,
                region,
                commands: dbSizecommand,
                ec2InstanceId: activeNodeInstanceId,
                comment: 'Get database size for MSSQL instance'
            })
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
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands,
            ec2InstanceId: activeNodeInstanceId,
            comment: 'GET MSSQL CPU utilization metrics'
        });
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
    const response = await callSsmExecution({
        credentialsId,
        region,
        commands,
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get tables count'
    });
    logger.debug('Fetching tables count response', response);
    if (response) {
        return sqlResponseParsing(response)[0];
    }
}

async function getTablesSummary(resourceId: string, databaseName: string) {
    logger.info('Get tables list for resource:', resourceId, databaseName);
    const [credentialsId, region, node1InstanceId, node2InstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Failed to get tables summary, invalid credentials or region'
        );
    }

    const { activeNodeInstanceId } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId: node1InstanceId ?? '',
        node2InstanceId: node2InstanceId ?? ''
    });

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

    const responses = await Promise.all(
        batchQueries.map(
            throat(SSM_QUERY_CONCURRENCY_LIMIT, async (query: string) =>
                callSsmExecution({
                    credentialsId,
                    region,
                    commands: [query],
                    ec2InstanceId: activeNodeInstanceId!,
                    comment: 'Get database tables summary'
                })
            )
        )
    );
    const tablesList = `[${responses.join().replace(/\[|\]/g, '')}]`;
    // this type of formatting is done because the responses are in an array of strings I am concatenating into 1 string by removing '[' and ']' and appending them again to start and end for proper JSON formatting

    const cleanResponses = sqlResponseParsing(tablesList);
    for (const record of cleanResponses) {
        record.databaseName = databaseName;
    }
    return { tables: cleanResponses };
}

async function getServerSummary(resourceId: string) {
    logger.info('Get details of SQL Server database:', { resourceId });

    const [credentialsId, region, node1InstanceId, node2InstanceId] = await getResourceDetails(resourceId);

    if (!credentialsId || !region) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Failed to get tables summary, invalid credentials or region'
        );
    }

    const { activeNodeInstanceId, instanceName } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId: node1InstanceId ?? '',
        node2InstanceId: node2InstanceId ?? ''
    });
    if (credentialsId && region && activeNodeInstanceId) {
        const sqlServerInstanceName = getOriginalDatabaseInstanceName(instanceName);
        const { [sqlServerInstanceName]: response } = await getServerDetails(
            credentialsId,
            region,
            activeNodeInstanceId,
            [sqlServerInstanceName]
        );
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
    instanceNames: string[] = [],
    isSqlAuthEnabled: boolean = false
) {
    logger.info('Get details of SQL Server database:', {
        credentialsId,
        region,
        activeNodeInstanceId,
        isSqlAuthEnabled
    });

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get server summary');
    }
    const updatedInstanceNames = IS_DEMO_FLOW ? [DEFAULT_INSTANCE_NAME] : instanceNames;
    const command = [sqlQueryExecutionWithAuth(updatedInstanceNames, SERVER_DETAILS, isSqlAuthEnabled)];
    const serverAllDetails = await callSsmExecution({
        credentialsId,
        region,
        commands: command,
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get MSSQL server details',
        cacheData: true,
        shouldReadFromCloudWatchLogs: true
    });

    const instancesResponse: { [key: string]: any } = {};
    const parsedResponse = serverAllDetails ? sqlResponseParsing(serverAllDetails) : {};

    instanceNames.forEach((iname: any) => {
        const instanceParsedResponse = IS_DEMO_FLOW ? parsedResponse[DEFAULT_INSTANCE_NAME] : parsedResponse[iname];
        if (
            instanceParsedResponse &&
            !(typeof instanceParsedResponse === 'string' && instanceParsedResponse.includes('error'))
        ) {
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
            ] = instanceParsedResponse || [{}];
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

            instancesResponse[iname] = {
                serverVersion: serverInfo[0].substring(0, serverInfo[0].indexOf('(')).trim(),
                serverEdition: `SQL Server ${ServerEdition?.split(':')?.[0] || 'Standard Edition'}`,
                serverEngine: '', // sending empty string to support blueXP endpoint
                serverStatus,
                activeConnections,
                deploymentModel: isClustered
                    ? SqlServerDeploymentModel.SQL_FCI
                    : SqlServerDeploymentModel.SQL_STANDALONE,
                activeNode,
                ...(isClustered ? { standbyNode, clusterName } : {}),
                operatingSystem: serverDetails.match('Windows Server \\d+')?.[0] || '',
                nodeNames: standbyNode ? [activeNode!, standbyNode!] : [activeNode!],
                dbCount: totalCount,
                collation: ServerCollation
            };
        }
    });

    return instancesResponse;
}

async function getSqlServerDetails(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    accountId?: string
) {
    logger.info('Getting SQL server details', { credentialsId, region, activeNodeInstanceId });

    const [resourceIdentifier, name] = await Promise.all([
        callSsmExecution({
            credentialsId,
            region,
            commands: [`${PSSCRIPT} -Query "${SERVER_GUID}"`],
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Get service_broker_guid for MSSQL server instance',
            accountId,
            cacheData: true
        }),
        callSsmExecution({
            credentialsId,
            region,
            commands: [`${PSSCRIPT} -Query "${SERVER_NAME}"`],
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Get MSSQL server instance name',
            accountId,
            cacheData: true
        })
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

    const resourceId = generateSqlResourceId(activeNodeInstanceId, standbyNodeInstanceId);
    const { resourceName } = await getSqlServerDetails(
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );
    const {
        items: [resourceDetails]
    } = await getResources({ accountId, resourceId });

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

    await associateResource(credentialsId, accountId, [
        {
            id: resourceId,
            name: resourceName,
            type: resourceType
        }
    ]);

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
    const response = await callSsmExecution({
        credentialsId,
        region,
        commands,
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get MSSQL server instance IO latency'
    });

    logger.debug('SQL server IO latency response', response);

    if (response) {
        return sqlResponseParsing(response)[0];
    }
}

async function getActiveSqlInstanceName(
    credentialsId: string,
    region: string,
    { nodeIds, sqlDeploymentType }: { nodeIds: string[]; sqlDeploymentType: SqlServerDeploymentModel }
) {
    logger.info('Fetch active MSSQL instance Name', { credentialsId, region });

    const commands = [INSTANCE_DETAILS, GET_FQDN, GET_NODE_IP_ADDRESS, GET_CLUSTER_NAME];
    try {
        for await (const nodeId of nodeIds) {
            const response = await callSsmExecution({
                credentialsId,
                region,
                commands,
                ec2InstanceId: nodeId,
                comment: 'Get MSSQL instance name'
            });
            if (response) {
                const parsedResponse = parseMultipleCommandResponse(response);
                const [parsedInstancesDetails, { fqdn }, { ipAddress }, { clusterName }] = parsedResponse;
                const instancesDetails = Array.isArray(parsedInstancesDetails)
                    ? parsedInstancesDetails
                    : [parsedInstancesDetails];
                const { sql, domain } = await getSQLAuthFromSSMParameterStore(credentialsId, region, nodeId);

                let selectedInstance = instancesDetails.find(
                    (instance: InstanceDetails) =>
                        instance.instanceState === SQL_SERVICE_STATE.RUNNING && !instance.instanceName.includes('$')
                )?.instanceName;

                instancesDetails.forEach(obj => {
                    (obj as any).isDefault = !obj.instanceName.includes('$');
                    obj.instanceName = obj.instanceName.replace(/^.+\$/, '');
                    obj.sqlAuthEnabled = getSqlAuthEnabledStatus(obj.instanceName, sql, domain);
                });
                let isDefaultInstance = true;

                // Issue: DBS-6183, In case of FCI, when node2 is active, we still show the node 1 as active.
                // RCA: When the default instance is not running, we check whether there are any other instances in running state. If yes, we consider the node as active - but those instances are standalone.
                // Fix: The check mentioned RCA can happen only in case of non - FCI
                if (!selectedInstance && sqlDeploymentType !== SqlServerDeploymentModel.SQL_FCI_SHORT) {
                    const runningInstances = instancesDetails.filter(
                        ({ instanceState }: { instanceState: string }) => instanceState === SQL_SERVICE_STATE.RUNNING
                    );

                    // Select the first running instance
                    selectedInstance = runningInstances.length > 0 ? runningInstances[0].instanceName : undefined;
                    isDefaultInstance = false;
                }
                if (selectedInstance !== undefined) {
                    const instanceName = getDatabaseInstanceName(selectedInstance, isDefaultInstance);
                    return { instanceName, instancesDetails, fqdn, ipAddress, clusterName };
                }

                return { instanceName: selectedInstance, instancesDetails, fqdn, ipAddress, clusterName };
            }
        }
    } catch (error) {
        logger.error(`Error while fetching SQL node status for node ${nodeIds}`, { error });
    }
}

async function getAllInstanceDetails(credentialsId: string, region: string, nodeIds: string[], accountId?: string) {
    logger.info('Fetch all MSSQL instance details', { credentialsId, region, nodeIds });
    const commands = [INSTANCE_DETAILS];
    let instances: any = [];

    try {
        await Promise.all(
            nodeIds.map(async nodeId => {
                const response = await callSsmExecution({
                    credentialsId,
                    region,
                    commands,
                    ec2InstanceId: nodeId,
                    comment: 'Get MSSQL instance details',
                    accountId,
                    cacheData: true
                });
                if (response) {
                    let parsedResponse = sqlResponseParsing(response);
                    parsedResponse = Array.isArray(parsedResponse) ? parsedResponse : [parsedResponse];
                    instances.push(...parsedResponse);
                }
            })
        );
        instances = instances.filter((res: any) => res?.instanceState !== SQL_SERVICE_STATE.STOPPED);

        return instances;
    } catch (error) {
        logger.error(`Error while fetching SQL node status for node ${nodeIds}`, error);
        throw error;
    }
}

async function getNativeSQLProtection(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instanceNames: string[] = [],
    isSqlAuthEnabled: boolean = false
) {
    logger.info('Fetch SQL native protection status', {
        credentialsId,
        region,
        activeNodeInstanceId,
        isSqlAuthEnabled
    });

    try {
        if (!credentialsId || !region || !activeNodeInstanceId) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
        }

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [sqlQueryExecutionWithAuth(instanceNames, NATIVE_SQL_BACKUPS, isSqlAuthEnabled)],
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Get native SQL backedup databases count',
            cacheData: true
        });

        const cleanedResponse = response?.replaceAll('\r\n', '');
        const parsedResponse = attempt(JSON.parse, cleanedResponse);

        logger.debug('SQL native protection status', parsedResponse);
        return parsedResponse instanceof Error ? undefined : parsedResponse;
    } catch (err) {
        logger.error('Error getting SQL native protection status', { err });
    }
}

async function getPerformanceMetrics(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instanceNames: string[] = [],
    isSqlAuthEnabled: boolean = false
) {
    const ssmComment = 'Fetch SQL server performance metrics (assessment, latency, IOPS, throughput) for resource';
    logger.info(ssmComment, {
        credentialsId,
        region,
        activeNodeInstanceId,
        isSqlAuthEnabled
    });

    if (!credentialsId || !region || !activeNodeInstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
    }

    const commands = [sqlQueryExecutionWithAuth(instanceNames, PERFORMANCE_METRICS_WITH_LATENCY, isSqlAuthEnabled)];

    const response = await callSsmExecution({
        credentialsId,
        region,
        commands,
        ec2InstanceId: activeNodeInstanceId,
        comment: ssmComment
    });

    logger.debug('SQL server performance metrics (latency, IOPS, throughput) response', response);

    let parsedResponse = response ? sqlResponseParsing(response) : {};
    if (IS_DEMO_FLOW) {
        parsedResponse = instanceNames.reduce((result: { [key: string]: any }, name) => {
            result[name] = parsedResponse;
            return result;
        }, {});
    }
    if (response) {
        const instancesResponse: { [key: string]: any } = {};
        instanceNames.forEach(instance => {
            if (
                parsedResponse?.[instance] &&
                !(typeof parsedResponse?.[instance] === 'string' && parsedResponse?.[instance].includes('error'))
            ) {
                const [instanceParsedResponse] = parsedResponse[instance];
                instancesResponse[instance] = {
                    assessment: instanceParsedResponse.assessment,
                    latency: {
                        read: instanceParsedResponse.READ_LATENCY,
                        write: instanceParsedResponse.WRITE_LATENCY,
                        serverIo: instanceParsedResponse.SERVER_IO_LATENCY
                    },
                    iops: { read: instanceParsedResponse.READ_IOPS, write: instanceParsedResponse.WRITE_IOPS },
                    throughput: {
                        read: instanceParsedResponse.READ_THROUGHPUT,
                        write: instanceParsedResponse.WRITE_THROUGHPUT
                    }
                };
            }
        });

        return instancesResponse;
    }
}

async function getNativeSQLBackedupDatabases(
    resourceId: string,
    activeNodeInstanceId?: string,
    instanceNames: string[] = [],
    isSqlAuthEnabled: boolean = false,
    accountId?: string,
    credentialsId?: string
) {
    logger.info('Fetch SQL native protection status', { resourceId, isSqlAuthEnabled, accountId, credentialsId });

    try {
        const [resourceDetail] = await listResources({
            accountId,
            resourceId,
            credentialIds: credentialsId,
            includeDatabaseInstances: true
        });
        if (!resourceDetail) {
            throw createError(HttpErrorCodes.NOT_FOUND, `Resource not found for resource id: ${resourceId}`);
        }

        const { region } = resourceDetail;

        if (!credentialsId || !region || !activeNodeInstanceId || isEmpty(instanceNames)) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, RESOURCE_RETRIVAL_ERROR);
        }

        const commands = [sqlQueryExecutionWithAuth(instanceNames, SQL_BACKUPS, isSqlAuthEnabled)];

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands,
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Get native SQL backedup databases',
            cacheData: true
        });

        const cleanedResponse = response?.replaceAll('\r\n', '');
        let parsedResponse = attempt(JSON.parse, cleanedResponse);
        if (IS_DEMO_FLOW) {
            parsedResponse = instanceNames.reduce((result: { [key: string]: any }, name) => {
                result[name] = parsedResponse;
                return result;
            }, {});
        }

        logger.debug('SQL native protection status', parsedResponse);
        return parsedResponse instanceof Error ? undefined : parsedResponse;
    } catch (err) {
        logger.error('Error getting SQL native protection status', { err });
    }
}

interface ActiveSqlNodeDetails {
    isSSMConnected: boolean;
    activeNodeInstanceId: string;
    standbyNodeInstanceId?: string;
    instanceName: string;
    ssmConnectionStatus: string;
    instancesDetails: InstanceDetails[];
    fqdn?: string;
    ipAddress?: string;
}

async function getActiveSqlNode(
    credentialsId: string,
    region: string,
    { node1InstanceId, node2InstanceId, resourceId, accountId, resourceType, sqlDeploymentType }: activeSqlNodeParams
) {
    logger.info('Getting active SQL node', {
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId,
        resourceId,
        resourceType,
        sqlDeploymentType
    });
    try {
        let connectionStatus = await getSSMConnectionStatus(credentialsId, region!, node1InstanceId, accountId);
        const resourceError = `Resource ID ${resourceId}`;
        let errorMessage = '';
        // Connection to activenode is successful
        if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
            if (resourceType === DatabaseTypes.PG_SQL) {
                const pgSqlInstanceDetails = await getPgSqlInstanceDetails(
                    accountId!,
                    credentialsId,
                    region,
                    node1InstanceId,
                    node2InstanceId
                );
                return pgSqlInstanceDetails;
            }

            if (resourceType === DatabaseTypes.ORACLE) {
                const oracleInstanceDetails = await getOracleInstanceDetails(
                    accountId!,
                    credentialsId,
                    region,
                    node1InstanceId
                );
                return oracleInstanceDetails;
            }

            const {
                instanceName,
                instancesDetails = [],
                fqdn,
                ipAddress,
                clusterName
            } = (await getActiveSqlInstanceName(credentialsId, region, {
                nodeIds: [node1InstanceId],
                sqlDeploymentType: sqlDeploymentType as SqlServerDeploymentModel
            })) || {};
            if (instanceName) {
                return {
                    isSSMConnected: true,
                    activeNodeInstanceId: node1InstanceId,
                    standbyNodeInstanceId: node2InstanceId,
                    instanceName,
                    ssmConnectionStatus: connectionStatus.Status,
                    instancesDetails,
                    fqdn,
                    ipAddress,
                    clusterName
                };
            }
        } else {
            errorMessage = `SSM status of node ${node1InstanceId} is not running :${connectionStatus.Status}`;
            errorMessage = resourceId ? errorMessage.concat(resourceError) : errorMessage;
            logger.warn(errorMessage, { connectionStatus });
        }

        // Check for connection to standby node
        if (node2InstanceId) {
            connectionStatus = await getSSMConnectionStatus(credentialsId, region!, node2InstanceId, accountId);
            if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
                const {
                    instanceName,
                    instancesDetails = [],
                    fqdn,
                    ipAddress,
                    clusterName
                } = (await getActiveSqlInstanceName(credentialsId, region, {
                    nodeIds: [node2InstanceId],
                    sqlDeploymentType: sqlDeploymentType as SqlServerDeploymentModel
                })) || {};
                if (instanceName) {
                    return {
                        isSSMConnected: true,
                        activeNodeInstanceId: node2InstanceId,
                        standbyNodeInstanceId: node1InstanceId,
                        instanceName,
                        ssmConnectionStatus: connectionStatus.Status,
                        instancesDetails,
                        fqdn,
                        ipAddress,
                        clusterName
                    };
                }
            }
            errorMessage = `SSM connection to node and SQL server status check for node ${node2InstanceId} has failed.`;
            errorMessage = resourceId ? errorMessage.concat(resourceError) : errorMessage;
            logger.warn(errorMessage, { connectionStatus });
        }
        return { isSSMConnected: false, ssmConnectionStatus: connectionStatus.Status };
    } catch (error) {
        logger.error(
            `Error while checking SSM connection or SQL server status for resource ID ${resourceId} credentialsId ${credentialsId}`,
            { region, node1InstanceId, node2InstanceId },
            error
        );
    }

    return { isSSMConnected: false };
}

async function getDatabaseEnvironmentDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceId: string,
    databaseInstanceName: string,
    node1InstanceId: string,
    node2InstanceId?: string
) {
    logger.info('Get active SQL node and instance details', {
        accountId,
        credentialsId,
        region,
        resourceId,
        databaseInstanceName,
        node1InstanceId,
        node2InstanceId
    });
    let isSSMConnected: boolean = false;
    let isManagedDatabaseInstance: boolean = false;
    let isDefaultInstance: boolean = false;
    let activeNodeInstanceId = node1InstanceId;
    let fsxId;
    let svmId;

    try {
        let connectionStatus = await getSSMConnectionStatus(credentialsId, region, activeNodeInstanceId);
        if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
            // Check if SSM connectivity is available on other node.
            if (node2InstanceId) {
                activeNodeInstanceId = node2InstanceId;
            }
            connectionStatus = await getSSMConnectionStatus(credentialsId, region!, activeNodeInstanceId);
        }
        if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
            isSSMConnected = true;
        }
    } catch (error) {
        logger.error(
            `Failed to get SSM state of nodes ${node1InstanceId} and ${node2InstanceId} in region ${region}. Reason: ${error}`
        );
    }

    const databaseInstanceInfo = await getPaginatedDatabaseInstances(accountId, {
        credentialsId,
        resourceId,
        databaseInstanceName
    });

    if (!isEmpty(databaseInstanceInfo)) {
        isManagedDatabaseInstance = true;
        const dbInstancesArray = Array.isArray(databaseInstanceInfo)
            ? databaseInstanceInfo
            : databaseInstanceInfo?.items ?? [];
        [{ is_default: isDefaultInstance }] = dbInstancesArray;

        // Currently the DB environment is expected to be on a single FSxN/SVM
        [{ fsxn_ids: fsxId }] = dbInstancesArray;
        const [{ fsx_svm_id: temp } = {}] = dbInstancesArray;
        svmId = temp![fsxId as keyof typeof temp];
    }

    return {
        isSSMConnected,
        isManagedDatabaseInstance,
        isDefaultInstance,
        ...(isSSMConnected && { activeNodeInstanceId }),
        fsxId,
        svmId
    };
}

async function checkDatabaseExists(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseName: string,
    activeNodeInstanceId: string,
    instanceName: string = DEFAULT_INSTANCE_NAME,
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    databaseInstanceId?: string,
    sqlAuthEnabled: boolean = false
) {
    logger.info('Checking Database name exists', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseName,
        activeNodeInstanceId,
        instanceName,
        executableInstanceName,
        databaseInstanceId,
        sqlAuthEnabled
    });

    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        if (databaseInstanceId) {
            const dbInstancesResult = await getPaginatedDatabaseInstances(accountId, {
                databaseInstanceId,
                credentialsId
            });
            const dbInstance = Array.isArray(dbInstancesResult) ? dbInstancesResult[0] : dbInstancesResult?.items?.[0];
            const { userDatabase } = (dbInstance?.metadata || { userDatabase: undefined }) as { userDatabase: any[] };
            return userDatabase?.some(db => db.name === databaseName) ?? false;
        }

        const { userDatabase } = ((
            await listResources({ accountId, resourceId: databaseHostId, credentialIds: credentialsId })
        )[0]?.metadata || { userDatabase: undefined }) as { userDatabase: any[] };
        return userDatabase?.some(db => db.name === databaseName) ?? false;
    }

    const command = [
        sqlQueryExecution(instanceName, executableInstanceName, DATABASE_NAME_EXISTS(databaseName), sqlAuthEnabled)
    ];

    try {
        const checkDatabaseExistsResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: activeNodeInstanceId,
            comment: `Check for existing Database with name ${databaseName}`,
            accountId
        });

        logger.debug('checking database name exists done', checkDatabaseExistsResponse);

        const parsedDatabaseExistsResponse = checkDatabaseExistsResponse
            ? sqlResponseParsing(checkDatabaseExistsResponse)
            : {};

        if (!isEmpty(parsedDatabaseExistsResponse)) {
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
    executableInstanceName: string = DEFAULT_MSSQL_INSTANCE_NAME,
    sqlAuthEnabled: boolean = false
) {
    logger.info('Get SQL server version:', {
        credentialsId,
        region,
        activeNodeInstanceId,
        executableInstanceName,
        sqlAuthEnabled
    });
    const instanceName = getOriginalDatabaseInstanceName(executableInstanceName);
    const command = [sqlQueryExecution(instanceName, executableInstanceName, SERVER_VERSION, sqlAuthEnabled)];
    const sqlServerVersionResponse = await callSsmExecution({
        credentialsId,
        region,
        commands: command,
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get MSSQL server version',
        cacheData: true
    });
    const { version = '' } = sqlServerVersionResponse ? sqlResponseParsing(sqlServerVersionResponse) : {}; // const sqlServerVersion: parsedSqlSeverVersionResponse[0].substring(0, serverInfo[0].indexOf('(')).trim(),
    const sqlServerVersion = version ? version.substring(0, version.indexOf('(')).trim() : '';

    return sqlServerVersion;
}

async function getMssqlInstanceGuid(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceName: string,
    nodeIds: string[]
) {
    logger.info('Fetching mssql instance id', accountId, nodeIds, instanceName);
    const commands = [`sqlcmd -S "${instanceName}" -Q "${INSTANCE_GUID}" -y 0`];
    let response;
    try {
        let sqlInstanceGuid;

        for await (const nodeId of nodeIds) {
            const ssmComment = 'Fetching MSSQL instance GUID';
            response = await callSsmExecution({
                credentialsId,
                region,
                commands,
                ec2InstanceId: nodeId,
                comment: ssmComment,
                accountId,
                cacheData: true
            });
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

async function getActiveSqlNodeAndInstanceDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    nodeIds: string[],
    databaseInstanceName: string,
    resourceId?: string,
    resourceName?: string
) {
    logger.info('Getting active SQL node and instance details', {
        accountId,
        credentialsId,
        region,
        nodeIds,
        databaseInstanceName,
        resourceId,
        resourceName
    });
    try {
        const inActiveNodes: { nodeId: string; connStatus: string }[] = [];
        for await (const nodeId of nodeIds) {
            const connectionStatus = await getSSMConnectionStatus(credentialsId, region, nodeId, accountId);
            if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
                const instanceDetails = await getAllInstanceDetails(credentialsId, region, [nodeId], accountId);
                const { sql, domain } = await getSQLAuthFromSSMParameterStore(credentialsId, region, nodeId);

                instanceDetails?.forEach((obj: { instanceName: string; sqlAuthEnabled: boolean }) => {
                    obj.instanceName = obj.instanceName.replace(/^.+\$/, '');
                    obj.sqlAuthEnabled = getSqlAuthEnabledStatus(obj.instanceName, sql, domain);
                });
                if (instanceDetails) {
                    const matchingInstance = instanceDetails.find(
                        (instance: InstanceDetails) =>
                            (IS_DEMO_FLOW
                                ? instance.instanceName.includes(databaseInstanceName)
                                : instance.instanceName === databaseInstanceName) &&
                            instance.instanceState === SQL_SERVICE_STATE.RUNNING
                    );

                    if (matchingInstance) {
                        return { nodeId, matchingInstance };
                    }
                    logger.debug(`Instance ${databaseInstanceName} is not running on node ${nodeId}`);
                } else {
                    logger.debug(`No active sql instances found in node ${nodeId} `);
                }
            } else {
                inActiveNodes.push({ nodeId, connStatus: connectionStatus?.Status ?? '' });
            }
        }
        const errorMessage = `Instance ${databaseInstanceName} is not running on nodes ${JSON.stringify([
            ...inActiveNodes
        ])} for resourceid: ${resourceId}, resource name : ${resourceName}    `;
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    } catch (err) {
        const errorMessage = `Error while checking SSM connection or SQL server status for resource: ${resourceId}, resource name: ${resourceName} credentialsId: ${credentialsId}, region: ${region}, nodeIds:${nodeIds} , ${err}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function getActiveNodeAndInstanceDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceDetails: ResourceDetails,
    databaseInstanceDetails: DatabaseInstance
) {
    logger.info('Fetching instance details', { accountId, credentialsId, region });

    const { resource_id: resourceId, metadata, resource_name: resourceName } = resourceDetails;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
    const { database_instance_name: instanceName } = databaseInstanceDetails;

    const activeNodeResponse: { nodeId: string; matchingInstance: any; standbyNodeInstanceId?: string } =
        await getActiveSqlNodeAndInstanceDetails(
            accountId,
            credentialsId,
            region,
            [node1InstanceId, ...(node2InstanceId ? [node2InstanceId] : [])],
            instanceName,
            resourceId,
            resourceName || ''
        );
    if (!activeNodeResponse) {
        const errorMessage = `${node1InstanceId} , ${node2InstanceId} are not in active state for resource id: ${resourceId}, resource name : ${resourceName} `;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    const { nodeId: activeNodeInstanceId } = activeNodeResponse;
    let standbyNodeInstanceId;
    if (node2InstanceId) {
        if (node1InstanceId === activeNodeInstanceId) {
            standbyNodeInstanceId = node2InstanceId;
        } else {
            standbyNodeInstanceId = node1InstanceId;
        }
    } else {
        standbyNodeInstanceId = undefined;
    }
    activeNodeResponse.standbyNodeInstanceId = standbyNodeInstanceId;

    return activeNodeResponse;
}

async function getSQLAuthFromSSMParameterStore(credentialsId: string, region: string, nodeId: string) {
    // Check if instance has SSM parameter store
    const parameterKey = `${SSM_PARAM_PREFIX}${nodeId}`;
    let ssmParameter;
    if (hasCache(AWS_SSM_PARAMETER, parameterKey)) {
        ssmParameter = readFromCacheByKey(AWS_SSM_PARAMETER, parameterKey) as string;
    } else {
        ssmParameter = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${nodeId}`);
        if (ssmParameter) {
            writeToCache(AWS_SSM_PARAMETER, parameterKey, ssmParameter, '60s');
        }
    }

    let sql = [];
    let domain = [];
    try {
        ({ sql = [], domain = [] } = JSON.parse(ssmParameter ?? '{}'));
    } catch (error) {
        logger.error('Error parsing SSM parameter store', { error }, { ssmParameter });
    }
    return { sql, domain };
}

async function getSqlServerVersionAndEdition(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
) {
    logger.info('Get SQL server version and edition:', { accountId, credentialsId, region, activeNodeInstanceId });

    const { instancesDetails } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId: activeNodeInstanceId,
        accountId
    });

    if (isEmpty(instancesDetails)) {
        logger.warn('No active SQL instances found while fetching version and edition');
        throw createError(HttpErrorCodes.NOT_FOUND, 'No active SQL instances found');
    }

    try {
        let sqlAuthEnabled = (instancesDetails || []).some(
            (instance: InstanceDetails) => instance.sqlAuthEnabled === true
        );

        let databaseInstances = (instancesDetails || []).map((instance: InstanceDetails) => instance.instanceName);

        if (IS_DEMO_FLOW) {
            sqlAuthEnabled = false;
            databaseInstances = [DEFAULT_INSTANCE_NAME];
        }

        const commands = sqlQueryExecutionWithAuth(databaseInstances, SERVER_VERSION_EDITION_DETAILS, sqlAuthEnabled);
        const ssmResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [commands],
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Get SQL server version and edition',
            accountId,
            cacheData: true
        });
        const parsedResponse = sqlResponseParsing(ssmResponse);

        const items = Object.entries(parsedResponse).map(([instanceName, records]) => {
            const [record = {}] = Array.isArray(records) ? records : [];
            if (!record) {
                logger.warn(`No records found for instance ${instanceName} while fetching version and edition`);
                return;
            }

            const { sqlServerVersion, windowsAuthentication, isHadrEnabled, isClustered } = record;
            if (sqlServerVersion) {
                const [sqlServerMajorVersion] = sqlServerVersion.split('.');
                record.sqlServerProductYear = SQL_SERVER_VERSION_TO_YEAR.get(sqlServerMajorVersion) || 2015;
            }

            let sqlServerDeploymentType: SqlServerDeploymentModel;
            if (isClustered) {
                sqlServerDeploymentType = SqlServerDeploymentModel.SQL_FCI_SHORT;
            } else if (isHadrEnabled) {
                sqlServerDeploymentType = SqlServerDeploymentModel.SQL_AOAG_SHORT;
            } else {
                sqlServerDeploymentType = SqlServerDeploymentModel.SQL_STANDALONE_SHORT;
            }

            const {
                instanceState,
                sqlAuthEnabled: sqlServerAuthentication,
                isDefault
            } = (instancesDetails || []).find((instance: InstanceDetails) => instance.instanceName === instanceName) ||
            {};

            return {
                ...record,
                sqlServerDeploymentType,
                sqlServerAuthentication,
                sqlServerInstance: instanceName,
                windowsAuthentication: Boolean(windowsAuthentication),
                sqlServerState: instanceState,
                isDefaultInstance: isDefault
            };
        });

        return [...compact(items)];
    } catch (error: any) {
        logger.error('Failed to get SQL Server version and edition details', error);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to get SQL Server version and edition details. ${error?.message}`
        );
    }
}

function getSqlAuthEnabledStatus(instanceName: string, sql: any[], domain: any[]) {
    logger.debug('Check if SQL authentication is enabled');

    let sqlAuthEnabled = false;
    if (IS_DEMO_FLOW) {
        sqlAuthEnabled = true;
    } else if (!isEmpty(sql)) {
        sqlAuthEnabled = Boolean(
            sql?.find(
                ({ sqlinstancename }: { sqlinstancename: string }) =>
                    sqlinstancename && sqlinstancename?.toUpperCase() === instanceName?.toUpperCase()
            )
        );
    } else if (!isEmpty(domain)) {
        sqlAuthEnabled = Boolean(
            domain?.find(
                ({ sqlinstancename }: { sqlinstancename: string }) =>
                    sqlinstancename &&
                    (sqlinstancename?.toUpperCase() === instanceName?.toUpperCase() ||
                        sqlinstancename?.toUpperCase() === DEFAULT_INSTANCE_NAME)
            )
        );
    } else {
        sqlAuthEnabled = false;
    }

    return sqlAuthEnabled;
}

async function getMssqlStorageDataFromOntap(
    activeNodeInstanceId: string,
    instanceDetails: DatabaseInstance[],
    isSqlAuthEnabled: boolean
) {
    const ssmComment = 'Get storage data from ONTAP';
    logger.info(ssmComment, ':', { activeNodeInstanceId, instancesLength: instanceDetails.length, isSqlAuthEnabled });

    try {
        const managedInstances = instanceDetails.filter(
            ({ isManaged, fsxn_ids: fsxnIds }) => isManaged && fsxnIds?.length
        );
        const [{ credentials_id: credentialsId, region, fsxn_ids: fsxnId }] = managedInstances;

        const instanceNames = managedInstances.map(({ database_instance_name: instanceName }) => instanceName);
        const command = getMappedOntapVolumesScript(
            fsxnId,
            region,
            '$false',
            instanceNames,
            isSqlAuthEnabled,
            'efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used,space.physical_used,space.performance_tier_footprint,space.capacity_tier_footprint,space.snapshot.used'
        );
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [command],
            ec2InstanceId: activeNodeInstanceId,
            comment: ssmComment,
            cacheData: true,
            shouldReadFromCloudWatchLogs: true
        });

        const cleanResponse = response?.replaceAll('\r\n', '');
        let parsedResponse = attempt(JSON.parse, cleanResponse);

        parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;
        logger.debug({ parsedResponse });

        const instancesResponse: { [key: string]: any } = {};
        instanceNames?.forEach((iName: string) => {
            if (
                parsedResponse?.[iName] &&
                !(typeof parsedResponse?.[iName] === 'string' && parsedResponse?.[iName].includes('error'))
            ) {
                const { volumes } = parsedResponse?.[iName] ?? {};
                const initialStorage = {
                    size: 0,
                    used: 0,
                    spaceSavings: 0,
                    physicalUsed: 0,
                    ssdUsed: 0,
                    capacityPoolUsed: 0,
                    snapshotUsed: 0
                };
                if (volumes && !isEmpty(volumes?.records)) {
                    const storageSavings = volumes.records.reduce(
                        (savings: Record<string, number>, { space, efficiency }: VolumeSpaceRecord) => ({
                            size: savings.size + space.size,
                            used: savings.used + space.used,
                            physicalUsed: savings.physicalUsed + (space.physical_used ?? 0),
                            ssdUsed: savings.ssdUsed + (space.performance_tier_footprint ?? 0),
                            capacityPoolUsed: savings.capacityPoolUsed + (space.capacity_tier_footprint ?? 0),
                            snapshotUsed: savings.snapshotUsed + (space.snapshot?.used ?? 0),
                            spaceSavings: savings.spaceSavings + efficiency.space_savings.total
                        }),
                        initialStorage as Record<string, number>
                    );
                    // storageSavings.spaceSavingsPercent = (storageSavings.spaceSavings / storageSavings.used) * 100;
                    instancesResponse[iName] = { ...storageSavings };
                } else {
                    instancesResponse[iName] = { ...initialStorage };
                }
            } else {
                logger.error(
                    'Failed to get storage savings from ONTAP for the instance:',
                    iName,
                    parsedResponse?.[iName]
                );
            }
        });

        return instancesResponse;
    } catch (error) {
        logger.error('Failed executing SSM script to get storage data from ONTAP', { error });
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
    deleteResourceById,
    getServerIOLatency,
    getNativeSQLProtection,
    getPerformanceMetrics,
    getNativeSQLBackedupDatabases,
    getActiveSqlNode,
    getDatabaseEnvironmentDetails,
    checkDatabaseExists,
    getSqlServerVersion,
    getMssqlInstanceGuid,
    getActiveSqlInstanceName,
    getAllInstanceDetails,
    getActiveNodeAndInstanceDetails,
    getActiveSqlNodeAndInstanceDetails,
    ActiveSqlNodeDetails,
    getSqlServerVersionAndEdition,
    getMssqlStorageDataFromOntap
};
