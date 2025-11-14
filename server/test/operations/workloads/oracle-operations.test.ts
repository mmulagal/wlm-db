import { isEmpty } from 'lodash-es';
import {
    getOracleDatabaseHostInstanceSummary,
    getOracleDatabaseMappedVolumes,
    getOraclePerformanceMetrics,
    getOracleProtectionStatus
} from '../../../src/operations/workloads/oracle/oracle-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import {
    createResource,
    deleteDatabaseInstance,
    deleteResource,
    upsertDatabaseInstance
} from '../../../src/lib/database/db';

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
    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: '6cbdabbfe3fb147e',
        databaseInstanceId: dbInstanceSid,
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    });
});
afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '6cbdabbfe3fb147e');
    await deleteDatabaseInstance(ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, '6cbdabbfe3fb147e', [dbInstanceSid]);
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
            [[{ isAsmManaged: false, mountIP: 'test-ip', mountPoint: '/fsx/mountpoint1', protocol: 'NFS' }]]
        );

        expect(result).toEqual({
            oradbsan: {
                isSqlNativeBackupEnabled: true,
                isAwsBackupEnabled: {
                    fsxn: true
                },
                isFsxOntapSnapshotsEnabled: true
            }
        });
    });

    it('should return oracle db protection data for PDBs', async () => {
        const result = await getOracleProtectionStatus(
            accountId,
            credentialsId,
            region,
            node1InstanceId,
            fsxNId,
            dbInstanceSid,
            [[{ isAsmManaged: false, mountIP: 'test-ip', mountPoint: '/fsx/mountpoint1', protocol: 'NFS' }]],
            'YES',
            ['pdb1']
        );

        expect(result).toEqual({
            oradbsan: {
                isAwsBackupEnabled: {
                    fsxn: true
                },
                isFsxOntapSnapshotsEnabled: true,
                isSqlNativeBackupEnabled: true
            },
            pdb1: {
                isAwsBackupEnabled: {
                    fsxn: true
                },
                isFsxOntapSnapshotsEnabled: true,
                isSqlNativeBackupEnabled: true
            }
        });
    });

    it('should return oracle volume-DB mappings', async () => {
        const result = await getOracleDatabaseMappedVolumes(accountId, credentialsId, region, '6cbdabbfe3fb147e');
        expect(result?.size).toBeGreaterThan(0);
    });

    it('should return instance summary', async () => {
        const result = await getOracleDatabaseHostInstanceSummary(
            accountId,
            credentialsId,
            region,
            '6cbdabbfe3fb147e',
            dbInstanceSid
        );
        expect(!isEmpty(result)).toBeTruthy();
    });
});
