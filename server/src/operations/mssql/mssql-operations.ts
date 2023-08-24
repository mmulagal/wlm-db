import { getDBSummary, serverResourceUtilisation } from '../../lib/mssql/mssql';
import { DB_ROWS_COUNT } from '../../lib/mssql/const';
import getLogger from '../../utils/logger';
import { removeResource } from '../../lib/cloud-manager/tenancy';

const logger = getLogger();

function getResourceDetailsFromTenancy(resourceId: string) {
    logger.info('Getting details of resource :', resourceId);
    const instanceId = '';
    const credentialsId = '';
    const region = '';
    return [instanceId, credentialsId, region];
    //since resources are not yet registered in tenancy hardcoding values
    //method will be replaced once tenancy methods are implemented
}

async function getDataBasesSummary(resourceId: string) {
    logger.info('Get databases summary for resource:', resourceId);
    const [instanceId, credentialsId, region] = getResourceDetailsFromTenancy(resourceId);
    const dbCount = 251; //since resources are not yet registered in tenancy harcoding values
    const rowscount = Math.ceil(dbCount / DB_ROWS_COUNT);
    const finaldb = [];
    let offset = 0;
    for (let i = 0; i < rowscount; i++) {
        const resp = await getDBSummary(credentialsId, region, instanceId, offset, DB_ROWS_COUNT);
        finaldb.push(...resp);
        offset += DB_ROWS_COUNT;
    }
    return { databases: finaldb };
}

async function getResourceUtilisation(resourceId: string, resourceType: string) {
    logger.info(`Get ${resourceType} resource utilization for resource: `, resourceId);
    const [instanceId, credentialsId, region] = getResourceDetailsFromTenancy(resourceId);
    return serverResourceUtilisation(instanceId, credentialsId, region, resourceType);
}

async function removeMsSqlServerResourceFromTenancy(resourceId: string) {
    logger.info('Remove MS SQL Server resource:', { resourceId });

    try {
        const response = await removeResource(resourceId);
        logger.info('Remove resource response:', response);

        return 204; // Successfully deleted
    } catch (error) {
        logger.error('Failed to remove resource. Reason:', error);
    }

    return 404; // Either resource not found or some other error
}

export { getDataBasesSummary, getResourceUtilisation, removeMsSqlServerResourceFromTenancy };
