import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { DATABASE_METRIC_TYPE } from '../../../src/utils/consts';
import { getResourceUtilisation } from '../../../src/operations/workloads/mssql/mssql-operations';



const getMemoryResonse = {
    percentUsed: '7',
    used: '326922240',
    total: '4294557696',
    remaining: '3967635456'
};
describe('getResourceUtilisation', () => {
    it('getResourceUtilisation', async () => {
        const resp = await getResourceUtilisation('resource-1',DATABASE_METRIC_TYPE.MEMORY);
        expect(resp).toEqual(getMemoryResonse);
    });
});
