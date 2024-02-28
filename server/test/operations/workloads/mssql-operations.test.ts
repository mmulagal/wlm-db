import { afterAll, beforeAll } from 'vitest';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import { STORAGE_TYPE } from '@prisma/client';
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
    discoverMsSqlServer,
    deleteResourceById,
    getServerIOLatency,
    getNativeSQLProtection,
    checkDatabaseExists
} from '../../../src/operations/workloads/mssql/mssql-operations';
import { createResource, deleteResource, listResources } from '../../../src/lib/database/db';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: 'ap-southeast-1',
        credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        storageType: STORAGE_TYPE.FSXN,
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-0880a21327284f67c',
            fsxSecret: 'WLMDB-SqlStandaloneStack-1699407080711-fsx'
        }
    });
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
});
describe('MSSQL Resource methods', () => {
    it('Get memory utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.MEMORY);
        expect(resp.percentUsed).toEqual(50);
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
        const resp = await getDatabasesCount(CREDENTIALS_ID, DEFAULT_AWS_REGION, ACTIVE_INSTANCE_ID);
        expect(resp.totalCount).toEqual(8);
    });

    it('Get resource details ', async () => {
        const resp = await getResourceDetails('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(mssqlResponse.resourceDetailsResponse);
    });

    it('Get tables count', async () => {
        const resp = await getTablesCount(CREDENTIALS_ID, DEFAULT_AWS_REGION, 'RetailBanking', ACTIVE_INSTANCE_ID);
        expect(resp.totalCount).toEqual(7);
    });

    it('Get tables summary ', async () => {
        const resp = await getTablesSummary('36E53042-04E8-40C9-AE69-26E56CB0D216', 'RetailBanking');
        expect(resp).toEqual(mssqlResponse.tablesSummaryResponse);
    });

    it('Get Server summary ', async () => {
        const resp = await getServerSummary('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(mssqlResponse.serverSummaryResponse);
    });

    it('Get Server IO Latency ', async () => {
        const resp = await getServerIOLatency('36E53042-04E8-40C9-AE69-26E56CB0D216', ACTIVE_INSTANCE_ID);
        expect(resp).toEqual(mssqlResponse.mssqlIOLatencyResponse);
    });

    it('Get MSSQL native backups count ', async () => {
        const resp = await getNativeSQLProtection('36E53042-04E8-40C9-AE69-26E56CB0D216', ACTIVE_INSTANCE_ID);
        expect(resp).toEqual(4);
    });

    it('Discover MSSQL server ', async () => {
        const resp = await discoverMsSqlServer(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'mssql',
            STORAGE_TYPE.FSXN,
            ACTIVE_INSTANCE_ID,
            STANDBY_INSTANCE_ID
        );
        expect(resp.resourceName).toEqual(mssqlResponse.mssqlRegistrationResponse.resourceName);

        await deleteResource(ACCOUNT_ID, resp.resourceId);
    });

    it('Delete MSSQL resource', async () => {
        const resp = await deleteResourceById(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp.message).toEqual('Resource successfully deleted');
        const listResp = await listResources(ACCOUNT_ID);
        const mssqlResource = listResp.find(res => res.resource_id === '36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(mssqlResource).toBeUndefined();
        const fsxResource = listResp.find(res => res.resource_id === 'fs-f6082f35c1db');
        expect(fsxResource).toBeUndefined();
    });

    it('check database name exists in resource', async () => {
        try {
            await checkDatabaseExists(
                'account-13rAEYet',
                '2626c05d-364c-4196-bec9-0317c4d53d81',
                'ap-southeast-1',
                'd749b6e689352eeaadf7b3d3c08dbda25763a62c7a75b7159d5e96080b7433b3',
                'tempdb18',
                'i-0ac64c292872877c7'
            );
        } catch (err: any) {
            expect(err.message).toEqual('Provided database tempdb18 already exists');
        }
    });
});
