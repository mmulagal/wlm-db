import { countBy, isEmpty, isNull } from 'lodash-es';
import createError from 'http-errors';
import moment from 'moment';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    ASSESSMENT_RESOURCE_TYPE
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';

import storageGoldenConfigData from './golden-configs/storage';
import { listDatabaseInstanceConfigData } from '../../lib/database/database-instance-config';
import {
    SizingViolationResponseType,
    StorageParameterDriftResponseType,
    StorageTierViolationResponseType
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
    logger.info('Checking for missing optimize permissions', { credentialsId, region, permissions });
    try {
        const missingPermissions: string[] = [];
        const { implicitlyDenied, explicitlyDenied } = await getMissingPermissionsList(
            credentialsId,
            region,
            permissions
        );
        const combinedDeniedPermissions = [...implicitlyDenied, ...explicitlyDenied];
        if (combinedDeniedPermissions.length > 0) {
            combinedDeniedPermissions.forEach(permission => {
                missingPermissions.push(`${permission.service}:${permission.action}`);
            });
        }
        return missingPermissions;
    } catch (error) {
        logger.error('Error while checking for missing optimize permissions', {
            credentialsId,
            region,
            permissions,
            error
        });
    }
}

function getLogVolumeDrift(logVolumes: LogDriveDetails[], status: AssessmentStatus, key: string) {
    logger.info('Getting log volume drift', logVolumes);

    const overProvisionedDrives: SizingViolationResponseType[] = [];
    const underProvisionedDrives: SizingViolationResponseType[] = [];
    const ignoredDrives: SizingViolationResponseType[] = [];
    const optimisedDrives: SizingViolationResponseType[] = [];

    const driveDetails = Array.isArray(logVolumes) ? logVolumes : [logVolumes];

    const filteredDriveDetails: LogDriveDetails[] = driveDetails.reduce((acc: LogDriveDetails[], driveDetail) => {
        // Case 1: Log drive is shared by multiple databases
        // Case 2: Log drive is shared by multiple data drives possibly from different databases
        // Both the cases are handled here
        const logDrive = acc.find(el => el.diskNumber === driveDetail.diskNumber);
        if (logDrive) {
            // Add all data drives to the same log drive - DBS-4838
            if (!driveDetail.dataAccessPath?.includes(logDrive.dataAccessPath)) {
                logDrive.dataAccessPath += `,${driveDetail.dataAccessPath}`;
            }
            if (!driveDetail.databaseName?.includes(logDrive.databaseName)) {
                logDrive.databaseName += `,${driveDetail.databaseName}`;
            }
            logDrive.dataDriveTotalSizeMB += driveDetail.dataDriveTotalSizeMB;
        } else {
            // There is already a log drive with the same databaseName
            const logDriveItem = acc.find(el => el.databaseName === driveDetail.databaseName);
            if (!logDriveItem) {
                acc.push(driveDetail);
            }
        }
        return acc;
    }, []);

    const currentSizePercentForAllVolumes: number[] = [];
    const drivesCount = filteredDriveDetails.length;
    filteredDriveDetails.forEach((drive: LogDriveDetails) => {
        let { dataAccessPath, logAccessPath, dataDriveTotalSizeMB, logDriveTotalSizeMB } = drive;
        if (isNull(logDriveTotalSizeMB) || isNull(dataDriveTotalSizeMB)) {
            logDriveTotalSizeMB = 0;
            dataDriveTotalSizeMB = 0;
        }
        const formattedDriveInfo = {
            ...drive,
            dataDriveTotalSizeMB,
            logDriveTotalSizeMB,
            dataAccessPath: dataAccessPath ? [...new Set(dataAccessPath.split(','))] : [],
            databases: [...new Set(drive.databaseName.split(','))]
        };
        if (!dataAccessPath || !logAccessPath || !dataDriveTotalSizeMB || !logDriveTotalSizeMB) {
            ignoredDrives.push(formattedDriveInfo as SizingViolationResponseType);
        } else if (dataAccessPath !== logAccessPath) {
            const logToDriveSizePercent = Math.ceil((logDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
            currentSizePercentForAllVolumes.push(logToDriveSizePercent);
            if (logToDriveSizePercent > 30) {
                overProvisionedDrives.push(formattedDriveInfo as SizingViolationResponseType);
            } else if (logToDriveSizePercent < 20) {
                underProvisionedDrives.push(formattedDriveInfo as SizingViolationResponseType);
            } else {
                optimisedDrives.push(formattedDriveInfo as SizingViolationResponseType);
            }
        } else {
            ignoredDrives.push(formattedDriveInfo as SizingViolationResponseType);
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
            : !isEmpty(ignoredDrives)
            ? AssessmentStatus.NOT_OPTIMIZED
            : AssessmentStatus.OPTIMIZED;

    return {
        key,
        status,
        overProvisionedDrives,
        underProvisionedDrives,
        ignoredDrives,
        optimisedDrives,
        currentSizePercentForAllVolumes,
        drivesCount
    };
}

function getTempDbVolumeDrift(value: TempDbDriveDetails, status: AssessmentStatus, key: string) {
    logger.info('Getting tempdb volume drift', value);

    const overProvisionedDrives: SizingViolationResponseType[] = [];
    const underProvisionedDrives: SizingViolationResponseType[] = [];
    const ignoredDrives: SizingViolationResponseType[] = [];
    const currentSizePercentForAllVolumes: number[] = [];

    let tempdbPercent = 0;
    let { dataDriveTotalSizeMB, tempdbDriveTotalSizeMB, defaultDataDriveLetter, tempdbDriveLetter, ontapVolumeUuid } =
        value;

    if (isNull(tempdbDriveTotalSizeMB) || isNull(dataDriveTotalSizeMB)) {
        tempdbDriveTotalSizeMB = 0;
        dataDriveTotalSizeMB = 0;
    }
    value = {
        ...value,
        dataDriveTotalSizeMB,
        tempdbDriveTotalSizeMB
    };

    if (defaultDataDriveLetter === tempdbDriveLetter) {
        status = AssessmentStatus.NOT_OPTIMIZED;

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

    const cwMetricsDataCollectionPeriodSeconds = 1 * 60 * 60; // 1 hour
    const cwMetricsDataCollectionPeriod = '1h'; // 1 hour

    const { totalUsed } = await calculateFsxnStorageEfficiencyUsingCloudwatch(
        region,
        credentialsId,
        fileSystemId,
        cwMetricsDataCollectionPeriodSeconds,
        cwMetricsDataCollectionPeriod
    );

    const headroomPercent = Math.ceil(((ssdStorageCapacityInBytes - totalUsed) / ssdStorageCapacityInBytes) * 100);
    const minSSdStorageCapacityInBytes = convertToBytes(1024, 'GiB');
    const status =
        headroomPercent < 35
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
        missingPermissions =
            (await checkForMissingOptimizePermissions(credentialsId, region, ['fsx:UpdateFileSystem'])) || [];
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
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const driftAssessmentData: StorageParameterDriftResponseType = {
        timestamp: moment(persistedConfigurationData.creation_time).unix() * 1000,
        configuration: { volumes: [], luns: [], os: [] },
        sizing: [],
        layout: [],
        fileSystems: []
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
                tags: config.tags,
                totalObjectsAssessed: volumes.length,
                resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME
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
                objectsInViolation: [...new Set(objectsInViolation)],
                severity: config.severity,
                recommendation: config.recommendation,
                tags: config.tags,
                totalObjectsAssessed: luns.length,
                resourceType: ASSESSMENT_RESOURCE_TYPE.LUN
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

    // Complete layout and sizing assessment failure
    if (errors && errors.layout) {
        driftAssessmentData.layout.push(
            { name: 'data-files-location', errorMessage: errors.layout },
            { name: 'log-files-location', errorMessage: errors.layout },
            { name: 'tempdb-files-location', errorMessage: errors.layout }
        );
    } else {
        let defaultLogFilesAssessment;
        let defaultDataFilesAssessment;
        let userDatabaseLayoutAssessment = { data: [], log: [] };
        let tempdbFilesLocationAssessment;
        Object.entries(layout).forEach(([key, value]) => {
            if (key === 'default-log-files-location') {
                defaultLogFilesAssessment = value;
            } else if (key === 'default-data-files-location') {
                defaultDataFilesAssessment = value;
            } else if (key === 'user-database-layout') {
                userDatabaseLayoutAssessment = value;
            } else if (key === 'tempdb-files-location') {
                tempdbFilesLocationAssessment = value;
            }
        });

        let goldenData = layoutConfigData.find(data => data.parameter === 'tempdb-files-location');
        if (errors && !isEmpty(errors['tempdb-files-location'])) {
            driftAssessmentData.layout.push({
                name: 'tempdb-files-location',
                errorMessage: errors['tempdb-files-location']
            });
        } else if (!isEmpty(goldenData)) {
            const status =
                goldenData?.value === tempdbFilesLocationAssessment
                    ? AssessmentStatus.OPTIMIZED
                    : AssessmentStatus.NOT_OPTIMIZED;
            driftAssessmentData.layout.push({
                name: 'tempdb-files-location',
                recommended: goldenData.value.toString(),
                status,
                severity: goldenData.severity,
                recommendation: goldenData.recommendation,
                tags: goldenData.tags,
                current: status === AssessmentStatus.OPTIMIZED ? 'separate drive' : 'shared drive',
                objectsInViolation: status === AssessmentStatus.OPTIMIZED ? [] : ['tempdb'],
                totalObjectsAssessed: 1,
                resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE
            });
        }

        let dataFilesLayoutStatus = AssessmentStatus.OPTIMIZED;
        let logFilesLayoutStatus = AssessmentStatus.OPTIMIZED;
        let recommended = 'separate drive';
        let recommendationString =
            'Separating data and log files onto different drives improves performance by allowing simultaneous I/O activity it also allows independent backup schedules and leverage fast and granular restore functionality';
        let severity = 'critical';
        let databasesInViolation: string[] = [];
        goldenData = layoutConfigData.find(data => data.parameter === 'default-data-files-location');
        if (!isEmpty(goldenData)) {
            dataFilesLayoutStatus =
                goldenData?.value === defaultDataFilesAssessment
                    ? AssessmentStatus.OPTIMIZED
                    : AssessmentStatus.NOT_OPTIMIZED;
            databasesInViolation = dataFilesLayoutStatus === AssessmentStatus.NOT_OPTIMIZED ? ['system'] : [];
        }
        goldenData = layoutConfigData.find(data => data.parameter === 'default-log-files-location');
        if (!isEmpty(goldenData)) {
            logFilesLayoutStatus =
                goldenData?.value === defaultLogFilesAssessment
                    ? AssessmentStatus.OPTIMIZED
                    : AssessmentStatus.NOT_OPTIMIZED;
            databasesInViolation = dataFilesLayoutStatus === AssessmentStatus.NOT_OPTIMIZED ? ['system'] : [];
        }

        const dataVolumes = userDatabaseLayoutAssessment?.data;
        const logVolumes = userDatabaseLayoutAssessment?.log;
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

        if (!isEmpty(databasesOnSameDataLogLun)) {
            recommended = 'separate-data-log-lun-per-database';
            dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            severity = 'critical';
            recommendationString =
                'Separate system databases from user databases to different drives/luns and different volumes';
            databasesInViolation = databasesOnSameDataLogLun.map(data => data.name);
        } else if (!isEmpty(databasesOnSameDataLogVolume)) {
            recommended = 'separate-data-log-volume-per-database';
            dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            severity = 'warning';
            recommendationString =
                'Separate system databases from user databases to different drives/luns and different volumes';
            databasesInViolation = databasesOnSameDataLogVolume.map(data => data.name);
        } else if (databasesAbove500Gb.length > 1) {
            if (
                !isEmpty(databasesSharingDataVolumes) ||
                !isEmpty(databasesSharingLogVolumes) ||
                !isEmpty(databasesSharingDataLuns) ||
                !isEmpty(databasesSharingLogLuns)
            ) {
                recommended = 'separate-data-log-lun-volume-for-large-database';
                dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
                logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
                severity = 'critical';
                recommendationString =
                    'Place large database size (say 500GB or more) on a separate volume for faster recovery. This volume should also be backed up by separate jobs.';
                databasesInViolation = databasesAbove500Gb.map(data => data.name);
            }
        } else if (!isEmpty(databasesSharingDataLuns) || !isEmpty(databasesSharingLogLuns)) {
            if (!isEmpty(databasesSharingDataLuns)) {
                dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            } else {
                logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            }
            recommended = 'separate-data-log-lun-for-large-database';
            severity = 'critical';
            recommendationString =
                'Place large database size (say 500GB or more) on a separate volume for faster recovery. This volume should also be backed up by separate jobs.';
            databasesInViolation = databasesAbove500Gb.map(data => data.name);
        } else if (!isEmpty(databasesSharingDataVolumes) || !isEmpty(databasesSharingLogVolumes)) {
            if (!isEmpty(databasesSharingDataVolumes)) {
                dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            } else {
                logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            }
            recommended = 'separate-data-log-volume-for-large-database';
            severity = 'warning';
            recommendationString =
                'Consolidate small-to-medium size databases that are less critical or have fewer I/O requirements to a single volume';
            databasesInViolation = databasesAbove500Gb.map(data => data.name);
        }

        driftAssessmentData.layout.push(
            {
                name: 'data-files-location',
                recommended,
                status: dataFilesLayoutStatus,
                severity,
                recommendation: recommendationString,
                tags: [
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ],
                current: dataFilesLayoutStatus === AssessmentStatus.OPTIMIZED ? 'separate drive' : 'shared drive',
                objectsInViolation: [...new Set(databasesInViolation)],
                totalObjectsAssessed: dataLogVolumeDetails.length,
                resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE
            },

            {
                name: 'log-files-location',
                recommended,
                status: logFilesLayoutStatus,
                severity,
                recommendation: recommendationString,
                tags: [
                    AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY,
                    AwsWellArchitecturedPillars.OPERATIONAL_EXCELLENCE
                ],
                current: logFilesLayoutStatus === AssessmentStatus.OPTIMIZED ? 'separate drive' : 'shared drive',
                objectsInViolation: [...new Set(databasesInViolation)],
                totalObjectsAssessed: dataLogVolumeDetails.length,
                resourceType: ASSESSMENT_RESOURCE_TYPE.DATABASE
            }
        );
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
            let storageTierViolations: StorageTierViolationResponseType[] = [];
            let totalObjectsAssessed = 1;
            let resourceType = ASSESSMENT_RESOURCE_TYPE.VOLUME;

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
                    const details = value;
                    if (typeof value !== 'boolean') {
                        // DBS-4648 FIX
                        // By default, when a list as a single element PS returns the element instead of a list.
                        // Script has been updated to return a list even if it has a single element. However, older data still has single element so the fix.
                        if (typeof value === 'number') {
                            value = [value];
                        } else {
                            storageTierViolations = details
                                .filter(
                                    (volumeDetail: { performanceTierPercent: number; volumeName: string } | number) =>
                                        typeof volumeDetail !== 'number' && volumeDetail.performanceTierPercent !== 100
                                )
                                .map((volumeDetail: { performanceTierPercent: number; volumeName: string }) => ({
                                    name: volumeDetail.volumeName,
                                    percent: volumeDetail.performanceTierPercent
                                }));
                            value = details.map(
                                (volumeDetail: { performanceTierPercent: number }) =>
                                    volumeDetail.performanceTierPercent
                            );
                        }
                        totalObjectsAssessed = value.length;
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
                        currentSizePercentForAllVolumes,
                        drivesCount: totalObjectsAssessed
                    } = getLogVolumeDrift(value, status, key));
                    resourceType = ASSESSMENT_RESOURCE_TYPE.DRIVE;
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
                    resourceType = ASSESSMENT_RESOURCE_TYPE.DATABASE;
                }

                let missingPermissions: string[] = [];
                // Check for 'fsx:UpdateVolume' permissions
                if (
                    (key === 'tempdb-drive-size' || key === 'log-drive-size') &&
                    status !== AssessmentStatus.OPTIMIZED
                ) {
                    missingPermissions =
                        (await checkForMissingOptimizePermissions(credentialsId, region, ['fsx:UpdateVolume'])) || [];
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
                    current: currentSizeRange,
                    totalObjectsAssessed,
                    storageTierViolations,
                    resourceType
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
            current: `${headroomPercent}%`,
            resourceType: ASSESSMENT_RESOURCE_TYPE.FILE_SYSTEM
        });
    } catch (error: any) {
        logger.error(
            `Error while calculating headroom details for ${databaseHostId}, ${databaseInstanceId}, ${filesystemId}.`,
            error
        );
    }

    // Add file system id to the response
    driftAssessmentData.fileSystems.push(filesystemId);

    return driftAssessmentData;
}

export { calculateStorageDrift, getHeadroomDrift, getLogVolumeDrift, getTempDbVolumeDrift };
