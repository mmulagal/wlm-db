import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import mssqlResponse from '../../simulator/responses/workload/mssql-operations-response.json';
import {
    ACCOUNT_ID,
    CREDENTIALS_ID,
    ACTIVE_INSTANCE_ID,
    STANDBY_INSTANCE_ID,
    DEFAULT_AWS_REGION
} from '../../utils/consts';
import { DATABASE_METRIC_TYPE } from '../../../src/utils/consts';
import {
    getDatabasesCount,
    getDataBasesSummary,
    getResourceUtilisation,
    getResourceDetails,
    getTablesCount,
    getTablesSummary,
    getServerSummary,
    discoverMsSqlServer
} from '../../../src/operations/workloads/mssql/mssql-operations';

describe('MSSQL Resource methods', () => {
    it('Get memory utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.MEMORY);
        expect(resp).toEqual(mssqlResponse.getResourceUtilizationResponse);
    });

    it('Get cpu utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.CPU);
        expect(resp).toEqual(mssqlResponse.getResourceUtilizationResponse);
    });

    it('Get disk utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.DISK);
        expect(resp).toEqual(mssqlResponse.diskUtilizationResponse);
    });

    it('Get databases summary', async () => {
        const resp = await getDataBasesSummary('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(mssqlResponse.databaseSummaryResponse);
    });

    it('Get databases count', async () => {
        const resp = await getDatabasesCount(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ACTIVE_INSTANCE_ID,
            STANDBY_INSTANCE_ID
        );
        expect(resp.totalCount).toEqual(7);
    });

    it('Get resource details ', async () => {
        const resp = await getResourceDetails('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(mssqlResponse.resourceDetailsResponse);
    });

    it('Get tables count', async () => {
        const resp = await getTablesCount(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ACTIVE_INSTANCE_ID,
            STANDBY_INSTANCE_ID,
            'Aaronview'
        );
        expect(resp.totalCount).toEqual(7);
    });

    it('Get tables summary ', async () => {
        const resp = await getTablesSummary('36E53042-04E8-40C9-AE69-26E56CB0D216', 'Aaronview');
        expect(resp).toEqual(mssqlResponse.tablesSummaryResponse);
    });

    it('Get Server summary ', async () => {
        const resp = await getServerSummary('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(mssqlResponse.serverSummaryResponse);
    });

    it('Discover MSSQL server ', async () => {
        const resp = await discoverMsSqlServer(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ACTIVE_INSTANCE_ID,
            STANDBY_INSTANCE_ID,
            'mssql'
        );
        expect(resp).toEqual(mssqlResponse.mssqlRegistrationResponse);
    });
});
