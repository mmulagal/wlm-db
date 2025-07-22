import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/fsx-scope';
import {
    getOracleDatabaseMappedVolumes,
    getOraclePerformanceMetrics,
    getOracleProtectionStatus
} from '../../../src/operations/workloads/oracle/oracle-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { createResource, deleteResource } from '../../../src/lib/database/db';

const credentialsId = DEFAULT_AWS_CREDENTIALS_ID;
const region = DEFAULT_AWS_REGION;
const dbInstanceSid = 'oradbsan';
const accountId = ACCOUNT_ID;
const node1InstanceId = 'i-07e76a4b916548dc';
const fsxNId = 'fs-f6082f35c1db';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
        resourceName: dbInstanceSid,
        resourceType: 'ORACLE',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0'
        }
    });
});
afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '6cbdabbfe3fb147e');
});
describe('Oracle Database Operations', () => {
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

    it('should return oracle volume-DB mappings', async () => {
        const result = await getOracleDatabaseMappedVolumes(accountId, credentialsId, region, '6cbdabbfe3fb147e');
        expect(result?.VolumeMappings?.length).toBeGreaterThan(0);
    });
});
