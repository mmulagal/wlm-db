import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import throat from 'throat';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../lib/database/database-instance-config';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus
} from '../../utils/continous-optimization-consts';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes } from '../../utils/consts';
import { AWSBackupAssessment } from '../../utils/common-types';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../routes/types/continuous-optimization.types';
import { describeFSx } from '../../lib/aws/fsx';
import { isFsxnAwsBackupEnabled } from '../aws/fsx-operations';
import { registerJob, updateJobDetails } from '../database/job-operations';
import {
    GoldenConfigEntry,
    runUnregisteredOntapSubAssessment,
    UnregisteredFilesystemVolumes,
    UnregisteredOntapSubAssessmentContext,
    UnregisteredSubAssessmentResult
} from './assessment-utils';

const logger = getLogger();

interface AwsBackupAssessmentResult {
    isAWSBackupEnabled: boolean;
    errorMessage: string;
    volumeBackupDetails: { name: string; uuid: string; isAWSBackupEnabled: boolean }[];
}

function mergeAwsBackupAssessments(assessments: AWSBackupAssessment[]): AWSBackupAssessment {
    const errorMessage = assessments
        .map(assessment => assessment.errorMessage)
        .filter(Boolean)
        .join('; ');
    const merged: AWSBackupAssessment = {
        fileSystemId: assessments.map(({ fileSystemId }) => fileSystemId).join(','),
        isAWSBackupEnabled: assessments.length > 0 && !errorMessage && assessments.every(a => a.isAWSBackupEnabled),
        ...(errorMessage && { errorMessage }),
        volumeBackupDetails: assessments.flatMap(({ volumeBackupDetails }) => volumeBackupDetails)
    };
    logger.info('Merged AWS backup assessments', {
        filesystemCount: assessments.length,
        volumeCount: merged.volumeBackupDetails?.length ?? 0,
        isAWSBackupEnabled: merged.isAWSBackupEnabled,
        hasError: Boolean(errorMessage)
    });
    return merged;
}

async function assessAwsBackupForVolumes(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    volumeUuids: string[],
    volumeNames: string[],
    instanceDisplayName: string,
    accountId?: string
): Promise<AwsBackupAssessmentResult> {
    logger.info('Assessing AWS backup for volumes', {
        credentialsId,
        region,
        fileSystemId,
        volumeUuids,
        instanceDisplayName,
        accountId
    });

    let isAWSBackupEnabled = false;
    let errorMessage = '';
    const volumeBackupDetails: { name: string; uuid: string; isAWSBackupEnabled: boolean }[] = [];

    const fsxnInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] }, accountId, {
        useCache: true
    });
    const fsSystems = fsxnInfo?.FileSystems ?? [];
    const fsRecord = fsSystems.find(fs => fs.FileSystemId === fileSystemId);
    if (!fsRecord && fsSystems.length > 0) {
        logger.warn('DescribeFileSystems returned no filesystem matching requested FileSystemId', {
            accountId,
            credentialsId,
            region,
            fileSystemId,
            returnedFileSystemIds: fsSystems.map(fs => fs.FileSystemId).filter((id): id is string => id != null)
        });
    }
    const retentionDays = fsRecord?.OntapConfiguration?.AutomaticBackupRetentionDays;
    isAWSBackupEnabled = retentionDays !== undefined && retentionDays > 0;
    logger.debug('Is Scheduled FSx for ONTAP backup enabled:', isAWSBackupEnabled);

    const volumeUuidToName = !isEmpty(volumeUuids)
        ? new Map(volumeUuids.map((uuid, index) => [uuid, volumeNames[index] || uuid]))
        : undefined;

    if (!isAWSBackupEnabled) {
        if (isEmpty(volumeUuids)) {
            errorMessage = `Found no FSx for ONTAP volumes for the instance ${instanceDisplayName}.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        const { volumeUuidsInBackups } =
            (await isFsxnAwsBackupEnabled(
                credentialsId,
                region,
                fileSystemId,
                volumeUuids,
                undefined,
                undefined,
                accountId
            )) || {};

        logger.debug('Is on-demand backup enabled:', volumeUuidsInBackups);

        const backupVolumeSet = new Set(volumeUuidsInBackups ?? []);
        isAWSBackupEnabled = volumeUuids.every(uuid => backupVolumeSet.has(uuid));

        volumeBackupDetails.push(
            ...volumeUuids.map(uuid => ({
                name: volumeUuidToName?.get(uuid) || uuid,
                uuid,
                isAWSBackupEnabled: backupVolumeSet.has(uuid)
            }))
        );
    } else if (!isEmpty(volumeUuids) && volumeUuidToName) {
        volumeBackupDetails.push(
            ...volumeUuids.map(uuid => ({
                name: volumeUuidToName.get(uuid) || uuid,
                uuid,
                isAWSBackupEnabled: true
            }))
        );
    }

    return { isAWSBackupEnabled, errorMessage, volumeBackupDetails };
}

async function initiateAwsBackupAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fileSystemId: string,
    resourceWithInstanceName: string,
    instanceDisplayName: string,
    parentJobId: string,
    volumeUuids: string[],
    volumeNames: string[]
) {
    logger.info('Initiating Scheduled FSx for ONTAP backup assessment:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    const jobName = 'Backup configuration assessment';
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    const { id: awsBackupAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobName,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let isAWSBackupEnabled = false;
    let volumeBackupDetails: { name: string; uuid: string; isAWSBackupEnabled: boolean }[] = [];

    try {
        const result = await assessAwsBackupForVolumes(
            credentialsId,
            region,
            fileSystemId,
            volumeUuids,
            volumeNames,
            instanceDisplayName,
            accountId
        );
        isAWSBackupEnabled = result.isAWSBackupEnabled;
        errorMessage = result.errorMessage;
        volumeBackupDetails = result.volumeBackupDetails;
    } catch (error) {
        errorMessage = (error as Error)?.message || 'Error while assessing backup configuration';
        logger.error(errorMessage, { accountId, credentialsId, region, databaseHostId, databaseInstanceId, error });
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, awsBackupAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus,
            error: errorMessage
        });
    }

    await createDatabaseInstanceConfigData([
        {
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            resource_id: databaseHostId,
            database_instance_id: databaseInstanceId,
            creation_time: new Date(Date.now()),
            config_data_type: AssessmentCategories.AWS_BACKUP,
            config_data: { fileSystemId, isAWSBackupEnabled, errorMessage, volumeBackupDetails }
        }
    ]);
}

function getAwsBackupDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    awsBackupAssessmentData: AWSBackupAssessment,
    goldenConfig: GoldenConfigEntry
): AssessmentItemType | AssessmentErrorItemType {
    logger.info('Get Scheduled FSx for ONTAP backup assessment data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    if (isEmpty(awsBackupAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.AWS_BACKUP);
        logger.error(errorMessage);
        return { ...goldenConfig, errorMessage };
    }

    const { fileSystemId, isAWSBackupEnabled, errorMessage, volumeBackupDetails } = awsBackupAssessmentData;
    if (errorMessage) {
        return { ...goldenConfig, errorMessage };
    }

    const volumesWithoutBackup = (volumeBackupDetails ?? [])
        .filter(volume => !volume.isAWSBackupEnabled)
        .map(volume => ({ ontapVolumeUuid: volume.uuid, ontapVolumeName: volume.name }));

    const backupRecommended = 'aws-backup-enabled';
    let objectsInViolation = volumesWithoutBackup;
    if (!isAWSBackupEnabled && isEmpty(volumeBackupDetails)) {
        logger.warn('Reporting backup drift against the filesystem because no volume details were collected', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            fileSystemId
        });
        objectsInViolation = [{ ontapVolumeUuid: fileSystemId, ontapVolumeName: fileSystemId }];
    }
    logger.info('Calculating AWS backup drift', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fileSystemId,
        isAWSBackupEnabled,
        volumeCount: volumeBackupDetails?.length ?? 0,
        volumesWithoutBackupCount: volumesWithoutBackup.length
    });
    const violationDetails = objectsInViolation.map(({ ontapVolumeName }) => ({
        objectName: ontapVolumeName ?? '',
        objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        value: 'Disabled',
        recommended: 'Enabled'
    }));

    return {
        ...goldenConfig,
        status: isAWSBackupEnabled ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        totalObjectsInViolation: isAWSBackupEnabled ? 0 : objectsInViolation.length || 1,
        recommended: backupRecommended,
        objectsInViolation,
        totalObjectsAssessed: volumeBackupDetails?.length || 1,
        violationDetails
    };
}

/** Backup assessment for an unregistered instance, derived from its tagged ONTAP volumes. */
async function runUnregisteredAwsBackupSubAssessment(
    context: UnregisteredOntapSubAssessmentContext,
    filesystemVolumes: UnregisteredFilesystemVolumes[],
    ontapCollectionError?: string
): Promise<UnregisteredSubAssessmentResult<AWSBackupAssessment>> {
    const { accountId, credentialsId, region, ec2InstanceId, instanceName, jobId, workloadLabel } = context;
    return runUnregisteredOntapSubAssessment(context, 'Backup configuration assessment', async () => {
        logger.info('Running unregistered backup configuration assessment', {
            accountId,
            credentialsId,
            region,
            jobId,
            ec2InstanceId,
            instanceName,
            workloadLabel,
            filesystemCount: filesystemVolumes.length
        });
        if (isEmpty(filesystemVolumes)) {
            throw new Error(ontapCollectionError || 'Backup configuration assessment requires tagged ONTAP volumes');
        }
        const perFileSystem = (
            await Promise.all(
                filesystemVolumes.map(
                    throat(3, async ({ filesystemId, volumes, volumesError }) => {
                        if (isEmpty(volumes)) {
                            logger.warn(
                                'Skipping unregistered backup assessment for filesystem with no tagged volumes',
                                {
                                    accountId,
                                    credentialsId,
                                    region,
                                    jobId,
                                    ec2InstanceId,
                                    instanceName,
                                    filesystemId,
                                    volumesError
                                }
                            );
                            return null;
                        }
                        logger.info('Assessing AWS backup for unregistered filesystem', {
                            accountId,
                            credentialsId,
                            region,
                            jobId,
                            ec2InstanceId,
                            instanceName,
                            filesystemId,
                            volumeCount: volumes.length
                        });
                        const result = await assessAwsBackupForVolumes(
                            credentialsId,
                            region,
                            filesystemId,
                            volumes.map(({ uuid }) => uuid),
                            volumes.map(({ name }) => name),
                            `${ec2InstanceId}/${instanceName}`,
                            accountId
                        );
                        return { fileSystemId: filesystemId, ...result };
                    })
                )
            )
        ).filter(assessment => assessment !== null);
        if (isEmpty(perFileSystem)) {
            const ontapError = filesystemVolumes
                .map(({ volumesError }) => volumesError)
                .filter(Boolean)
                .join('; ');
            throw new Error(
                ontapCollectionError || ontapError || 'Backup configuration assessment requires tagged ONTAP volumes'
            );
        }
        return mergeAwsBackupAssessments(perFileSystem);
    });
}

export {
    assessAwsBackupForVolumes,
    mergeAwsBackupAssessments,
    initiateAwsBackupAssessment,
    getAwsBackupDriftData,
    runUnregisteredAwsBackupSubAssessment
};
