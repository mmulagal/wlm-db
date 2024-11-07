import {
    AssessmentCategories,
    AssessmentStatus,
    OPTIMIZE_SIZING_CONFIGS
} from '../utils/continous-optimization-consts';
import getLogger from '../utils/logger';
import { getHeadroomDrift, getLogVolumeDrift, getTempDbVolumeDrift } from './drift-assessment';
import { listDatabaseInstanceConfigData } from '../lib/database/database-instance-config';
import { StorageAssessment } from '../utils/common-types';
import { updateFsxCapacity, updateFsxVolumeSize } from '../lib/aws/fsx';
import { convertToBytes, sizeInGigaBytes } from '../utils/utils';
import { getFsxStorageDetails } from './aws/fsx-operations';

const logger = getLogger();

export default async function optimizeSizing(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    type: string
) {
    logger.info('Optimizing sizing ', { accountId, credentialsId, region, databaseHostId, databaseInstanceId, type });

    // create job
    const jobId = 'jobId';
    const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        AssessmentCategories.STORAGE
    );
    const { config_data: configData } = persistedConfigurationData;
    const { filesystemId } = configData as unknown as StorageAssessment;

    switch (type) {
        case OPTIMIZE_SIZING_CONFIGS.HEADROOM:
            await headroomOptimization(accountId, credentialsId, region, filesystemId);
            break;
        case OPTIMIZE_SIZING_CONFIGS.LOG_DRIVE_SIZE: {
            const {
                sizing: { 'data-log-drive-details': logDriveDetails }
            } = configData as unknown as StorageAssessment;
            await logDriveOptimization(accountId, credentialsId, region, filesystemId, logDriveDetails);
            break;
        }
        case OPTIMIZE_SIZING_CONFIGS.TEMPDB_DRIVE_SIZE: {
            const {
                sizing: { 'data-tempdb-drive-details': tempdbDriveDetails }
            } = configData as unknown as StorageAssessment;
            await tempDbDriveOptimization(accountId, credentialsId, region, filesystemId, tempdbDriveDetails);
            break;
        }
        default:
            throw new Error('Invalid optimization type');
    }

    return { jobId };
}

async function headroomOptimization(accountId: string, credentialsId: string, region: string, fileSystemId: string) {
    logger.info('Optimizing headroom ', { accountId, credentialsId, region, fileSystemId });

    const { headroomPercent, ssdStorageCapacityInBytes, totalVolumeSizeInBytes } = await getHeadroomDrift(
        credentialsId,
        region,
        fileSystemId
    );

    if (headroomPercent < 35) {
        logger.info('Under provisioned: Headroom is less than 35%');
        let newFsxStorageCapacity = totalVolumeSizeInBytes / 0.64;
        const increase = ((newFsxStorageCapacity - ssdStorageCapacityInBytes) / ssdStorageCapacityInBytes) * 100;
        // increase newFsxStorageCapactiy so that increment is atleast 10%
        newFsxStorageCapacity = increase > 10 ? newFsxStorageCapacity : ssdStorageCapacityInBytes * 1.1;

        const newFsxStorageCapactiyGiB = sizeInGigaBytes(newFsxStorageCapacity);
        return updateFsxCapacity(credentialsId, region, accountId, fileSystemId, newFsxStorageCapactiyGiB);
    }
    logger.info('Headroom is greater than 35%, no action required');
}

async function logDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    logDriveDetails: any
) {
    logger.info('Optimizing log drive ', { accountId, credentialsId, region, fileSystemId, logDriveDetails });

    const { underProvisionedDrives } = getLogVolumeDrift(
        logDriveDetails,
        AssessmentStatus.UNDER_PROVISIONED,
        'log-drive-size'
    );
    if (underProvisionedDrives.length > 0) {
        logger.info(
            'Under provisioned: Log drives are under provisioned',
            underProvisionedDrives.map((drive: any) => drive.driveName)
        );
        const { ssdStorageCapacityInBytes, totalVolumeSizeInBytes } = await getFsxStorageDetails(
            credentialsId,
            region,
            fileSystemId
        );

        // check if enough room in the FSxN: if there is, increase log volume size  to 25% of data volume. If not, ask user to add permission or increase FSx SSD capacity manually to desired capacity.

        underProvisionedDrives.forEach(async (drive: any) => {
            const { dataVolumeSizeInBytes } = drive;
            const requiredLogVolumeSizeBytes = dataVolumeSizeInBytes * 0.25;

            const availableCapacityInBytes = ssdStorageCapacityInBytes - totalVolumeSizeInBytes;

            if (availableCapacityInBytes >= requiredLogVolumeSizeBytes) {
                await updateFsxVolumeSize(credentialsId, region, accountId, fileSystemId, requiredLogVolumeSizeBytes); // Assume this function increases the log volume size
                logger.info(`Log volume size increased to ${requiredLogVolumeSizeBytes} bytes.`);
            } else {
                logger.warn(
                    'Not enough room in the FSx. Please add permission or increase FSx SSD capacity manually to the desired capacity.'
                );
                // possibly a new API to increase FSx SSD capacity
            }
        });
    }
    logger.info('Log drives are not under provisioned, no action required');
}

async function tempDbDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    tempDbDriveDetails: any
) {
    logger.info('Optimizing temp db drive ', { accountId, credentialsId, region, fileSystemId, tempDbDriveDetails });
    // Check if enough room in the FSx: If there is, increase tempdb volume size  to 10% of data volume. If not, ask user to add permission or increase FSx SSD capacity manually to desired capacity.
    const { defaultDataDriveSizeMB, tempdbPercent } = getTempDbVolumeDrift(
        tempDbDriveDetails,
        AssessmentStatus.UNDER_PROVISIONED,
        'tempdb-drive-size'
    );
    if (tempdbPercent < 10) {
        const defaultDataDriveSizeBytes = convertToBytes(defaultDataDriveSizeMB, 'MiB') || 0;

        const requiredTempDbVolumeSizeBytes = defaultDataDriveSizeBytes * 0.1;

        const { ssdStorageCapacityInBytes, totalVolumeSizeInBytes } = await getFsxStorageDetails(
            credentialsId,
            region,
            fileSystemId
        );

        const availableCapacityInBytes = ssdStorageCapacityInBytes - totalVolumeSizeInBytes;

        if (availableCapacityInBytes >= requiredTempDbVolumeSizeBytes) {
            await updateFsxVolumeSize(credentialsId, region, accountId, fileSystemId, requiredTempDbVolumeSizeBytes); // Assume this function increases the tempdb volume size
            logger.info(`Temp db volume size increased to ${requiredTempDbVolumeSizeBytes} bytes.`);
            return;
        }
        logger.warn(
            'Not enough room in the FSx. Please add permission or increase FSx SSD capacity manually to the desired capacity.'
        );
        // possibly a new API to increase FSx SSD capacity
    }
    logger.info('Temp db drives are not under provisioned, no action required');
}
