import { countBy, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import moment from 'moment';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';

import storageGoldenConfigData from './golden-configs/storage';
import { listDatabaseInstanceConfigData } from '../../lib/database/database-instance-config';
import {
    SizingViolationResponseType,
    StorageParameterDriftResponseType
} from '../../routes/types/continuous-optimization.types';
import { LogDriveDetails, StorageAssessment, TempDbDriveDetails } from '../../utils/common-types';
import { HttpErrorCodes } from '../../utils/consts';
import { calculateFsxStorageCapacityForHeadroomOptimization, convertToBytes } from '../../utils/utils';
import getMissingPermissionsList from '../aws/iam-operations';
import { getFsxStorageDetails } from '../aws/fsx-operations';
import { calculateFsxnStorageEfficiencyUsingCloudwatch } from '../aws/cloud-watch-operations';

const logger = getLogger();
interface DatabaseVolumeRecord {
    ontapVolumeUuid: string | undefined;
    svm: string;
    volumeName: string;
    fileId?: number;
    lunSerialNumber: string;
    name: string;
    fileName: string;
    lunPath: string;
    volumeUuid: string;
    sizeInMb: number;
    fileType: number;
    logVolume?: string;
    logLunPath?: string;
    logFileName?: string;
    logSize?: number;
    logVolumeUuid?: string;
    databaseSizeInGb?: number;
    logSizeInMb?: number;
}

const volumeConfigData = storageGoldenConfigData.configuration.volume;
const lunConfigData = storageGoldenConfigData.configuration.lun;
const osConfigData = storageGoldenConfigData.configuration.os;
const layoutConfigData = storageGoldenConfigData.layout;
const sizingConfigData = storageGoldenConfigData.sizing;

async function checkForMissingOptimizePermissions(credentialsId: string, region: string, permissions: string[]) {
    const missingPermissions: string[] = [];
    const { implicitlyDenied, explicitlyDenied } = await getMissingPermissionsList(credentialsId, region, permissions);
    const combinedDeniedPermissions = [...implicitlyDenied, ...explicitlyDenied];
    if (combinedDeniedPermissions.length > 0) {
        combinedDeniedPermissions.forEach(permission => {
            missingPermissions.push(`${permission.service}:${permission.action}`);
        });
    }
    return missingPermissions;
}

function getLogVolumeDrift(logVolumes: LogDriveDetails[], status: AssessmentStatus, key: string) {
    logger.info('Getting log volume drift', logVolumes);

    const overProvisionedDrives: SizingViolationResponseType[] = [];
    const underProvisionedDrives: SizingViolationResponseType[] = [];
    const ignoredDrives: SizingViolationResponseType[] = [];
    const optimisedDrives: SizingViolationResponseType[] = [];

    const driveDetails = Array.isArray(logVolumes) ? logVolumes : [logVolumes];
    const currentSizePercentForAllVolumes: number[] = [];
    driveDetails.forEach((drive: LogDriveDetails) => {
        const { dataAccessPath, logAccessPath, dataDriveTotalSizeMB, logDriveTotalSizeMB } = drive;
        if (!dataAccessPath || !logAccessPath || !dataDriveTotalSizeMB || !logDriveTotalSizeMB) {
            ignoredDrives.push(drive as SizingViolationResponseType);
        } else if (dataAccessPath !== logAccessPath) {
            const logToDriveSizePercent = Math.ceil((logDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
            currentSizePercentForAllVolumes.push(logToDriveSizePercent);
            if (logToDriveSizePercent > 30) {
                overProvisionedDrives.push(drive as SizingViolationResponseType);
            } else if (logToDriveSizePercent < 20) {
                underProvisionedDrives.push(drive as SizingViolationResponseType);
            } else {
                optimisedDrives.push(drive as SizingViolationResponseType);
            }
        } else {
            ignoredDrives.push(drive as SizingViolationResponseType);
        }
    });
    key = 'log-drive-size';
    status =
        !isEmpty(overProvisionedDrives) && !isEmpty(underProvisionedDrives)
            ? AssessmentStatus.NOT_OPTIMIZED
            : !isEmpty(overProvisionedDrives) && isEmpty(underProvisionedDrives)
            ? AssessmentStatus.OVER_PROVISIONED
            : isEmpty(overProvisionedDrives) && !isEmpty(underProvisionedDrives)
            ? AssessmentStatus.UNDER_PROVISIONED
            : isEmpty(optimisedDrives) && !isEmpty(ignoredDrives)
            ? AssessmentStatus.NOT_APPLICABLE
            : AssessmentStatus.OPTIMIZED;

    return {
        key,
        status,
        overProvisionedDrives,
        underProvisionedDrives,
        ignoredDrives,
        optimisedDrives,
        currentSizePercentForAllVolumes
    };
}

function getTempDbVolumeDrift(value: TempDbDriveDetails, status: AssessmentStatus, key: string) {
    logger.info('Getting tempdb volume drift', value);

    const overProvisionedDrives: SizingViolationResponseType[] = [];
    const underProvisionedDrives: SizingViolationResponseType[] = [];
    const ignoredDrives: SizingViolationResponseType[] = [];
    const currentSizePercentForAllVolumes: number[] = [];

    let tempdbPercent = 0;
    const { dataDriveTotalSizeMB, tempdbDriveTotalSizeMB, defaultDataDriveLetter, tempdbDriveLetter, ontapVolumeUuid } =
        value;
    if (defaultDataDriveLetter === tempdbDriveLetter) {
        status = AssessmentStatus.NOT_APPLICABLE;

        ignoredDrives.push(value);
    } else {
        tempdbPercent = Math.ceil((tempdbDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
        currentSizePercentForAllVolumes.push(tempdbPercent);
        status =
            tempdbPercent > 20
                ? AssessmentStatus.OVER_PROVISIONED
                : tempdbPercent < 10
                ? AssessmentStatus.UNDER_PROVISIONED
                : AssessmentStatus.OPTIMIZED;
        if (status === AssessmentStatus.OVER_PROVISIONED) {
            overProvisionedDrives.push(value);
        } else if (status === AssessmentStatus.UNDER_PROVISIONED) {
            underProvisionedDrives.push(value);
        }
    }
    key = 'tempdb-drive-size';
    return {
        status,
        key,
        tempdbPercent,
        dataDriveTotalSizeMB,
        ontapVolumeUuid,
        underProvisionedDrives,
        overProvisionedDrives,
        ignoredDrives,
        currentSizePercentForAllVolumes
    };
}

async function getHeadroomDrift(credentialsId: string, region: string, fileSystemId: string) {
    logger.info('Getting headroom drift', { credentialsId, region, fileSystemId });

    const { ssdStorageCapacityInBytes } = await getFsxStorageDetails(credentialsId, region, fileSystemId);

    const { totalUsed } = await calculateFsxnStorageEfficiencyUsingCloudwatch(region, credentialsId, fileSystemId);

    const headroomPercent = Math.ceil(((ssdStorageCapacityInBytes - totalUsed) / ssdStorageCapacityInBytes) * 100);
    const minSSdStorageCapacityInBytes = convertToBytes(1024, 'GiB');
    const status =
        headroomPercent < 95 // FOR TESTING ONLY
            ? AssessmentStatus.UNDER_PROVISIONED
            : headroomPercent > 100 &&
              ssdStorageCapacityInBytes &&
              ssdStorageCapacityInBytes > minSSdStorageCapacityInBytes! // if overprovisioned, consider optimized if fsxSSDCapacity is 1024 GiB which is the case of smaller databases
            ? AssessmentStatus.OVER_PROVISIONED
            : AssessmentStatus.OPTIMIZED;

    // Check for 'fsx:UpdateFileSystem' permissions
    let missingPermissions: string[] = [];
    let newFsxStorageCapactiyGiB = 0;
    if (status !== AssessmentStatus.OPTIMIZED) {
        missingPermissions = await checkForMissingOptimizePermissions(credentialsId, region, ['fsx:UpdateFileSystem']);
        newFsxStorageCapactiyGiB = calculateFsxStorageCapacityForHeadroomOptimization(
            totalUsed,
            ssdStorageCapacityInBytes
        );
    }
    return {
        status,
        headroomPercent,
        ssdStorageCapacityInBytes,
        totalUsed,
        missingPermissions,
        newFsxStorageCapactiyGiB
    };
}

async function calculateStorageDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Calculating storage drift', { accountId, credentialsId, region, databaseHostId });

    const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        AssessmentCategories.STORAGE
    );

    if (isEmpty(persistedConfigurationData)) {
        const errorMessage = `No ${AssessmentCategories.STORAGE} assessment data found. Assessment is scheduled to run every 24hours and may not have run on the instance. Please try again later.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const driftAssessmentData: StorageParameterDriftResponseType = {
        timestamp: moment(persistedConfigurationData.creation_time).unix() * 1000,
        configuration: { volumes: [], luns: [], os: [] },
        sizing: [],
        layout: []
    };

    const { config_data: configData } = persistedConfigurationData;

    const { volumes, luns, os, layout, sizing, filesystemId, errors } = configData as unknown as StorageAssessment;

    if (errors && errors.volumes) {
        driftAssessmentData.configuration.volumes.push({ errorMessage: errors.volumes });
    } else {
        volumeConfigData.forEach(config => {
            let status = AssessmentStatus.OPTIMIZED;
            const objectsInViolation: string[] = [];
            volumes.forEach(volume => {
                let objectName = '';
                Object.entries(volume).forEach(([key, value]) => {
                    objectName = key === 'name' ? value : objectName;
                    if (key === config.parameter) {
                        status = config.value !== value ? AssessmentStatus.NOT_OPTIMIZED : status;
                        if (status === AssessmentStatus.NOT_OPTIMIZED) {
                            objectsInViolation.push(objectName!);
                        }
                    }
                });
            });

            driftAssessmentData.configuration.volumes.push({
                name: config.parameter,
                recommended: config.value.toString(),
                status,
                objectsInViolation,
                severity: config.severity,
                recommendation: config.recommendation,
                tags: config.tags
            });
        });
    }
    if (errors && errors.luns) {
        driftAssessmentData.configuration.luns.push({ errorMessage: errors.luns });
    } else {
        lunConfigData.forEach(config => {
            let status = AssessmentStatus.OPTIMIZED;
            const objectsInViolation: string[] = [];
            luns.forEach(lun => {
                let objectName = '';
                Object.entries(lun).forEach(([key, value]) => {
                    objectName = key === 'name' ? value : objectName;
                    if (key === config.parameter) {
                        status = config.value !== value ? AssessmentStatus.NOT_OPTIMIZED : status;

                        if (status === AssessmentStatus.NOT_OPTIMIZED) {
                            objectsInViolation.push(objectName!);
                        }
                    }
                });
            });

            driftAssessmentData.configuration.luns.push({
                name: config.parameter,
                recommended: config.value.toString(),
                status,
                objectsInViolation,
                severity: config.severity,
                recommendation: config.recommendation,
                tags: config.tags
            });
        });
    }

    if (errors && errors['mpio-policy']) {
        driftAssessmentData.configuration.os.push({ name: 'mpio-policy', errorMessage: errors['mpio-policy'] });
    }

    Object.entries(os).forEach(([key, value]) => {
        const goldenData = osConfigData.find(data => data.parameter === key);
        if (!isEmpty(goldenData)) {
            const status = goldenData?.value === value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

            driftAssessmentData.configuration.os.push({
                name: key,
                recommended: goldenData.value.toString(),
                status,
                severity: goldenData.severity,
                recommendation: goldenData.recommendation,
                tags: goldenData.tags
            });
        }
    });

    if (errors && errors.layout) {
        driftAssessmentData.layout.push(
            { name: 'user-database-layout', errorMessage: errors.layout },
            { name: 'default-data-files-location', errorMessage: errors.layout },
            { name: 'default-log-files-location', errorMessage: errors.layout },
            { name: 'tempdb-files-location', errorMessage: errors.layout }
        );
    } else {
        Object.entries(layout).forEach(([key, value]) => {
            const goldenData = layoutConfigData.find(data => data.parameter === key);
            if (!isEmpty(goldenData)) {
                const status =
                    goldenData?.value === value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

                driftAssessmentData.layout.push({
                    name: key,
                    recommended: goldenData.value.toString(),
                    status,
                    severity: goldenData.severity,
                    recommendation: goldenData.recommendation,
                    tags: goldenData.tags,
                    current: status === AssessmentStatus.OPTIMIZED ? 'separate drive' : 'shared drive'
                });
            }
            if (key === 'user-database-layout') {
                const dataVolumes = value.data;
                const logVolumes = value.log;
                const dataLogVolumeDetails: DatabaseVolumeRecord[] = [];
                dataVolumes.map((data: DatabaseVolumeRecord) =>
                    logVolumes.forEach((log: DatabaseVolumeRecord) => {
                        if (data.name === log.name) {
                            const volDetails = data as DatabaseVolumeRecord;
                            volDetails.logVolume = log.volumeName;
                            volDetails.logLunPath = log.lunPath;
                            volDetails.logFileName = log.fileName;
                            volDetails.logSizeInMb = log.sizeInMb;
                            volDetails.logVolumeUuid = log.ontapVolumeUuid;
                            volDetails.databaseSizeInGb = Math.ceil((data.sizeInMb! + log.sizeInMb!) / 1024);
                            dataLogVolumeDetails.push(volDetails);
                        }
                    })
                );

                // start user database layout assessment
                // each database is on separate data and log lun
                const databasesOnSameDataLogLun: DatabaseVolumeRecord[] = dataLogVolumeDetails.filter(
                    (data: DatabaseVolumeRecord) => data.lunPath === data.logLunPath
                );

                // each database is on separate data and log volume
                const databasesOnSameDataLogVolume: DatabaseVolumeRecord[] = dataLogVolumeDetails.filter(
                    (data: DatabaseVolumeRecord) => data.ontapVolumeUuid === data.logVolumeUuid
                );

                const databasesAbove500Gb: DatabaseVolumeRecord[] = dataLogVolumeDetails.filter(
                    (data: DatabaseVolumeRecord) => data.databaseSizeInGb! >= 500
                );

                const groupByDataVolume = countBy(databasesAbove500Gb, 'volumeUuid');
                const groupByLogVolume = countBy(databasesAbove500Gb, 'logVolumeUuid');
                const groupByDataLun = countBy(databasesAbove500Gb, 'lunPath');
                const groupByLogLun = countBy(databasesAbove500Gb, 'logLunPath');

                const databasesSharingDataVolumes = Object.values(groupByDataVolume).filter(count => count > 1);
                const databasesSharingLogVolumes = Object.values(groupByLogVolume).filter(count => count > 1);
                const databasesSharingDataLuns = Object.values(groupByDataLun).filter(count => count > 1);
                const databasesSharingLogLuns = Object.values(groupByLogLun).filter(count => count > 1);

                let recommended = '';
                let status = AssessmentStatus.OPTIMIZED;
                let recommendationString = '';
                let severity = 'critical';

                if (!isEmpty(databasesOnSameDataLogLun)) {
                    recommended = 'separate-data-log-lun-per-database';
                    status = AssessmentStatus.NOT_OPTIMIZED;
                    severity = 'critical';
                    recommendationString =
                        'Separate system databases from user databases to different drives/luns and different volumes';
                } else if (!isEmpty(databasesOnSameDataLogVolume)) {
                    recommended = 'separate-data-log-volume-per-database';
                    status = AssessmentStatus.NOT_OPTIMIZED;
                    severity = 'warning';
                    recommendationString =
                        'Separate system databases from user databases to different drives/luns and different volumes';
                } else if (databasesAbove500Gb.length > 1) {
                    if (
                        !isEmpty(databasesSharingDataVolumes) ||
                        !isEmpty(databasesSharingLogVolumes) ||
                        !isEmpty(databasesSharingDataLuns) ||
                        !isEmpty(databasesSharingLogLuns)
                    ) {
                        recommended = 'separate-data-log-lun-volume-for-large-database';
                        status = AssessmentStatus.NOT_OPTIMIZED;
                        severity = 'critical';
                        recommendationString =
                            'Place large database size (say 500GB or more) on a separate volume for faster recovery. This volume should also be backed up by separate jobs.';
                    }
                } else if (!isEmpty(databasesSharingDataLuns) || !isEmpty(databasesSharingLogLuns)) {
                    recommended = 'separate-data-log-lun-for-large-database';
                    status = AssessmentStatus.NOT_OPTIMIZED;
                    severity = 'critical';
                    recommendationString =
                        'Place large database size (say 500GB or more) on a separate volume for faster recovery. This volume should also be backed up by separate jobs.';
                } else if (!isEmpty(databasesSharingDataVolumes) || !isEmpty(databasesSharingLogVolumes)) {
                    recommended = 'separate-data-log-volume-for-large-database';
                    status = AssessmentStatus.NOT_OPTIMIZED;
                    severity = 'warning';
                    recommendationString =
                        'Consolidate small-to-medium size databases that are less critical or have fewer I/O requirements to a single volume';
                }

                driftAssessmentData.layout.push({
                    name: 'user-database-layout',
                    recommended,
                    status,
                    severity,
                    recommendation: recommendationString,
                    tags: [
                        AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
                        AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                    ],
                    current: status === AssessmentStatus.OPTIMIZED ? 'separate drive' : 'shared drive'
                });
            }
        });
    }

    if (errors && (errors.sizing || errors['volumes-footprint'])) {
        const errorMessage = errors.sizing || errors['volumes-footprint'];
        driftAssessmentData.sizing.push(
            { name: 'performance-tier', errorMessage },
            { name: 'tempdb-drive-size', errorMessage },
            { name: 'log-drive-size', errorMessage }
        );
    } else {
        Object.entries(sizing).forEach(async ([key, value]) => {
            let goldenData = sizingConfigData.find(data => data.parameter === key);

            let overProvisionedDrives;
            let underProvisionedDrives;
            let ignoredDrives;
            let currentSizePercentForAllVolumes;

            if (key === 'data-log-drive-details') {
                goldenData = sizingConfigData.find(data => data.parameter === 'log-drive-size');
            }
            if (key === 'data-tempdb-drive-details') {
                goldenData = sizingConfigData.find(data => data.parameter === 'tempdb-drive-size');
            }
            if (!isEmpty(goldenData)) {
                let currentSizeRange = '';
                let status = AssessmentStatus.NOT_OPTIMIZED;
                if (key === 'performance-tier') {
                    // Old assessment data has performance-tier as boolean, new assessment data has performance-tier as list of numbers

                    if (typeof value !== 'boolean') {
                        if (typeof value === 'number') {
                            value = [value];
                        }
                        const minSizePercent = Math.min(...value);
                        const maxSizePercent = Math.max(...value);
                        currentSizeRange =
                            minSizePercent === maxSizePercent
                                ? `${maxSizePercent}%`
                                : `${minSizePercent}% - ${maxSizePercent}%`;
                        value = minSizePercent === 100 && maxSizePercent === 100;
                    }
                    status = value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
                }
                if (key === 'data-log-drive-details') {
                    ({
                        key,
                        status,
                        overProvisionedDrives,
                        underProvisionedDrives,
                        ignoredDrives,
                        currentSizePercentForAllVolumes
                    } = getLogVolumeDrift(value, status, key));
                }
                if (key === 'data-tempdb-drive-details') {
                    ({
                        status,
                        key,
                        overProvisionedDrives,
                        underProvisionedDrives,
                        ignoredDrives,
                        currentSizePercentForAllVolumes
                    } = getTempDbVolumeDrift(value, status, key));
                }

                let missingPermissions: string[] = [];
                // Check for 'fsx:UpdateVolume' permissions
                if (
                    (key === 'tempdb-drive-size' || key === 'log-drive-size') &&
                    status !== AssessmentStatus.OPTIMIZED
                ) {
                    missingPermissions = await checkForMissingOptimizePermissions(credentialsId, region, [
                        'fsx:UpdateVolume'
                    ]);
                }

                if (currentSizePercentForAllVolumes !== undefined && currentSizePercentForAllVolumes.length > 0) {
                    const minSizePercent = Math.min(...currentSizePercentForAllVolumes);
                    const maxSizePercent = Math.max(...currentSizePercentForAllVolumes);
                    currentSizeRange =
                        minSizePercent === maxSizePercent
                            ? `${maxSizePercent}%`
                            : `${minSizePercent}% - ${maxSizePercent}%`;
                }
                driftAssessmentData.sizing.push({
                    name: key,
                    recommended: goldenData.value.toString(),
                    status,
                    severity: goldenData.severity,
                    recommendation: goldenData.recommendation,
                    tags: goldenData.tags,
                    sizingViolations: { overProvisionedDrives, underProvisionedDrives, ignoredDrives },
                    missingPermissions,
                    current: currentSizeRange
                });
            }
        });
    }

    // Headroom drift assessment

    try {
        const goldenData = sizingConfigData.find(data => data.parameter === 'headroom');
        const { status, headroomPercent, missingPermissions, newFsxStorageCapactiyGiB } = await getHeadroomDrift(
            credentialsId,
            region,
            filesystemId
        );

        driftAssessmentData.sizing.push({
            name: 'headroom',
            recommended: goldenData!.value.toString(),
            status,
            severity: goldenData!.severity,
            recommendation: goldenData!.recommendation,
            tags: goldenData!.tags,
            missingPermissions,
            recommendedSizeInGib: newFsxStorageCapactiyGiB ? Math.ceil(newFsxStorageCapactiyGiB) : 0,
            current: `${headroomPercent}%`
        });
    } catch (error: any) {
        logger.error(
            `Error while calculating headroom details for ${databaseHostId}, ${databaseInstanceId}, ${filesystemId}.`
        );
    }

    return driftAssessmentData;
}

export { calculateStorageDrift, getHeadroomDrift, getLogVolumeDrift, getTempDbVolumeDrift };
