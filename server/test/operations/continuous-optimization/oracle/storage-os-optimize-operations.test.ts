import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/aws/cloud-watch-logs-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';
import '../../../simulator/scopes/aws/s3-scope';

import { JOBTYPE, JOBSTATUS } from '@prisma/client';
import { createResource, upsertDatabaseInstance, deleteResource } from '../../../../src/lib/database/db';
import { oracleOptimizeStorageOS } from '../../../../src/operations/continuous-optimization/oracle/storage-os-optimize-operations';
import { getJobs } from '../../../../src/operations/database/job-operations';
import {
    OptimizeOracleiSCSIStorageOperatingSystem,
    OptimizeOracleNFSStorageOperatingSystem
} from '../../../../src/utils/continous-optimization-consts';
import { ACCOUNT_ID, DEFAULT_AWS_REGION, DEFAULT_AWS_CREDENTIALS_ID } from '../../../utils/consts';
import waitForJobCompletion from '../../../utils/utils';
import { DatabaseTypes } from '../../../../src/utils/consts';

const dbInstanceSid = 'oradbopt';
const node1InstanceId = 'i-optimizetest123456';
const fsxNId = 'fs-0f53fbecdd3d85fb2';
const RESOURCE_ID = 'optim-storage-os-resource-1234';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: RESOURCE_ID,
        resourceName: dbInstanceSid,
        resourceType: DatabaseTypes.ORACLE,
        coRelationId: fsxNId,
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: { node1InstanceId }
    });

    const DATABASE_INSTANCE_RECORD = {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: RESOURCE_ID,
        databaseInstanceId: dbInstanceSid,
        databaseInstanceName: dbInstanceSid,
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'Standalone',
        fsxSvmId: { [fsxNId]: 'svm-0123456789abcdef0' },
        fsxnIds: fsxNId,
        databaseType: 'Oracle',
        metadata: { node1InstanceId }
    };
    await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, RESOURCE_ID);
});

describe('oracleOptimizeStorageOS (integration style)', () => {
    describe('iSCSI Replacement Timeout Optimization', () => {
        it('should optimize iSCSI replacement timeout successfully', async () => {
            await oracleOptimizeStorageOS(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                dbInstanceSid,
                OptimizeOracleiSCSIStorageOperatingSystem.ISCSI_REPLACEMENT_TIMEOUT
            );

            const { items: jobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });

            // Find the parent job for iSCSI replacement timeout optimization
            const iscsiOptimizeJob = jobItems?.find(
                (job: any) =>
                    job.description?.includes('iSCSI replacement timeout') &&
                    job.type === JOBTYPE.WELL_ARCHITECTED &&
                    job.resourceName === dbInstanceSid
            );

            expect(iscsiOptimizeJob).toBeDefined();
            expect(iscsiOptimizeJob?.resourceName).toBe(dbInstanceSid);

            // Wait for job completion
            if (iscsiOptimizeJob?.id) {
                await waitForJobCompletion(
                    ACCOUNT_ID,
                    DEFAULT_AWS_CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    iscsiOptimizeJob.id
                );

                // Check final job status
                const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    includeSubJobs: true
                });

                const completedJob = finalJobItems?.find((job: any) => job.id === iscsiOptimizeJob.id);
                expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
            }
        });
    });

    describe('Multipath IO Sessions Optimization', () => {
        it('should optimize multipath IO sessions successfully', async () => {
            await oracleOptimizeStorageOS(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                dbInstanceSid,
                OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_IO_SESSIONS
            );

            const { items: jobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });

            // Find the parent job for multipath IO sessions optimization
            const multipathOptimizeJob = jobItems?.find(
                (job: any) =>
                    job.description?.includes('multipath IO sessions') &&
                    job.type === JOBTYPE.WELL_ARCHITECTED &&
                    job.resourceName === dbInstanceSid
            );

            expect(multipathOptimizeJob).toBeDefined();
            expect(multipathOptimizeJob?.resourceName).toBe(dbInstanceSid);

            // Wait for job completion
            if (multipathOptimizeJob?.id) {
                await waitForJobCompletion(
                    ACCOUNT_ID,
                    DEFAULT_AWS_CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    multipathOptimizeJob.id
                );

                // Check final job status
                const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    includeSubJobs: true
                });

                const completedJob = finalJobItems?.find((job: any) => job.id === multipathOptimizeJob.id);
                expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
            }
        });
    });

    describe('TCP Options Optimization', () => {
        it('should optimize TCP options successfully', async () => {
            await oracleOptimizeStorageOS(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                dbInstanceSid,
                OptimizeOracleiSCSIStorageOperatingSystem.TCP_OPTIONS
            );

            const { items: jobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });
            // Find the parent job for TCP options optimization
            const tcpOptimizeJob = jobItems?.find(
                (job: any) =>
                    job.description?.includes('TCP advanced options') &&
                    job.type === JOBTYPE.WELL_ARCHITECTED &&
                    job.resourceName === dbInstanceSid
            );

            expect(tcpOptimizeJob).toBeDefined();
            expect(tcpOptimizeJob?.resourceName).toBe(dbInstanceSid);

            // Wait for job completion
            if (tcpOptimizeJob?.id) {
                await waitForJobCompletion(
                    ACCOUNT_ID,
                    DEFAULT_AWS_CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    tcpOptimizeJob.id
                );

                // Check final job status
                const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    includeSubJobs: true
                });

                const completedJob = finalJobItems?.find((job: any) => job.id === tcpOptimizeJob.id);
                expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
            }
        });
    });

    describe('Host Utilities Installation', () => {
        it('should install host utilities successfully', async () => {
            await oracleOptimizeStorageOS(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                dbInstanceSid,
                OptimizeOracleiSCSIStorageOperatingSystem.HOST_UTILITIES
            );

            const { items: jobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });

            // Find the parent job for host utilities installation
            const hostUtilitiesJob = jobItems?.find(
                (job: any) =>
                    job.description?.includes('Install Host Utilities') &&
                    job.type === JOBTYPE.WELL_ARCHITECTED &&
                    job.resourceName === dbInstanceSid
            );

            expect(hostUtilitiesJob).toBeDefined();
            expect(hostUtilitiesJob?.resourceName).toBe(dbInstanceSid);

            // Wait for job completion
            if (hostUtilitiesJob?.id) {
                await waitForJobCompletion(
                    ACCOUNT_ID,
                    DEFAULT_AWS_CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    hostUtilitiesJob.id
                );

                // Check final job status
                const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    includeSubJobs: true
                });

                const completedJob = finalJobItems?.find((job: any) => job.id === hostUtilitiesJob.id);
                expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
            }
        });
    });

    describe('optimize kernel TCP sunrpc slots', () => {
        it('should optimize kernel TCP sunrpc slots successfully', async () => {
            await oracleOptimizeStorageOS(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                dbInstanceSid,
                OptimizeOracleNFSStorageOperatingSystem.KERNEL_PARAMETERS
            );

            const { items: jobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });

            // Find the parent job for kernel TCP sunrpc slots optimization
            const tcpSunrpcOptimizeJob = jobItems?.find(
                (job: any) =>
                    job.description.toLowerCase().includes('slot table') &&
                    job.type === JOBTYPE.WELL_ARCHITECTED &&
                    job.resourceName === dbInstanceSid
            );

            expect(tcpSunrpcOptimizeJob).toBeDefined();
            expect(tcpSunrpcOptimizeJob?.resourceName).toBe(dbInstanceSid);

            // Wait for job completion
            if (tcpSunrpcOptimizeJob?.id) {
                await waitForJobCompletion(
                    ACCOUNT_ID,
                    DEFAULT_AWS_CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    tcpSunrpcOptimizeJob.id
                );

                // Check final job status
                const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    includeSubJobs: true
                });

                const completedJob = finalJobItems?.find((job: any) => job.id === tcpSunrpcOptimizeJob.id);
                expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
            }
        });
    });

    describe('Enable Multipath IO', () => {
        it('should enable multipath IO successfully', async () => {
            await oracleOptimizeStorageOS(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                dbInstanceSid,
                OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_ENABLE
            );

            const { items: jobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });

            // Find the parent job for multipath IO enablement
            const multipathEnableJob = jobItems?.find(
                (job: any) =>
                    (job.description?.toLowerCase().includes('multipath') ||
                        job.description?.toLowerCase().includes('enable multipath') ||
                        job.description?.includes('Optimization completed for')) &&
                    job.type === JOBTYPE.WELL_ARCHITECTED &&
                    job.resourceName === dbInstanceSid
            );

            expect(multipathEnableJob).toBeDefined();
            expect(multipathEnableJob?.resourceName).toBe(dbInstanceSid);

            // Wait for job completion
            if (multipathEnableJob?.id) {
                await waitForJobCompletion(
                    ACCOUNT_ID,
                    DEFAULT_AWS_CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    multipathEnableJob.id
                );

                // Check final job status
                const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    includeSubJobs: true
                });

                const completedJob = finalJobItems?.find((job: any) => job.id === multipathEnableJob.id);
                expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
            }
        });
    });

    describe('Disable SELinux', () => {
        it('should disable SELinux successfully', async () => {
            await oracleOptimizeStorageOS(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                dbInstanceSid,
                OptimizeOracleiSCSIStorageOperatingSystem.SELINUX_DISABLE
            );

            const { items: jobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });

            // Find the parent job for SELinux disable
            const selinuxDisableJob = jobItems?.find(
                (job: any) =>
                    job.description?.toLowerCase().includes('selinux disable ') &&
                    job.type === JOBTYPE.WELL_ARCHITECTED &&
                    job.resourceName === dbInstanceSid
            );

            expect(selinuxDisableJob).toBeDefined();
            expect(selinuxDisableJob?.resourceName).toBe(dbInstanceSid);

            // Wait for job completion
            if (selinuxDisableJob?.id) {
                await waitForJobCompletion(
                    ACCOUNT_ID,
                    DEFAULT_AWS_CREDENTIALS_ID,
                    DEFAULT_AWS_REGION,
                    selinuxDisableJob.id
                );

                // Check final job status
                const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                    region: DEFAULT_AWS_REGION,
                    includeSubJobs: true
                });

                const completedJob = finalJobItems?.find((job: any) => job.id === selinuxDisableJob.id);
                expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
            }
        });
    });
});

describe('Multipath Configuration Optimization', () => {
    it('should optimize multipath configuration successfully', async () => {
        await oracleOptimizeStorageOS(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            dbInstanceSid,
            OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_CONFIGURATION
        );

        const { items: jobItems } = await getJobs(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            includeSubJobs: true
        });

        // Find the parent job for multipath configuration optimization
        const multipathConfigOptimizeJob = jobItems?.find(
            (job: any) =>
                job.description?.includes('multipath configuration') &&
                job.type === JOBTYPE.WELL_ARCHITECTED &&
                job.resourceName === dbInstanceSid
        );

        expect(multipathConfigOptimizeJob).toBeDefined();
        expect(multipathConfigOptimizeJob?.resourceName).toBe(dbInstanceSid);

        // Wait for job completion
        if (multipathConfigOptimizeJob?.id) {
            await waitForJobCompletion(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                multipathConfigOptimizeJob.id
            );

            // Check final job status
            const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });

            const completedJob = finalJobItems?.find((job: any) => job.id === multipathConfigOptimizeJob.id);
            expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
        }
    });
});

describe('Multipath Friendly Names Optimization', () => {
    it('should optimize multipath friendly names successfully', async () => {
        await oracleOptimizeStorageOS(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            dbInstanceSid,
            OptimizeOracleiSCSIStorageOperatingSystem.MULTIPATH_FRIENDLY_NAMES
        );

        const { items: jobItems } = await getJobs(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            includeSubJobs: true
        });

        // Find the parent job for multipath friendly names optimization
        const multipathFriendlyNamesOptimizeJob = jobItems?.find(
            (job: any) =>
                job.description?.includes('multipath friendly names') &&
                job.type === JOBTYPE.WELL_ARCHITECTED &&
                job.resourceName === dbInstanceSid
        );

        expect(multipathFriendlyNamesOptimizeJob).toBeDefined();
        expect(multipathFriendlyNamesOptimizeJob?.resourceName).toBe(dbInstanceSid);

        // Wait for job completion
        if (multipathFriendlyNamesOptimizeJob?.id) {
            await waitForJobCompletion(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                multipathFriendlyNamesOptimizeJob.id
            );

            // Check final job status
            const { items: finalJobItems } = await getJobs(ACCOUNT_ID, {
                credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                includeSubJobs: true
            });

            const completedJob = finalJobItems?.find((job: any) => job.id === multipathFriendlyNamesOptimizeJob.id);
            expect(completedJob?.status).toBe(JOBSTATUS.COMPLETED);
        }
    });
});
