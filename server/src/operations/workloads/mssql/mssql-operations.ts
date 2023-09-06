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
    SERVER_NODES,
    TABLES_COUNT_QUERY,
    TABLES_QUERY
} from './const';
import { executeSSMDocument } from '../../aws/ssm-operations';
import getLogger from '../../../utils/logger';
import { getTenancyResource } from '../../tenancy-operations';
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
            commands: commands
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
    try {
        logger.debug('Output:', response.StandardOutputContent);
        return JSON.parse(response.StandardOutputContent!);
    } catch (error) {
        logger.error('Error parsing response for command:', commands, error);
        throw new Error('Error parsing response for command:');
    }
}

async function getDBSummary(
    credentialsId: string,
    region: string,
    activeInstanceId: string,
    standbyInstanceId: string,
    offset: number,
    rowscount: number
) {
    logger.info('Fetching databases ', credentialsId, region, activeInstanceId, offset, rowscount);

    const commands = [`${PSSCRIPT} -Query "${DATABASES(offset, rowscount)}"`];
    const response = await callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, commands);
    logger.debug('Fetching databases response', response);

    return response;
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

    return response;
}

async function getDataBasesSummary(resourceId: string) {
    logger.info('Get databases summary for resource:', resourceId);
    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);

    let dbCount = await getDatabasesCount(credentialsId, region, activeInstanceId, standbyInstanceId);
    dbCount = dbCount?.totalCount || 0;

    const rowscount = Math.ceil(dbCount / DB_ROWS_COUNT);

    const finaldb = [];
    let offset = 0;
    for (let i = 0; i < rowscount; i++) {
        const resp = await getDBSummary(
            credentialsId,
            region,
            activeInstanceId,
            standbyInstanceId,
            offset,
            DB_ROWS_COUNT
        );
        finaldb.push(...resp);
        offset += DB_ROWS_COUNT;
    }

    return { databases: finaldb };
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
        const dbSizecommand = [`${PSSCRIPT} -Query "${DB_SIZE}"`];
        const diskUtilizationCommand = [`${PSSCRIPT} -Query "${DISK_UTILISATION}"`];

        const [diskdata, size] = await Promise.all([
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, diskUtilizationCommand),
            callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, dbSizecommand)
        ]);
        const diskUtilization = {
            used: size.TotalSize.toString(),
            total: diskdata.total.toString(),
            remaining: (Number(diskdata.total) - size.TotalSize).toString(),
            percentUsed: Math.round((size.TotalSize * 100) / Number(diskdata.total)).toString()
        };
        return diskUtilization;
    }
    const response = await callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, commands);
    logger.debug('Fetching  utilization', response);

    return response;
}

async function getTablesCount(
    credentialsId: string,
    region: string,
    activeInstanceId: string,
    standbyInstanceId: string,
    databaseName: string
) {
    logger.info('Fetching tables total count ', credentialsId, region, activeInstanceId, databaseName);

    const commands = [`${PSSCRIPT} -Query "${TABLES_COUNT_QUERY(databaseName)}"`];
    const response = await callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, commands);
    logger.debug('Fetching tables count response', response);

    return response;
}

async function getTablesList(
    credentialsId: string,
    region: string,
    activeInstanceId: string,
    standbyInstanceId: string,
    offset: number,
    rowscount: number,
    databaseName: string
) {
    logger.info('Fetching tables ', credentialsId, region, activeInstanceId, offset, rowscount, databaseName);

    const commands = [`${PSSCRIPT} -Query "${TABLES_QUERY(databaseName, offset, rowscount)}"`];
    const response = await callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, commands);

    logger.debug('Fetching tables response', response);

    return response;
}

async function getTablesSummary(resourceId: string, databaseName: string) {
    logger.info('Get tables list for resource:', resourceId, databaseName);
    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);

    const { totalCount: tablesCount = 0 } =
        (await getTablesCount(credentialsId, region, activeInstanceId, standbyInstanceId, databaseName)) || {};

    const batchcount = Math.ceil(tablesCount / DB_ROWS_COUNT);

    const tablesList = [];
    let offset = 0;
    for (let i = 0; i < batchcount; i++) {
        const resp = await getTablesList(
            credentialsId,
            region,
            activeInstanceId,
            standbyInstanceId,
            offset,
            DB_ROWS_COUNT,
            databaseName
        );
        tablesList.push(...resp);
        offset += DB_ROWS_COUNT;
    }
    tablesList.map(result => (result.databaseName = databaseName));

    return { tables: tablesList };
}

async function getServerSummary(resourceId: string): Promise<{
    serverId: string;
    serverVersion: string;
    serverEdition: string;
    serverEngine: string;
    serverStatus: string;
    activeConnections: number;
    deploymentModel: string;
    activeNode: string;
    standbyNode: string;
}> {
    logger.info('Get details of SQL Server database:', { resourceId });

    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);

    const [serverDetails, connections, state, isClustered, nodes] = await Promise.all([
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
            `${PSSCRIPT} -Query "${SERVER_NODES}"`
        ])
    ]);

    const serverInfo = serverDetails?.serverDetails?.split('\n');
    const version = serverInfo[0].match(/\d+\.\d+\.\d+\.\d+/);

    return {
        serverId: resourceId,
        serverVersion: version ? version[0] : ' ',
        serverEdition: serverInfo[0].substring(0, serverInfo[0].indexOf(' - ')).trim(),
        serverEngine: serverInfo[3].substring(0, serverInfo[3].indexOf(' on ')).trim(),
        serverStatus: state['Current Service State'],
        activeConnections: connections.numberOfConnections,
        deploymentModel: isClustered.isClustered
            ? SqlServerDeploymentModel.SQL_FCI
            : SqlServerDeploymentModel.SQL_STANDALONE,
        activeNode: nodes.activeNode,
        standbyNode: nodes.standbyNode
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
    const resourceId = resourceIdentifier?.serverGuid;
    const resourceName = name?.serverName;
    const workspaceId = getAsyncLocalStorageResource<string>(WORKSPACE_ID);
    const params: ServiceResourceRequest = {
        name: resourceName,
        resourceIdentifier: resourceId,
        resourceType,
        workspacePublicId: workspaceId,
        accountPublicId: accountId,
        resourceClass: WLMDB_RESOURCE_CLASS,
        metadata: {
            propertyName: 'properties',
            propertyValue: JSON.stringify({
                location: CloudProviders.AWS,
                credentialsId: credentialsId,
                region: regionId,
                activeInstanceId: activeNodeInstanceId,
                standbyInstanceId: standbyNodeInstanceId,
                deploymentState: DeploymentState.SUCCESS
            })
        }
    };

    await registerServiceResource(params);
    return { resourceId: resourceId, resourceName: resourceName };
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
    getDBSummary,
    getTablesCount,
    getTablesList
};
