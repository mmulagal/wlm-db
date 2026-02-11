import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { countBy, isEmpty, isNull } from 'lodash-es';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    ASSESSMENT_RESOURCE_TYPE,
    VALID_MPIO_LB_POLICIES,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE
} from '../../../utils/continous-optimization-consts';
import getLogger from '../../../utils/logger';

import { GenericViolationResponseType } from '../../../routes/types/continuous-optimization.types';
import storageGoldenConfigData from './golden-config';
import { LogDriveDetails, StorageAssessment, TempDbDriveDetails, WorkloadInstance } from '../../../utils/common-types';
import { sqlResponseParsing, IS_DEMO_FLOW } from '../../../utils/utils';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import {
    STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES,
    HttpErrorCodes,
    ASSESSMENT_SSM_EXECUTION_TIMEOUT,
    RESOURCESTYPE
} from '../../../utils/consts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from '../../workloads/mssql/storage-scripts';
import { collectSnapshotCopyData } from './resilience-assessment-operation';
import {
    SizingViolationResponseType,
    StorageParameterDriftResponseType
} from '../../../routes/types/mssql-continuous-optimisation.types';
import { checkForMissingOptimizePermissions } from '../assessment-utils';
import { getHeadroomDrift } from '../headroom-assessment';

const logger = getLogger();

interface DatabaseRecord {
    name: string;
    sizeInMb: number;
}
interface DatabaseVolumeRecord {
    ontapVolumeUuid: string | undefined;
    svm: string;
    volumeName: string;
    fileId?: number;
    lunSerialNumber: string;
    name: string;
    // fileName: string;
    lunPath: string;
    volumeUuid: string;
    sizeInMb: number;
    fileType: number;
    logVolume?: string;
    logLunPath?: string;
    // logFileName?: string;
    logSize?: number;
    logVolumeUuid?: string;
    databaseSizeInGb?: number;
    logSizeInMb?: number;
    databaseDetails?: Array<DatabaseRecord>;
}

const volumeConfigData = storageGoldenConfigData.configuration.volume;
const lunConfigData = storageGoldenConfigData.configuration.lun;
const osConfigData = storageGoldenConfigData.configuration.os;
const layoutConfigData = storageGoldenConfigData.layout;
const sizingConfigData = storageGoldenConfigData.sizing;

async function initiateStorageAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance,
    jobTriggers: STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES = STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH
) {
    logger.info('Initiating storage assessment data collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId,
        instanceName: instanceRecord?.name,
        fsxId: instanceRecord?.fsxFileSystem
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';
    let snapshotPolicyAssessmentJobId = '';

    const { resourceName, name: databaseInstanceName } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    try {
        if (isEmpty(instanceRecord.mappedVolumesUuids)) {
            errorMessage = `Found no FSx for ONTAP volumes for the instance ${instanceRecord.name}.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        const command = [STORAGE_CONFIGURATION_ASSESSMENT(instanceRecord)];
        const ssmComment = 'Get Storage Configuration Assessment for MSSQL Database Instance';

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: instanceRecord.activeNodeInstanceid,
            comment: ssmComment,
            accountId,
            executionTimeout: ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            shouldReadFromCloudWatchLogs: true
        });

        const parsedResponse = response ? sqlResponseParsing(response) : {};
        const { volumes, luns, os, layout, sizing } = parsedResponse as unknown as StorageAssessment;
        if (!IS_DEMO_FLOW) {
            // add snapshot copy details to volumes
            parsedResponse.volumes = await collectSnapshotCopyData(accountId, credentialsId, instanceRecord, volumes);
        }
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

        const configJobStatus = IS_DEMO_FLOW
            ? JOBSTATUS.COMPLETED
            : isEmpty(volumes) && isEmpty(luns) && isEmpty(os)
            ? JOBSTATUS.FAILED
            : !isEmpty(volumes) && !isEmpty(luns) && !isEmpty(os)
            ? JOBSTATUS.COMPLETED
            : JOBSTATUS.WARNING;
        if (
            jobTriggers.valueOf() === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH.valueOf() ||
            jobTriggers === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.STORAGE.valueOf()
        ) {
            await registerJob(accountId, credentialsId, region, {
                name: 'Storage configuration assessment',
                description: 'Storage configuration assessment',
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: configJobStatus,
                type: JOBTYPE.ASSESSMENT,
                parentJobId
            });
            await registerJob(accountId, credentialsId, region, {
                name: 'Storage layout assessment',
                description: 'Storage layout assessment',
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: IS_DEMO_FLOW ? JOBSTATUS.COMPLETED : isEmpty(layout) ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
                type: JOBTYPE.ASSESSMENT,
                parentJobId
            });
            await registerJob(accountId, credentialsId, region, {
                name: 'Storage sizing assessment',
                description: 'Storage sizing assessment',
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: IS_DEMO_FLOW ? JOBSTATUS.COMPLETED : isEmpty(sizing) ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
                type: JOBTYPE.ASSESSMENT,
                parentJobId
            });
        }

        if (
            jobTriggers.valueOf() === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.BOTH.valueOf() ||
            jobTriggers === STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES.RESILIENCY.valueOf()
        ) {
            ({ id: snapshotPolicyAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
                name: 'Snapshot policy assessment ',
                description: 'Snapshot policy assessment ',
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: configJobStatus,
                type: JOBTYPE.ASSESSMENT,
                parentJobId
            }));
        }
    } catch (error) {
        logger.error('Error while initiating storage assessment collection', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceName: instanceRecord?.name,
            fsxId: instanceRecord?.fsxFileSystem,
            error
        });
        errorMessage = `Error while initiating storage assessment collection. ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        if (snapshotPolicyAssessmentJobId) {
            await updateJobDetails(accountId, snapshotPolicyAssessmentJobId, {
                endTime: Date.now(),
                status: jobStatus,
                error: errorMessage
            });
        }
    }
}

function expandVolumeDataPerDatabaseForLayoutAssessment(data: DatabaseVolumeRecord[]) {
    const expandedData: DatabaseVolumeRecord[] = [];
    data.forEach((volume: DatabaseVolumeRecord) => {
        if (volume.databaseDetails && volume.databaseDetails.length > 0) {
            volume.databaseDetails.forEach((db: DatabaseRecord) => {
                const dbVolume = { ...volume };
                dbVolume.name = db.name;
                dbVolume.sizeInMb = db.sizeInMb;
                delete dbVolume.databaseDetails;
                expandedData.push(dbVolume);
            });
        } else {
            expandedData.push(volume);
        }
    });
    return expandedData;
}

function expandDatabaseDetailForSizingAssessment(data: LogDriveDetails[]) {
    const expandedData: LogDriveDetails[] = [];
    data.forEach((volume: LogDriveDetails) => {
        const databaseNames = volume.databaseName?.split(',');
        if (databaseNames.length > 0) {
            databaseNames.forEach((db: string) => {
                const dbVolume = { ...volume };
                dbVolume.databaseName = db;
                expandedData.push(dbVolume);
            });
        } else {
            expandedData.push(volume);
        }
    });
    return expandedData;
}

function getLogVolumeDrift(logVolumes: LogDriveDetails[], status: AssessmentStatus, key: string) {
    logger.info('Getting log volume drift', { logVolumesLength: logVolumes.length });

    const overProvisionedDrives: SizingViolationResponseType[] = [];
    const underProvisionedDrives: SizingViolationResponseType[] = [];
    const ignoredDrives: SizingViolationResponseType[] = [];
    const optimisedDrives: SizingViolationResponseType[] = [];

    // DBS-5449: To address truncation databases sharing log disk are combined. For right sizing assessment, we need to expand the data
    const driveDetails = expandDatabaseDetailForSizingAssessment(Array.isArray(logVolumes) ? logVolumes : [logVolumes]);

    const filteredDriveDetails: LogDriveDetails[] = driveDetails.reduce((acc: LogDriveDetails[], driveDetail) => {
        // Case 1: Log drive is shared by multiple databases
        // Case 2: Log drive is shared by multiple data drives possibly from different databases
        // Both the cases are handled here
        const logDrive = acc.find(el => el.diskNumber === driveDetail.diskNumber);
        if (logDrive) {
            // Add all data drives (not shared) to the same log drive - DBS-4838
            // In the case multiple data drives are shared by the same log drive, add the data drive to the log drive and append the dataAccessPath
            if (!logDrive.dataAccessPath?.includes(driveDetail.dataAccessPath)) {
                logDrive.dataAccessPath += `,${driveDetail.dataAccessPath}`;
                logDrive.dataDriveTotalSizeMB += driveDetail.dataDriveTotalSizeMB;
            }
            // Append all databases sharing the same data and log drives as impacted databases - DBS-4838
            if (!logDrive.databaseName?.includes(driveDetail.databaseName)) {
                logDrive.databaseName += `,${driveDetail.databaseName}`;
            }
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
        let sizePercentToDataDrive = 0;
        if (isNull(logDriveTotalSizeMB) || isNull(dataDriveTotalSizeMB)) {
            logDriveTotalSizeMB = 0;
            dataDriveTotalSizeMB = 0;
        }
        sizePercentToDataDrive = Math.ceil((logDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
        const formattedDriveInfo = {
            ...drive,
            dataDriveTotalSizeMB,
            logDriveTotalSizeMB,
            dataAccessPath: dataAccessPath ? [...new Set(dataAccessPath.split(','))] : [],
            databases: [...new Set(drive.databaseName.split(','))],
            sizePercentToDataDrive: Number.isNaN(sizePercentToDataDrive) ? 0 : sizePercentToDataDrive
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
        } else if (formattedDriveInfo.databaseName !== 'msdb') {
            // Ignore system databases when log and data drive is shared: DBS-4639
            ignoredDrives.push(formattedDriveInfo as SizingViolationResponseType);
        }
    });
    const totalObjectsInViolation = [...new Set(overProvisionedDrives.concat(underProvisionedDrives, ignoredDrives))]
        .length;

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
    key = 'log-drive-size';
    return {
        key,
        status,
        overProvisionedDrives,
        underProvisionedDrives,
        ignoredDrives,
        optimisedDrives,
        currentSizePercentForAllVolumes,
        drivesCount,
        totalObjectsInViolation
    };
}

function getTempDbVolumeDrift(value: TempDbDriveDetails, status: AssessmentStatus, key: string) {
    logger.info('Getting tempdb volume drift');

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
    tempdbPercent = Math.ceil((tempdbDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
    value = {
        ...value,
        dataDriveTotalSizeMB,
        tempdbDriveTotalSizeMB,
        sizePercentToDataDrive: Number.isNaN(tempdbPercent) ? 0 : tempdbPercent
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
    const totalObjectsInViolation = [...new Set(overProvisionedDrives.concat(underProvisionedDrives, ignoredDrives))]
        .length;
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
        currentSizePercentForAllVolumes,
        totalObjectsInViolation
    };
}

async function calculateStorageDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    storageAssessmentData: StorageAssessment
) {
    logger.info('Calculating storage drift', { accountId, credentialsId, region, databaseHostId });

    if (isEmpty(storageAssessmentData)) {
        const errorMessage = `No ${AssessmentCategories.STORAGE} assessment data found. Assessment is scheduled to run every 24hours and may not have run on the instance. Please try again later.`;
        return { errorMessage };
    }

    const driftAssessmentData: StorageParameterDriftResponseType = {
        configuration: { volumes: [], luns: [], os: [] },
        sizing: [],
        layout: [],
        fileSystems: []
    };

    const { volumes, luns, os, layout, sizing, filesystemId, errors } =
        storageAssessmentData as unknown as StorageAssessment;

    if (errors && errors.volumes) {
        driftAssessmentData.configuration.volumes.push({ errorMessage: errors.volumes });
    } else {
        volumeConfigData.forEach(config => {
            let overallStatus = AssessmentStatus.OPTIMIZED;
            const objectsInViolation: string[] = [];
            const violationDetails: GenericViolationResponseType[] = [];
            volumes.forEach(volume => {
                let objectName = '';
                let volumeStatus = AssessmentStatus.OPTIMIZED;
                Object.entries(volume).forEach(([key, value]) => {
                    objectName = key === 'name' ? value : objectName;
                    if (key === config.parameter) {
                        volumeStatus =
                            config.value !== value ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
                        overallStatus = volumeStatus === AssessmentStatus.NOT_OPTIMIZED ? volumeStatus : overallStatus;
                        if (volumeStatus === AssessmentStatus.NOT_OPTIMIZED) {
                            objectsInViolation.push(objectName!);
                            violationDetails.push({
                                objectName,
                                value: value ? value.toString() : '',
                                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
                            });
                        }
                    }
                });
            });

            driftAssessmentData.configuration.volumes.push({
                name: config.parameter,
                recommended: config.value.toString(),
                status: overallStatus,
                objectsInViolation,
                severity: config.severity,
                recommendation: config.recommendation,
                tags: config.tags,
                totalObjectsAssessed: volumes.length,
                totalObjectsInViolation: objectsInViolation.length,
                resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                violationDetails
            });
        });
    }
    if (errors && errors.luns) {
        driftAssessmentData.configuration.luns.push({ errorMessage: errors.luns });
    } else {
        lunConfigData.forEach(config => {
            let overallStatus = AssessmentStatus.OPTIMIZED;
            const objectsInViolation: string[] = [];
            const violationDetails: GenericViolationResponseType[] = [];
            luns.forEach(lun => {
                let objectName = '';
                let volumeStatus = AssessmentStatus.OPTIMIZED;
                Object.entries(lun).forEach(([key, value]) => {
                    objectName = key === 'name' ? value : objectName;
                    if (key === config.parameter) {
                        volumeStatus =
                            config.value !== value ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
                        overallStatus = volumeStatus === AssessmentStatus.NOT_OPTIMIZED ? volumeStatus : overallStatus;

                        if (volumeStatus === AssessmentStatus.NOT_OPTIMIZED) {
                            objectsInViolation.push(objectName!);
                            violationDetails.push({
                                objectName,
                                value: value ? value.toString() : '',
                                objectType: ASSESSMENT_RESOURCE_TYPE.LUN
                            });
                        }
                    }
                });
            });

            driftAssessmentData.configuration.luns.push({
                name: config.parameter,
                recommended: config.value.toString(),
                status: overallStatus,
                objectsInViolation: [...new Set(objectsInViolation)],
                severity: config.severity,
                recommendation: config.recommendation,
                tags: config.tags,
                totalObjectsAssessed: luns.length,
                totalObjectsInViolation: objectsInViolation.length,
                resourceType: ASSESSMENT_RESOURCE_TYPE.LUN,
                violationDetails
            });
        });
    }
    if (errors && errors['mpio-policy']) {
        driftAssessmentData.configuration.os.push({ name: 'mpio-policy', errorMessage: errors['mpio-policy'] });
    }

    let assessmentDetails = [];

    let objectsInViolation: GenericViolationResponseType[] = [];

    Object.entries(os).forEach(([key, value]) => {
        const goldenData = osConfigData.find(data => data.parameter === key);
        if (!isEmpty(goldenData)) {
            if (key === 'ntfs-allocation-unit-size') {
                assessmentDetails = Object.entries(os)
                    .filter(([type]) => type === 'ntfs-allocation-details')
                    .map(([, data]) => data)
                    .flat();
                objectsInViolation = assessmentDetails
                    .filter(ntfsDetail => ntfsDetail.BlockSize && ntfsDetail.BlockSize !== 65536)
                    .map(ntfsDetail => ({
                        objectName: ntfsDetail.DriveLetter || ntfsDetail.Name || '',
                        value: ntfsDetail.BlockSize.toString(),
                        objectType: ASSESSMENT_RESOURCE_TYPE.DRIVE
                    }));
            } else if (key === 'mpio-load-balance-policy') {
                assessmentDetails = Object.entries(os)
                    .filter(([type]) => type === 'mpio-load-balance-policy-details')
                    .map(([, data]) => data)
                    .flat();
                objectsInViolation = assessmentDetails
                    .filter(policyDetail => !VALID_MPIO_LB_POLICIES.includes(policyDetail.policy))
                    .map(policyDetail => ({
                        objectName: policyDetail.accessPath || policyDetail.disk || '',
                        value: policyDetail.policy,
                        objectType: ASSESSMENT_RESOURCE_TYPE.DRIVE
                    }));
            } else if (key === 'mpio-timeout') {
                assessmentDetails = Object.entries(os)
                    .filter(([type]) => type === 'mpio-timeout')
                    .map(([, data]) => data)
                    .flat();
                objectsInViolation = assessmentDetails
                    .filter(
                        timeoutDetail =>
                            timeoutDetail['mpio-timeout'] && timeoutDetail['mpio-timeout'] !== goldenData.value
                    )
                    .map(timeoutDetail => ({
                        objectName: timeoutDetail.accessPath || timeoutDetail.disk || '',
                        value: timeoutDetail.timeout,
                        objectType: ASSESSMENT_RESOURCE_TYPE.DRIVE
                    }));
                value = Number(value);
            }
            const status = goldenData?.value === value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
            driftAssessmentData.configuration.os.push({
                name: key,
                recommended: goldenData.value.toString(),
                status,
                severity: goldenData.severity,
                recommendation: goldenData.recommendation,
                tags: goldenData.tags,
                violationDetails: objectsInViolation,
                totalObjectsAssessed: assessmentDetails.length,
                totalObjectsInViolation: objectsInViolation.length,
                resourceType: goldenData.resourceType
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
        let userDatabaseLayoutAssessment = { data: [], log: [] };
        let tempdbFilesLocationAssessment;
        Object.entries(layout).forEach(([key, value]) => {
            if (key === 'user-database-layout') {
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
                totalObjectsInViolation: status === AssessmentStatus.OPTIMIZED ? 0 : 1,
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
        // DBS-5449: To address truncation databases databases sharing disk are combined. For layout assessment, we need to expand the data
        const dataVolumes = expandVolumeDataPerDatabaseForLayoutAssessment(
            userDatabaseLayoutAssessment?.data
        ) as DatabaseVolumeRecord[];
        const logVolumes = expandVolumeDataPerDatabaseForLayoutAssessment(
            userDatabaseLayoutAssessment?.log
        ) as DatabaseVolumeRecord[];
        const dataLogVolumeDetails: DatabaseVolumeRecord[] = [];

        dataVolumes.map((data: DatabaseVolumeRecord) =>
            logVolumes.forEach((log: DatabaseVolumeRecord) => {
                // Ignore system databases for layout assessment: DBS-4639
                if (data.name !== 'msdb' && data.name === log.name) {
                    const volDetails = data as DatabaseVolumeRecord;
                    volDetails.logVolume = log.volumeName;
                    volDetails.logLunPath = log.lunPath;
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

        databasesInViolation = [...new Set(databasesInViolation)];
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
                objectsInViolation: databasesInViolation,
                totalObjectsAssessed: dataLogVolumeDetails.length,
                totalObjectsInViolation: databasesInViolation.length,
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
                objectsInViolation: databasesInViolation,
                totalObjectsAssessed: dataLogVolumeDetails.length,
                totalObjectsInViolation: databasesInViolation.length,
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
        if (errors && !isEmpty(errors['data-tempdb-drive-details'])) {
            driftAssessmentData.sizing.push({
                name: 'tempdb-drive-size',
                errorMessage: errors['data-tempdb-drive-details']
            });
        }

        for (let [key, value] of Object.entries(sizing)) {
            let goldenData = sizingConfigData.find(data => data.parameter === key);
            let overProvisionedDrives;
            let underProvisionedDrives;
            let ignoredDrives;
            let currentSizePercentForAllVolumes;
            let storageTierViolations: GenericViolationResponseType[] = [];
            let totalObjectsAssessed = 1;
            let totalObjectsInViolation = 0;
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
                                    objectName: volumeDetail.volumeName,
                                    value: volumeDetail.performanceTierPercent.toString(),
                                    objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
                                }));

                            value = details.map((volumeDetail: { performanceTierPercent: number } | number) => {
                                if (typeof volumeDetail !== 'number') {
                                    return volumeDetail.performanceTierPercent;
                                }
                                return volumeDetail;
                            });
                        }
                        totalObjectsAssessed = value.length;
                        totalObjectsInViolation = storageTierViolations.length;
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
                        drivesCount: totalObjectsAssessed,
                        totalObjectsInViolation
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
                        currentSizePercentForAllVolumes,
                        totalObjectsInViolation
                    } = getTempDbVolumeDrift(value, status, key));
                    resourceType = ASSESSMENT_RESOURCE_TYPE.DRIVE;
                }

                let missingPermissions: string[] = [];
                // Check for 'fsx:UpdateVolume' permissions
                if (
                    (key === 'tempdb-drive-size' || key === 'log-drive-size') &&
                    status !== AssessmentStatus.OPTIMIZED
                ) {
                    missingPermissions =
                        // eslint-disable-next-line no-await-in-loop
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
                const sizingViolations =
                    key === 'performance-tier'
                        ? undefined
                        : { overProvisionedDrives, underProvisionedDrives, ignoredDrives };
                const tierViolations = key === 'performance-tier' ? storageTierViolations : undefined;
                driftAssessmentData.sizing.push({
                    name: key,
                    recommended: goldenData.value.toString(),
                    status,
                    severity: goldenData.severity,
                    recommendation: goldenData.recommendation,
                    tags: goldenData.tags,
                    sizingViolations,
                    missingPermissions,
                    current: currentSizeRange,
                    totalObjectsAssessed,
                    totalObjectsInViolation,
                    violationDetails: tierViolations,
                    resourceType
                });
            }
        }
    }

    // Headroom drift assessment

    try {
        const goldenData = sizingConfigData.find(data => data.parameter === 'headroom');
        const { status, headroomPercent, missingPermissions, newFsxStorageCapacityGiB } = await getHeadroomDrift(
            credentialsId,
            region,
            filesystemId,
            RESOURCESTYPE.MSSQL,
            accountId
        );

        driftAssessmentData.sizing.push({
            name: 'headroom',
            recommended: `${MIN_OPTIMIZED_HEADROOM_PERCENTAGE.MSSQL}%`,
            status,
            severity: goldenData!.severity,
            recommendation: goldenData!.recommendation,
            tags: goldenData!.tags,
            missingPermissions,
            recommendedSizeInGib: newFsxStorageCapacityGiB ? Math.ceil(newFsxStorageCapacityGiB) : 0,
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

export { calculateStorageDrift, getLogVolumeDrift, getTempDbVolumeDrift, initiateStorageAssessmentCollection };
