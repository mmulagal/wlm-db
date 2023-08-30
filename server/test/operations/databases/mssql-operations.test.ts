import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import { DATABASE_METRIC_TYPE } from '../../../src/utils/consts';
import { getDataBasesSummary, getResourceUtilisation } from '../../../src/operations/workloads/mssql/mssql-operations';

const getResourceUtilizationResonse = {
    percentUsed: 7,
    used: 342859776,
    total: 4294557696,
    remaining: 3951697920
};

const databaseSummaryResponse = {
    databases: [
        {
            databaseId: 177,
            databaseName: 'Aaronview',
            creationDate: '/Date(1681235380963)/',
            databaseStatus: 'ONLINE',
            databaseSize: '553648128'
        },
        {
            databaseId: 34,
            databaseName: 'Adamfort',
            creationDate: '/Date(1681233819663)/',
            databaseStatus: 'OFFLINE',
            databaseSize: '16777216'
        },
        {
            databaseId: 203,
            databaseName: 'Adamsview',
            creationDate: '/Date(1681235388887)/',
            databaseStatus: 'ONLINE',
            databaseSize: '16777216'
        }
    ]
};


describe('Get MSSQL Resouce utilization details', () => {
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

    it('Get databases summary', async () => {
        const resp = await getDataBasesSummary('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(databaseSummaryResponse);
    });
});
