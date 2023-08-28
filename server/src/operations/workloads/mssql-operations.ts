import { getDatabasesCount, getDatabasesSummary, serverResourceUtilisation } from '../../lib/mssql/mssql';
import getLogger from '../../utils/logger';
import { getTenancyResource } from '../tenancy-operations';
import { DatabaseTypes } from '../../utils/consts';
import { DB_ROWS_COUNT } from '../../lib/mssql/const';

const logger = getLogger();

async function getResourceDetails(resourceId: string) {
    logger.info('Gettng resource details of resource', resourceId);
    const resourceDetails = await getTenancyResource(DatabaseTypes.MS_SQL_SERVER, resourceId);
    let resourceProperties;
    try {
        resourceProperties = resourceDetails?.metadata?.properties
            ? JSON.parse(resourceDetails?.metadata?.properties)
            : {};
    } catch (error) {
        logger.error('Error parsing resource properties', error);
    }
    const credentialsId = resourceProperties?.credentialsId || '';
    const region = resourceProperties?.region || '';
    const activeInstanceId = resourceProperties?.activeInstanceId || '';
    const standbyInstanceId = resourceProperties?.standbyInstanceId || '';

    return [credentialsId, region, activeInstanceId, standbyInstanceId];
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

    const [credentialsId, region, activeInstanceId, standbyInstanceId] = await getResourceDetails(resourceId);
    return serverResourceUtilisation(credentialsId, region, activeInstanceId, standbyInstanceId, metricType);
}

export { getResourceUtilisation, getDataBasesSummary };
