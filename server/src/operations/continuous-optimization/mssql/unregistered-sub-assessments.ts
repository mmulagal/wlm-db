import { JOBSTATUS, JOBTYPE } from '@prisma/client';

import getLogger from '../../../utils/logger';
import {
    AWSBackupAssessment,
    CloneAssessment,
    ComputeAssessment,
    StorageAssessment,
    VolumeRecord
} from '../../../utils/common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { isFleetManagerCollectionFailure } from '../../aws/ssm-fleet-manager-operations';
import { resolveAwsAccountIdFromCredentials } from '../../cloud-manager/credentials-operations';
import { buildCloneAssessmentFromOntapVolumes } from '../clone-assessment-utils';
import { runComputeAssessment } from '../compute-assessment-operations';
import { assessAwsBackupForVolumes, mergeAwsBackupAssessments } from '../resilience-awsBackup-operations';
import {
    runLayoutAssessment,
    getMultipathConfig,
    getClusterQuorumConfig,
    SqlInstanceAssessment,
    MultipathConfig,
    ClusterQuorumConfig
} from './ssm-doc-storage-assessment';

const logger = getLogger();

interface UnregisteredSubAssessmentResult<T> {
    data?: T;
    error?: string;
}

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

async function runUnregisteredSubAssessment<T>(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceName: string,
    jobId: string,
    jobName: string,
    collect: () => Promise<T>
): Promise<UnregisteredSubAssessmentResult<T>> {
    const resourceName = `${ec2InstanceId}/${instanceName}`;
    const { id: subJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: `${jobName} for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    let status: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage: string | undefined;
    logger.info(`Starting ${jobName.toLowerCase()} for unregistered MSSQL instance`, {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceName,
        subJobId
    });
    try {
        const data = await collect();
        logger.info(`Completed ${jobName.toLowerCase()} for unregistered MSSQL instance`, {
            accountId,
            ec2InstanceId,
            instanceName,
            subJobId
        });
        return { data };
    } catch (error) {
        status = JOBSTATUS.FAILED;
        errorMessage = error instanceof Error ? error.message : `${jobName} failed`;
        logger.warn(`Failed to run ${jobName.toLowerCase()} for unregistered MSSQL instance`, {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            instanceName,
            subJobId,
            error
        });
        return { error: errorMessage };
    } finally {
        await updateJobDetails(accountId, subJobId, {
            status,
            endTime: Date.now(),
            ...(errorMessage && { error: errorMessage })
        });
    }
}

function getScopedMssqlVolumes(ontapStorageAssessments: StorageAssessment[] | undefined): VolumeRecord[] {
    return (ontapStorageAssessments ?? []).flatMap(assessment => assessment.volumes as unknown as VolumeRecord[]);
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
    return runUnregisteredSubAssessment(
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceName,
        jobId,
        'Backup configuration assessment',
        async () => {
            if (!ontapStorageAssessments?.length) {
                throw new Error(
                    ontapCollectionError || 'Backup configuration assessment requires tagged ONTAP volumes'
                );
            }
            const perFileSystem = await Promise.all(
                ontapStorageAssessments.map(async assessment => {
                    const volumes = assessment.volumes as unknown as VolumeRecord[];
                    if (!volumes.length) {
                        throw new Error(
                            assessment.errors?.volumes ||
                                `Found no tagged ONTAP volumes for FSx file system ${assessment.filesystemId}`
                        );
                    }
                    logger.info('Assessing AWS backup for unregistered MSSQL filesystem', {
                        accountId,
                        ec2InstanceId,
                        instanceName,
                        filesystemId: assessment.filesystemId,
                        volumeCount: volumes.length
                    });
                    const result = await assessAwsBackupForVolumes(
                        credentialsId,
                        region,
                        assessment.filesystemId,
                        volumes.map(({ uuid }) => uuid),
                        volumes.map(({ name }) => name),
                        `${ec2InstanceId}/${instanceName}`,
                        accountId
                    );
                    return { fileSystemId: assessment.filesystemId, ...result };
                })
            );
            return mergeAwsBackupAssessments(perFileSystem);
        }
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
    return runUnregisteredSubAssessment(
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceName,
        jobId,
        'Clone management assessment',
        async () => {
            const volumes = getScopedMssqlVolumes(ontapStorageAssessments);
            if (!ontapStorageAssessments?.length || !volumes.length) {
                const ontapError = ontapStorageAssessments
                    ?.map(assessment => assessment.errors?.volumes)
                    .filter(Boolean)
                    .join('; ');
                throw new Error(
                    ontapCollectionError || ontapError || 'Clone management assessment requires tagged ONTAP volumes'
                );
            }
            return buildCloneAssessmentFromOntapVolumes(volumes, {
                databaseHostName: ec2InstanceId,
                databaseHostId: ec2InstanceId,
                databaseInstanceName: instanceName
            });
        }
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
    return runUnregisteredSubAssessment(
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceName,
        jobId,
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
