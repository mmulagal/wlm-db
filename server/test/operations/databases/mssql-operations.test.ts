import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import { DATABASE_METRIC_TYPE } from '../../../src/utils/consts';
import { getResourceUtilisation } from '../../../src/operations/workloads/mssql/mssql-operations';

const getResourceUtilizationResonse = {
    percentUsed: 7,
    used: 342859776,
    total: 4294557696,
    remaining: 3951697920
};
describe('Get Resouce utilization details', () => {
    it('Get memory utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.MEMORY);
        expect(resp).toEqual(getResourceUtilizationResonse);
    });

    it('Get cpu utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.CPU);
        expect(resp).toEqual(getResourceUtilizationResonse);
    });

    it('Get disk utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.DISK);
        expect(resp).toEqual(getResourceUtilizationResonse);
    });
});
