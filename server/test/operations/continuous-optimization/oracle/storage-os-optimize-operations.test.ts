import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/aws/cloud-watch-logs-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';

import { JOBTYPE, JOBSTATUS } from '@prisma/client';
import { createResource, upsertDatabaseInstance, deleteResource } from '../../../../src/lib/database/db';
import { oracleOptimizeStorageOS } from '../../../../src/operations/continuous-optimization/oracle/storage-os-optimize-operations';
import { getJobs } from '../../../../src/operations/database/job-operations';
import { OptimizeOracleiSCSIStorageOperatingSystem } from '../../../../src/utils/continous-optimization-consts';
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
                    (job.description?.includes('iSCSI replacement timeout') ||
                        job.description?.includes('Optimization completed for')) &&
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
                    (job.description?.includes('multipath IO sessions') ||
                        job.description?.includes('Optimization completed for')) &&
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
});
