import { JOBSTATUS, JOBTYPE } from '@prisma/client';

import getLogger from '../../../utils/logger';
import {
    AWSBackupAssessment,
    CloneAssessment,
    ComputeAssessment,
    StorageAssessment
} from '../../../utils/common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { isFleetManagerCollectionFailure } from '../../aws/ssm-fleet-manager-operations';
import { resolveAwsAccountIdFromCredentials } from '../../cloud-manager/credentials-operations';
import { runComputeAssessment } from '../compute-assessment-operations';
import {
    runUnregisteredOntapSubAssessment,
    toMssqlFilesystemVolumes,
    type UnregisteredSubAssessmentResult
} from '../assessment-utils';
import { runUnregisteredAwsBackupSubAssessment } from '../resilience-awsBackup-operations';
import { runUnregisteredCloneSubAssessment } from '../clone-assessment-utils';
import {
    runLayoutAssessment,
    getMultipathConfig,
    getClusterQuorumConfig,
    SqlInstanceAssessment,
    MultipathConfig,
    ClusterQuorumConfig
} from './ssm-doc-storage-assessment';

const logger = getLogger();

function failSubJobOnCollectionError(
    result: { error?: string },
    jobState: { status: JOBSTATUS; errorMessage?: string },
    context: { jobName: string; accountId: string; ec2InstanceId: string; instanceName: string }
): boolean {
    if (result.error && isFleetManagerCollectionFailure(result.error)) {
        jobState.status = JOBSTATUS.FAILED;
        jobState.errorMessage = result.error;
        logger.error(`Fleet Manager collection failed for ${context.jobName} on unregistered MSSQL instance`, {
            ...context,
            error: result.error
        });
        return true;
    }
    return false;
}

async function runLayoutSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string
): Promise<Omit<SqlInstanceAssessment, 'mpio'> | undefined> {
    const { id: subJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'Registry storage layout assessment',
        description: `Registry-based storage layout assessment for ${ec2InstanceId}/${instanceName}`,
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    let status: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage: string | undefined;
    logger.info('Starting registry storage layout assessment for unregistered MSSQL instance', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceName,
        subJobId
    });
    try {
        const result = await runLayoutAssessment(credentialsId, region, ec2InstanceId, instanceName, accountId);
        logger.info('Completed registry storage layout assessment for unregistered MSSQL instance', {
            accountId,
            ec2InstanceId,
            instanceName,
            subJobId,
            deploymentType: result?.deploymentType
        });
        return result;
    } catch (error) {
        status = JOBSTATUS.FAILED;
        errorMessage = error instanceof Error ? error.message : 'Registry layout assessment failed';
        logger.error('Failed to run registry-based storage layout assessment for unregistered MSSQL instance', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            error
        });
        return undefined;
    } finally {
        await updateJobDetails(accountId, subJobId, {
            status,
            endTime: Date.now(),
            ...(errorMessage && { error: errorMessage })
        });
    }
}

async function runMpioSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string
): Promise<MultipathConfig | undefined> {
    const { id: subJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'Registry MPIO assessment',
        description: `Registry-based MPIO assessment for ${ec2InstanceId}/${instanceName}`,
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    let status: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage: string | undefined;
    logger.info('Starting registry MPIO assessment for unregistered MSSQL instance', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceName,
        subJobId
    });
    try {
        const result = await getMultipathConfig(credentialsId, region, ec2InstanceId, accountId);
        const jobState = { status, errorMessage };
        if (
            failSubJobOnCollectionError(result, jobState, {
                jobName: 'Registry MPIO assessment',
                accountId,
                ec2InstanceId,
                instanceName
            })
        ) {
            status = jobState.status;
            errorMessage = jobState.errorMessage;
            return undefined;
        }
        logger.info('Completed registry MPIO assessment for unregistered MSSQL instance', {
            accountId,
            ec2InstanceId,
            instanceName,
            subJobId
        });
        return result;
    } catch (error) {
        status = JOBSTATUS.FAILED;
        errorMessage = error instanceof Error ? error.message : 'Registry MPIO assessment failed';
        logger.error('Failed to run registry-based MPIO assessment for unregistered MSSQL instance', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            error
        });
        return undefined;
    } finally {
        await updateJobDetails(accountId, subJobId, {
            status,
            endTime: Date.now(),
            ...(errorMessage && { error: errorMessage })
        });
    }
}

async function runClusterQuorumSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string
): Promise<ClusterQuorumConfig | undefined> {
    const { id: subJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'Registry cluster quorum assessment',
        description: `Registry-based cluster quorum assessment for ${ec2InstanceId}/${instanceName}`,
        resourceName: `${ec2InstanceId}/${instanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    let status: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage: string | undefined;
    logger.info('Starting registry cluster quorum assessment for unregistered MSSQL instance', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceName,
        subJobId
    });
    try {
        const result = await getClusterQuorumConfig(credentialsId, region, ec2InstanceId, accountId);
        const jobState = { status, errorMessage };
        if (
            failSubJobOnCollectionError(result, jobState, {
                jobName: 'Registry cluster quorum assessment',
                accountId,
                ec2InstanceId,
                instanceName
            })
        ) {
            status = jobState.status;
            errorMessage = jobState.errorMessage;
            return undefined;
        }
        logger.info('Completed registry cluster quorum assessment for unregistered MSSQL instance', {
            accountId,
            ec2InstanceId,
            instanceName,
            subJobId
        });
        return result;
    } catch (error) {
        status = JOBSTATUS.FAILED;
        errorMessage = error instanceof Error ? error.message : 'Registry cluster quorum assessment failed';
        logger.error('Failed to run registry-based cluster quorum assessment for unregistered MSSQL instance', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            error
        });
        return undefined;
    } finally {
        await updateJobDetails(accountId, subJobId, {
            status,
            endTime: Date.now(),
            ...(errorMessage && { error: errorMessage })
        });
    }
}

async function runAwsBackupSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string,
    ontapStorageAssessments?: StorageAssessment[],
    ontapCollectionError?: string
): Promise<UnregisteredSubAssessmentResult<AWSBackupAssessment>> {
    return runUnregisteredAwsBackupSubAssessment(
        {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            jobId,
            workloadLabel: 'MSSQL'
        },
        toMssqlFilesystemVolumes(ontapStorageAssessments),
        ontapCollectionError
    );
}

async function runCloneSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string,
    ontapStorageAssessments?: StorageAssessment[],
    ontapCollectionError?: string
): Promise<UnregisteredSubAssessmentResult<CloneAssessment>> {
    return runUnregisteredCloneSubAssessment(
        {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            jobId,
            workloadLabel: 'MSSQL'
        },
        toMssqlFilesystemVolumes(ontapStorageAssessments),
        ontapCollectionError
    );
}

async function runComputeSubAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string
): Promise<UnregisteredSubAssessmentResult<ComputeAssessment>> {
    return runUnregisteredOntapSubAssessment(
        { accountId, credentialsId, region, ec2InstanceId, instanceName, jobId, workloadLabel: 'MSSQL' },
        'Compute rightsizing assessment',
        async () => {
            const awsAccountId = await resolveAwsAccountIdFromCredentials(credentialsId, accountId);
            if (!awsAccountId) {
                logger.warn('Unable to resolve AWS account ID for unregistered compute assessment', {
                    accountId,
                    credentialsId,
                    region,
                    ec2InstanceId,
                    instanceName
                });
                throw new Error(`Unable to resolve AWS account ID from credentials ${credentialsId}`);
            }
            return runComputeAssessment(
                awsAccountId,
                accountId,
                credentialsId,
                region,
                ec2InstanceId,
                `${ec2InstanceId}/${instanceName}`
            );
        }
    );
}

export {
    runLayoutSubAssessment,
    runMpioSubAssessment,
    runClusterQuorumSubAssessment,
    runAwsBackupSubAssessment,
    runCloneSubAssessment,
    runComputeSubAssessment,
    type UnregisteredSubAssessmentResult
};
