import { isEmpty } from 'lodash-es';
import {
    getDataguardDetailsForAllInstances,
    getOracleDatabaseHostInstanceSummary,
    getOracleDatabaseMappedVolumes,
    getOraclePerformanceMetrics,
    getOracleProtectionStatus,
    runOracleAdminScript
} from '../../../src/operations/workloads/oracle/oracle-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import {
    createResource,
    deleteDatabaseInstance,
    deleteResource,
    upsertDatabaseInstance
} from '../../../src/lib/database/db';
import { initializeDatabase } from '../../../src/utils/prisma-utils';

const credentialsId = DEFAULT_AWS_CREDENTIALS_ID;
const region = DEFAULT_AWS_REGION;
const dbInstanceSid = 'oradbsan';
const accountId = ACCOUNT_ID;
const node1InstanceId = 'i-07e76a4b916548dc';
const fsxNId = 'fs-f6082f35c1db';

beforeAll(async () => {
    await initializeDatabase();
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
    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: '6cbdabbfe3fb147e',
        databaseInstanceId: 'dataguard-primary',
        databaseInstanceName: 'dataguard-primary',
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

    it('should return dataguard details', async () => {
        const result = await getDataguardDetailsForAllInstances(
            accountId,
            credentialsId,
            region,
            'i-07e76a4b916548dc0',
            ['dataguard-primary'],
            true
        );
        expect(!isEmpty(result)).toBeTruthy();
        expect(result['dataguard-primary']).toBeDefined();
        expect(result['dataguard-primary'].associatedHosts.length).toBe(2);
    });

    it('should run an allowlisted topology-check script and return SSM output', async () => {
        const result = await runOracleAdminScript(
            accountId,
            credentialsId,
            region,
            { ec2InstanceId: node1InstanceId },
            'topology-check',
            { ORACLE_SID: dbInstanceSid },
            'oracle admin script'
        );

        expect(result).toEqual({
            output: '{"status":"ok","svmName":"svm01","dataVolume":"oradata","logVolume":"oraredo"}'
        });
    });

    it('should reject an unknown scriptId', async () => {
        await expect(
            runOracleAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'echo-hello',
                undefined,
                'oracle admin script'
            )
        ).rejects.toThrow('Unknown scriptId: echo-hello');
    });

    it('should reject extra args that are not in the script allowlist', async () => {
        await expect(
            runOracleAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'topology-check',
                { ORACLE_SID: dbInstanceSid, DATA_VOLUME: 'oradata' },
                'oracle admin script'
            )
        ).rejects.toThrow('Unexpected args for scriptId topology-check: DATA_VOLUME');
    });

    it('should reject missing required args for a mutating script', async () => {
        await expect(
            runOracleAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'create-pdb',
                { ORACLE_SID: dbInstanceSid },
                'oracle admin script'
            )
        ).rejects.toThrow(
            'Missing required args for scriptId create-pdb: PDB_NAME, PDB_ADMIN_USER, PDB_ADMIN_PASSWORD'
        );
    });

    it('should reject an invalid admin script arg name', async () => {
        await expect(
            runOracleAdminScript(
                accountId,
                credentialsId,
                region,
                { ec2InstanceId: node1InstanceId },
                'topology-check',
                { 'ORACLE-SID': dbInstanceSid },
                'oracle admin script'
            )
        ).rejects.toThrow('Invalid script arg name: ORACLE-SID');
    });

    it('should reject an admin script with neither ec2InstanceId nor databaseHostId', async () => {
        await expect(
            runOracleAdminScript(
                accountId,
                credentialsId,
                region,
                {},
                'topology-check',
                { ORACLE_SID: dbInstanceSid },
                'oracle admin script'
            )
        ).rejects.toThrow('Provide ec2InstanceId for an unregistered host or databaseHostId for a registered host');
    });

    it('should reject a scriptId with missing required args before resolving the target', async () => {
        await expect(
            runOracleAdminScript(
                accountId,
                credentialsId,
                region,
                {},
                'topology-check',
                undefined,
                'oracle admin script'
            )
        ).rejects.toThrow('Missing required args for scriptId topology-check: ORACLE_SID');
    });

    it('should reject databaseInstanceId without databaseHostId', async () => {
        await expect(
            runOracleAdminScript(
                accountId,
                credentialsId,
                region,
                { databaseInstanceId: 'id1' },
                'topology-check',
                { ORACLE_SID: dbInstanceSid },
                'oracle admin script'
            )
        ).rejects.toThrow('databaseInstanceId requires databaseHostId for a registered Oracle host');
    });

    it('should reject an unknown registered Oracle host', async () => {
        await expect(
            runOracleAdminScript(
                accountId,
                credentialsId,
                region,
                { databaseHostId: 'missing-oracle-run-script-host' },
                'topology-check',
                { ORACLE_SID: dbInstanceSid },
                'oracle admin script'
            )
        ).rejects.toThrow('Oracle host missing-oracle-run-script-host not found');
    });

    it('should run an oracle admin script on a registered host via databaseHostId', async () => {
        const result = await runOracleAdminScript(
            accountId,
            credentialsId,
            region,
            { databaseHostId: '6cbdabbfe3fb147e', databaseInstanceId: dbInstanceSid },
            'topology-check',
            { ORACLE_SID: 'MSSQLSERVER' },
            'oracle admin script'
        );

        expect(result).toEqual({
            output: '{"status":"ok","svmName":"svm01","dataVolume":"oradata","logVolume":"oraredo"}'
        });
    });

    it('should reject a databaseInstanceId that is not on the registered host', async () => {
        const hostId = 'oracle-run-script-host-no-inst';
        try {
            await createResource(accountId, {
                resourceId: hostId,
                resourceName: 'oracle-run-script-no-inst',
                resourceType: 'ORACLE',
                credentialsId,
                storageType: 'FSXN',
                region,
                metadata: { node1InstanceId }
            });

            await expect(
                runOracleAdminScript(
                    accountId,
                    credentialsId,
                    region,
                    { databaseHostId: hostId, databaseInstanceId: 'not-on-this-host' },
                    'topology-check',
                    { ORACLE_SID: dbInstanceSid },
                    'oracle admin script'
                )
            ).rejects.toThrow(`databaseInstanceId not-on-this-host not found on host ${hostId}`);
        } finally {
            await deleteResource(accountId, hostId);
        }
    });
});
