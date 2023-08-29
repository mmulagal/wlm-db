import '../../simulator/scopes/databases/msql-memory-utilization-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import mssqlMemoryUtilization from '../../simulator/responses/databases/get-msql-memory-utilization.json';
import { serverResourceUtilisation } from '../../../src/lib/mssql/mssql'; 
import { DATABASE_METRIC_TYPE, DEFAULT_AWS_REGION } from '../../../src/utils/consts';


describe('Testcases for MSSQL', () => {
    it('List memory utilization for mssql resource', async () => {
        const response = await serverResourceUtilisation('credentialId', DEFAULT_AWS_REGION, 'activeInstanceId', 'standbyInstanceId', DATABASE_METRIC_TYPE.MEMORY);
        expect(response).toEqual(mssqlMemoryUtilization);
    });
});
