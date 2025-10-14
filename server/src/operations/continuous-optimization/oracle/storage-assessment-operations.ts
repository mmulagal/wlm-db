import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty, uniqBy } from 'lodash-es';
import getLogger from '../../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { WorkloadInstance } from '../../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT, STORAGE_PROTOCOLS } from '../../../utils/consts';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus
} from '../../../utils/continous-optimization-consts';
import { isDemo, parseMultipleCommandResponse } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob } from '../../database/job-operations';
import { VOLUME_LUN_CONFIGURATION } from '../../workloads/oracle/storage-assessment-scripts';
import {
    MAX_LUNS_PER_DG,
    MIN_OPTIMAL_LUN_PER_DG,
    SSM_RUN_SHELL_SCRIPT_DOC,
    SSM_RUN_SHELL_SCRIPT_DOC_VERSION
} from '../../workloads/oracle/consts';
import storageGoldenConfigData from './golden-config';
import { GenericViolationResponseType } from '../../../routes/types/continuous-optimization.types';
import { StorageParameterDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';
import {
    OracleMappedOntapVolumesResponse,
    OracleSysFileTypes,
    OracleVolumeRecord
} from '../../workloads/oracle/common-types';
import { OS_ASSESSMENT } from '../../workloads/oracle/os-iscsi-assessment-scripts';
import { NFS_OS_ASSESSMENT } from '../../workloads/oracle/os-nfs-assessment-scripts';
import {
    defaultMultipathExpected,
    netappMultipathExpected,
    nfsMountOptionExpected,
    StorageAssessment,
    StorageIscsiAssessment,
    StorageNfsAssessment
} from './common-types';

const logger = getLogger();
const isDemoFlow = isDemo();

const volumeConfigData = storageGoldenConfigData.configuration.volume;
const lunConfigData = storageGoldenConfigData.configuration.lun;
const osIsciConfigData = storageGoldenConfigData.configuration.os_iscsi;
const osNfsConfigData = storageGoldenConfigData.configuration.os_nfs;

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
        acc[type] = uniqBy(
            flattenedRecords
                .filter(
                    record =>
                        record.type === type && record.volume?.volumeId != null && record.volume.volumeId !== 'null'
                )
                .map(({ volume }) => ({
                    volumeId: volume.volumeId,
                    volumeName: volume.volumeName,
                    svmName: volume.svmName,
                    svmUuid: volume.svmId,
                    ...(volume.lunId && { lunId: volume.lunId }),
                    ...(volume.lunName && { lunName: volume.lunName }),
                    ...(volume.diskName && { diskName: volume.diskName }),
                    ...(volume.diskGroup && { diskGroup: volume.diskGroup })
                })),
            'volumeId'
        );
        return acc;
    }, {} as Record<OracleSysFileTypes, OracleVolumeRecord[]>);
}

function createEmptyVolumeAssessment(configData: any, volumeType: string) {
    return {
        name: configData.name,
        errorMessage: `No ${volumeType} volumes found.`
    };
}

function createViolationDetail(
    objectName: string,
    objectType: string,
    value: string,
    recommended: string,
    dataCategory?: string
): GenericViolationResponseType {
    return {
        objectName,
        objectType,
        value,
        recommended,
        ...(dataCategory && { dataCategory })
    };
}

function createAssessment(
    config: any,
    totalObjectsAssessed: number,
    objectsInViolation: string[],
    violationDetails: GenericViolationResponseType[]
) {
    const status = violationDetails.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
    objectsInViolation = status === AssessmentStatus.NOT_OPTIMIZED ? objectsInViolation : [];

    return {
        ...config,
        status,
        objectsInViolation,
        totalObjectsAssessed,
        totalObjectsInViolation: [...new Set(objectsInViolation)].length,
        violationDetails
    };
}

function getOSConfigDrift(
    ec2InstanceId: string,
    databaseInstanceName: string,
    storageAssessmentData: StorageIscsiAssessment
) {
    logger.info('Fetching OS configuration drift', { ec2InstanceId, databaseInstanceName });
    const { os } = storageAssessmentData;
    const osDrift: StorageParameterDriftResponseType['configuration']['os'] = [];

    if (!os || isEmpty(os)) {
        osDrift.push({ errorMessage: 'No OS assessment data found.' });
        return osDrift;
    }

    osIsciConfigData.forEach(config => {
        let violationDetails: GenericViolationResponseType[] = [];

        switch (config.parameter) {
            case 'multipath-io': {
                const multipathData = os?.['multipath-io'];
                const isActive = multipathData?.['multipath-io-is-active'];
                const isEnabled = multipathData?.['multipath-io-is-enabled'];

                if (isActive === false || isEnabled === false) {
                    violationDetails.push(
                        createViolationDetail(
                            'multipathd',
                            'service',
                            `active: ${isActive ? 'true' : 'false'}, enabled: ${isEnabled ? 'true' : 'false'}`,
                            'multipathd is installed, active and enabled'
                        )
                    );
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'host-utilities': {
                const hostUtilsData = os?.['host-utilities'];
                if (hostUtilsData?.['sanlun-installed'] === false) {
                    violationDetails.push(
                        createViolationDetail('sanlun', 'package', 'not installed', 'sanlun is installed')
                    );
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'selinux': {
                const selinuxData = os?.selinux;
                if (selinuxData?.['selinux-disabled'] === false) {
                    violationDetails.push(
                        createViolationDetail(
                            'selinux',
                            'configuration',
                            selinuxData?.['selinux-value'] || '',
                            'SELINUX=disabled'
                        )
                    );
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'transparent-hugepages': {
                const thpData = os?.['transparent-hugepages'];
                if (thpData?.['thp-disabled'] === false) {
                    violationDetails.push(
                        createViolationDetail(
                            'transparent-hugepages',
                            'configuration',
                            `${thpData?.['thp-value'] || 'enabled'}`,
                            'always madvise [never]'
                        )
                    );
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'multipath-friendly-names': {
                const multipathConfigData = os?.['multipath-configuration'];
                const defaultsFriendlyNames = multipathConfigData?.defaults?.user_friendly_names;
                const netappFriendlyNames = multipathConfigData?.['netapp-device']?.user_friendly_names;
                violationDetails = [];
                // If netapp-device section exists, it takes precedence over defaults section
                const friendlyNamesValue = netappFriendlyNames ?? defaultsFriendlyNames;
                if (friendlyNamesValue !== 'yes') {
                    const isNetappConfig = netappFriendlyNames != null;
                    const configType = isNetappConfig ? 'netapp device configuration' : 'default configuration';
                    const recommendedText = isNetappConfig
                        ? 'user_friendly_names "yes" for netapp device section'
                        : 'user_friendly_names "yes" for default section';
                    const currentValue = friendlyNamesValue == null ? 'not found' : friendlyNamesValue.toString();

                    violationDetails.push(
                        createViolationDetail('user_friendly_names', configType, currentValue, recommendedText)
                    );
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'multipath-configuration': {
                const multipathConfigData = os?.['multipath-configuration'];
                const defaultsData = multipathConfigData?.defaults;
                const netappDeviceData = multipathConfigData?.['netapp-device'];
                violationDetails = [];

                // Check defaults configuration
                Object.entries(defaultMultipathExpected).forEach(([key, expectedValue]) => {
                    const actualValue = defaultsData?.[key];
                    const isViolated = Array.isArray(expectedValue)
                        ? !expectedValue.includes(actualValue as string)
                        : actualValue !== expectedValue;

                    if (isViolated) {
                        violationDetails.push(
                            createViolationDetail(
                                key,
                                'default configuration',
                                actualValue?.toString() || 'not found',
                                `${key} ${
                                    Array.isArray(expectedValue) ? expectedValue.join(' or ') : expectedValue.toString()
                                }`
                            )
                        );
                    }
                });

                // Check netapp device configuration
                Object.entries(netappMultipathExpected).forEach(([key, expectedValue]) => {
                    const actualValue = netappDeviceData?.[key];
                    const isViolated = Array.isArray(expectedValue)
                        ? !expectedValue.includes(actualValue as string)
                        : actualValue !== expectedValue;

                    if (isViolated) {
                        violationDetails.push(
                            createViolationDetail(
                                key,
                                'netapp device configuration',
                                actualValue?.toString() || 'not found',
                                `${key} ${
                                    Array.isArray(expectedValue) ? expectedValue.join(' or ') : expectedValue.toString()
                                }`
                            )
                        );
                    }
                });
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'iscsi-replacement-timeout': {
                const timeoutData = os?.['iscsi-replacement-timeout'];
                if (timeoutData?.error || timeoutData?.['replacement-timeout'] !== 5) {
                    violationDetails = [
                        createViolationDetail(
                            'iscsi-replacement-timeout',
                            'configuration',
                            `${timeoutData?.['replacement-timeout']?.toString() || 'unknown'}`,
                            '5'
                        )
                    ];
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'tcp-advanced-options': {
                const tcpData = os?.['tcp-advanced-options'];
                const tcpFeatures = tcpData?.['tcp-features'] || {};
                const requiredFeatures = ['tcp-sack-enabled', 'tcp-window-scaling-enabled', 'tcp-timestamps-enabled'];
                const disabledFeatures = requiredFeatures.filter(
                    feature => !tcpFeatures[feature as keyof typeof tcpFeatures]
                );
                violationDetails = disabledFeatures.map(feature =>
                    createViolationDetail(feature.replace('-enabled', ''), 'configuration', '0', '1')
                );
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'filesystems-io-options': {
                const oracleParamsData = os?.['oracle-parameters']?.['filesystemio-options'];
                if (oracleParamsData?.found === false || oracleParamsData?.value !== 'SETALL') {
                    violationDetails = [
                        createViolationDetail(
                            'filesystemio_options',
                            'oracle parameter',
                            `${oracleParamsData?.value || 'unknown'}`,
                            'SETALL'
                        )
                    ];
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'multipath-readcount': {
                const oracleParamsData =
                    os?.['oracle-parameters-from-init']?.['db-file-multiblock-read-count-in-init'] || [];
                violationDetails = oracleParamsData
                    .filter(paramRecord => paramRecord['parameter-found'])
                    .map(paramRecord =>
                        createViolationDetail(
                            'db_file_multiblock_read_count',
                            'oracle parameter',
                            `${paramRecord['parameter-value']}`,
                            'db_file_multiblock_read_count should not be set'
                        )
                    );
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'multipath-io-sessions': {
                const iscsiTargetSessions = os?.['iscsi-targets-sessions'];
                if (iscsiTargetSessions?.error) {
                    osDrift.push({ name: config.name, errorMessage: iscsiTargetSessions.error });
                } else {
                    const targetSessions = iscsiTargetSessions?.['iscsi-sessions-per-target'] || {};
                    violationDetails = Object.entries(targetSessions)
                        .filter(([, sessions]) => sessions !== 4)
                        .map(([target, sessions]) =>
                            createViolationDetail(target, 'iscsi target', sessions.toString(), '4')
                        );
                    osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                }
                break;
            }

            default:
                break;
        }
    });

    return osDrift;
}

function getNfsOSConfigDrift(
    ec2InstanceId: string,
    databaseInstanceName: string,
    deploymentType: string,
    storageAssessmentData: StorageNfsAssessment
) {
    logger.info('Fetching NFS OS configuration drift', { ec2InstanceId, databaseInstanceName, deploymentType });
    const { os } = storageAssessmentData;
    const osDrift: StorageParameterDriftResponseType['configuration']['os'] = [];

    if (!os || isEmpty(os)) {
        osDrift.push({ errorMessage: 'No OS assessment data found.' });
        return osDrift;
    }

    const recommendedNFSMountOptions = Object.entries(nfsMountOptionExpected)
        .map(([key, expectedValue]) => {
            const recommendedText = Array.isArray(expectedValue)
                ? expectedValue.join(' or ')
                : expectedValue.toString();
            return `${key}=${recommendedText}`;
        })
        .join(', ');

    osNfsConfigData.forEach(config => {
        const violationDetails: GenericViolationResponseType[] = [];

        switch (config.parameter) {
            case 'kernel-parameters': {
                const kernelParamsData = os?.['kernel-parameters'];
                const sunrpcTcpSlotEntries = kernelParamsData?.['sunrpc-tcp-slot-entries'];
                if (kernelParamsData?.error) {
                    osDrift.push({ name: config.name, errorMessage: kernelParamsData.error });
                } else {
                    const tcpMaxSlotTable = sunrpcTcpSlotEntries?.['tcp-max-slot-table'] || '';
                    const tcpSlotTable = sunrpcTcpSlotEntries?.['tcp-slot-table'] || '';

                    ['tcp-max-slot-table', 'tcp-slot-table'].forEach(param => {
                        const value = param === 'tcp-max-slot-table' ? tcpMaxSlotTable : tcpSlotTable;
                        if (value !== '128') {
                            violationDetails.push(createViolationDetail(param, 'kernel parameter', value, '128'));
                        }
                    });

                    if (violationDetails.length > 0) {
                        osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                    }
                }
                break;
            }
            case 'nfs-mount-options-databasefiles': {
                const nfsMountData = os?.['nfs-mount-options'];
                if (nfsMountData?.error) {
                    osDrift.push({ name: config.name, errorMessage: nfsMountData.error });
                } else {
                    const mountOptions = nfsMountData?.['nfs-mount-options'] || [];
                    mountOptions.forEach(mount => {
                        const mountPoint = mount?.['mount-point'] || '';
                        const remotePath = mount?.['remote-path'] || '';
                        const options = mount?.options || {};

                        const violations = Object.entries(nfsMountOptionExpected)
                            .filter(([key, expectedValue]) => {
                                const actualValue = options[key];
                                return Array.isArray(expectedValue)
                                    ? !expectedValue.includes(actualValue as string)
                                    : actualValue !== expectedValue;
                            })
                            .map(([key]) => {
                                const actualValue = options[key]?.toString() || 'not found';
                                return `${key}=${actualValue}`;
                            });

                        if (violations.length > 0) {
                            violationDetails.push(
                                createViolationDetail(
                                    `${remotePath}:${mountPoint}`,
                                    'nfs mount options',
                                    violations.join(', '),
                                    recommendedNFSMountOptions
                                )
                            );
                        }
                    });
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }
            case 'nfs-caching-options': {
                if (deploymentType !== 'Standalone') {
                    return;
                }
                const nfsMountData = os?.['nfs-mount-options'];
                if (nfsMountData?.error) {
                    osDrift.push({ name: config.name, errorMessage: nfsMountData.error });
                } else {
                    const mountOptions = nfsMountData?.['nfs-mount-options'] || [];
                    mountOptions.forEach(mount => {
                        const mountPoint = mount?.['mount-point'] || '';
                        const remotePath = mount?.['remote-path'] || '';
                        const options = mount?.options || {};
                        const violations: string[] = [];

                        // Check for noac with NFSv3
                        if (options.vers === '3' && options.noac !== undefined) {
                            violations.push('noac should not be used with NFSv3');
                        }

                        // Check for caching options set to 0
                        ['acregmin', 'acregmax', 'acdirmin', 'acdirmax'].forEach(option => {
                            if (options[option] === '0') {
                                violations.push(`${option}=${options[option]}`);
                            }
                        });

                        if (violations.length > 0) {
                            violationDetails.push(
                                createViolationDetail(
                                    `${remotePath}:${mountPoint}`,
                                    'nfs mount options',
                                    violations.join(', '),
                                    'Remove noac option and ensure caching options are not set to 0'
                                )
                            );
                        }
                    });
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }
            case 'nfs-mount-options-adrhome': {
                const adrMountInfoData = os?.['adr-info'];
                if (adrMountInfoData?.error) {
                    osDrift.push({ name: config.name, errorMessage: adrMountInfoData.error });
                } else {
                    const mountOptions = adrMountInfoData?.['adr-home-mount-info'];
                    const fileSystem = mountOptions?.['filesystem-type'] || '';

                    if (!fileSystem.includes('nfs')) {
                        osDrift.push({ name: config.name, errorMessage: 'ADR home mount is not NFS' });
                        return;
                    }

                    const mountPoint = mountOptions?.['mount-point'] || '';
                    const options = mountOptions?.['mount-options'] || {};

                    const violations = Object.entries(nfsMountOptionExpected)
                        .filter(([key, expectedValue]) => {
                            if (key === 'nointr') {
                                return false;
                            } // Skip nointr check for adr-home

                            const actualValue = options[key];
                            return Array.isArray(expectedValue)
                                ? !expectedValue.includes(actualValue as string)
                                : actualValue !== expectedValue;
                        })
                        .map(([key]) => {
                            const actualValue = options[key]?.toString() || 'not found';

                            return `${key}=${actualValue}`;
                        });

                    if (violations.length > 0) {
                        violationDetails.push(
                            createViolationDetail(
                                mountPoint,
                                'nfs mount options',
                                violations.join(', '),
                                recommendedNFSMountOptions
                            )
                        );
                    }
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }
            default:
                break;
        }
    });

    return osDrift;
}

function prepareASMLunLayoutAssessment(
    goldenConfig: any,
    lunMap: OracleVolumeRecord[],
    minLunType: MIN_OPTIMAL_LUN_PER_DG,
    diskGroupLabel: string
) {
    logger.info(`Drift assessment for ASM LUN layout of ${diskGroupLabel}`);
    const luns = lunMap.reduce((acc, record) => {
        if (!acc.some(lun => lun.lunId === record.lunId)) {
            acc.push(record);
        }
        return acc;
    }, [] as OracleVolumeRecord[]);

    const lunsGroupedByDiskGroup = Object.groupBy(luns, lun => lun.diskGroup!);
    if (isEmpty(luns)) {
        goldenConfig = createEmptyVolumeAssessment(goldenConfig, diskGroupLabel);
    } else {
        goldenConfig.status = AssessmentStatus.OPTIMIZED;
        goldenConfig.totalObjectsInViolation = 0;
        goldenConfig.objectsInViolation = [];
        goldenConfig.violationDetails = [];
        Object.keys(lunsGroupedByDiskGroup).forEach(diskGrp => {
            const associatedLuns = lunsGroupedByDiskGroup[diskGrp]?.length ?? NaN;
            if (associatedLuns < minLunType || associatedLuns > MAX_LUNS_PER_DG) {
                goldenConfig.objectsInViolation.push(diskGrp);
                const violationDetails: GenericViolationResponseType = {
                    objectName: diskGrp,
                    value: associatedLuns.toString(),
                    objectType: ASSESSMENT_RESOURCE_TYPE.DISK_GROUP,
                    recommended: minLunType.toString(),
                    dataCategory: diskGroupLabel
                };
                goldenConfig.violationDetails.push(violationDetails);
            }
        });
        if (goldenConfig.objectsInViolation.length > 0) {
            goldenConfig.status = AssessmentStatus.NOT_OPTIMIZED;
            goldenConfig.totalObjectsInViolation = goldenConfig.objectsInViolation.length;
        }
        goldenConfig.totalObjectsAssessed = Object.keys(lunsGroupedByDiskGroup).length;
    }
    return goldenConfig;
}

function getVolumeConfigDrift(
    volumeTypeMap: Record<OracleSysFileTypes, OracleVolumeRecord[]>,
    storageAssessmentData: StorageAssessment
) {
    logger.info('Fetching volume configuration drift');
    const {
        CONTROL_FILES: controlFileVolumes,
        DATA_FILES: dataFileVolumes,
        REDO_LOGS: redoLogVolumes,
        ARCHIVE_LOGS: archiveLogVolumes,
        TEMP_FILES: tempFileVolumes,
        FRA: fraVolumes
    } = volumeTypeMap;

    const allVolumeNames = Object.values(volumeTypeMap).flat();
    if (isEmpty(allVolumeNames)) {
        return [{ errorMessage: 'Found no FSx for ONTAP volumes for the database.' }];
    }

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

    const compactionRecommendations = {
        'log-files': 'none',
        others: 'enabled'
    };

    const controlDataFileVolumeIds = [
        ...dataFileVolumes.map(volume => volume.volumeId),
        ...controlFileVolumes.map(volume => volume.volumeId)
    ];
    const redoLogsTempLogsVolumeIds = [
        ...redoLogVolumes.map(volume => volume.volumeId),
        ...tempFileVolumes.map(volume => volume.volumeId)
    ];
    const archiveLogVolumeIds = [
        ...archiveLogVolumes.map(volume => volume.volumeId),
        ...fraVolumes.map(volume => volume.volumeId)
    ];
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
                    value = value !== 'none' ? 'enabled' : value;
                    if (isIn(redoLogsTempLogsVolumeIds, objectId)) {
                        recommended = compactionRecommendations['log-files'];
                        dataCategory = volumeMembership >= 2 ? 'mixed' : 'log-files';
                    } else {
                        recommended = compactionRecommendations.others;
                        dataCategory = 'non-log-files';
                    }
                    isViolated = value !== recommended;
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
                value: lun[config.parameter]?.toString() || '',
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
    volumeTypeMap: Record<OracleSysFileTypes, OracleVolumeRecord[]>,
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
        TEMP_FILES: tempFileVolumes,
        FRA: fraVolumes
    } = volumeTypeMap;

    let status = AssessmentStatus.OPTIMIZED;

    const archiveFraLogVolumes = [...archiveLogVolumes, ...fraVolumes];
    if (isEmpty(archiveFraLogVolumes)) {
        volumeLayoutDrift.push(createEmptyVolumeAssessment(storageGoldenConfigData.archivePlacement, 'archive log'));
    } else {
        const archiveLogConflicts = [
            ...new Set(
                archiveFraLogVolumes.filter(archiveVolume =>
                    [controlFileVolumes, dataFileVolumes, redoLogVolumes, tempFileVolumes]
                        .flat()
                        .map(volume => volume.volumeId)
                        .includes(archiveVolume.volumeId)
                )
            )
        ];
        status = archiveLogConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        volumeLayoutDrift.push({
            ...storageGoldenConfigData.archivePlacement,
            status,
            objectsInViolation:
                status === AssessmentStatus.NOT_OPTIMIZED
                    ? archiveLogConflicts.map(conflict => conflict.volumeName)
                    : [],
            totalObjectsAssessed: archiveFraLogVolumes.length,
            totalObjectsInViolation: status === AssessmentStatus.NOT_OPTIMIZED ? archiveLogConflicts.length : 0
        });
    }

    if (isEmpty(dataFileVolumes)) {
        volumeLayoutDrift.push(createEmptyVolumeAssessment(storageGoldenConfigData.datafilesPlacement, 'data file'));
    } else {
        // Data files can be on separate volume or shared with control files
        const dataFileConflicts = [
            ...new Set(
                dataFileVolumes.filter(dataVolume =>
                    [...redoLogVolumes, ...archiveLogVolumes, ...tempFileVolumes]
                        .flat()
                        .map(volume => volume.volumeId)
                        .includes(dataVolume.volumeId)
                )
            )
        ];
        status = dataFileConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        volumeLayoutDrift.push({
            ...storageGoldenConfigData.datafilesPlacement,
            status,
            objectsInViolation:
                status === AssessmentStatus.NOT_OPTIMIZED ? dataFileConflicts.map(conflict => conflict.volumeName) : [],
            totalObjectsAssessed: dataFileVolumes.length,
            totalObjectsInViolation: status === AssessmentStatus.NOT_OPTIMIZED ? dataFileConflicts.length : 0
        });
    }

    let hasConflicts;
    let insufficientMultiplexing;
    if (isEmpty(controlFileVolumes)) {
        volumeLayoutDrift.push(
            createEmptyVolumeAssessment(storageGoldenConfigData.controlfilesPlacement, 'control file')
        );
    } else {
        // Control files can be on separate volume or shared with data/redo/temp and maintain at least two, preferably three, control file copies across separate volumes
        const conflictVolumeIds = [...archiveLogVolumes].map(volume => volume.volumeId);
        const controlFileConflicts = [
            ...new Set(controlFileVolumes.filter(controlVolume => conflictVolumeIds.includes(controlVolume.volumeId)))
        ];

        hasConflicts = controlFileConflicts.length > 0;

        const uniqueControlFileVolumesWithoutSharingViolation = [
            ...new Set(
                controlFileVolumes
                    .filter(controlVolume => !conflictVolumeIds.includes(controlVolume.volumeId))
                    .map(volume => volume.volumeId)
            )
        ];
        // Best practice is to have at least two multiplexed control files on separate volumes. So we need at least two separate volumes if there are multiplexed control files
        insufficientMultiplexing = uniqueControlFileVolumesWithoutSharingViolation.length < 2;

        status = hasConflicts || insufficientMultiplexing ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const recommended =
            hasConflicts && insufficientMultiplexing
                ? 'separate-volume-or-shared-with-data-redo-temp-with-two-multiplexed-volumes'
                : hasConflicts
                ? 'separate-volume-or-shared-with-data-redo-temp'
                : 'two-multiplexed-volumes';
        volumeLayoutDrift.push({
            ...storageGoldenConfigData.controlfilesPlacement,
            recommended,
            status,
            objectsInViolation: hasConflicts ? controlFileConflicts.map(conflict => conflict.volumeName) : [],
            totalObjectsAssessed: controlFileVolumes.length,
            totalObjectsInViolation: hasConflicts ? controlFileConflicts.length : 0
        });
    }

    if (isEmpty(redoLogVolumes)) {
        volumeLayoutDrift.push(createEmptyVolumeAssessment(storageGoldenConfigData.redologsPlacement, 'redo log'));
    } else {
        // Redo logs can be on separate or shared with temp/control
        const conflictVolumeIds = [...dataFileVolumes, ...archiveLogVolumes].map(volume => volume.volumeId);
        const redoFileConflicts = [
            ...new Set(redoLogVolumes.filter(redoVolume => conflictVolumeIds.includes(redoVolume.volumeId)))
        ];

        hasConflicts = redoFileConflicts.length > 0;

        const uniqueRedoLogVolumesWithoutSharingViolation = [
            ...new Set(
                redoLogVolumes
                    .filter(redoVolume => !conflictVolumeIds.includes(redoVolume.volumeId))
                    .map(volume => volume.volumeId)
            )
        ];

        // - Need at least 2 volumes for proper multiplexing
        // - OR if only 1 volume, it must have copiesCount = 1 (single redo log)
        const hasMultipleVolumes = uniqueRedoLogVolumesWithoutSharingViolation.length >= 2;
        const hasSingleVolumeWithSingleCopy =
            uniqueRedoLogVolumesWithoutSharingViolation.length === 1 &&
            redoLogVolumes.find(vol => vol.volumeId === uniqueRedoLogVolumesWithoutSharingViolation[0])?.copiesCount ===
                1;
        insufficientMultiplexing = !hasMultipleVolumes && !hasSingleVolumeWithSingleCopy;

        status = hasConflicts || insufficientMultiplexing ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const recommended =
            hasConflicts && insufficientMultiplexing
                ? 'separate-volume-or-shared-with-control-temp-with-multiplexed-copies-on-two-or-more-volumes'
                : hasConflicts
                ? 'separate-volume-or-shared-with-control-temp'
                : 'multiplexed-copies-on-two-or-more-volumes';
        volumeLayoutDrift.push({
            ...storageGoldenConfigData.redologsPlacement,
            recommended,
            status,
            objectsInViolation: hasConflicts ? redoFileConflicts.map(conflict => conflict.volumeName) : [],
            totalObjectsAssessed: redoLogVolumes.length,
            totalObjectsInViolation: hasConflicts ? redoFileConflicts.length : 0
        });
    }

    if (isEmpty(tempFileVolumes)) {
        volumeLayoutDrift.push(createEmptyVolumeAssessment(storageGoldenConfigData.templogsPlacement, 'temp log'));
    } else {
        // Temp logs can be on separate or shared with redo/control
        const tempFileConflicts = [
            ...new Set(
                tempFileVolumes.filter(tempVolume =>
                    [...dataFileVolumes, ...archiveLogVolumes]
                        .map(volume => volume.volumeId)
                        .includes(tempVolume.volumeId)
                )
            )
        ];
        status = tempFileConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        volumeLayoutDrift.push({
            ...storageGoldenConfigData.templogsPlacement,
            status,
            objectsInViolation:
                tempFileConflicts.length > 0 ? tempFileConflicts.map(conflict => conflict.volumeName) : [],
            totalObjectsAssessed: tempFileVolumes.length,
            totalObjectsInViolation: tempFileConflicts.length > 0 ? tempFileConflicts.length : 0
        });
    }

    if (isEmpty(binaryVolumeIds)) {
        volumeLayoutDrift.push(
            createEmptyVolumeAssessment(storageGoldenConfigData.oracleBinaryPlacement, 'binary log')
        );
    } else {
        const binaryVolumeConflicts = binaryVolumeIds.filter(binaryVolumeId =>
            [controlFileVolumes, dataFileVolumes, redoLogVolumes, archiveLogVolumes, tempFileVolumes]
                .flat()
                .map(volume => volume.volumeId)
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
    }

    return volumeLayoutDrift;
}

function getLunLayoutDrift(
    volumeTypeMap: Record<OracleSysFileTypes, OracleVolumeRecord[]>,
    storageAssessmentData: StorageAssessment
) {
    logger.info('Fetching LUN layout drift');
    const {
        DATA_FILES: dataFileLuns,
        REDO_LOGS: redoLogLuns,
        ARCHIVE_LOGS: archiveLogLuns,
        FRA: fraLuns
    } = volumeTypeMap;
    const { fraEnabled } = storageAssessmentData;
    const result = [];
    result.push(
        prepareASMLunLayoutAssessment(
            storageGoldenConfigData.dataDiskLunLayout,
            dataFileLuns,
            MIN_OPTIMAL_LUN_PER_DG.DATA,
            'Data'
        )
    );
    result.push(
        prepareASMLunLayoutAssessment(
            storageGoldenConfigData.redoLogDiskLunLayout,
            redoLogLuns,
            MIN_OPTIMAL_LUN_PER_DG.LOG_RECOVERY,
            'Redo Log'
        )
    );
    if (fraEnabled === 'yes') {
        result.push(
            prepareASMLunLayoutAssessment(
                storageGoldenConfigData.fraDiskLunLayout,
                fraLuns,
                MIN_OPTIMAL_LUN_PER_DG.LOG_RECOVERY,
                'FRA'
            )
        );
    } else {
        result.push(
            prepareASMLunLayoutAssessment(
                storageGoldenConfigData.archivelogDiskLunLayout,
                archiveLogLuns,
                MIN_OPTIMAL_LUN_PER_DG.LOG_RECOVERY,
                'Archive Log'
            )
        );
    }
    return result;
}

function calculateStorageDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    ec2InstanceId: string,
    databaseInstanceId: string,
    databaseInstanceName: string,
    deploymentType: string,
    fsxFileSystemId: string,
    mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse>,
    storageAssessmentData: StorageAssessment
) {
    logger.info('Calculating storage drift', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        deploymentType
    });

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
    const isASMManaged = mappedOntapVolumes[fsxFileSystemId]?.isASMManaged;
    if (protocol === STORAGE_PROTOCOLS.ISCSI) {
        storageDriftData.configuration.luns = getLunConfigDrift(storageAssessmentData);
        storageDriftData.configuration.os = getOSConfigDrift(
            ec2InstanceId,
            databaseInstanceName,
            storageAssessmentData
        );
        if (isASMManaged) {
            storageDriftData.layout.push(...getLunLayoutDrift(volumeTypeMap, storageAssessmentData));
        }
    } else {
        storageDriftData.configuration.os = getNfsOSConfigDrift(
            ec2InstanceId,
            databaseInstanceName,
            deploymentType,
            storageAssessmentData as StorageNfsAssessment
        );
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
        fsxFileSystem,
        storageProtocol
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
        if (storageProtocol === 'iSCSI') {
            command.push(OS_ASSESSMENT(activeNodeInstanceid, databaseInstanceName));
        } else {
            command.push(NFS_OS_ASSESSMENT(activeNodeInstanceid, databaseInstanceName));
        }
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

        const parsedResponse = parseMultipleCommandResponse(response);
        const [storageAssessment, osAssessment] = parsedResponse;

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.STORAGE,
                config_data: { ...storageAssessment, ...osAssessment }
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

export { initiateStorageAssessmentCollection, calculateStorageDrift, getVolumeConfigDrift, mapVolumeTypesToIdName };
