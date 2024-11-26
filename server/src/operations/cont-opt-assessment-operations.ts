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
    DatabaseInstance,
    databaseInstanceMetadata,
    DatabaseInstancesIncludingResource,
    LogDriveDetails,
    StorageAssessment,
    TempDbDriveDetails,
    WorkloadInstance
} from '../utils/common-types';
import { CUSTOM_SSM_EXECUTION_TIMEOUT, HttpErrorCodes, RESOURCESTYPE } from '../utils/consts';
import { registerJob, updateJobDetails } from './database/job-operations';

import { listAllManagedInstances, listDatabaseInstances } from '../lib/database/db';
import { getEC2InstanceRecommendations } from '../lib/aws/compute-optimizer';
import { checkComputeOptimizerEnrollmentStatus } from './recommendation-operations';
import { translateFindingReasonCode } from './aws/compute-optimizer-operations';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../utils/continous-optimization-consts';
import {
    ComputeDriftResponseType,
    DriftAssessmentResponseType,
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

function getLogVolumeDrift(logVolumes: LogDriveDetails[], status: AssessmentStatus, key: string) {
    logger.info('Getting log volume drift', logVolumes);

    const overProvisionedDrives: SizingViolationResponseType[] = [];
    const underProvisionedDrives: SizingViolationResponseType[] = [];
    const ignoredDrives: SizingViolationResponseType[] = [];
    const optimisedDrives: SizingViolationResponseType[] = [];

    const driveDetails = Array.isArray(logVolumes) ? logVolumes : [logVolumes];
    driveDetails.forEach((drive: LogDriveDetails) => {
        const { dataAccessPath, logAccessPath, dataDriveTotalSizeMB, logDriveTotalSizeMB } = drive;
        if (!dataAccessPath || !logAccessPath || !dataDriveTotalSizeMB || !logDriveTotalSizeMB) {
            ignoredDrives.push(drive as SizingViolationResponseType);
        } else if (dataAccessPath !== logAccessPath) {
            const logToDriveSizePercent = Math.ceil((logDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
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

    return { key, status, overProvisionedDrives, underProvisionedDrives, ignoredDrives, optimisedDrives };
}

function getTempDbVolumeDrift(value: TempDbDriveDetails, status: AssessmentStatus, key: string) {
    logger.info('Getting tempdb volume drift', value);

    const overProvisionedDrives: SizingViolationResponseType[] = [];
    const underProvisionedDrives: SizingViolationResponseType[] = [];
    const ignoredDrives: SizingViolationResponseType[] = [];

    let tempdbPercent = 0;
    const {
        dataDriveTotalSizeMB,
        tempdbDriveTotalSizeMB,
        defaultDataDriveLetter,
        tempdbDriveLetter,
        lunUuid,
        svmName,
        ontapVolumeName,
        ontapVolumeUuid
    } = value;
    if (defaultDataDriveLetter === tempdbDriveLetter) {
        status = AssessmentStatus.NOT_APPLICABLE;

        ignoredDrives.push({
            dataDriveTotalSizeMB,
            tempdbDriveTotalSizeMB,
            dataAccessPath: defaultDataDriveLetter,
            tempdbAccessPath: tempdbDriveLetter,
            lunUuid,
            svmName,
            ontapVolumeName,
            ontapVolumeUuid
        });
    } else {
        tempdbPercent = Math.ceil((tempdbDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
        status =
            tempdbPercent > 20
                ? AssessmentStatus.OVER_PROVISIONED
                : tempdbPercent < 10
                ? AssessmentStatus.UNDER_PROVISIONED
                : AssessmentStatus.OPTIMIZED;
        if (status === AssessmentStatus.OVER_PROVISIONED) {
            overProvisionedDrives.push({
                dataDriveTotalSizeMB,
                tempdbDriveTotalSizeMB,
                dataAccessPath: defaultDataDriveLetter,
                tempdbAccessPath: tempdbDriveLetter,
                lunUuid,
                svmName,
                ontapVolumeName,
                ontapVolumeUuid
            });
        } else if (status === AssessmentStatus.UNDER_PROVISIONED) {
            underProvisionedDrives.push({
                dataDriveTotalSizeMB,
                tempdbDriveTotalSizeMB,
                dataAccessPath: defaultDataDriveLetter,
                tempdbAccessPath: tempdbDriveLetter,
                lunUuid,
                svmName,
                ontapVolumeName,
                ontapVolumeUuid
            });
        }
    }
    key = 'tempdb-drive-size';
    return { status, key, tempdbPercent, dataDriveTotalSizeMB, ontapVolumeUuid };
}

async function getHeadroomDrift(credentialsId: string, region: string, fileSystemId: string) {
    logger.info('Getting headroom drift', { credentialsId, region, fileSystemId });

    const { ssdStorageCapacityInBytes, totalVolumeSizeInBytes } = await getFsxStorageDetails(
        credentialsId,
        region,
        fileSystemId
    );

    const headroomPercent = Math.ceil(
        ((ssdStorageCapacityInBytes - totalVolumeSizeInBytes) / ssdStorageCapacityInBytes) * 100
    );
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
    const missingPermissions = [];
    let newFsxStorageCapactiyGiB = 0;
    if (status !== AssessmentStatus.OPTIMIZED) {
        const { implicitlyDenied, explicitlyDenied } = await getMissingPermissionsList(credentialsId, region, [
            'fsx:UpdateFileSystem'
        ]);
        if (implicitlyDenied.length > 0 || explicitlyDenied.length > 0) {
            missingPermissions.push('fsx:UpdateFileSystem');
        }
        newFsxStorageCapactiyGiB = calculateFsxStorageCapacityForHeadroomOptimization(
            totalVolumeSizeInBytes,
            ssdStorageCapacityInBytes
        );
    }
    return {
        status,
        headroomPercent,
        ssdStorageCapacityInBytes,
        totalVolumeSizeInBytes,
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
                    tags: goldenData.tags
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
                    ]
                });
            }
        });
    }

    if (errors && errors.sizing) {
        driftAssessmentData.sizing.push({ errorMessage: errors.sizing });
    } else {
        Object.entries(sizing).forEach(([key, value]) => {
            let goldenData = sizingConfigData.find(data => data.parameter === key);

            let overProvisionedDrives;
            let underProvisionedDrives;
            let ignoredDrives;

            if (key === 'data-log-drive-details') {
                goldenData = sizingConfigData.find(data => data.parameter === 'log-drive-size');
            }
            if (key === 'data-tempdb-drive-details') {
                goldenData = sizingConfigData.find(data => data.parameter === 'tempdb-drive-size');
            }
            if (!isEmpty(goldenData)) {
                let status = AssessmentStatus.NOT_OPTIMIZED;
                if (key === 'performance-tier') {
                    status = value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
                }
                if (key === 'data-log-drive-details') {
                    ({ key, status, overProvisionedDrives, underProvisionedDrives, ignoredDrives } = getLogVolumeDrift(
                        value,
                        status,
                        key
                    ));
                }
                if (key === 'data-tempdb-drive-details') {
                    ({ status, key } = getTempDbVolumeDrift(value, status, key));
                }

                driftAssessmentData.sizing.push({
                    name: key,
                    recommended: goldenData.value.toString(),
                    status,
                    severity: goldenData.severity,
                    recommendation: goldenData.recommendation,
                    tags: goldenData.tags,
                    sizingViolations: { overProvisionedDrives, underProvisionedDrives, ignoredDrives }
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
            const { status, missingPermissions, newFsxStorageCapactiyGiB } = await getHeadroomDrift(
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
                recommendedSizeInGib: newFsxStorageCapactiyGiB ? Math.ceil(newFsxStorageCapactiyGiB) : 0
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
        const { activeNodeInstanceId, cloudProviderAccountId, resourceName } = await getInstanceDetails(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );
        const { finding, findingReasonCodes, currentInstanceType, recommendationOptions } =
            (await initiateComputeAssessment(
                cloudProviderAccountId!,
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName!
            )) || {};

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
    databaseHostId: string,
    resourceName: string
) {
    logger.info('Initiate compute assessment', {
        awsAccountId,
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName
    });
    let errorMessage = '';
    try {
        await checkComputeOptimizerEnrollmentStatus(accountId, credentialsId, region);

        const resourceArn = getEc2Arn(awsAccountId, region, databaseHostId);
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
                ?.filter(({ platformDifferences }) => platformDifferences?.length === 0)
                ?.map(
                    ({ instanceType, rank, savingsOpportunity, platformDifferences }) => ({
                        instanceType,
                        rank,
                        savingsOpportunity,
                        platformDifferences
                    }) // return only such recommandation options that has no platform difference. Migration to different platform cannot be supported programatically from our application.
                )
        };
    } catch (error: any) {
        errorMessage = `Failed to get compute optimizer recommendation options for the selected database host during Continuous Optimization. ${error.message}`;
        logger.error({ errorMessage, error });
        throw Error(errorMessage);
    }
}

async function updateMasterAssessment(accountId: string, masterAssessmentJobId: string) {
    logger.info('Updating master assessment', { accountId, masterAssessmentJobId });

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

    // Create dummy compute right sizing assessment jobs for each managed resource
    if (masterJobStatus !== JOBSTATUS.IN_PROGRESS) {
        const allManagedResources = allSubJobs
            .map(item => item.resource_name)
            .filter((value, index, self) => self.indexOf(value) === index);
        allManagedResources.forEach(async resource => {
            const resourceName = resource.split('\\')[0]!;
            const jobString = `Assess SQL Server host ${resourceName} compute right sizing`;
            await registerJob(accountId, '', '', {
                name: jobString,
                description: jobString,
                resourceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: JOBSTATUS.COMPLETED,
                type: JOBTYPE.ASSESSMENT,
                parentJobId: masterAssessmentJobId
            });
        });
    }
    await updateJobDetails(accountId, masterAssessmentJobId, {
        status: masterJobStatus,
        endTime: Date.now()
    });
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
    } catch (error: any) {
        logger.error(`Error while fetching instance details: ${accountId} ${databaseInstanceId}. Error: ${error}.`);
        return;
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
        await updateMasterAssessment(accountId, parentJobId);
    }
}

async function triggerDriftAssessmentDataCollection(initiatedBy: string, fields?: string) {
    logger.info('Trigger drift assessment per account', { initiatedBy });

    const allManagedInstances = (await listAllManagedInstances()) as DatabaseInstancesIncludingResource[];
    if (isEmpty(allManagedInstances)) {
        logger.error('No successfully managed database instances found.');
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
                logger.error(errorMessage);
            } else {
                const jobDescription = `Assess online SQL Server instances from ${managedInstances.length} managed instances in your account ${accountId} for best practice misalignments.`;
                const { id: parentJobId } = await registerJob(accountId, '', '', {
                    name: jobDescription,
                    description: jobDescription,
                    resourceName: accountId,
                    initiator: initiatedBy.toLocaleUpperCase(),
                    startTime: Date.now(),
                    status: JOBSTATUS.IN_PROGRESS,
                    type: JOBTYPE.ASSESSMENT
                });

                try {
                    await Promise.all(
                        managedInstances.map(
                            async managedInstance => {
                                await triggerAssessment(managedInstance, parentJobId, fields);
                            },
                            {
                                concurrency: 1
                            }
                        )
                    );
                } catch (error: any) {
                    logger.info('Error while triggering drift assessment for account', { accountId, error });
                    await updateJobDetails(accountId, parentJobId, {
                        status: JOBSTATUS.FAILED,
                        error: error.message,
                        endTime: Date.now()
                    });
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

    let fieldsValues: Array<string> = [AssessmentCategories.STORAGE];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }
    const driftAssessmentData: DriftAssessmentResponseType = {};
    const shouldCalculateStorageAssessment = fieldsValues?.includes(AssessmentCategories.STORAGE.toLocaleLowerCase());
    const shouldCalculateComputeAssessment = fieldsValues?.includes(AssessmentCategories.COMPUTE.toLocaleLowerCase());

    const [storageAssessmentResponse, computeAssessmentResponse] = await Promise.all([
        shouldCalculateStorageAssessment
            ? calculateStorageDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({}),
        shouldCalculateComputeAssessment
            ? calculateComputeDrift(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
            : Promise.resolve({})
    ]);

    if (!isEmpty(storageAssessmentResponse)) {
        if (isDemoFlow) {
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            const { metadata: instanceMetadata } = instanceDetail as unknown as DatabaseInstance;

            logger.info('Instance metadata:', instanceMetadata);
            const storgaeConfigsOptimized =
                (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.STORAGE || [];
            const osConfigsOptimized = (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.OS || [];
            const sizingConfigsOptimized =
                (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.SIZING || [];

            if (storgaeConfigsOptimized.length > 0) {
                storageAssessmentResponse.configuration.volumes = storageAssessmentResponse.configuration.volumes.map(
                    volume => {
                        const vol = volume as ParameterDriftResponseType;
                        if (storgaeConfigsOptimized.includes(vol.name)) {
                            vol.status = AssessmentStatus.OPTIMIZED;
                            vol.objectsInViolation = [];
                        }
                        return vol;
                    }
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
        if (isDemoFlow) {
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            const { metadata: instanceMetadata } = instanceDetail as unknown as DatabaseInstance;
            const computeConfigsOptimized =
                (instanceMetadata as databaseInstanceMetadata)?.configsOptimized?.COMPUTE || '';

            computeAssessmentResponse.status = AssessmentStatus.OPTIMIZED;

            if (computeConfigsOptimized) {
                driftAssessmentData.compute = computeAssessmentResponse as ComputeDriftResponseType;
            }
        }
    }
    return driftAssessmentData;
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
        const savedInstanceName = `${resourceName}\\${instanceName}`;
        const jobString = `SQL Server instance ${savedInstanceName} is being scanned for best practice misalignments.`;
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: jobString,
            description: jobString,
            resourceName: savedInstanceName!,
            initiator: initiatedBy.toLocaleUpperCase(),
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.ASSESSMENT,
            parentJobId
        });
        triggerAssessment(managedInstance, jobId, fields);

        return { jobId };
    } catch (error) {
        logger.error(`Error while fetching database instance details ${accountId}, ${databaseHostId}, ${error}`);
    }
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
    calculateComputeDrift
};
