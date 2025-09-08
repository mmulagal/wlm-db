import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty, uniq } from 'lodash-es';
import getLogger from '../../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { WorkloadInstance } from '../../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT } from '../../../utils/consts';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus
} from '../../../utils/continous-optimization-consts';
import { isDemo, sqlResponseParsing } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob } from '../../database/job-operations';
import { VOLUME_LUN_CONFIGURATION } from '../../workloads/oracle/storage-assessment-scripts';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import storageGoldenConfigData from './golden-config';
import { GenericViolationResponseType } from '../../../routes/types/continuous-optimization.types';
import { StorageParameterDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';
import {
    OracleMappedOntapVolumesResponse,
    OracleSysFileTypes,
    OracleVolumeRecord
} from '../../workloads/oracle/common-types';

const logger = getLogger();
const isDemoFlow = isDemo();

const volumeConfigData = storageGoldenConfigData.configuration.volume;
const lunConfigData = storageGoldenConfigData.configuration.lun;

interface StorageAssessment {
    fraEnabled?: string;
    rmanCompressionEnabled?: string;
    volumes: {
        error: string;
        data: Record<string, any>[];
        filesystemId: string;
    };
    luns?: {
        error: string;
        data: Record<string, any>[];
    };
    binaryVolumes?: {
        error?: string;
        data?: { volumeId: string; volumeName: string }[];
    };
}

function mapVolumeTypesToIdName(
    databaseInstanceName: string,
    fsxFileSystem: string,
    mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse>
) {
    let instanceVolumeMappings;
    if (isDemoFlow) {
        instanceVolumeMappings = Object.values(mappedOntapVolumes)
            .flatMap(volumeResponse => volumeResponse.volumeMappings || [])
            .flatMap(volumeMapping => Object.values(volumeMapping))
            .find(mapping => Object.keys(mapping).length > 0);
    } else {
        instanceVolumeMappings = mappedOntapVolumes[fsxFileSystem]?.volumeMappings?.find(mapping =>
            mapping.hasOwnProperty(databaseInstanceName)
        )?.[databaseInstanceName];
    }

    const isCDB = instanceVolumeMappings?.isCDB || false;
    const volumeRecords = instanceVolumeMappings?.ontapVolumes || {};

    const flattenedRecords = isCDB
        ? Object.values(volumeRecords).flatMap(pdb =>
              Object.entries(pdb).flatMap(([type, volumes]) =>
                  Array.isArray(volumes) ? volumes.map(vol => ({ type, volume: vol })) : []
              )
          )
        : Object.entries(volumeRecords).flatMap(
              ([type, volumes]) => volumes?.map((volume: OracleVolumeRecord) => ({ type, volume })) || []
          );

    return Object.values(OracleSysFileTypes).reduce((acc, type) => {
        acc[type] = uniq(
            flattenedRecords
                .filter(record => record.type === type)
                .map(({ volume }) => ({ id: volume.volumeId, name: volume.volumeName }))
        );
        return acc;
    }, {} as Record<OracleSysFileTypes, { id: string; name: string }[]>);
}

function getVolumeConfigDrift(
    volumeTypeMap: Record<OracleSysFileTypes, { id: string; name: string }[]>,
    storageAssessmentData: StorageAssessment
) {
    logger.info('Fetching volume configuration drift');
    const {
        CONTROL_FILES: controlFileVolumes,
        DATA_FILES: dataFileVolumes,
        REDO_LOGS: redoLogVolumes,
        ARCHIVE_LOGS: archiveLogVolumes,
        TEMP_FILES: tempFileVolumes
    } = volumeTypeMap;

    const { volumes, fraEnabled, rmanCompressionEnabled } = storageAssessmentData;
    const { data: volumesData, error } = volumes;

    if (error) {
        return [{ errorMessage: error }];
    }

    const tieringPolicyRecommendations = {
        'data-control-files': 'none',
        'log-files': 'none',
        'archive-log-files': 'auto'
    };

    const compressionRecommendations = {
        'log-files': 'none',
        others: 'adaptive'
    };

    const deduplicationRecommendations = {
        'log-files': ['none'],
        others: ['inline', 'both']
    };

    const controlDataFileVolumeIds = [
        ...dataFileVolumes.map(volume => volume.id),
        ...controlFileVolumes.map(volume => volume.id)
    ];
    const redoLogsTempLogsVolumeIds = [
        ...redoLogVolumes.map(volume => volume.id),
        ...tempFileVolumes.map(volume => volume.id)
    ];
    const archiveLogVolumeIds = [...archiveLogVolumes.map(volume => volume.id)];
    const isIn = (list: string[], id: string) => list.includes(id);

    return volumeConfigData.map(config => {
        const objectsInViolation: GenericViolationResponseType[] = [];
        const objectsInViolationNames: string[] = [];
        let totalObjectsAssessed = volumesData.length;
        volumesData.forEach(volume => {
            let value = (volume[config.parameter] ?? '').toString();
            const objectName = volume.name || '';
            const objectId = volume.uuid || '';
            let recommended = config.value.toString();
            let isViolated = false;
            let dataCategory = '';

            const volumeMembership = [controlDataFileVolumeIds, redoLogsTempLogsVolumeIds, archiveLogVolumeIds].filter(
                list => isIn(list, objectId)
            ).length;

            switch (config.parameter) {
                case 'compaction':
                    isViolated = value === 'none';
                    recommended = 'enabled';
                    break;

                case 'tieringMinCoolingDays':
                    totalObjectsAssessed = archiveLogVolumeIds.length;
                    if (isIn(redoLogsTempLogsVolumeIds, objectId) || isIn(controlDataFileVolumeIds, objectId)) {
                        return;
                    }
                    recommended =
                        isIn(archiveLogVolumeIds, objectId) && fraEnabled === 'yes' && rmanCompressionEnabled === 'no'
                            ? '14'
                            : '2';
                    isViolated = value !== recommended;
                    break;

                case 'tieringPolicy':
                    if (isIn(redoLogsTempLogsVolumeIds, objectId)) {
                        recommended = tieringPolicyRecommendations['log-files'];
                        dataCategory = volumeMembership >= 2 ? 'mixed' : 'log-files';
                    } else if (isIn(controlDataFileVolumeIds, objectId)) {
                        recommended = tieringPolicyRecommendations['data-control-files'];
                        dataCategory = volumeMembership >= 2 ? 'mixed' : 'data-control-files';
                    } else if (isIn(archiveLogVolumeIds, objectId)) {
                        recommended = tieringPolicyRecommendations['archive-log-files'];
                        dataCategory = 'archive-log-files';
                    }

                    isViolated = value !== recommended;
                    break;

                case 'compressionType': {
                    const currentCompression = (volume.compression ?? '').toString();
                    const recommendations = compressionRecommendations;
                    if (isIn(redoLogsTempLogsVolumeIds, objectId)) {
                        value = currentCompression === 'none' ? 'none' : value;
                        recommended = recommendations['log-files'];
                        dataCategory = volumeMembership >= 2 ? 'mixed' : 'log-files';
                    } else {
                        recommended = recommendations.others;
                        dataCategory = 'non-log-files';
                    }
                    isViolated = value !== recommended;
                    break;
                }

                case 'deduplication': {
                    const recommendations = deduplicationRecommendations;
                    let multirecommendations = recommendations['log-files'];
                    if (isIn(redoLogsTempLogsVolumeIds, objectId)) {
                        dataCategory = volumeMembership >= 2 ? 'mixed' : 'log-files';
                        recommended = 'none';
                    } else {
                        multirecommendations = recommendations.others;
                        dataCategory = 'non-log-files';
                        recommended = 'inline';
                    }
                    isViolated = !multirecommendations.includes(value);
                    break;
                }

                case 'snapshotAutodelete':
                    // Determine snapshot autodelete status and order
                    recommended = value === 'true' ? 'oldest_first' : 'enabled';
                    value = value === 'true' ? (volume.snapshotDeleteOrder ?? '').toString() : 'disabled';
                    isViolated = value !== recommended;
                    break;

                default:
                    isViolated = value !== recommended;
                    break;
            }

            if (isViolated) {
                objectsInViolation.push({
                    objectName,
                    value: value?.toString() || '',
                    objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                    recommended,
                    dataCategory
                });
                objectsInViolationNames.push(objectName);
            }
        });

        return {
            ...config,
            recommended: config.value.toString(),
            status: objectsInViolation.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
            objectsInViolation: [...new Set(objectsInViolationNames)],
            totalObjectsAssessed,
            totalObjectsInViolation: objectsInViolation.length,
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            violationDetails: objectsInViolation
        };
    });
}

function getLunConfigDrift(storageAssessmentData: StorageAssessment) {
    logger.info('Fetching LUN configuration drift');
    const { luns = { data: [], error: '' } } = storageAssessmentData;
    const { data: lunsData, error } = luns;

    if (error) {
        return [{ errorMessage: error }];
    }

    return lunConfigData.map(config => {
        const violationDetails = lunsData
            .filter(lun => lun[config.parameter] !== config.value)
            .map(lun => ({
                objectName: lun.name,
                objectType: ASSESSMENT_RESOURCE_TYPE.LUN,
                value: lun[config.parameter],
                recommended: config.value.toString()
            }));

        return {
            ...config,
            recommended: config.value.toString(),
            status: violationDetails.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
            objectsInViolation: violationDetails.map(detail => detail.objectName),
            violationDetails,
            totalObjectsAssessed: lunsData.length,
            totalObjectsInViolation: violationDetails.length
        };
    });
}

function getVolumeLayoutDrift(
    volumeTypeMap: Record<OracleSysFileTypes, { id: string; name: string }[]>,
    storageAssessmentData: StorageAssessment
) {
    logger.info('Fetching volume layout drift');
    const volumeLayoutDrift: StorageParameterDriftResponseType['layout'] = [];

    const binaryVolumeIds = storageAssessmentData.binaryVolumes?.data?.map(volume => volume.volumeId) || [];

    const {
        CONTROL_FILES: controlFileVolumes,
        DATA_FILES: dataFileVolumes,
        REDO_LOGS: redoLogVolumes,
        ARCHIVE_LOGS: archiveLogVolumes,
        TEMP_FILES: tempFileVolumes
    } = volumeTypeMap;

    let status = AssessmentStatus.OPTIMIZED;

    // Archive logs should be on separate volume
    const archiveLogConflicts = [
        ...new Set(
            archiveLogVolumes.filter(archiveVolume =>
                [controlFileVolumes, dataFileVolumes, redoLogVolumes, tempFileVolumes]
                    .flat()
                    .map(volume => volume.id)
                    .includes(archiveVolume.id)
            )
        )
    ];
    status = archiveLogConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.archivePlacement,
        status,
        objectsInViolation:
            status === AssessmentStatus.NOT_OPTIMIZED ? archiveLogConflicts.map(conflict => conflict.name) : [],
        totalObjectsAssessed: archiveLogVolumes.length,
        totalObjectsInViolation: status === AssessmentStatus.NOT_OPTIMIZED ? archiveLogConflicts.length : 0
    });

    // Data files can be on separate volume or shared with control files
    const dataFileConflicts = [
        ...new Set(
            dataFileVolumes.filter(dataVolume =>
                [...redoLogVolumes, ...archiveLogVolumes, ...tempFileVolumes]
                    .flat()
                    .map(volume => volume.id)
                    .includes(dataVolume.id)
            )
        )
    ];
    status = dataFileConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.datafilesPlacement,
        status,
        objectsInViolation:
            status === AssessmentStatus.NOT_OPTIMIZED ? dataFileConflicts.map(conflict => conflict.name) : [],
        totalObjectsAssessed: dataFileVolumes.length,
        totalObjectsInViolation: status === AssessmentStatus.NOT_OPTIMIZED ? dataFileConflicts.length : 0
    });

    // Control files can be on separate volume or shared with data/redo/temp and maintain at least two, preferably three, control file copies across separate volumes
    const controlFileConflicts = [
        ...new Set(
            controlFileVolumes.filter(controlVolume =>
                archiveLogVolumes.map(volume => volume.id).includes(controlVolume.id)
            )
        )
    ];

    let hasConflicts = controlFileConflicts.length > 0;
    let insufficientMultiplexing = controlFileVolumes.length < 2;
    status = hasConflicts || insufficientMultiplexing ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;

    volumeLayoutDrift.push({
        ...storageGoldenConfigData.controlfilesPlacement,
        status,
        objectsInViolation: hasConflicts
            ? controlFileConflicts.map(conflict => conflict.name)
            : insufficientMultiplexing
            ? controlFileVolumes.map(volume => volume.name)
            : [],
        totalObjectsAssessed: controlFileVolumes.length,
        totalObjectsInViolation: hasConflicts
            ? controlFileConflicts.length
            : insufficientMultiplexing
            ? controlFileVolumes.length
            : 0
    });

    // Redo logs can be on separate or shared with temp/control and maintain at least 1 redo file copies across separate volumes
    const redoFileConflicts = [
        ...new Set(
            redoLogVolumes.filter(redoVolume =>
                [...dataFileVolumes, ...archiveLogVolumes].map(volume => volume.id).includes(redoVolume.id)
            )
        )
    ];

    hasConflicts = redoFileConflicts.length > 0;
    insufficientMultiplexing = redoLogVolumes.length < 1;
    status = hasConflicts || insufficientMultiplexing ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.redologsPlacement,
        status,
        objectsInViolation: hasConflicts
            ? redoFileConflicts.map(conflict => conflict.name)
            : insufficientMultiplexing
            ? redoLogVolumes.map(volume => volume.name)
            : [],
        totalObjectsAssessed: redoLogVolumes.length,
        totalObjectsInViolation: hasConflicts
            ? redoFileConflicts.length
            : insufficientMultiplexing
            ? redoLogVolumes.length
            : 0
    });

    // Temp logs can be on separate or shared with redo/control
    const tempFileConflicts = [
        ...new Set(
            tempFileVolumes.filter(tempVolume =>
                [...dataFileVolumes, ...archiveLogVolumes].map(volume => volume.id).includes(tempVolume.id)
            )
        )
    ];
    status = tempFileConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.templogsPlacement,
        status,
        objectsInViolation: tempFileConflicts.length > 0 ? tempFileConflicts.map(conflict => conflict.name) : [],
        totalObjectsAssessed: tempFileVolumes.length,
        totalObjectsInViolation: tempFileConflicts.length > 0 ? tempFileConflicts.length : 0
    });

    const binaryVolumeConflicts = binaryVolumeIds.filter(binaryVolumeId =>
        [controlFileVolumes, dataFileVolumes, redoLogVolumes, archiveLogVolumes, tempFileVolumes]
            .flat()
            .map(volume => volume.id)
            .includes(binaryVolumeId)
    );
    status = binaryVolumeConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.oracleBinaryPlacement,
        status,
        objectsInViolation: binaryVolumeConflicts.length > 0 ? binaryVolumeConflicts : [],
        totalObjectsAssessed: binaryVolumeIds.length,
        totalObjectsInViolation: binaryVolumeConflicts.length > 0 ? binaryVolumeConflicts.length : 0
    });

    return volumeLayoutDrift;
}

function calculateStorageDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    databaseInstanceName: string,
    fsxFileSystemId: string,
    mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse>,
    storageAssessmentData: StorageAssessment
) {
    logger.info('Calculating storage drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    if (isEmpty(storageAssessmentData)) {
        const errorMessage = `No ${AssessmentCategories.STORAGE} assessment data found. Assessment is scheduled to run every 24hours and may not have run on the instance. Please try again later.`;
        return { errorMessage };
    }

    const volumeTypeMap = mapVolumeTypesToIdName(databaseInstanceName, fsxFileSystemId, mappedOntapVolumes);

    const storageDriftData: StorageParameterDriftResponseType = {
        configuration: { volumes: [] },
        layout: []
    };

    const layoutAssessment = getVolumeLayoutDrift(volumeTypeMap, storageAssessmentData);

    storageDriftData.layout = layoutAssessment;

    storageDriftData.configuration.volumes = getVolumeConfigDrift(volumeTypeMap, storageAssessmentData);

    const protocol = mappedOntapVolumes[fsxFileSystemId]?.protocol;
    if (protocol === 'iSCSI') {
        storageDriftData.configuration.luns = getLunConfigDrift(storageAssessmentData);
    }

    return storageDriftData;
}

async function initiateStorageAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Initiating storage assessment data collection for oracle instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId,
        instanceName: instanceRecord.name,
        fsxId: instanceRecord.fsxFileSystem
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    const {
        resourceName,
        id: databaseInstanceId,
        name: databaseInstanceName,
        activeNodeInstanceid,
        mappedVolumesUuids,
        fsxFileSystem
    } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    if (isEmpty(mappedVolumesUuids)) {
        errorMessage = `Found no FSx for ONTAP volumes for the database ${databaseInstanceName}.`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        await registerJob(accountId, credentialsId, region, {
            name: 'Storage configuration assessment',
            description: 'Storage configuration assessment',
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: jobStatus,
            type: JOBTYPE.ASSESSMENT,
            parentJobId,
            error: errorMessage
        });
        await registerJob(accountId, credentialsId, region, {
            name: 'Storage layout assessment',
            description: 'Storage layout assessment',
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: jobStatus,
            type: JOBTYPE.ASSESSMENT,
            parentJobId,
            error: errorMessage
        });
        return;
    }
    try {
        const command = [VOLUME_LUN_CONFIGURATION(instanceRecord)];
        const ssmComment = 'Get Storage Configuration Assessment for Oracle instance';

        const response = await callSsmExecution(
            credentialsId,
            region,
            command,
            activeNodeInstanceid,
            ssmComment,
            accountId,
            false,
            ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            true,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );

        const parsedResponse = response ? sqlResponseParsing(response) : {};

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.STORAGE,
                config_data: parsedResponse
            }
        ]);

        await registerJob(accountId, credentialsId, region, {
            name: 'Storage configuration assessment',
            description: 'Storage configuration assessment',
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: jobStatus,
            type: JOBTYPE.ASSESSMENT,
            parentJobId
        });
        await registerJob(accountId, credentialsId, region, {
            name: 'Storage layout assessment',
            description: 'Storage layout assessment',
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: jobStatus,
            type: JOBTYPE.ASSESSMENT,
            parentJobId
        });
    } catch (error) {
        logger.error('Error while initiating storage assessment collection', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceName: databaseInstanceName,
            fsxId: fsxFileSystem,
            error
        });
        errorMessage = `Error while initiating storage assessment collection. ${error}`;
        jobStatus = JOBSTATUS.FAILED;
    }
}

export { initiateStorageAssessmentCollection, calculateStorageDrift, StorageAssessment };
