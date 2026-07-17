import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { countBy, isEmpty, isNull } from 'lodash-es';
import {
    AssessmentCategories,
    AssessmentStatus,
    ASSESSMENT_RESOURCE_TYPE,
    VALID_MPIO_LB_POLICIES,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE,
    OptimizeStorageConfigs
} from '../../../utils/continous-optimization-consts';
import getLogger from '../../../utils/logger';

import {
    AssessmentErrorItemType,
    AssessmentItemType,
    GenericViolationResponseType
} from '../../../routes/types/continuous-optimization.types';
import type {
    MssqlAssessmentItemType,
    SizingViolationResponseType
} from '../../../routes/types/mssql-continuous-optimisation.types';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';
import {
    LogDriveDetails,
    StorageAssessment,
    TempDbDriveDetails,
    WorkloadInstance,
    UserDatabaseLayout
} from '../../../utils/common-types';
import { sqlResponseParsing, IS_DEMO_FLOW } from '../../../utils/utils';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import {
    STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES,
    HttpErrorCodes,
    ASSESSMENT_SSM_EXECUTION_TIMEOUT,
    RESOURCESTYPE
} from '../../../utils/consts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob } from '../../database/job-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from '../../workloads/mssql/storage-scripts';
import {
    checkForMissingOptimizePermissions,
    buildBlockDeviceSpaceManagementEntry,
    buildVolumeCombinedEntry,
    type GoldenConfigEntry
} from '../assessment-utils';
import { getHeadroomDrift } from '../headroom-assessment';
import { DriftAssessmentDetail } from '../../../utils/wad-consts';

interface WadManagerMssqlAssessmentItemType extends MssqlAssessmentItemType {
    assessmentDetails?: DriftAssessmentDetail[];
}

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
    driveLetter?: string;
    volumeUuid: string;
    sizeInMb: number;
    fileType: number;
    logVolume?: string;
    logLunPath?: string;
    logDriveLetter?: string;
    // logFileName?: string;
    logSize?: number;
    logVolumeUuid?: string;
    databaseSizeInGb?: number;
    logSizeInMb?: number;
    databaseDetails?: Array<DatabaseRecord>;
}
const volumeConfigData = MSSQL_GOLDEN_CONFIG.filter(
    e =>
        e.type === 'storage' &&
        e.subType === 'configuration' &&
        e.resourceType === 'Volume' &&
        e.id !== OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION
);
const lunConfigData = MSSQL_GOLDEN_CONFIG.filter(
    e => e.type === 'storage' && e.subType === 'configuration' && e.resourceType === 'Lun'
);
const osConfigData = MSSQL_GOLDEN_CONFIG.filter(
    e =>
        e.type === 'storage' &&
        e.subType === 'configuration' &&
        e.resourceType !== 'Volume' &&
        e.resourceType !== 'Lun' &&
        e.id !== OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
);
const layoutConfigData = MSSQL_GOLDEN_CONFIG.filter(e => e.type === 'storage' && e.subType === 'layout');
const sizingConfigData = MSSQL_GOLDEN_CONFIG.filter(e => e.type === 'storage' && e.subType === 'sizing');
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

    let errorMessage = '';

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

function getLogVolumeDrift(
    logVolumes: LogDriveDetails[],
    status: AssessmentStatus,
    key: string,
    databaseRoles?: Array<{ databaseName: string; agName: string; replicaRole: string }>,
    lunUuidToLunPathMap?: Map<string, string>
) {
    logger.info('Getting log volume drift', { logVolumesLength: logVolumes.length, hasDatabaseRoles: !!databaseRoles });
    const primaryDatabases = new Set(
        databaseRoles?.filter(db => db.replicaRole === 'PRIMARY').map(db => db.databaseName.toLowerCase()) ?? []
    );

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
            // For AOAG, check if this database is a primary database
            const isAoag = primaryDatabases.size > 0;
            const isPrimaryDatabase = primaryDatabases.has(driveDetail.databaseName.toLowerCase());

            // Add all data drives (not shared) to the same log drive - DBS-4838
            // For AOAG: Only sum data drives for primary databases, exclude secondary/replica drives
            if (!logDrive.dataAccessPath?.includes(driveDetail.dataAccessPath)) {
                logDrive.dataAccessPath += `,${driveDetail.dataAccessPath}`;
                // Only add to total if it's not AOAG, or if it's a primary database in AOAG
                if (!isAoag || isPrimaryDatabase) {
                    logDrive.dataDriveTotalSizeMB += driveDetail.dataDriveTotalSizeMB;
                }
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
            sizePercentToDataDrive: Number.isNaN(sizePercentToDataDrive) ? 0 : sizePercentToDataDrive,
            lunPath: drive.lunUuid && lunUuidToLunPathMap ? lunUuidToLunPathMap.get(drive.lunUuid) : undefined
        };
        if (!dataAccessPath || !logAccessPath || !dataDriveTotalSizeMB || !logDriveTotalSizeMB) {
            ignoredDrives.push(formattedDriveInfo as SizingViolationResponseType);
        } else if (dataAccessPath !== logAccessPath) {
            const logToDriveSizePercent = Math.ceil((logDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);
            currentSizePercentForAllVolumes.push(logToDriveSizePercent);
            const volumeDatabases = [...new Set(drive.databaseName.split(','))].map(db => db.trim().toLowerCase());
            const hasPrimaryDatabases =
                primaryDatabases.size > 0 && volumeDatabases.some(db => primaryDatabases.has(db));
            // For AOAG primary databases: 30% recommended (26% to 35% range)
            // Anything < 26% (including 25%) is under-provisioned for AOAG primary
            // For non-primary/non-AOAG: 25% recommended (20% to 30% range, same as original)
            const lowerThreshold = hasPrimaryDatabases ? 26 : 20;
            const upperThreshold = hasPrimaryDatabases ? 35 : 30;
            if (logToDriveSizePercent > upperThreshold) {
                overProvisionedDrives.push(formattedDriveInfo as SizingViolationResponseType);
            } else if (logToDriveSizePercent < lowerThreshold) {
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

    // Check if ANY drive has primary databases for AOAG recommended value calculation
    const hasAnyPrimaryDatabase = filteredDriveDetails.some(drive => {
        const volumeDatabases = [...new Set(drive.databaseName.split(','))].map(db => db.trim().toLowerCase());
        return primaryDatabases.size > 0 && volumeDatabases.some(db => primaryDatabases.has(db));
    });

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
        totalObjectsInViolation,
        hasPrimaryDatabases: hasAnyPrimaryDatabase
    };
}

function getTempDbVolumeDrift(
    value: TempDbDriveDetails,
    status: AssessmentStatus,
    key: string,
    lunUuidToLunPathMap?: Map<string, string>
) {
    logger.info('Getting tempdb volume drift');

    const overProvisionedDrives: SizingViolationResponseType[] = [];
    const underProvisionedDrives: SizingViolationResponseType[] = [];
    const ignoredDrives: SizingViolationResponseType[] = [];
    const currentSizePercentForAllVolumes: number[] = [];

    let tempdbPercent = 0;
    let {
        dataDriveTotalSizeMB,
        tempdbDriveTotalSizeMB,
        defaultDataDriveLetter,
        tempdbDriveLetter,
        ontapVolumeUuid,
        lunUuid
    } = value;

    if (isNull(tempdbDriveTotalSizeMB) || isNull(dataDriveTotalSizeMB)) {
        tempdbDriveTotalSizeMB = 0;
        dataDriveTotalSizeMB = 0;
    }
    tempdbPercent = Math.ceil((tempdbDriveTotalSizeMB / dataDriveTotalSizeMB) * 100);

    const details: SizingViolationResponseType = {
        ...value,
        dataDriveTotalSizeMB,
        tempdbDriveTotalSizeMB,
        sizePercentToDataDrive: Number.isNaN(tempdbPercent) ? 0 : tempdbPercent,
        lunPath: lunUuid && lunUuidToLunPathMap ? lunUuidToLunPathMap.get(lunUuid) : undefined,
        tempdbAccessPath: tempdbDriveLetter,
        databases: ['tempdb']
    };

    if (defaultDataDriveLetter === tempdbDriveLetter) {
        status = AssessmentStatus.NOT_OPTIMIZED;

        ignoredDrives.push(details);
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
            overProvisionedDrives.push(details);
        } else if (status === AssessmentStatus.UNDER_PROVISIONED) {
            underProvisionedDrives.push(details);
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

function evaluateStorageEfficiencyParameter(parameter: string, volume: Record<string, unknown>) {
    const value = volume[parameter];
    const normalized = String(value ?? '').toLowerCase();
    switch (parameter) {
        case 'compressionType': {
            const currentCompression = (volume.compression ?? '').toString();
            return {
                optimized: currentCompression !== 'none' && normalized === 'adaptive',
                current: currentCompression === 'none' ? 'none' : String(value ?? ''),
                recommended: 'adaptive'
            };
        }
        case 'deduplication':
            return {
                optimized: normalized === 'inline' || normalized === 'both',
                current: String(value ?? ''),
                recommended: 'inline/both'
            };
        case 'compaction':
            return {
                optimized: normalized === 'enabled' || normalized === 'inline',
                current: String(value ?? ''),
                recommended: 'enabled/inline'
            };
        default:
            return { optimized: true, current: String(value ?? ''), recommended: '' };
    }
}

function buildStorageEfficienciesEntry(
    config: GoldenConfigEntry,
    volumes: Array<Record<string, unknown>>
): AssessmentItemType {
    const storageEfficienciesComponents = config.components ?? [];

    const namedVolumes = volumes.filter(volume => typeof volume.name === 'string' && volume.name.length > 0);
    const hasEfficiencyData = (volume: Record<string, unknown>) =>
        storageEfficienciesComponents.some(({ parameter }) => String(volume[parameter] ?? '').trim() !== '');
    if (namedVolumes.length > 0 && !namedVolumes.some(hasEfficiencyData)) {
        return {
            ...config,
            errorMessage:
                'No storage efficiencies assessment data found. Assessment is scheduled to run every 24hours and may not have run on the instance. Please try again later.'
        } as unknown as AssessmentItemType;
    }

    const assessmentDetails: DriftAssessmentDetail[] = [];
    volumes.forEach(volume => {
        const { name: volumeName, uuid } = volume;
        if (typeof volumeName !== 'string' || volumeName.length === 0) {
            return;
        }
        const componentsStatus: { id: string; current: string; recommended: string; optimized: boolean }[] =
            storageEfficienciesComponents.flatMap(({ parameter, name }) => {
                const { optimized, current, recommended } = evaluateStorageEfficiencyParameter(parameter, volume);
                return [{ id: name ?? parameter, current, recommended: recommended ?? '', optimized }];
            });

        if (componentsStatus.length === 0) {
            return;
        }
        assessmentDetails.push({
            id: (uuid as string) || volumeName || '',
            name: volumeName || '',
            status: componentsStatus.every(component => component.optimized)
                ? AssessmentStatus.OPTIMIZED
                : AssessmentStatus.NOT_OPTIMIZED,
            metadata: {
                components: componentsStatus.map(({ id, current, recommended, optimized }) => ({
                    parameter: id,
                    current,
                    recommended: recommended ?? '',
                    status: optimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED
                }))
            }
        });
    });

    const violationDetails: GenericViolationResponseType[] = assessmentDetails
        .filter(detail => detail.status === AssessmentStatus.NOT_OPTIMIZED)
        .map(({ name, metadata }) => ({
            objectName: name,
            value: '',
            objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            violatedConfigs:
                metadata?.components
                    ?.filter(c => c.status === AssessmentStatus.NOT_OPTIMIZED)
                    .map(({ parameter, current, recommended }) => ({
                        id: parameter,
                        current,
                        recommended
                    })) ?? []
        }));

    const objectsInViolation = violationDetails.map(row => row.objectName);
    return {
        ...config,
        recommended: '',
        status: objectsInViolation.length === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        objectsInViolation,
        totalObjectsAssessed: volumes.length,
        totalObjectsInViolation: objectsInViolation.length,
        resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
        violationDetails,
        assessmentDetails,
        configDetails: storageEfficienciesComponents.map(({ name, value }) => ({
            id: name,
            recommended: String(value ?? ''),
            objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
        }))
    } as AssessmentItemType;
}

async function calculateStorageDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    storageAssessmentData: StorageAssessment,
    aoagContext?: { databaseRoles: Array<{ databaseName: string; agName: string; replicaRole: string }> }
) {
    logger.info('Calculating storage drift', { accountId, credentialsId, region, databaseHostId });

    if (isEmpty(storageAssessmentData)) {
        const errorMessage = `No ${AssessmentCategories.STORAGE} assessment data found. Assessment is scheduled to run every 24hours and may not have run on the instance. Please try again later.`;
        return [...volumeConfigData, ...lunConfigData, ...osConfigData, ...layoutConfigData, ...sizingConfigData].map(
            config => ({ ...config, errorMessage })
        );
    }

    const driftAssessmentData: (WadManagerMssqlAssessmentItemType | AssessmentErrorItemType)[] = [];

    const { volumes, luns, os, layout, sizing, filesystemId, errors } =
        storageAssessmentData as unknown as StorageAssessment;

    if (errors && errors.volumes) {
        volumeConfigData.forEach(config => {
            driftAssessmentData.push({ ...config, errorMessage: errors.volumes });
        });
    } else {
        volumeConfigData.forEach(config => {
            if (config.id === OptimizeStorageConfigs.STORAGE_EFFICIENCIES) {
                driftAssessmentData.push(
                    buildStorageEfficienciesEntry(
                        config,
                        volumes as Array<Record<string, unknown>>
                    ) as MssqlAssessmentItemType
                );
                return;
            }
            let overallStatus = AssessmentStatus.OPTIMIZED;
            const objectsInViolation: string[] = [];
            const violationDetails: GenericViolationResponseType[] = [];
            const wadManagerAssessmentDetails: DriftAssessmentDetail[] = [];
            volumes.forEach(volume => {
                let objectName = '';
                let objectId = '';
                let svmName = '';
                let volumeStatus = AssessmentStatus.OPTIMIZED;
                Object.entries(volume).forEach(([key, value]) => {
                    objectName = key === 'name' ? value : objectName;
                    objectId = key === 'uuid' ? value : objectId;
                    svmName = key === 'svmName' ? value : svmName;
                    if (key === config.parameter) {
                        volumeStatus =
                            config.value !== value ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
                        overallStatus = volumeStatus === AssessmentStatus.NOT_OPTIMIZED ? volumeStatus : overallStatus;
                        if (volumeStatus === AssessmentStatus.NOT_OPTIMIZED) {
                            objectsInViolation.push(objectName!);
                            violationDetails.push({
                                objectName,
                                value: value != null ? String(value) : '',
                                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME
                            });
                        }
                        // For WAD MANAGER INTEGRATION
                        wadManagerAssessmentDetails.push({
                            id: objectId || objectName || '',
                            name: objectName,
                            status: volumeStatus,
                            svmName,
                            metadata: {
                                components: [
                                    {
                                        parameter: config.id,
                                        current: value != null ? String(value) : '',
                                        recommended: (config.value ?? '').toString(),
                                        status: volumeStatus
                                    }
                                ]
                            }
                        });
                    }
                });
            });

            driftAssessmentData.push({
                ...config,
                recommended: (config.value ?? '').toString(),
                status: overallStatus,
                objectsInViolation,
                totalObjectsAssessed: volumes.length,
                totalObjectsInViolation: objectsInViolation.length,
                violationDetails,
                assessmentDetails: wadManagerAssessmentDetails
            });
        });

        const tieringTcoConfig = MSSQL_GOLDEN_CONFIG.find(
            c => c.id === OptimizeStorageConfigs.TIERING_TCO_OPTIMIZATION
        );
        if (tieringTcoConfig) {
            driftAssessmentData.push(
                buildVolumeCombinedEntry(
                    tieringTcoConfig,
                    volumes as Array<Record<string, unknown>>
                ) as MssqlAssessmentItemType
            );
        }
    }
    if (errors && errors.luns) {
        lunConfigData.forEach(config => {
            driftAssessmentData.push({ ...config, errorMessage: errors.luns });
        });
    } else {
        lunConfigData.forEach(config => {
            let overallStatus = AssessmentStatus.OPTIMIZED;
            const objectsInViolation: string[] = [];
            const violationDetails: GenericViolationResponseType[] = [];
            const wadManagerAssessmentDetails: DriftAssessmentDetail[] = [];
            luns.forEach(lun => {
                let objectName = '';
                let objectId = '';
                let volumeStatus = AssessmentStatus.OPTIMIZED;
                Object.entries(lun).forEach(([key, value]) => {
                    objectName = key === 'name' ? value : objectName;
                    objectId = key === 'uuid' ? value : objectId;
                    if (key === config.parameter) {
                        volumeStatus =
                            config.value !== value ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
                        overallStatus = volumeStatus === AssessmentStatus.NOT_OPTIMIZED ? volumeStatus : overallStatus;

                        if (volumeStatus === AssessmentStatus.NOT_OPTIMIZED) {
                            objectsInViolation.push(objectName!);
                            violationDetails.push({
                                objectName,
                                value: value != null ? String(value) : '',
                                objectType: ASSESSMENT_RESOURCE_TYPE.LUN
                            });
                        }
                        // For WAD MANAGER INTEGRATION
                        wadManagerAssessmentDetails.push({
                            id: objectId,
                            name: objectName,
                            status: volumeStatus,
                            metadata: {
                                components: [
                                    {
                                        parameter: config.id,
                                        current: value != null ? String(value) : '',
                                        recommended: (config.value ?? '').toString(),
                                        status: volumeStatus
                                    }
                                ]
                            }
                        });
                    }
                });
            });

            driftAssessmentData.push({
                ...config,
                recommended: (config.value ?? '').toString(),
                status: overallStatus,
                objectsInViolation: [...new Set(objectsInViolation)],
                totalObjectsAssessed: luns.length,
                totalObjectsInViolation: objectsInViolation.length,
                resourceType: ASSESSMENT_RESOURCE_TYPE.LUN,
                violationDetails,
                assessmentDetails: wadManagerAssessmentDetails
            });
        });

        if (!errors?.volumes) {
            const blockDeviceConfig = MSSQL_GOLDEN_CONFIG.find(
                c => c.id === OptimizeStorageConfigs.BLOCK_DEVICE_SPACE_MANAGEMENT
            );
            if (blockDeviceConfig) {
                driftAssessmentData.push(
                    buildBlockDeviceSpaceManagementEntry(
                        blockDeviceConfig,
                        luns as Array<Record<string, unknown>>,
                        volumes as Array<Record<string, unknown>>
                    ) as MssqlAssessmentItemType
                );
            }
        }
    }

    if (errors && errors['mpio-policy']) {
        osConfigData.forEach(config => {
            driftAssessmentData.push({ ...config, errorMessage: errors['mpio-policy'] });
        });
    }

    Object.entries(os).forEach(([key, value]) => {
        const goldenData = osConfigData.find(data => data.parameter === key);
        if (!isEmpty(goldenData)) {
            let assessmentDetails: unknown[] = [];
            let objectsInViolation: GenericViolationResponseType[] = [];

            if (key === 'ntfs-allocation-unit-size') {
                assessmentDetails = Object.entries(os)
                    .filter(([type]) => type === 'ntfs-allocation-details')
                    .map(([, data]) => data)
                    .flat();
                objectsInViolation = assessmentDetails
                    .filter((ntfsDetail: any) => ntfsDetail.BlockSize && ntfsDetail.BlockSize !== 65536)
                    .map((ntfsDetail: any) => ({
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
                    .filter((policyDetail: any) => !VALID_MPIO_LB_POLICIES.includes(policyDetail.policy))
                    .map((policyDetail: any) => ({
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
                        (timeoutDetail: any) =>
                            timeoutDetail['mpio-timeout'] && timeoutDetail['mpio-timeout'] !== goldenData.value
                    )
                    .map((timeoutDetail: any) => ({
                        objectName: timeoutDetail.accessPath || timeoutDetail.disk || '',
                        value: timeoutDetail.timeout,
                        objectType: ASSESSMENT_RESOURCE_TYPE.DRIVE
                    }));
                value = Number(value);
            }
            const status = goldenData?.value === value ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
            const entryRecommended = (goldenData.value ?? '').toString();
            // Boolean OS configs (mpio-enabled, mpio-iscsi-count) have no per-object detail loop above;
            // emit a single synthetic entry so consumers always get violationDetails when NOT_OPTIMIZED.
            if (objectsInViolation.length === 0 && status === AssessmentStatus.NOT_OPTIMIZED) {
                const toEnabledDisabled = (v: unknown) => (v === true || v === 'true' ? 'Enabled' : 'Disabled');
                const isBoolean = typeof goldenData.value === 'boolean';
                objectsInViolation = [
                    {
                        objectName: key,
                        objectType: 'configuration',
                        value: isBoolean ? toEnabledDisabled(value) : String(value),
                        recommended: isBoolean ? toEnabledDisabled(goldenData.value) : entryRecommended
                    }
                ];
            }
            driftAssessmentData.push({
                ...goldenData,
                recommended: entryRecommended,
                status,
                objectsInViolation: objectsInViolation.map(v => v.objectName),
                violationDetails: objectsInViolation,
                totalObjectsAssessed: assessmentDetails.length || 1,
                totalObjectsInViolation: objectsInViolation.length
            });
        }
    });

    // Complete layout and sizing assessment failure
    let userDatabaseLayoutAssessment = { data: [], log: [], tempDb: [] };
    if (errors && errors.layout) {
        layoutConfigData.forEach(config => {
            driftAssessmentData.push({ ...config, errorMessage: errors.layout });
        });
    } else {
        let tempdbFilesLocationAssessment;
        Object.entries(layout).forEach(([key, value]) => {
            if (key === 'user-database-layout') {
                userDatabaseLayoutAssessment = value;
            } else if (key === 'tempdb-files-location') {
                tempdbFilesLocationAssessment = value;
            }
        });

        let goldenData = layoutConfigData.find(data => data.id === 'tempdb-files-location');
        if (errors && !isEmpty(errors['tempdb-files-location'])) {
            driftAssessmentData.push({ ...goldenData!, errorMessage: errors['tempdb-files-location'] });
        } else if (!isEmpty(goldenData)) {
            const status =
                goldenData?.value === tempdbFilesLocationAssessment
                    ? AssessmentStatus.OPTIMIZED
                    : AssessmentStatus.NOT_OPTIMIZED;
            const tempDbRecord = (userDatabaseLayoutAssessment.tempDb || [])[0] as DatabaseVolumeRecord | undefined;
            const tempdbViolationDetails: GenericViolationResponseType[] =
                status === AssessmentStatus.NOT_OPTIMIZED && tempDbRecord
                    ? [
                          {
                              objectName: 'placement',
                              value: 'tempdb',
                              objectType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
                              additionalInfo: {
                                  lunPath: tempDbRecord.lunPath,
                                  driveLetter: tempDbRecord.driveLetter
                              }
                          }
                      ]
                    : [];
            let tempdbCurrentLabel = 'Separate drive';
            if (status === AssessmentStatus.NOT_OPTIMIZED && tempDbRecord) {
                const dataRecord = (userDatabaseLayoutAssessment.data || [])[0] as DatabaseVolumeRecord | undefined;
                const logRecord = (userDatabaseLayoutAssessment.log || [])[0] as DatabaseVolumeRecord | undefined;
                const sharingWith: string[] = [];
                if (dataRecord?.driveLetter === tempDbRecord.driveLetter) {
                    sharingWith.push('data files');
                }
                if (logRecord?.driveLetter === tempDbRecord.driveLetter) {
                    sharingWith.push('log files');
                }
                tempdbCurrentLabel =
                    sharingWith.length > 0
                        ? `Shared with ${sharingWith.join(' and ')}`
                        : 'Shared with data or log files';
            }
            driftAssessmentData.push({
                ...goldenData,
                recommended: (goldenData.value ?? '').toString(),
                status,
                current: tempdbCurrentLabel,
                objectsInViolation: status === AssessmentStatus.OPTIMIZED ? [] : ['tempdb'],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: status === AssessmentStatus.OPTIMIZED ? 0 : 1,
                violationDetails: tempdbViolationDetails.length > 0 ? tempdbViolationDetails : undefined
            });
        }

        let dataFilesLayoutStatus = AssessmentStatus.OPTIMIZED;
        let logFilesLayoutStatus = AssessmentStatus.OPTIMIZED;
        let currentDataFilesLabel = 'Separate drive';
        let currentLogFilesLabel = 'Separate drive';
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
                    volDetails.logDriveLetter = log.driveLetter;
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
            dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            currentDataFilesLabel = 'Shared LUN with log files';
            currentLogFilesLabel = 'Shared LUN with data files';
            severity = 'critical';
            recommendationString =
                'Separate system databases from user databases to different drives/luns and different volumes';
            databasesInViolation = databasesOnSameDataLogLun.map(data => data.name);
        } else if (!isEmpty(databasesOnSameDataLogVolume)) {
            dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
            currentDataFilesLabel = 'Shared volume with log files';
            currentLogFilesLabel = 'Shared volume with data files';
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
                dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
                logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
                currentDataFilesLabel = 'Large databases sharing data LUN or volume';
                currentLogFilesLabel = 'Large databases sharing log LUN or volume';
                severity = 'critical';
                recommendationString =
                    'Place large database size (say 500GB or more) on a separate volume for faster recovery. This volume should also be backed up by separate jobs.';
                databasesInViolation = databasesAbove500Gb.map(data => data.name);
            }
        } else if (!isEmpty(databasesSharingDataLuns) || !isEmpty(databasesSharingLogLuns)) {
            if (!isEmpty(databasesSharingDataLuns)) {
                dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
                currentDataFilesLabel = 'Large databases sharing data LUN';
            } else {
                logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
                currentLogFilesLabel = 'Large databases sharing log LUN';
            }
            severity = 'critical';
            recommendationString =
                'Place large database size (say 500GB or more) on a separate volume for faster recovery. This volume should also be backed up by separate jobs.';
            databasesInViolation = databasesAbove500Gb.map(data => data.name);
        } else if (!isEmpty(databasesSharingDataVolumes) || !isEmpty(databasesSharingLogVolumes)) {
            if (!isEmpty(databasesSharingDataVolumes)) {
                dataFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
                currentDataFilesLabel = 'Large databases sharing data volume';
            } else {
                logFilesLayoutStatus = AssessmentStatus.NOT_OPTIMIZED;
                currentLogFilesLabel = 'Large databases sharing log volume';
            }
            severity = 'warning';
            recommendationString =
                'Consolidate small-to-medium size databases that are less critical or have fewer I/O requirements to a single volume';
            databasesInViolation = databasesAbove500Gb.map(data => data.name);
        }

        databasesInViolation = [...new Set(databasesInViolation)];

        const dataViolationDetails: GenericViolationResponseType[] = databasesInViolation.flatMap(dbName => {
            const dbs = dataLogVolumeDetails.filter(d => d.name === dbName);
            const seen = new Set<string>();
            return dbs
                .filter(db => {
                    const key = `${db.lunPath}|${db.driveLetter}`;
                    if (seen.has(key)) {
                        return false;
                    }
                    seen.add(key);
                    return true;
                })
                .map(db => ({
                    objectName: 'placement',
                    value: dbName,
                    objectType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
                    additionalInfo: { lunPath: db.lunPath, driveLetter: db.driveLetter }
                }));
        });

        const logViolationDetails: GenericViolationResponseType[] = databasesInViolation.map(dbName => {
            const db = dataLogVolumeDetails.find(d => d.name === dbName);
            return {
                objectName: 'placement',
                value: dbName,
                objectType: ASSESSMENT_RESOURCE_TYPE.DATABASE,
                additionalInfo: {
                    lunPath: db?.logLunPath,
                    driveLetter: db?.logDriveLetter
                }
            };
        });

        const dataFilesGoldenData = layoutConfigData.find(data => data.parameter === 'default-data-files-location');
        const logFilesGoldenData = layoutConfigData.find(data => data.parameter === 'default-log-files-location');
        driftAssessmentData.push(
            {
                ...dataFilesGoldenData!,
                recommended: recommendationString,
                status: dataFilesLayoutStatus,
                severity,
                recommendation: recommendationString,
                current: currentDataFilesLabel,
                objectsInViolation: databasesInViolation,
                totalObjectsAssessed: dataLogVolumeDetails.length,
                totalObjectsInViolation: databasesInViolation.length,
                violationDetails: dataViolationDetails.length > 0 ? dataViolationDetails : undefined
            },
            {
                ...logFilesGoldenData!,
                recommended: recommendationString,
                status: logFilesLayoutStatus,
                severity,
                recommendation: recommendationString,
                current: currentLogFilesLabel,
                objectsInViolation: databasesInViolation,
                totalObjectsAssessed: dataLogVolumeDetails.length,
                totalObjectsInViolation: databasesInViolation.length,
                violationDetails: logViolationDetails.length > 0 ? logViolationDetails : undefined
            }
        );
    }

    const lunUuidToLunPathMap = new Map<string, string>(
        [
            ...(userDatabaseLayoutAssessment.log as UserDatabaseLayout[]),
            ...(userDatabaseLayoutAssessment.tempDb as UserDatabaseLayout[])
        ]
            .filter(entry => entry.lunUuid && entry.lunPath)
            .map(entry => [entry.lunUuid, entry.lunPath])
    );

    if (errors && (errors.sizing || errors['volumes-footprint'])) {
        const errorMessage = errors.sizing || errors['volumes-footprint'];
        sizingConfigData.forEach(config => {
            driftAssessmentData.push({ ...config, errorMessage });
        });
    } else {
        if (errors && !isEmpty(errors['data-tempdb-drive-details'])) {
            const tempdbSizingConfig = sizingConfigData.find(c => c.parameter === 'tempdb-drive-size');
            if (tempdbSizingConfig) {
                driftAssessmentData.push({ ...tempdbSizingConfig, errorMessage: errors['data-tempdb-drive-details'] });
            }
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
                    let hasPrimaryDatabases = false;
                    ({
                        key,
                        status,
                        overProvisionedDrives,
                        underProvisionedDrives,
                        ignoredDrives,
                        currentSizePercentForAllVolumes,
                        drivesCount: totalObjectsAssessed,
                        totalObjectsInViolation,
                        hasPrimaryDatabases
                    } = getLogVolumeDrift(value, status, key, aoagContext?.databaseRoles, lunUuidToLunPathMap));
                    resourceType = ASSESSMENT_RESOURCE_TYPE.DRIVE;

                    // For AOAG primary databases, use 30% recommended (25% base + 20% of 25%)
                    // For all others (non-AOAG, AOAG secondary), use golden config value (25%)
                    if (hasPrimaryDatabases && goldenData) {
                        goldenData = { ...goldenData, value: '30%' };
                    }
                }

                if (key === 'data-tempdb-drive-details') {
                    // TempDB drive details can be an array with a single element or single object. Extract the single element if it exists.
                    const tempdbValue = Array.isArray(value) && value.length > 0 ? value[0] : value;
                    ({
                        status,
                        key,
                        overProvisionedDrives,
                        underProvisionedDrives,
                        ignoredDrives,
                        currentSizePercentForAllVolumes,
                        totalObjectsInViolation
                    } = getTempDbVolumeDrift(tempdbValue, status, key, lunUuidToLunPathMap));
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
                const sizingObjectsInViolation: string[] =
                    key === 'performance-tier'
                        ? storageTierViolations.map(v => v.objectName)
                        : key === 'log-drive-size'
                        ? [
                              ...(sizingViolations?.overProvisionedDrives ?? []),
                              ...(sizingViolations?.underProvisionedDrives ?? []),
                              ...(sizingViolations?.ignoredDrives ?? [])
                          ]
                              .map(d => d.logAccessPath ?? d.ontapVolumeName ?? '')
                              .filter(Boolean)
                        : key === 'tempdb-drive-size'
                        ? [
                              ...(sizingViolations?.overProvisionedDrives ?? []),
                              ...(sizingViolations?.underProvisionedDrives ?? []),
                              ...(sizingViolations?.ignoredDrives ?? [])
                          ]
                              .map(d => d.tempdbAccessPath ?? d.ontapVolumeName ?? '')
                              .filter(Boolean)
                        : [];
                driftAssessmentData.push({
                    ...goldenData,
                    recommended: (goldenData.value ?? '').toString(),
                    status,
                    sizingViolations,
                    missingPermissions,
                    current: currentSizeRange,
                    objectsInViolation: sizingObjectsInViolation,
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
        const [goldenData] = sizingConfigData.filter(data => data.parameter === 'headroom');
        const { status, headroomPercent, missingPermissions, newFsxStorageCapacityGiB } = await getHeadroomDrift(
            credentialsId,
            region,
            filesystemId,
            RESOURCESTYPE.MSSQL,
            accountId
        );

        driftAssessmentData.push({
            ...goldenData,
            recommended: `${MIN_OPTIMIZED_HEADROOM_PERCENTAGE.MSSQL}%`,
            status,
            missingPermissions,
            recommendedSizeInGib: newFsxStorageCapacityGiB ? Math.ceil(newFsxStorageCapacityGiB) : 0,
            current: `${headroomPercent}%`,
            totalObjectsAssessed: 1,
            totalObjectsInViolation: status === AssessmentStatus.OPTIMIZED ? 0 : 1,
            objectsInViolation: status === AssessmentStatus.OPTIMIZED ? [] : [filesystemId].filter(Boolean)
        });
    } catch (error: any) {
        logger.error(
            `Error while calculating headroom details for ${databaseHostId}, ${databaseInstanceId}, ${filesystemId}.`,
            error
        );
    }

    return sortStorageAssessments(driftAssessmentData);
}

const STORAGE_ASSESSMENT_ORDER = [
    ...sizingConfigData,
    ...layoutConfigData,
    ...volumeConfigData,
    ...lunConfigData,
    ...osConfigData
];
const storageAssessmentOrderIndex = new Map(STORAGE_ASSESSMENT_ORDER.map((config, index) => [config.id, index]));

function sortStorageAssessments<T extends { id?: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
        const aIdx = storageAssessmentOrderIndex.get(a.id ?? '') ?? Number.MAX_SAFE_INTEGER;
        const bIdx = storageAssessmentOrderIndex.get(b.id ?? '') ?? Number.MAX_SAFE_INTEGER;
        return aIdx - bIdx;
    });
}

export {
    calculateStorageDrift,
    getLogVolumeDrift,
    getTempDbVolumeDrift,
    initiateStorageAssessmentCollection,
    buildStorageEfficienciesEntry
};
