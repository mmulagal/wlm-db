import {
    getPgSqlDatabaseCount,
    getPgSqlDatabaseInstancesDetails,
    getPgSqlDatabasesList,
    getPgSqlInstanceInfo,
    getPgSqlPerformaceMetrics,
    getPgSqlProtectionStatus,
    getPgSqlStorageSavingsVolumeData
} from '../../../src/operations/workloads/pgsql/pgsql-operations';
import { DatabaseInstance, PgSqlInstanceDetails } from '../../../src/utils/common-types';
import { ServerState, STORAGE_PROTOCOLS } from '../../../src/utils/consts';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import { parsePgSqlInstanceInfo } from '../../../src/utils/utils';
import '../../simulator/scopes/aws/fsx-scope';

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
            assessment: 'Excellent ( <=1 ms )',
            latency: {
                read: 0,
                write: 0,
                serverIo: 0
            },
            iops: {
                read: 0.08,
                write: 66.59
            },
            throughput: {
                read: 0.001,
                write: 0.545
            }
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
});
