import { beforeEach, afterEach } from 'vitest';
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
import { createResource, deleteResource } from '../../../src/lib/database/db';

beforeEach(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'test-fsx',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: 'ap-southeast-1',
        metadata: {
            credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            activeNodeInstanceId: 'i-07e76a4b916548dc0',
            activeNodeInstanceName: 'node1',
            standbyNodeInstanceId: 'i-0880a21327284f67c',
            standbyNodeInstanceName: 'node2',
            activeNodeInstanceIp: '10.0.0.0',
            standbyNodeInstanceIp: '10.0.0.1'
        }
    });
});

afterEach(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
});
describe('MSSQL Resource methods', () => {
    it('Get memory utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.MEMORY);
        expect(resp.percentUsed).toEqual(mssqlResponse.getResourceUtilizationResponse.percentUsed);

        await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    });

    it('Get cpu utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.CPU);
        expect(resp.percentUsed).toEqual(mssqlResponse.getResourceUtilizationResponse.percentUsed);
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
            'Aaronview',
            ACTIVE_INSTANCE_ID,
            STANDBY_INSTANCE_ID
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
            'mssql',
            ACTIVE_INSTANCE_ID,
            'test-active-instance-name',
            STANDBY_INSTANCE_ID,
            'test-standby-instance-name'
        );
        expect(resp.resourceName).toEqual(mssqlResponse.mssqlRegistrationResponse.resourceName);

        await deleteResource(ACCOUNT_ID, '5c791ae7-0e86-486b-8dc2-bafef485b875');
    });
});
