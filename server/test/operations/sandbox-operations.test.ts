import { ACCOUNT_ID, SANDBOX_LIFECYCLE_REFRESH, SANDBOX_LIFECYCLE_REBASELINE } from '../../src/utils/consts';
import {
    createResource,
    deleteDatabaseInstance,
    deleteResource,
    upsertDatabaseInstance
} from '../../src/lib/database/db';
import {
    createSandbox,
    getSandboxSavings,
    getSandboxesInfo,
    getDatabaseMountPointInfo,
    deleteSandbox,
    updateSandboxLifeCycle,
    splitSandbox,
    checkDatabaseIntegrity,
    getSandboxSnapshots,
    getSandboxConnectionString,
    getSandboxSplitEstimate
} from '../../src/operations/sandbox-operations';
import sandboxResponse from '../simulator/responses/workload/sandbox-response.json';
import { registerProxyGetResponse, resetProxyOverrides } from '../simulator/scopes/cloud-manager/proxy-forwarder-scope';

const MAPPED_VOLUMES_FSX_ID = 'fs-0f53fbecdd3d85fb2';

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
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI',
            sandboxCreated: true,
            userDatabase: [
                {
                    name: 'testdb1',
                    size: 1234,
                    status: 'Running',
                    type: 'Standalone',
                    protection: {
                        isAwsBackupEnabled: true,
                        isFsxOntapSnapshotsEnabled: true,
                        isSqlNativeEnabled: true
                    },
                    collation: 'utf8'
                },
                {
                    name: 'testdb2',
                    size: 1234,
                    status: 'Running',
                    type: 'Standalone',
                    protection: {
                        isAwsBackupEnabled: true,
                        isFsxOntapSnapshotsEnabled: true,
                        isSqlNativeEnabled: true
                    },
                    collation: 'utf8'
                }
            ]
        }
    });

    const DATABASE_INSTANCE_RECORD = {
        credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        region: 'ap-southeast-1',
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        databaseInstanceId: 'default',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    };

    const DATABASE_INSTANCE_RECORD2 = {
        credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        region: 'ap-southeast-1',
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        databaseInstanceId: 'test-database',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    };

    const DATABASE_INSTANCE_RECORD3 = {
        credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        region: 'ap-southeast-1',
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        databaseInstanceId: 'testdb1',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    };

    // Insert a new record
    await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);
    await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD2);
    await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD3);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    await deleteDatabaseInstance(
        ACCOUNT_ID,
        'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        '36E53042-04E8-40C9-AE69-26E56CB0D216',
        ['default', 'test-database', 'testdb1']
    );
});

describe('sandbox operations ', () => {
    it('Get sandbox details for all resources', async () => {
        const resp = await getSandboxesInfo(ACCOUNT_ID, 'f6082f35-c1db-4619-bb5c-84bcb5bf3286', 'ap-southeast-1');
        expect(resp).toBeDefined();
        if (resp) {
            expect(Object.keys(resp)).toEqual(['count', 'items', 'nextToken']);
        }
    });

    it('Get the storage savings for cloned resources', async () => {
        const resp = await getSandboxSavings(ACCOUNT_ID, 'f6082f35-c1db-4619-bb5c-84bcb5bf3286', 'ap-southeast-1');
        expect(Object.keys(resp).sort()).toEqual(
            ['consumedStorage', 'sandboxSavingsPercentage', 'savedStorage'].sort()
        );
    });

    it('create sandbox', async () => {
        const resp = await createSandbox(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            {
                host: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                instance: 'default',
                database: 'testdb1'
            },
            {
                host: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                instance: 'default',
                database: 'testdb1'
            },
            'other',
            {
                dataDrive: 'D',
                logDrive: 'E'
            }
        );
        expect(resp.jobId).toBeDefined();
    });

    it('Get the data and log mount point drives of the database', async () => {
        const resp = await getDatabaseMountPointInfo(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'test-database'
        );

        expect(resp).toEqual(sandboxResponse.sandboxMountPointResponse);
    });

    it('Deletes the sandbox', async () => {
        const resp = await deleteSandbox(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'testdb1'
        );
        expect(resp.jobId).toBeDefined();
    });

    it('Refreshes the sandbox', async () => {
        const resp = await updateSandboxLifeCycle(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'testdb1',
            SANDBOX_LIFECYCLE_REFRESH
        );
        expect(resp.jobId).toBeDefined();
    });

    it('Re-baselines the sandbox', async () => {
        const resp = await updateSandboxLifeCycle(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'testdb1',
            SANDBOX_LIFECYCLE_REBASELINE
        );
        expect(resp.jobId).toBeDefined();
    });

    it('Splits the sandbox', async () => {
        const resp = await splitSandbox(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'testdb1'
        );
        expect(resp.jobId).toBeDefined();
    });

    it('Check the sandbox integrity', async () => {
        const resp = await checkDatabaseIntegrity(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'testdb2'
        );
        expect(resp.jobId).toBeDefined();
    });

    it('Get snapshots for clone', async () => {
        const resp = await getSandboxSnapshots(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'testdb1'
        );
        expect(resp).toBeDefined();
    });

    it('Get sandbox connection string', async () => {
        const resp = await getSandboxConnectionString(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'testdb1'
        );
        expect(resp).toBeDefined();
    });

    it('Get sandbox split estimate', async () => {
        const resp = await getSandboxSplitEstimate(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'default',
            'testdb1'
        );
        expect(resp).toBeDefined();
    });

    it('Fails instead of continuing with unmapped volumes when ONTAP returns no LUNs for the serial numbers', async () => {
        registerProxyGetResponse({
            targetId: MAPPED_VOLUMES_FSX_ID,
            ontapPath: 'api/storage/luns',
            body: { records: [], num_records: 0 }
        });

        await expect(
            getSandboxSplitEstimate(
                ACCOUNT_ID,
                'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
                'ap-southeast-1',
                '36E53042-04E8-40C9-AE69-26E56CB0D216',
                'default',
                'testdb1'
            )
        ).rejects.toThrow('Could not get lun names from serial numbers');

        resetProxyOverrides();
    });
});
