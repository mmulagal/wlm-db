import { countBy, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import Promise from 'bluebird';
import { CpuVendorArchitecture } from '@aws-sdk/client-compute-optimizer';
import moment from 'moment';
import getLogger from '../utils/logger';
import {
    calculateFsxStorageCapacityForHeadroomOptimization,
    convertToBytes,
    getEc2Arn,
    isDemo,
    sqlResponseParsing
} from '../utils/utils';
import { getFsxStorageDetails, getMappedOntapVolumes } from './aws/fsx-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { getInstanceDetails, MappedOnTapVolumeResponse } from './database-hosts-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from './workloads/mssql/continuous-optimization-scripts';
import storageGoldenConfigData from './continuous-optimization/golden-configs/storage';
import {
    ComputeAssessment,
    DatabaseInstance,
    databaseInstanceMetadata,
    DatabaseInstancesIncludingResource,
    LicenseAssessment,
    LogDriveDetails,
    Metadata,
    StorageAssessment,
    TempDbDriveDetails,
    WorkloadInstance
} from '../utils/common-types';
import {
    AuditStatus,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    ENT_ENGINE_EDITION,
    FINDING,
    HttpErrorCodes,
    RESOURCESTYPE,
    SQL_STD
} from '../utils/consts';
import { getJobDetails, registerJob, updateJobDetails } from './database/job-operations';

import {
    listAllManagedInstances,
    listDatabaseInstances,
    listResources,
    updateResourceMetaData
} from '../lib/database/db';
import { getEC2InstanceRecommendations } from '../lib/aws/compute-optimizer';
import {
    checkComputeOptimizerEnrollmentStatus,
    fetchSqlServerInstanceConfiguration,
    getLicenseRecommendations
} from './recommendation-operations';
import { translateFindingReasonCode } from './aws/compute-optimizer-operations';
import {
    AssessmentCategories,
    AssessmentStatus,
    AssessmentTriggeredBy,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../utils/continous-optimization-consts';
import {
    ComputeDriftResponseType,
    DriftAssessmentResponseType,
    LicenseDriftResponseType,
    ParameterDriftResponseType,
    SizingViolationResponseType,
    StorageParameterDriftResponseType
} from '../routes/types/continuous-optimization.types';
import { getInstanceInfo } from './database/database-operations';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../lib/database/database-instance-config';
import { listJobs } from '../lib/database/job';
import getMissingPermissionsList from './aws/iam-operations';
import { getHostAndSqlServerInfo } from './discover-operations';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import { calculateFsxnStorageEfficiencyUsingCloudwatch } from './aws/cloud-watch-operations';

const isDemoFlow = isDemo();
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
        driftAssessmentData.configuration.os.push({ errorMessage: errors['mpio-policy'] });
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
        driftAssessmentData.layout.push({ errorMessage: errors.layout });
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

    if (errors && errors.sizing) {
        driftAssessmentData.sizing.push({ errorMessage: errors.sizing });
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
    if (errors && errors.sizing) {
        driftAssessmentData.sizing.push({ errorMessage: errors.sizing });
    } else {
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
    }

    return driftAssessmentData;
}

async function calculateComputeDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Calculating compute drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    let errorMessage = '';
    try {
        let finding;
        let findingReasonCodes;
        let currentInstanceType;
        let recommendationOptions;

        const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
        const { assessment: { compute } = {} } = metadata as unknown as Metadata;
        if (!isEmpty(compute)) {
            ({ finding, findingReasonCodes, currentInstanceType, recommendationOptions } =
                compute as ComputeAssessment);
        } else {
            const { activeNodeInstanceId, cloudProviderAccountId, resourceName } = await getInstanceDetails(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId
            );
            ({ finding, findingReasonCodes, currentInstanceType, recommendationOptions } =
                (await initiateComputeAssessment(
                    cloudProviderAccountId!,
                    accountId,
                    credentialsId,
                    region,
                    activeNodeInstanceId,
                    resourceName!
                )) || {});
            const existingAssessmentData = (metadata as unknown as Metadata).assessment;
            (metadata as unknown as Metadata).assessment = {
                ...existingAssessmentData,
                compute: { finding, findingReasonCodes, currentInstanceType, recommendationOptions }
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

        let recommendationMessage =
            'Your current instance is being analyzed for rightsizing. Please check back later for recommendations.';
        let findingValue = AssessmentStatus.ANALYZING;
        let objectsInViolation: string[] = [];

        if (finding) {
            findingValue = getMatchingAssessmentStatus(finding);
            const underProvisionedRecommendationMessage = `Your current instance ${currentInstanceType} is under-provisioned. We recommend upgrading it to meet your workload demands. This will provide additional CPU, memory, and I/O capacity, ensuring better performance for your SQL Server DB.`;
            const overProvisionedRecommendationMessage = `Your current instance ${currentInstanceType} is over-provisioned. We recommend downgrading it to reduce costs. This instance type will still meet the performance needs of your SQL Server DB while saving on unnecessary expenses.`;

            if (findingValue.includes('provisioned')) {
                // under_provisioned or over_provisioned
                const genericRecommendationMessage =
                    'Click Optimize to view cost comparison between current and recommended instance types to understand potential savings.';
                recommendationMessage =
                    findingValue === AssessmentStatus.UNDER_PROVISIONED
                        ? underProvisionedRecommendationMessage
                        : overProvisionedRecommendationMessage;
                recommendationMessage += ` ${genericRecommendationMessage}`;
            } else {
                recommendationMessage = 'Your current instance is optimized for your workload.';
            }

            objectsInViolation = findingReasonCodes?.map(code => translateFindingReasonCode(code));
        }

        return {
            name: 'compute-rightsizing',
            status: findingValue,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation: recommendationMessage,
            objectsInViolation,
            tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
            recommendationOptions
        };
    } catch (error: any) {
        errorMessage = `Error while calculating compute drift. ${error.message}`;
        logger.error({ errorMessage, error });
    }
    return { errorMessage };
}

async function calculateLicenseDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Calculating license drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    let errorMessage = '';
    try {
        let licenseAssessment;

        const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
        const { assessment: { license } = {} } = metadata as unknown as Metadata;
        if (!isEmpty(license)) {
            licenseAssessment = license as LicenseAssessment;
        } else {
            const { activeNodeInstanceId } = await getInstanceDetails(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId
            );
            licenseAssessment = await runLicenseAssessment(accountId, credentialsId, region, activeNodeInstanceId);
            const existingAssessmentData = (metadata as unknown as Metadata).assessment;
            (metadata as unknown as Metadata).assessment = {
                ...existingAssessmentData,
                license: licenseAssessment
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

        const { licenseFinding, sqlServerInstances } = licenseAssessment;
        const matchingLicenseAssessmentStatus = getMatchingAssessmentStatus(licenseFinding);
        const recommendationMessage =
            licenseFinding === FINDING.NOT_OPTIMIZED
                ? 'When Workload Factory detects that your database infrastructure is not using any of the commercial software license features you are paying for, a license is considered not optimized. A license that is not optimized might result in unnecessary additional costs.'
                : 'When the license for your commercial software database meets your performance requirements, the license is considered optimized';

        return {
            name: 'sql-license',
            status: matchingLicenseAssessmentStatus,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation: recommendationMessage,
            tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION],
            sqlServerInstances
        };
    } catch (error: any) {
        errorMessage = `Error while calculating license drift. ${error.message}`;
        logger.error({ errorMessage, error });
    }
    return { errorMessage };
}

async function managedHostsLicenseAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    resourceName: string,
    parentJobId?: string
) {
    const { id: licenseAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL server license assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL server license assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let licenseAssessment;
    let jobStatus;
    let errorMessage;
    try {
        licenseAssessment = await runLicenseAssessment(accountId, credentialsId, region, activeNodeInstanceId);
    } catch (error) {
        errorMessage = `Error while performing license assessment. ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, licenseAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }

    return licenseAssessment;
}

async function runLicenseAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
) {
    const { items: [{ sqlServerInstances = [] } = {}] = [] } = await getHostAndSqlServerInfo(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        [activeNodeInstanceId]
    );
    const { sqlServerDeploymentType = '' } = fetchSqlServerInstanceConfiguration(sqlServerInstances) || {};
    if (sqlServerInstances.some(instance => instance.sqlServerEngineEdition === ENT_ENGINE_EDITION)) {
        return getLicenseRecommendations(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId,
            sqlServerInstances,
            sqlServerDeploymentType
        );
    }
    return {
        licenseFinding: FINDING.OPTIMIZED,
        recommendedLicenseType: SQL_STD,
        sqlServerInstances
    };
}

async function managedHostsComputeAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    awsAccountId: string,
    activeNodeInstanceId: string,
    resourceName: string,
    parentJobId: string
) {
    const { id: computeAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL server compute assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL server compute assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let computeAssessment;
    let jobStatus;
    let errorMessage;
    try {
        computeAssessment =
            (await initiateComputeAssessment(
                awsAccountId!,
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName!
            )) || {};
    } catch (error) {
        errorMessage = `Error while performing compute assessment. ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, computeAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }
    return computeAssessment;
}

async function initiateComputeLicenseAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    resourceName: string,
    jobId: string,
    fields: string[]
) {
    logger.info('Initiate compute/license assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName,
        jobId,
        fields
    });

    const [{ metadata, cloud_provider_account_id: awsAccountId }] = await listResources(
        accountId,
        databaseHostId,
        credentialsId,
        region
    );
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { activeNodeInstanceId = '' } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );
    if (metadata && activeNodeInstanceId) {
        let licenseAssessment;
        let computeAssessment;
        if (fields?.includes(AssessmentCategories.LICENSE)) {
            licenseAssessment = await managedHostsLicenseAssessment(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName,
                jobId
            );
        }
        if (fields?.includes(AssessmentCategories.COMPUTE)) {
            computeAssessment = await managedHostsComputeAssessment(
                accountId,
                credentialsId,
                region,
                awsAccountId!,
                activeNodeInstanceId,
                resourceName,
                jobId
            );
        }
        if (!isEmpty(licenseAssessment) || !isEmpty(computeAssessment)) {
            (metadata as unknown as Metadata).assessment = {
                license: licenseAssessment || undefined,
                compute: computeAssessment || undefined
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }
    } else {
        logger.error('No active node found for the resource', { accountId, databaseHostId, credentialsId, region });
    }
}
async function initiateStorageAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    jobId: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Initiating storage assessment data collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        jobId,
        instanceRecord
    });

    const instanceVolumeMapping = ((await getMappedOntapVolumes(
        credentialsId,
        region,
        instanceRecord.fsxFileSystem,
        false,
        instanceRecord.activeNodeInstanceid,
        [instanceRecord.name],
        instanceRecord.sqlAuthEnabled,
        true
    )) as MappedOnTapVolumeResponse[]) || [{ volumeUuids: [], volumeDBMap: {}, lunNames: [] }];

    const volumeRecords =
        Object.values(instanceVolumeMapping)
            ?.map(i => i?.volumeRecords)
            .flat() || [];
    instanceRecord.mappedVolumesUuids = volumeRecords.map(volume => volume.uuid as string);
    instanceRecord.mappedVolumeNames = volumeRecords.map(volume => volume.name as string);

    instanceRecord.mappedLunNames =
        Object.values(instanceVolumeMapping)
            ?.map(i => i.lunNames)
            .flat() || [];

    const command = [STORAGE_CONFIGURATION_ASSESSMENT(instanceRecord)];

    const response = await callSsmExecution(
        credentialsId,
        region,
        command,
        instanceRecord.activeNodeInstanceid,
        accountId,
        false,
        CUSTOM_SSM_EXECUTION_TIMEOUT
    );

    const parsedResponse = response ? sqlResponseParsing(response) : {};

    await createDatabaseInstanceConfigData([
        {
            account_id: accountId,
            credentials_id: credentialsId,
            region,
            resource_id: databaseHostId,
            database_instance_id: instanceRecord.id,
            creation_time: new Date(Date.now()),
            config_data_type: AssessmentCategories.STORAGE,
            config_data: parsedResponse
        }
    ]);

    const resourceWithInstanceName = `${instanceRecord.resourceName}\\${instanceRecord.name}`;
    const { volumes, luns, os, layout, sizing } = parsedResponse as unknown as StorageAssessment;
    const configJobStatus = isDemo()
        ? JOBSTATUS.COMPLETED
        : isEmpty(volumes) && isEmpty(luns) && isEmpty(os)
        ? JOBSTATUS.FAILED
        : !isEmpty(volumes) && !isEmpty(luns) && !isEmpty(os)
        ? JOBSTATUS.COMPLETED
        : JOBSTATUS.WARNING;

    await registerJob(accountId, credentialsId, region, {
        name: 'Storage configuration assessment',
        description: 'Storage configuration assessment',
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        endTime: Date.now(),
        status: configJobStatus,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    await registerJob(accountId, credentialsId, region, {
        name: 'Storage layout assessment',
        description: 'Storage layout assessment',
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        endTime: Date.now(),
        status: isDemo() ? JOBSTATUS.COMPLETED : isEmpty(layout) ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    await registerJob(accountId, credentialsId, region, {
        name: 'Storage sizing assessment',
        description: 'Storage sizing assessment',
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        endTime: Date.now(),
        status: isDemo() ? JOBSTATUS.COMPLETED : isEmpty(sizing) ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
}

async function initiateComputeAssessment(
    awsAccountId: string,
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    resourceName: string
) {
    logger.info('Initiate compute assessment', {
        awsAccountId,
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        resourceName
    });
    let errorMessage = '';
    try {
        await checkComputeOptimizerEnrollmentStatus(accountId, credentialsId, region);

        const resourceArn = getEc2Arn(awsAccountId, region, ec2InstanceId);
        const computeOptimizerInstanceRecommendations = await getEC2InstanceRecommendations(
            region,
            credentialsId,
            accountId,
            {
                instanceArns: [resourceArn],
                recommendationPreferences: {
                    cpuVendorArchitectures: [CpuVendorArchitecture.CURRENT] // CURRENT to view recommendations that are based on the same CPU vendor and architecture as the current instance.
                }
            }
        );
        const {
            instanceRecommendations: [
                {
                    currentInstanceType = '',
                    finding = '',
                    findingReasonCodes = [],
                    recommendationOptions: coRecOptions = []
                } = {}
            ] = []
        } = computeOptimizerInstanceRecommendations || {};
        return {
            currentInstanceType,
            finding,
            findingReasonCodes,
            recommendationOptions: coRecOptions
                ?.filter(
                    ({ instanceType, platformDifferences }) =>
                        platformDifferences?.length === 0 && /^[mcr]/.test(instanceType!)
                )
                ?.map(
                    ({ instanceType, rank, savingsOpportunity, platformDifferences }) => ({
                        instanceType,
                        rank,
                        savingsOpportunity,
                        platformDifferences
                    }) // return only such recommandation options that has no platform difference. Migration to different platform cannot be supported programatically from our application.
                )
        } as ComputeAssessment;
    } catch (error: any) {
        errorMessage = `Failed to get compute optimizer recommendation options for the selected database host during Continuous Optimization. ${error.message}`;
        logger.error({ errorMessage, error });
        throw Error(errorMessage);
    }
}

async function updateMasterAssessment(accountId: string, masterAssessmentJobId: string) {
    logger.info('Updating master assessment', { accountId, masterAssessmentJobId });

    const masterAssessmentJob = await getJobDetails(accountId, masterAssessmentJobId);
    if (masterAssessmentJob.status !== JOBSTATUS.FAILED) {
        const allSubJobs = await listJobs(accountId, '', '', masterAssessmentJobId);
        const masterJobStatus = allSubJobs.some(job => job.status === JOBSTATUS.IN_PROGRESS)
            ? JOBSTATUS.IN_PROGRESS
            : allSubJobs.every(job => job.status === JOBSTATUS.FAILED)
            ? JOBSTATUS.FAILED
            : allSubJobs.every(job => job.status === JOBSTATUS.COMPLETED)
            ? JOBSTATUS.COMPLETED
            : allSubJobs.some(job => job.status === JOBSTATUS.FAILED)
            ? JOBSTATUS.WARNING
            : JOBSTATUS.IN_PROGRESS;

        await updateJobDetails(accountId, masterAssessmentJobId, {
            status: masterJobStatus,
            endTime: Date.now()
        });
    }
}

async function driftAssessmentDataCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    jobId: string,
    databaseHostId: string,
    databaseInstanceRecord: WorkloadInstance,
    fields?: string
) {
    logger.info('Drift assessment data collection', {
        accountId,
        credentialsId,
        region,
        jobId,
        databaseHostId,
        databaseInstanceRecord,
        fields
    });

    let fieldsValues: Array<string> = [AssessmentCategories.STORAGE];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const shouldRunStorageAssessment = fieldsValues?.includes(AssessmentCategories.STORAGE.toLocaleLowerCase());
    const shouldRunComputeAssessment = fieldsValues?.includes(AssessmentCategories.COMPUTE.toLocaleLowerCase());
    const shouldRunLicenseAssessment = fieldsValues?.includes(AssessmentCategories.LICENSE.toLocaleLowerCase());

    if (shouldRunStorageAssessment) {
        await initiateStorageAssessmentCollection(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            jobId,
            databaseInstanceRecord
        );
    }

    if (shouldRunComputeAssessment || shouldRunLicenseAssessment) {
        await initiateComputeLicenseAssessmentCollection(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceRecord.resourceName,
            jobId,
            fieldsValues
        );
    }
}

async function triggerAssessment(
    managedInstance: DatabaseInstancesIncludingResource,
    parentJobId: string,
    fields?: string
) {
    logger.info('Triggering drift assessment ', { managedInstance, parentJobId, fields });

    let jobStatus: string = JOBSTATUS.COMPLETED;
    let errorMessage = '';
    const {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId,
        database_instance_name: databaseInstanceName,
        resource
    } = managedInstance;

    const { resource_name: resourceName } = resource;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const instanceDetailsForJob = JSON.stringify({
        hostName: resourceName,
        resourceId: databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        sqlServerDeploymentType: RESOURCESTYPE.MSSQL
    });

    let activeNodeInstanceId;
    let newDatabaseInstanceDetails;
    let cloudProviderAccountId;
    try {
        const instanceDetails = await getInstanceDetails(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );

        activeNodeInstanceId = instanceDetails.activeNodeInstanceId;
        newDatabaseInstanceDetails = instanceDetails.newDatabaseInstanceDetails;
        cloudProviderAccountId = instanceDetails.cloudProviderAccountId;
    } catch (error) {
        errorMessage = `Error while fetching instance details: ${accountId} ${databaseInstanceId}. Error: ${error}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
    }

    const jobName = `Assess SQL Server instance ${resourceWithInstanceName}`;
    const jobDescription = `Assess SQL Server instance ${resourceWithInstanceName}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });
    try {
        const {
            database_instance_name: savedInstanceName,
            fsxn_ids: fileSystemId,
            sqlAuthEnabled
        } = newDatabaseInstanceDetails || {};

        const instanceRecord: WorkloadInstance = {
            id: databaseInstanceId,
            name: savedInstanceName!,
            type: RESOURCESTYPE.MSSQL,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            activeNodeInstanceid: activeNodeInstanceId!,
            fsxFileSystem: fileSystemId!,
            cloudProviderAccountId: cloudProviderAccountId || '',
            resourceName: resource.resource_name || ''
        };
        await driftAssessmentDataCollection(
            accountId,
            credentialsId,
            region,
            jobId,
            databaseHostId,
            instanceRecord,
            fields
        );
    } catch (error: any) {
        logger.error(error);
        errorMessage = error.message || 'Internal Server Error';
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, jobId, {
            error: errorMessage,
            status: jobStatus,
            endTime: Date.now()
        });
    }
}

async function triggerDriftAssessmentDataCollection(initiatedBy: string, fields?: string) {
    logger.info('Trigger drift assessment per account', { initiatedBy });

    const allManagedInstances = (await listAllManagedInstances()) as DatabaseInstancesIncludingResource[];
    if (isEmpty(allManagedInstances)) {
        logger.info('No successfully managed database instances found.');
        return;
    }

    // group managed instances by account_id
    const managedInstancesGroupedByAccountId: { [key: string]: DatabaseInstancesIncludingResource[] } =
        allManagedInstances.reduce((acc: { [key: string]: DatabaseInstancesIncludingResource[] }, managedInstance) => {
            const key = `${managedInstance.account_id}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(managedInstance);
            return acc;
        }, {} as { [key: string]: DatabaseInstancesIncludingResource[] });

    await Promise.all(
        Object.entries(managedInstancesGroupedByAccountId).map(async ([accountId, managedInstances]) => {
            if (isEmpty(managedInstances)) {
                const errorMessage = `No managed instances found for account ${accountId}.`;
                logger.info(errorMessage);
            } else {
                const jobDescription = `Assess online SQL Server instances out of ${managedInstances.length} managed instances in your account ${accountId} for best practice misalignments.`;
                let parentJobStatus = '';
                const { id: parentJobId } = await registerJob(accountId, '', '', {
                    name: jobDescription,
                    description: jobDescription,
                    resourceName: accountId,
                    initiator: initiatedBy.toLocaleUpperCase(),
                    startTime: Date.now(),
                    status: JOBSTATUS.IN_PROGRESS,
                    type: JOBTYPE.ASSESSMENT
                });
                const assessmentErrors: unknown[] = [];
                try {
                    await Promise.all(
                        managedInstances.map(
                            async managedInstance => {
                                try {
                                    await triggerAssessment(managedInstance, parentJobId, fields);
                                } catch (error) {
                                    assessmentErrors.push(error);
                                }
                            },
                            {
                                concurrency: 1
                            }
                        )
                    );

                    if (assessmentErrors.length === managedInstances.length) {
                        const errorMessage = `No managed instance is up and running in account ${accountId}.`;
                        logger.info(errorMessage);
                        await updateJobDetails(accountId, parentJobId, {
                            status: JOBSTATUS.WARNING,
                            error: errorMessage,
                            endTime: Date.now()
                        });
                    } else {
                        // Proceeding with compute and license assessment at host level
                        const uniqueResMap = new Map(
                            managedInstances.map(({ resource }) => [
                                `${resource.account_id} + ${resource.credentials_id} + ${resource.id}`,
                                resource
                            ])
                        ); // create a map with unique resources; key being (accountId,credsId,resourceId unique combination) and value being actual resource
                        const uniqueResources = Array.from(uniqueResMap.values()); // getting all the unique resources from the map

                        await Promise.all(
                            uniqueResources.map(
                                async ({
                                    account_id: wfAccountId,
                                    credentials_id: credentialsId,
                                    region,
                                    resource_id: databaseHostId,
                                    resource_name: resourceName
                                }) => {
                                    await initiateComputeLicenseAssessmentCollection(
                                        wfAccountId,
                                        credentialsId,
                                        region!,
                                        databaseHostId,
                                        resourceName!,
                                        parentJobId,
                                        [AssessmentCategories.LICENSE, AssessmentCategories.COMPUTE]
                                    );
                                }
                            )
                        );
                    }
                } catch (error: any) {
                    logger.info('Error while triggering drift assessment for account', { accountId, error });
                    parentJobStatus = JOBSTATUS.FAILED;
                    await updateJobDetails(accountId, parentJobId, {
                        status: parentJobStatus,
                        error: error.message,
                        endTime: Date.now()
                    });
                } finally {
                    if (parentJobStatus !== JOBSTATUS.FAILED) {
                        await updateMasterAssessment(accountId, parentJobId);
                    }
                }
            }
        })
    );
}

async function fetchDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
) {
    logger.info('Fetching drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields
    });

    let shouldCalculateStorageAssessment = false;
    let shouldCalculateComputeAssessment = false;
    let shouldCalculateLicenseAssessment = false;
    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        const fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
        shouldCalculateStorageAssessment = fieldsValues?.includes(AssessmentCategories.STORAGE.toLocaleLowerCase());
        shouldCalculateComputeAssessment = fieldsValues?.includes(AssessmentCategories.COMPUTE.toLocaleLowerCase());
        shouldCalculateLicenseAssessment = fieldsValues?.includes(AssessmentCategories.LICENSE.toLocaleLowerCase());
    } else {
        shouldCalculateStorageAssessment = true;
        shouldCalculateComputeAssessment = true;
        shouldCalculateLicenseAssessment = true;
    }
    const driftAssessmentData: DriftAssessmentResponseType = {};

    const [storageAssessmentResponse, computeAssessmentResponse, licenseAssessmentResponse] = await Promise.all([
        shouldCalculateStorageAssessment
            ? calculateStorageDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({}),
        shouldCalculateComputeAssessment
            ? calculateComputeDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({}),
        shouldCalculateLicenseAssessment
            ? calculateLicenseDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({})
    ]);

    if (!isEmpty(storageAssessmentResponse)) {
        if (isDemoFlow) {
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            const { metadata: instanceMetadata } = instanceDetail as unknown as DatabaseInstance;
            const storageConfigsOptimized =
                (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.STORAGE || [];
            const osConfigsOptimized = (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.OS || [];
            const sizingConfigsOptimized =
                (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.SIZING || [];

            if (storageConfigsOptimized.length > 0) {
                const optimizeConfig = (configArray: ParameterDriftResponseType[], optimizedConfigs: string[]) =>
                    configArray.map(config => {
                        if (optimizedConfigs.includes(config.name)) {
                            config.status = AssessmentStatus.OPTIMIZED;
                            config.objectsInViolation = [];
                        }
                        return config;
                    });

                storageAssessmentResponse.configuration.volumes = optimizeConfig(
                    storageAssessmentResponse.configuration.volumes as ParameterDriftResponseType[],
                    storageConfigsOptimized
                );

                storageAssessmentResponse.configuration.luns = optimizeConfig(
                    storageAssessmentResponse.configuration.luns as ParameterDriftResponseType[],
                    storageConfigsOptimized
                );
            }
            if (osConfigsOptimized.length > 0) {
                storageAssessmentResponse.configuration.os = storageAssessmentResponse.configuration.os.map(
                    osConfig => {
                        const os = osConfig as ParameterDriftResponseType;
                        if (osConfigsOptimized.includes(os.name)) {
                            os.status = AssessmentStatus.OPTIMIZED;
                        }
                        return os;
                    }
                );
            }
            if (sizingConfigsOptimized.length > 0) {
                storageAssessmentResponse.sizing = storageAssessmentResponse.sizing.map(sizingConfig => {
                    const sizing = sizingConfig as ParameterDriftResponseType;
                    if (sizingConfigsOptimized.includes(sizing.name)) {
                        sizing.status = AssessmentStatus.OPTIMIZED;
                    }
                    return sizing;
                });
            }
        }

        driftAssessmentData.storage = storageAssessmentResponse;
    }

    if (!isEmpty(computeAssessmentResponse)) {
        driftAssessmentData.compute = computeAssessmentResponse as ComputeDriftResponseType;
        if (isDemoFlow) {
            const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId)) || [];
            const computeConfigsOptimized = (metadata as unknown as Metadata).isComputeOptimized;
            if (computeConfigsOptimized) {
                computeAssessmentResponse.status = AssessmentStatus.OPTIMIZED;
                computeAssessmentResponse.recommendation = 'Your current instance is optimized for your workload.';
                driftAssessmentData.compute = computeAssessmentResponse as ComputeDriftResponseType;
            }
        }
    }

    if (!isEmpty(licenseAssessmentResponse)) {
        driftAssessmentData.license = licenseAssessmentResponse as LicenseDriftResponseType;
        if (isDemoFlow) {
            const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId)) || [];
            const licenseConfigsOptimized = (metadata as unknown as Metadata).isLicenseOptimized;
            if (licenseConfigsOptimized) {
                computeAssessmentResponse.status = AssessmentStatus.OPTIMIZED;
                computeAssessmentResponse.recommendation = 'Your current SQL license is optimized for your workload.';
                driftAssessmentData.license = licenseAssessmentResponse as LicenseDriftResponseType;
            }
        }
    }
    return driftAssessmentData;
}

async function fetchDriftAssessmentPerHost(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    fields?: string
) {
    logger.info('Fetching drift assessment per host', { accountId, credentialsId, region, databaseHostId, fields });

    const [resourceDetail] = await listResources(accountId, databaseHostId, credentialsId, region);

    if (isEmpty(resourceDetail)) {
        const infoMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.info(infoMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${infoMessage}`);
    }

    const instancesManaged = await listDatabaseInstances(accountId, {
        resourceId: databaseHostId,
        credentialsId,
        region
    });
    logger.info('Instances managed:', instancesManaged);

    if (isEmpty(instancesManaged)) {
        const infoMessage = `No managed instances found for account ${accountId} and host ${databaseHostId}.`;
        logger.info(infoMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${infoMessage}`);
    }

    const driftAssessments: Array<{
        databaseInstanceId: string;
        assessments?: DriftAssessmentResponseType;
        error?: string;
    }> = [];
    await Promise.all(
        instancesManaged.map(async managedInstance => {
            const { database_instance_id: databaseInstanceId } = managedInstance;

            try {
                const driftAssessment = await fetchDriftAssessment(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    fields
                );
                driftAssessments.push({
                    databaseInstanceId,
                    assessments: driftAssessment
                });
            } catch (error: any) {
                const errorMessage = `Error while fetching drift assessment for ${databaseInstanceId}. Error: ${error.message}`;
                logger.error(errorMessage);
                driftAssessments.push({ databaseInstanceId, error: errorMessage });
            }
        })
    );
    return {
        databaseHostId,
        instancesAssessment: driftAssessments
    };
}

function getMatchingAssessmentStatus(finding: string) {
    logger.info('Getting matching assessment status for finding:', finding);
    switch (finding) {
        case 'NOT_OPTIMIZED':
            return AssessmentStatus.NOT_OPTIMIZED;
        case 'OVER_PROVISIONED':
            return AssessmentStatus.OVER_PROVISIONED;
        case 'UNDER_PROVISIONED':
            return AssessmentStatus.UNDER_PROVISIONED;
        case 'OPTIMIZED':
        default:
            return AssessmentStatus.OPTIMIZED;
    }
}

async function handleAssessment(
    accountId: string,
    managedInstance: DatabaseInstancesIncludingResource,
    masterAssessmentJobId: string,
    initiatedBy: string,
    fields?: string
) {
    let jobStatus = '';
    try {
        await triggerAssessment(managedInstance, masterAssessmentJobId, fields);
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        await updateJobDetails(accountId, masterAssessmentJobId, {
            status: jobStatus,
            endTime: Date.now()
        });
        logger.error(`Error while fetching database instance details ${accountId}, ${error}`);
    } finally {
        jobStatus = jobStatus || JOBSTATUS.COMPLETED;
        if (jobStatus !== JOBSTATUS.FAILED) {
            // If the masterAssessmentJobId failed, we don't want to overwrite the master assessment status
            await updateMasterAssessment(accountId, masterAssessmentJobId);
        }
    }
    if (initiatedBy === AssessmentTriggeredBy.USER) {
        const auditStatus = jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED;
        updateLongRunningAuditGroup(auditStatus);
    }
}

async function onDemandTriggerDriftAssessmentDataCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    initiatedBy: string,
    fields?: string,
    parentJobId?: string
) {
    logger.info('On-demand trigger drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseInstanceId,
        databaseHostId,
        initiatedBy,
        fields,
        parentJobId
    });

    const [managedInstance] = (await listDatabaseInstances(accountId, {
        credentialsId,
        region,
        resourceId: databaseHostId,
        sqlInstanceId: databaseInstanceId
    })) as DatabaseInstancesIncludingResource[];
    if (isEmpty(managedInstance)) {
        logger.error(
            `No  managed database instance by ${accountId} ${credentialsId} ${databaseHostId} ${databaseInstanceId} found.`
        );
        return;
    }
    const {
        resource: { resource_name: resourceName },
        database_instance_name: instanceName
    } = managedInstance;
    try {
        const instanceDetailsForJob = JSON.stringify({
            hostName: resourceName,
            resourceId: databaseHostId,
            databaseInstanceId,
            databaseInstanceName: instanceName,
            sqlServerDeploymentType: RESOURCESTYPE.MSSQL
        });
        const savedInstanceName = `${resourceName}\\${instanceName}`;
        const jobDescription = `Assess SQL Server instance ${savedInstanceName}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: `Assess SQL Server instance ${savedInstanceName}`,
            description: jobDescription,
            resourceName: savedInstanceName!,
            initiator: initiatedBy.toLocaleUpperCase(),
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.ASSESSMENT,
            parentJobId
        });
        // Call the async function without awaiting it
        handleAssessment(accountId, managedInstance, jobId, initiatedBy, fields);

        return { jobId };
    } catch (error) {
        logger.error(`Error while fetching database instance details ${accountId}, ${databaseHostId}, ${error}`);
    }
}

async function fetchDriftAssessmentPerAccount(
    accountId: string,
    credentialsId: string,
    region: string,
    fields?: string,
    nextToken?: string,
    pageSize?: number
) {
    logger.info('Fetching drift assessment per host', {
        accountId,
        credentialsId,
        region,
        fields,
        nextToken,
        pageSize
    });

    pageSize = pageSize || 50;

    const resourceDetails = await listResources(
        accountId,
        undefined,
        credentialsId,
        region,
        RESOURCESTYPE.MSSQL,
        undefined,
        undefined,
        pageSize,
        nextToken
    );
    if (isEmpty(resourceDetails)) {
        logger.info(`No successfully deployed database hosts found for account ${accountId} in region ${region}.`);
        return { count: 0, assessmentsPerAccount: [], nextToken: '' };
    }
    const driftAssessmentPerAccount: Array<{
        databaseHostId: string;
        instancesAssessment: Array<{
            databaseInstanceId: string;
            assessments?: DriftAssessmentResponseType;
            error?: string;
        }>;
    }> = [];
    await Promise.all(
        resourceDetails.map(async resourceDetail => {
            const { resource_id: databaseHostId } = resourceDetail;
            try {
                const drifAssessmentPerHost = await fetchDriftAssessmentPerHost(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    fields
                );
                driftAssessmentPerAccount.push(drifAssessmentPerHost);
            } catch (error) {
                logger.error(
                    `Error while fetching drift assessment per host ${accountId}, ${databaseHostId}, ${error}`
                );
            }
        })
    );

    return {
        count: driftAssessmentPerAccount.length,
        assessmentsPerAccount: driftAssessmentPerAccount,
        nextToken: resourceDetails?.length === pageSize ? resourceDetails[resourceDetails.length - 1].id : undefined
    };
}

export {
    triggerDriftAssessmentDataCollection,
    fetchDriftAssessment,
    driftAssessmentDataCollection,
    getHeadroomDrift,
    getLogVolumeDrift,
    getTempDbVolumeDrift,
    getFsxStorageDetails,
    onDemandTriggerDriftAssessmentDataCollection,
    calculateComputeDrift,
    fetchDriftAssessmentPerHost,
    fetchDriftAssessmentPerAccount,
    checkForMissingOptimizePermissions
};
