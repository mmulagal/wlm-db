import { getDBSummary } from '../../lib/mssql/mssql';
import { DB_ROWS_COUNT } from '../../utils/consts';

function getResourceDetailsFromTenancy(resourceId: string) {
    console.log(`got instanceid from ${resourceId}`);
    const instanceId = 'i-0880a21327284f67c';
    const credentialsId = '936c652f-8ee5-4de8-9938-b7975d24bdce';
    const region = 'ap-southeast-1';
    return [instanceId, credentialsId, region];
    //since resources are not yet registered in tenancy hardcoding values
    //method will be replaced once tenancy methods are implemented
}

async function getDataBasesSummary(resourceId: string) {
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

export { getDataBasesSummary };
