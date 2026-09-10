import { DATABASE_TYPE, STORAGE_TYPE } from '@prisma/client';
import {
    getPgSqlDatabaseCount,
    getPgSqlDatabaseInstancesDetails,
    getPgSqlDatabasesList,
    getPgSqlInstanceInfo,
    getPgSqlPerformaceMetrics,
    getPgSqlProtectionStatus,
    getPgSqlStorageSavingsVolumeData,
    runPgSqlAdminScript
} from '../../../src/operations/workloads/pgsql/pgsql-operations';
import { DatabaseInstance, PgSqlInstanceDetails } from '../../../src/utils/common-types';
import { ServerState, STORAGE_PROTOCOLS } from '../../../src/utils/consts';
import { parsePgSqlInstanceInfo } from '../../../src/utils/utils';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../src/lib/database/db';

describe('PgSql Database Operations', () => {
    const credentialsId = 'test-credentials-id';
    const region = 'us-west-2';
    const resourceId = 'test-resource-id';
    const accountId = 'test-account-id';
    const node1InstanceId = 'test-node1-instance-id';
    const fsxNId = 'test-fsxN-id';

    const instancesManaged: DatabaseInstance[] = [
        {
            database_instance_name: 'instance1',
            is_default: true,
            database_instance_id: 'id1',
            database_type: '',
            metadata: {},
            fsxn_ids: 'fs-1234',
            credentials_id: credentialsId,
            region,
            resource: {
                resource_id: resourceId,
                resource_type: 'PGSQL',
                resource_name: 'resource-1',
                id: '43de7387-661a-4754-8c99-b15ed4c27ffe',
                account_id: '',
                co_relation_id: 'fs-1234',
                cloud_provider_account_id: '42023456789',
                cloud_provider_name: 'AWS',
                region,
                credentials_id: credentialsId,
                metadata: {}
            }
        },
        {
            database_instance_name: 'instance2',
            is_default: true,
            database_instance_id: 'id2',
            database_type: '',
            metadata: {},
            fsxn_ids: 'fs-9876',
            credentials_id: credentialsId,
            region,
            resource: {
                resource_id: resourceId,
                resource_type: 'PGSQL',
                resource_name: 'resource-2',
                id: '25de7387-661a-4754-8c99-b15ed4c27ffe',
                account_id: '',
                co_relation_id: 'fs-9876',
                cloud_provider_account_id: '42023456788',
                cloud_provider_name: 'AWS',
                region,
                credentials_id: credentialsId,
                metadata: {}
            }
        }
    ];

    const instanceDetails: PgSqlInstanceDetails[] = [
        {
            databaseInstanceId: 'id1',
            instanceName: 'instance1',
            isDefault: true,
            instanceState: ServerState.UP,
            isManaged: true
        }
    ];

    it('should return updated instance details with managed instances', async () => {
        const result = await getPgSqlDatabaseInstancesDetails(
            credentialsId,
            region,
            instancesManaged,
            resourceId,
            instanceDetails
        );

        expect(result).toEqual([
            {
                databaseInstanceId: 'id1',
                instanceName: 'instance1',
                isDefault: true,
                instanceState: ServerState.UP,
                isManaged: true
            },
            {
                instanceName: 'instance2',
                isDefault: true,
                instanceState: ServerState.DOWN,
                isManaged: true,
                databaseInstanceId: 'id2'
            }
        ]);
    });

    it('should not add duplicate instances', async () => {
        const result = await getPgSqlDatabaseInstancesDetails(
            credentialsId,
            region,
            instancesManaged,
            resourceId,
            instanceDetails
        );

        expect(result).toHaveLength(2);
    });
    it('should return the storage savings volume data', async () => {
        const result = await getPgSqlStorageSavingsVolumeData(
            accountId,
            credentialsId,
            region,
            node1InstanceId,
            fsxNId
        );

        expect(result).toEqual({
            fsxn: {
                spaceSavings: 1486848,
                spaceSavingsPercentage: 5,
                size: 1209463209984,
                used: 26292224,
                protocol: [STORAGE_PROTOCOLS.NFS]
            }
        });
    });

    it('should return the database count', async () => {
        const result = await getPgSqlDatabaseCount(accountId, credentialsId, region, node1InstanceId);
        expect(result).toEqual('1');
    });

    it('should return the instance info when executeBashSsmCommand is successful', async () => {
        const instanceInfo = await getPgSqlInstanceInfo(accountId, credentialsId, region, ['test-node-id']);
        const { dbInstanceId, dbClusterState } = parsePgSqlInstanceInfo(instanceInfo!);

        expect(dbInstanceId).toEqual('7450008296037943418');
        expect(dbClusterState).toEqual('in production');
    });

    it('should return the list of databases', async () => {
        const result = await getPgSqlDatabasesList(accountId, credentialsId, region, node1InstanceId);

        expect(result).toEqual([
            {
                name: 'postgres',
                size: 8106467,
                status: 'ONLINE',
                collation: 'C.UTF-8',
                type: 'System Database'
            }
        ]);
    });

    it('should return the performance metrics', async () => {
        const result = await getPgSqlPerformaceMetrics(accountId, credentialsId, region, node1InstanceId);

        expect(result).toEqual({
            assessment: 'Excellent ( >=98% cache hit ratio)',
            cacheHitRatio: 98.04,
            latency: {
                read: 0.6,
                write: 0.8,
                serverIo: 0.7
            },
            iops: {
                read: 0.49,
                write: 0.39
            },
            throughput: {
                read: 0.07,
                write: 0.061
            },
            workloadType: 'Balanced'
        });
    });
    it('should return the protection status for a given PGSQL instance', async () => {
        const result = await getPgSqlProtectionStatus(accountId, credentialsId, region, node1InstanceId, fsxNId);

        expect(result).toEqual({
            isAwsBackupEnabled: {
                fsxn: true
            },
            isFsxOntapSnapshotsEnabled: true
        });
    });

    it('should run an allowlisted inspect script and return SSM output', async () => {
        const result = await runPgSqlAdminScript(
            accountId,
            credentialsId,
            region,
            { ec2InstanceId: node1InstanceId },
            'inspect',
            { DATABASE_NAME: 'appdb' },
            'pgsql admin script'
        );

        expect(result).toEqual({
            output: '{"status":"ok","svmName":"svm01","dataVolume":"pgdata","logVolume":"pgwal"}'
        });
    });

    it('should reject an unknown scriptId', async () => {
        await expect(
            runPgSqlAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'echo-hello',
                undefined,
                'pgsql admin script'
            )
        ).rejects.toThrow('Unknown scriptId: echo-hello');
    });

    it('should reject extra args that are not in the script allowlist', async () => {
        await expect(
            runPgSqlAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'inspect',
                { DATA_VOLUME: 'pgdata' },
                'pgsql admin script'
            )
        ).rejects.toThrow('Unexpected args for scriptId inspect: DATA_VOLUME');
    });

    it('should reject a caller REGION arg so path region cannot be overridden', async () => {
        await expect(
            runPgSqlAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'inspect',
                { REGION: 'eu-west-1' },
                'pgsql admin script'
            )
        ).rejects.toThrow('Unexpected args for scriptId inspect: REGION');
    });

    it('should reject missing required args for a mutating script', async () => {
        await expect(
            runPgSqlAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'createdb',
                undefined,
                'pgsql admin script'
            )
        ).rejects.toThrow('Missing required args for scriptId createdb: DATABASE_NAME');
    });

    it('should reject an invalid admin script arg name', async () => {
        await expect(
            runPgSqlAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'inspect',
                { 'DATA-VOLUME': 'pgdata' },
                'pgsql admin script'
            )
        ).rejects.toThrow('Invalid script arg name: DATA-VOLUME');
    });

    it('should reject an admin script with neither ec2InstanceId nor databaseHostId', async () => {
        await expect(
            runPgSqlAdminScript(accountId, credentialsId, region, {}, 'inspect', undefined, 'pgsql admin script')
        ).rejects.toThrow('Provide ec2InstanceId for an unregistered host or databaseHostId for a registered host');
    });

    it('should reject databaseInstanceId without databaseHostId', async () => {
        await expect(
            runPgSqlAdminScript(
                accountId,
                credentialsId,
                region,
                { databaseInstanceId: 'id1' },
                'inspect',
                undefined,
                'pgsql admin script'
            )
        ).rejects.toThrow('databaseInstanceId requires databaseHostId for a registered PostgreSQL host');
    });

    it('should reject an unknown registered PostgreSQL host', async () => {
        await expect(
            runPgSqlAdminScript(
                accountId,
                credentialsId,
                region,
                { databaseHostId: 'missing-pgsql-run-script-host' },
                'inspect',
                undefined,
                'pgsql admin script'
            )
        ).rejects.toThrow('PostgreSQL host missing-pgsql-run-script-host not found');
    });

    it('should run an inspect script on a registered host via databaseHostId', async () => {
        const hostId = 'pgsql-run-script-host';
        const instanceId = 'pgsql-run-script-instance';
        try {
            await createResource(accountId, {
                resourceId: hostId,
                resourceName: 'pgsql-run-script',
                resourceType: 'PGSQL',
                credentialsId,
                storageType: STORAGE_TYPE.FSXN,
                region,
                metadata: { node1InstanceId }
            });
            await upsertDatabaseInstance(accountId, {
                credentialsId,
                region,
                resourceId: hostId,
                databaseInstanceId: instanceId,
                databaseInstanceName: 'POSTGRES',
                isDefault: true,
                source: 'discovery',
                sqlDeploymentType: 'Standalone',
                fsxSvmId: {},
                fsxnIds: 'fs-1234',
                databaseType: DATABASE_TYPE.pgsql
            });

            const result = await runPgSqlAdminScript(
                accountId,
                credentialsId,
                region,
                { databaseHostId: hostId, databaseInstanceId: instanceId },
                'inspect',
                { DATABASE_NAME: 'appdb' },
                'pgsql admin script'
            );

            expect(result).toEqual({
                output: '{"status":"ok","svmName":"svm01","dataVolume":"pgdata","logVolume":"pgwal"}'
            });
        } finally {
            await deleteResource(accountId, hostId);
        }
    });

    it('should reject a databaseInstanceId that is not on the registered host', async () => {
        const hostId = 'pgsql-run-script-host-no-inst';
        try {
            await createResource(accountId, {
                resourceId: hostId,
                resourceName: 'pgsql-run-script-no-inst',
                resourceType: 'PGSQL',
                credentialsId,
                storageType: STORAGE_TYPE.FSXN,
                region,
                metadata: { node1InstanceId }
            });

            await expect(
                runPgSqlAdminScript(
                    accountId,
                    credentialsId,
                    region,
                    { databaseHostId: hostId, databaseInstanceId: 'not-on-this-host' },
                    'inspect',
                    undefined,
                    'pgsql admin script'
                )
            ).rejects.toThrow(`databaseInstanceId not-on-this-host not found on host ${hostId}`);
        } finally {
            await deleteResource(accountId, hostId);
        }
    });
});
