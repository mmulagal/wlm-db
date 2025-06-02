import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/fsx-scope';
import {
    getOraclePerformanceMetrics,
    getOracleProtectionStatus
} from '../../../src/operations/workloads/oracle/oracle-operations';

describe('Oracle Database Operations', () => {
    const credentialsId = 'test-credentials-id';
    const region = 'us-west-2';
    const dbInstanceSid = 'oradbsan';
    const accountId = 'test-account-id';
    const node1InstanceId = 'test-node1-instance-id';
    const fsxNId = 'test-fsxN-id';

    it('should return oracle db performance metrics', async () => {
        const result = await getOraclePerformanceMetrics(
            accountId,
            credentialsId,
            region,
            node1InstanceId,
            dbInstanceSid
        );

        expect(result).toEqual({
            assessment: 'Excellent ( <=1 ms )',
            latency: {
                read: 0,
                write: 0,
                serverIo: 0
            },
            iops: {
                read: 0.11,
                write: 0.6
            },
            throughput: {
                read: 0.001,
                write: 0.005
            }
        });
    });

    it('should return oracle db protection data', async () => {
        const result = await getOracleProtectionStatus(
            accountId,
            credentialsId,
            region,
            node1InstanceId,
            fsxNId,
            dbInstanceSid,
            'test-ip',
            '/mnt/oradata',
            'NFS'
        );

        expect(result).toEqual({
            isSqlNativeBackupEnabled: false,
            isAwsBackupEnabled: {
                fsxn: true
            },
            isFsxOntapSnapshotsEnabled: true
        });
    });
});
