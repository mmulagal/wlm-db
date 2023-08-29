import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import { DATABASE_METRIC_TYPE } from '../../../src/utils/consts';
import { getResourceUtilisation } from '../../../src/operations/workloads/mssql/mssql-operations';

const getMemoryResonse = {
    percentUsed: 7,
    used: 342859776,
    total: 4294557696,
    remaining: 3951697920
};
describe('getResourceUtilisation', () => {
    it('getResourceUtilisation', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.MEMORY);
        expect(resp).toEqual(getMemoryResonse);
    });
});
