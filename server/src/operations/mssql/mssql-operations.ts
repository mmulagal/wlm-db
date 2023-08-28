import {
    getDatabasesCount,
    getDatabasesSummary,
    serverResourceUtilisation,
    getSqlServerGuid,
    getSqlServerName
} from '../../lib/mssql/mssql';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import getLogger from '../../utils/logger';
import { getTenancyResource } from '../tenancy-operations';

import { DatabaseTypes, WORKSPACE_ID, WLMDB_RESOURCE_CLASS, CloudProviders, DeploymentState } from '../../utils/consts';
import { DB_ROWS_COUNT } from '../../lib/mssql/const';
import { registerServiceResource, ServiceResourceRequest } from '../../lib/cloud-manager/tenancy';

const logger = getLogger();

async function getDataBasesSummary(resourceId: string) {
    logger.info('Get databases summary for resource:', resourceId);

    const resourceDetails = await getTenancyResource(DatabaseTypes.MS_SQL_SERVER, resourceId);
    const resourceProperties = JSON.parse(resourceDetails?.metadata?.properties) || {};

    const credentialsId = resourceProperties?.credentialsId || '';
    const region = resourceProperties?.region || '';
    const activeInstanceId = resourceProperties?.activeInstanceId || '';
    const standbyInstanceId = resourceProperties?.standbyInstanceId || '';

    let dbCount = await getDatabasesCount(credentialsId, region, activeInstanceId, standbyInstanceId);
    dbCount = dbCount?.totalCount || 0;

    const rowscount = Math.ceil(dbCount / DB_ROWS_COUNT);

    const finaldb = [];
    let offset = 0;
    for (let i = 0; i < rowscount; i++) {
        const resp = await getDatabasesSummary(
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

async function getResourceUtilisation(resourceId: string, metricType: string) {
    logger.info(`Get ${metricType} resource utilization for resource: `, resourceId);

    const resourceDetails = await getTenancyResource(DatabaseTypes.MS_SQL_SERVER, resourceId);
    const resourceProperties = JSON.parse(resourceDetails?.metadata?.properties) || {};
    const credentialsId = resourceProperties?.credentialsId || '';
    const region = resourceProperties?.region || '';
    const activeInstanceId = resourceProperties?.activeInstanceId || '';
    const standbyInstanceId = resourceProperties?.standbyInstanceId || '';

    return serverResourceUtilisation(credentialsId, region, activeInstanceId, standbyInstanceId, metricType);
}

async function discoverMsSqlServer(
    accountId: string,
    credentialsId: string,
    regionId: string,
    ec2InstanceId: string,
    resourceType: string
) {
    logger.info('Save SQL Server details in tenancy:', {
        accountId,
        credentialsId,
        regionId,
        ec2InstanceId,
        resourceType
    });

    const serverId: string = await getSqlServerGuid(credentialsId, regionId, ec2InstanceId);
    const serverName: string = await getSqlServerName(credentialsId, regionId, ec2InstanceId);
    const workspaceId = getAsyncLocalStorageResource<string>(WORKSPACE_ID);
    const params: ServiceResourceRequest = {
        name: serverName,
        resourceIdentifier: serverId,
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
                activeInstanceId: ec2InstanceId,
                standbyInstanceId: ec2InstanceId, // FIXME: Update with failover EC2 node instanceId
                deploymentState: DeploymentState.SUCCESS
            })
        }
    };

    await registerServiceResource(params);
    return { resourceId: serverId, resourceName: serverName };
}

export { getResourceUtilisation, getDataBasesSummary, discoverMsSqlServer };
