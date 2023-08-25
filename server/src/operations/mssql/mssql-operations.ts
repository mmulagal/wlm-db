import { serverResourceUtilisation } from '../../lib/mssql/mssql';
import getLogger from '../../utils/logger';
import { getTenancyResource } from '../tenancy-operations';
import { DatabaseTypes } from '../../utils/consts';

const logger = getLogger();

// async function getDataBasesSummary(resourceType: string, resourceId: string) {
//     logger.info('Get databases summary for resource:', resourceId);

//     const resourceDetails = await getTenancyResource(resourceType, resourceId);
//     const dbCount = resourceDetails?.metadata; //since resources are not yet registered in tenancy harcoding values
//     const rowscount = Math.ceil(dbCount / DB_ROWS_COUNT);
//     const finaldb = [];
//     let offset = 0;
//     for (let i = 0; i < rowscount; i++) {
//         const resp = await getDatabasesSummary(credentialsId, region, instanceId, offset, DB_ROWS_COUNT);
//         finaldb.push(...resp);
//         offset += DB_ROWS_COUNT;
//     }
//     return { databases: finaldb };
// }

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

export { getResourceUtilisation };
