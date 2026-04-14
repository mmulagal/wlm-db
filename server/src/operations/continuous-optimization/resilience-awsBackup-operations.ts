import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../lib/database/database-instance-config';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars
} from '../../utils/continous-optimization-consts';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes } from '../../utils/consts';
import { AWSBackupAssessment } from '../../utils/common-types';
import { describeFSx } from '../../lib/aws/fsx';
import { isFsxnAwsBackupEnabled } from '../aws/fsx-operations';
import { registerJob, updateJobDetails } from '../database/job-operations';

const logger = getLogger();

interface AwsBackupGoldenConfig {
    name: string;
    tags: AwsWellArchitecturedPillars[];
    category: string;
    subCategory: string;
    focusWidgetName: string;
    severity: string;
    resourceType: string;
    recommendation: string;
}

interface AwsBackupAssessmentResult {
    isAWSBackupEnabled: boolean;
    errorMessage: string;
    volumeBackupDetails: { name: string; uuid: string; isAWSBackupEnabled: boolean }[];
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
    goldenConfig: AwsBackupGoldenConfig
) {
    logger.info('Get Scheduled FSx for ONTAP backup assessment data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    if (isEmpty(awsBackupAssessmentData)) {
        const errorMsg = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.AWS_BACKUP);
        logger.error(errorMsg);
        return { errorMessage: errorMsg };
    }

    const { fileSystemId, isAWSBackupEnabled, errorMessage, volumeBackupDetails } = awsBackupAssessmentData;
    if (errorMessage) {
        return { errorMessage };
    }

    const volumesWithoutBackup = volumeBackupDetails
        ?.filter(volume => !volume.isAWSBackupEnabled)
        .map(volume => ({ ontapVolumeUuid: volume.uuid, ontapVolumeName: volume.name }));

    return {
        ...goldenConfig,
        status: isAWSBackupEnabled ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        totalObjectsInViolation: isAWSBackupEnabled ? 0 : volumesWithoutBackup?.length || 1,
        recommended: 'aws-backup-enabled',
        objectsInViolation: isAWSBackupEnabled ? [] : volumesWithoutBackup || [fileSystemId],
        totalObjectsAssessed: volumeBackupDetails?.length || 1
    };
}

export { assessAwsBackupForVolumes, initiateAwsBackupAssessment, getAwsBackupDriftData, AwsBackupGoldenConfig };
