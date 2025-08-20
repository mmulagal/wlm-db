import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import getLogger from '../../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { WorkloadInstance } from '../../../utils/common-types';
import { HttpErrorCodes, ASSESSMENT_SSM_EXECUTION_TIMEOUT } from '../../../utils/consts';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus
} from '../../../utils/continous-optimization-consts';
import { sqlResponseParsing } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob } from '../../database/job-operations';
import { VOLUME_LUN_CONFIGURATION } from '../../workloads/oracle/storage-assessment-scripts';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import storageGoldenConfigData from './golden-config';
import { GenericViolationResponseType } from '../../../routes/types/continuous-optimization.types';
import { StorageParameterDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';
import { OracleMappedOntapVolumesResponse, OracleSysFileTypes } from '../../workloads/oracle/common-types';

const logger = getLogger();

const volumeConfigData = storageGoldenConfigData.configuration.volume;
const lunConfigData = storageGoldenConfigData.configuration.lun;

interface StorageAssessment {
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

function mapVolumeTypesToIdsOrNames(
    databaseInstanceName: string,
    fsxFileSystem: string,
    mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse>,
    mapByName: boolean
) {
    const instanceVolumeMappings = mappedOntapVolumes[fsxFileSystem]?.volumeMappings?.find(mapping =>
        mapping.hasOwnProperty(databaseInstanceName)
    )?.[databaseInstanceName];

    const isCDB = instanceVolumeMappings?.isCDB || false;
    const volumeRecords = instanceVolumeMappings?.ontapVolumes || {};

    const flattenedRecords = isCDB
        ? Object.values(volumeRecords).flatMap(pdb =>
              Object.entries(pdb).flatMap(([type, volumes]) =>
                  Array.isArray(volumes) ? volumes.map(vol => ({ type, volume: vol })) : []
              )
          )
        : Object.entries(volumeRecords).flatMap(([type, volumes]) => volumes?.map(volume => ({ type, volume })) || []);

    return Object.values(OracleSysFileTypes).reduce((acc, type) => {
        acc[type] = flattenedRecords
            .filter(record => record.type === type)
            .map(({ volume }) => (mapByName ? volume.volumeName : volume.volumeId));
        return acc;
    }, {} as Record<OracleSysFileTypes, string[]>);
}

function getVolumeConfigDrift(
    databaseInstanceName: string,
    fsxFileSystem: string,
    mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse>,
    storageAssessmentData: StorageAssessment,
    isLayoutViolated: boolean
) {
    logger.info('Fetching volume configuration drift');
    const volumeTypeToNamesMap = mapVolumeTypesToIdsOrNames(
        databaseInstanceName,
        fsxFileSystem,
        mappedOntapVolumes,
        true
    );
    const {
        CONTROL_FILES: controlFileVolumeNames,
        DATA_FILES: dataFileVolumeNames,
        REDO_LOGS: redoLogVolumeNames,
        ARCHIVE_LOGS: archiveLogVolumeNames,
        TEMP_FILES: tempFileVolumeNames
    } = volumeTypeToNamesMap;

    const { volumes } = storageAssessmentData;
    const { data: volumesData, error } = volumes;

    if (error) {
        return [{ errorMessage: error }];
    }

    const tieringPolicyRecommendations = {
        mixed: 'none',
        'data-control-files': 'snapshot-only',
        'log-files': 'none',
        'archive-log-files': 'auto'
    };

    const compressionRecommendations = {
        mixed: 'none',
        'log-files': 'none',
        'non-log-files': 'adaptive'
    };

    const deduplicationRecommendations = {
        mixed: 'none',
        'log-files': 'none',
        'non-log-files': 'inline'
    };

    return volumeConfigData.map(config => {
        const objectsInViolation: GenericViolationResponseType[] = [];
        const objectsInViolationNames: string[] = [];
        const controlDataFileVolumeNames = [...dataFileVolumeNames, ...controlFileVolumeNames];
        const redoLogsTempLogsVolumeNames = [...redoLogVolumeNames, ...tempFileVolumeNames];
        volumesData.forEach(volume => {
            const value = volume[config.parameter];
            const objectName = volume.name || '';
            let recommended = config.value.toString();
            let isViolated = false;
            let dataCategory: string = '';

            const isMixedViolation = isLayoutViolated && value !== 'none';

            switch (config.parameter) {
                case 'compaction':
                    isViolated = value === 'none';
                    recommended = 'none';
                    break;
                case 'tieringPolicy':
                    if (isMixedViolation) {
                        isViolated = true;
                        recommended = tieringPolicyRecommendations.mixed;
                        dataCategory = 'mixed';
                    } else if (controlDataFileVolumeNames.includes(objectName)) {
                        isViolated = value !== tieringPolicyRecommendations['data-control-files'];
                        recommended = tieringPolicyRecommendations['data-control-files'];
                        dataCategory = 'data-control-files';
                    } else if (redoLogsTempLogsVolumeNames.includes(objectName)) {
                        isViolated = value !== tieringPolicyRecommendations['log-files'];
                        recommended = tieringPolicyRecommendations['log-files'];
                        dataCategory = 'log-files';
                    } else if (archiveLogVolumeNames.includes(objectName)) {
                        isViolated = value !== tieringPolicyRecommendations['archive-log-files'];
                        recommended = tieringPolicyRecommendations['archive-log-files'];
                        dataCategory = 'archive-log-files';
                    }
                    break;
                case 'compression':
                    if (isMixedViolation) {
                        isViolated = true;
                        recommended = compressionRecommendations.mixed;
                        dataCategory = 'mixed';
                    } else if (redoLogsTempLogsVolumeNames.includes(objectName)) {
                        isViolated = value !== compressionRecommendations['log-files'];
                        recommended = compressionRecommendations['log-files'];
                        dataCategory = 'log-files';
                    } else {
                        isViolated = value !== compressionRecommendations['non-log-files'];
                        recommended = compressionRecommendations['non-log-files'];
                        dataCategory = 'non-log-files';
                    }
                    break;
                case 'deduplication':
                    if (isMixedViolation) {
                        isViolated = true;
                        recommended = deduplicationRecommendations.mixed;
                        dataCategory = 'mixed';
                    } else if (redoLogsTempLogsVolumeNames.includes(objectName)) {
                        isViolated = value !== deduplicationRecommendations['log-files'];
                        recommended = deduplicationRecommendations['log-files'];
                        dataCategory = 'log-files';
                    } else {
                        isViolated = value !== deduplicationRecommendations['non-log-files'];
                        recommended = deduplicationRecommendations['non-log-files'];
                        dataCategory = 'non-log-files';
                    }
                    break;
                default:
                    isViolated = value !== config.value;
                    recommended = config.value.toString();
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
            totalObjectsAssessed: volumesData.length,
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
    databaseInstanceName: string,
    fsxFileSystem: string,
    mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse>,
    storageAssessmentData: StorageAssessment
) {
    logger.info('Fetching volume layout drift');
    const volumeLayoutDrift: StorageParameterDriftResponseType['layout'] = [];

    const volumeTypeToIdsMap = mapVolumeTypesToIdsOrNames(
        databaseInstanceName,
        fsxFileSystem,
        mappedOntapVolumes,
        false
    );

    const binaryVolumeIds = storageAssessmentData.binaryVolumes?.data?.map(volume => volume.volumeId) || [];

    const {
        CONTROL_FILES: controlFileVolumeIds,
        DATA_FILES: dataFileVolumeIds,
        REDO_LOGS: redoLogVolumeIds,
        ARCHIVE_LOGS: archiveLogVolumeIds,
        TEMP_FILES: tempFileVolumeIds
    } = volumeTypeToIdsMap;

    const archiveLogConflicts = [
        ...new Set(
            archiveLogVolumeIds.filter(volumeId =>
                [controlFileVolumeIds, dataFileVolumeIds, redoLogVolumeIds, tempFileVolumeIds].flat().includes(volumeId)
            )
        )
    ];
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.archivePlacement,
        status: archiveLogConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
        objectsInViolation: archiveLogConflicts,
        totalObjectsAssessed: archiveLogVolumeIds.length,
        totalObjectsInViolation: archiveLogConflicts.length
    });

    const dataControlConflicts = [
        ...new Set(
            controlFileVolumeIds.filter(volumeId =>
                [...archiveLogVolumeIds, ...redoLogVolumeIds, ...tempFileVolumeIds].includes(volumeId)
            )
        )
    ];
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.datafilesControlfilesPlacement,
        status: dataControlConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
        objectsInViolation: dataControlConflicts,
        totalObjectsAssessed: dataFileVolumeIds.length,
        totalObjectsInViolation: dataControlConflicts.length
    });

    const redoTempConflicts = [
        ...new Set(
            [...redoLogVolumeIds, ...tempFileVolumeIds].filter(volumeId =>
                [controlFileVolumeIds, dataFileVolumeIds, archiveLogVolumeIds].flat().includes(volumeId)
            )
        )
    ];
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.redologsTempPlacement,
        status: redoTempConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
        objectsInViolation: redoTempConflicts,
        totalObjectsAssessed: redoLogVolumeIds.length,
        totalObjectsInViolation: redoTempConflicts.length
    });

    const binaryVolumeConflicts = binaryVolumeIds.filter(volumeId =>
        [controlFileVolumeIds, dataFileVolumeIds, redoLogVolumeIds, archiveLogVolumeIds, tempFileVolumeIds]
            .flat()
            .includes(volumeId)
    );
    volumeLayoutDrift.push({
        ...storageGoldenConfigData.oracleBinaryPlacement,
        status: binaryVolumeConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
        objectsInViolation: binaryVolumeConflicts,
        totalObjectsAssessed: binaryVolumeIds.length,
        totalObjectsInViolation: binaryVolumeConflicts.length
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

    const storageDriftData: StorageParameterDriftResponseType = {
        configuration: { volumes: [] },
        layout: []
    };

    const layoutAssessment = getVolumeLayoutDrift(
        databaseInstanceName,
        fsxFileSystemId,
        mappedOntapVolumes,
        storageAssessmentData
    );

    storageDriftData.layout = layoutAssessment;

    const isLayoutViolated = layoutAssessment.some(
        assessment =>
            assessment.name !== 'oracle-binary-placement' &&
            'status' in assessment &&
            assessment.status === AssessmentStatus.NOT_OPTIMIZED
    );

    storageDriftData.configuration.volumes = getVolumeConfigDrift(
        databaseInstanceName,
        fsxFileSystemId,
        mappedOntapVolumes,
        storageAssessmentData,
        isLayoutViolated
    );

    const protocol = mappedOntapVolumes[fsxFileSystemId]?.protocol;
    if (protocol === 'iSCSI') {
        storageDriftData.configuration.luns = getLunConfigDrift(storageAssessmentData);
    }

    return { storageDriftData, protocol };
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
    try {
        if (isEmpty(mappedVolumesUuids)) {
            errorMessage = `Found no FSx for ONTAP volumes for the instance ${databaseInstanceName}.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

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
