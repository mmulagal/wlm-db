import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { compact, groupBy, isEmpty, uniqBy } from 'lodash-es';
import getLogger from '../../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { WorkloadInstance } from '../../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT, RESOURCESTYPE, STORAGE_PROTOCOLS } from '../../../utils/consts';
import { IS_DEMO_FLOW, parseMultipleCommandResponse, sizeInGigaBytes } from '../../../utils/utils';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE,
    OptimizeStorageConfigs
} from '../../../utils/continous-optimization-consts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob } from '../../database/job-operations';
import {
    MAX_LUNS_PER_DG,
    MIN_OPTIMAL_LUN_PER_DG,
    SSM_RUN_SHELL_SCRIPT_DOC,
    SSM_RUN_SHELL_SCRIPT_DOC_VERSION,
    supportedOracleOsVersions
} from '../../workloads/oracle/consts';
import ORACLE_GOLDEN_CONFIG from './golden-config';
import {
    ORACLE_FILE_TYPE_LABEL_ORDER,
    ORACLE_FILE_TYPE_LABELS,
    STORAGE_EFFICIENCIES_CONFIG_DETAILS,
    TIERING_TCO_OPTIMIZATION_CONFIG_DETAILS,
    COMBINED_VOLUME_CONFIG_IDS,
    COMBINED_SUB_PARAMETER_TO_PROPERTY,
    getArchiveLogTieringMinCoolingDaysRecommendation
} from './consts';
import {
    GenericViolationResponseType,
    AssessmentItemType,
    AssessmentErrorItemType
} from '../../../routes/types/continuous-optimization.types';
import {
    OracleMappedOntapVolumesResponse,
    OracleSysFileTypes,
    OracleVolumeRecord
} from '../../workloads/oracle/common-types';
import {
    defaultMultipathExpected,
    ISCIOSAssessment,
    netappMultipathExpected,
    nfsMountOptionExpected,
    StorageAssessment,
    StorageIscsiAssessment,
    StorageNfsAssessment
} from './common-types';
import { OS_ASSESSMENT } from './ssm-scripts/os-iscsi-assessment-scripts';
import { NFS_OS_ASSESSMENT } from './ssm-scripts/os-nfs-assessment-scripts';
import { ORACLE_STORAGE_SIZING_ASSESSMENT, VOLUME_LUN_CONFIGURATION } from './ssm-scripts/storage-assessment-scripts';
import { getHeadroomDrift } from '../headroom-assessment';
import {
    buildBlockDeviceSpaceManagementEntry,
    isPdbGroupedVolumes,
    normalizeNfsVersion,
    type GoldenConfigEntry
} from '../assessment-utils';
import { DriftAssessmentDetail } from '../../../utils/wad-consts';

const logger = getLogger();

interface WadManagerOracleAssessmentItemType extends AssessmentItemType {
    assessmentDetails?: DriftAssessmentDetail[];
}

type NfsMountEntry = NonNullable<
    NonNullable<StorageNfsAssessment['os']>['nfs-mount-options']
>['nfs-mount-options'] extends Array<infer T> | undefined
    ? T
    : never;

function addNosharecacheViolationIfNeeded(
    mount: NfsMountEntry,
    flaggedMounts: Set<string>,
    violationDetails: GenericViolationResponseType[]
): void {
    const key = `${mount?.['remote-path']}:${mount?.['mount-point']}`;
    if (flaggedMounts.has(key)) {
        return;
    }
    flaggedMounts.add(key);

    const options = mount?.options || {};
    if (options.nosharecache !== true && options.nosharecache !== 'true') {
        const currentOpts = Object.entries(options)
            .map(([k, v]) => (v === true ? k : `${k}=${v}`))
            .join(',');

        violationDetails.push(
            createViolationDetail(
                key,
                'NFS mount option',
                currentOpts || 'no options',
                currentOpts ? `${currentOpts},nosharecache` : 'nosharecache'
            )
        );
    }
}

const storageConfigData = ORACLE_GOLDEN_CONFIG.filter(e => e.type === 'storage');
const volumeConfigData = ORACLE_GOLDEN_CONFIG.filter(
    e =>
        e.type === 'storage' &&
        e.subType === 'configuration' &&
        !e.applicableTo &&
        e.resourceType === ASSESSMENT_RESOURCE_TYPE.VOLUME
);
const volumeNfsConfigData = ORACLE_GOLDEN_CONFIG.filter(
    e => e.applicableTo === 'nfs' && e.resourceType === ASSESSMENT_RESOURCE_TYPE.VOLUME
);
const lunConfigData = ORACLE_GOLDEN_CONFIG.filter(
    e => e.applicableTo === 'iscsi' && e.resourceType === ASSESSMENT_RESOURCE_TYPE.LUN
);
const blockDeviceConfig = ORACLE_GOLDEN_CONFIG.find(e => e.id === 'block-device-space-management');
const osIsciConfigData = ORACLE_GOLDEN_CONFIG.filter(
    e => e.applicableTo === 'iscsi' && e.resourceType !== ASSESSMENT_RESOURCE_TYPE.LUN
);
const osNfsConfigData = ORACLE_GOLDEN_CONFIG.filter(
    e => e.applicableTo === 'nfs' && e.resourceType !== ASSESSMENT_RESOURCE_TYPE.VOLUME
);
const sizingConfigData = ORACLE_GOLDEN_CONFIG.filter(e => e.type === 'storage' && e.subType === 'sizing');
const asmOSConfig = ORACLE_GOLDEN_CONFIG.filter(
    e =>
        e.type === 'storage' &&
        e.subType === 'configuration' &&
        !e.applicableTo &&
        e.resourceType !== ASSESSMENT_RESOURCE_TYPE.VOLUME &&
        e.resourceType !== ASSESSMENT_RESOURCE_TYPE.LUN
);

const [archivePlacementConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'archive-placement');
const [datafilesPlacementConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'datafiles-placement');
const [controlfilesPlacementConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'controlfiles-placement');
const [redologsPlacementConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'redologs-placement');
const [templogsPlacementConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'templogs-placement');
const [oracleBinaryPlacementConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'oracle-binary-placement');
const [dataDiskLunLayoutConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'data-dg-lun-layout');
const [redoLogDiskLunLayoutConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'redolog-dg-lun-layout');
const [fraDiskLunLayoutConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'fra-dg-lun-layout');
const [archivelogDiskLunLayoutConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'archivelog-dg-lun-layout');

function mapVolumeTypesToIdName(
    databaseInstanceName: string,
    fsxFileSystem: string,
    mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse>
) {
    let instanceVolumeMappings;
    if (IS_DEMO_FLOW) {
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
    const hasPdbGroupedVolumes = isPdbGroupedVolumes(isCDB, volumeRecords);

    const flattenedRecords = hasPdbGroupedVolumes
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
    config: GoldenConfigEntry,
    totalObjectsAssessed: number,
    objectsInViolation: string[],
    violationDetails: GenericViolationResponseType[]
): AssessmentItemType {
    const status = violationDetails.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
    const resolvedViolations = status === AssessmentStatus.NOT_OPTIMIZED ? objectsInViolation : [];
    return {
        ...config,
        recommended: config.recommended ?? '',
        status,
        objectsInViolation: resolvedViolations,
        totalObjectsAssessed,
        totalObjectsInViolation: [...new Set(resolvedViolations)].length,
        violationDetails
    };
}

function getAsmOSConfigDrift(
    osData: ISCIOSAssessment,
    databaseInstanceName: string
): (AssessmentItemType | AssessmentErrorItemType)[] {
    try {
        const asmOsConfigData = osData?.['asm-os-config'];
        const driftData: (AssessmentItemType | AssessmentErrorItemType)[] = [];
        if (asmOsConfigData && !isEmpty(asmOsConfigData) && asmOsConfigData?.isIscsi === 'true') {
            asmOSConfig.forEach(config => {
                const violationDetails: GenericViolationResponseType[] = [];
                switch (config.id) {
                    case 'asm-setup': {
                        if (asmOsConfigData?.isIscsi === 'true') {
                            if (asmOsConfigData['asm-setup'] !== 'true') {
                                violationDetails.push(
                                    createViolationDetail(
                                        config.id,
                                        'configuration',
                                        asmOsConfigData['asm-setup'] || 'false',
                                        'true'
                                    )
                                );
                            }
                            driftData.push(
                                createAssessment(
                                    config,
                                    1,
                                    asmOsConfigData['asm-setup'] !== 'true' ? [databaseInstanceName] : [],
                                    violationDetails
                                )
                            );
                        }
                        break;
                    }
                    case 'asm-external-redundancy': {
                        if (asmOsConfigData['asm-setup'] !== 'true') {
                            break;
                        }
                        if (asmOsConfigData?.['asm-external-redundancy']?.error) {
                            driftData.push({
                                ...config,
                                errorMessage: asmOsConfigData?.['asm-external-redundancy']?.error
                            });
                        } else if (asmOsConfigData?.['asm-external-redundancy']?.assessment) {
                            if (
                                (asmOsConfigData?.['asm-external-redundancy']?.assessment?.violations ?? []).length > 0
                            ) {
                                asmOsConfigData?.['asm-external-redundancy']?.assessment?.violations?.forEach(
                                    (dgName: string) => {
                                        violationDetails.push(
                                            createViolationDetail(dgName, 'ASM Disk Group', 'False', 'External')
                                        );
                                    }
                                );
                            }
                            driftData.push(
                                createAssessment(
                                    config,
                                    asmOsConfigData?.['asm-external-redundancy']?.assessment?.totalObjects ?? 0,
                                    asmOsConfigData?.['asm-external-redundancy']?.assessment?.violations || [],
                                    violationDetails
                                )
                            );
                        }
                        break;
                    }
                    case 'afd-logical-block-size': {
                        if (asmOsConfigData['asm-setup'] !== 'true') {
                            break;
                        }
                        if (asmOsConfigData?.['afd-logical-block-size']?.error) {
                            driftData.push({
                                ...config,
                                errorMessage: asmOsConfigData?.['afd-logical-block-size']?.error
                            });
                        } else if (asmOsConfigData?.['afd-logical-block-size']?.assessment) {
                            if (asmOsConfigData?.['afd-logical-block-size']?.assessment?.result === '0') {
                                violationDetails.push(
                                    createViolationDetail(config.id, 'configuration', 'false', 'true')
                                );
                            }
                            driftData.push(
                                createAssessment(
                                    config,
                                    1,
                                    asmOsConfigData?.['afd-logical-block-size']?.assessment?.result === '0'
                                        ? [databaseInstanceName]
                                        : [],
                                    violationDetails
                                )
                            );
                        }
                        break;
                    }
                    case 'asmlib-logical-block-size': {
                        if (asmOsConfigData['asm-setup'] !== 'true') {
                            break;
                        }
                        if (asmOsConfigData?.['asmlib-logical-block-size']?.error) {
                            driftData.push({
                                ...config,
                                errorMessage: asmOsConfigData?.['asmlib-logical-block-size']?.error
                            });
                        } else if (asmOsConfigData?.['asmlib-logical-block-size']?.assessment) {
                            const isUnoptimized = !['Y', 'YES'].includes(
                                asmOsConfigData?.['asmlib-logical-block-size']?.assessment?.result?.toUpperCase() ?? ''
                            );
                            if (isUnoptimized) {
                                violationDetails.push(
                                    createViolationDetail(
                                        config.id,
                                        'configuration',
                                        asmOsConfigData?.[
                                            'asmlib-logical-block-size'
                                        ]?.assessment?.result?.toUpperCase() || 'N',
                                        'Y'
                                    )
                                );
                            }
                            driftData.push(
                                createAssessment(
                                    config,
                                    1,
                                    isUnoptimized ? [databaseInstanceName] : [],
                                    violationDetails
                                )
                            );
                        }
                        break;
                    }
                    default:
                        break;
                }
            });
        }
        return driftData;
    } catch (error) {
        logger.error('Error while assessing ASM OS configuration drift', { error });
        throw error;
    }
}

function getOSConfigDrift(
    ec2InstanceId: string,
    databaseInstanceName: string,
    storageAssessmentData: StorageIscsiAssessment
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching iSCSI OS configuration drift', { ec2InstanceId, databaseInstanceName });
    const { os } = storageAssessmentData;
    const osDrift: (AssessmentItemType | AssessmentErrorItemType)[] = [];

    if (!os || isEmpty(os)) {
        osIsciConfigData.forEach(config => {
            osDrift.push({ ...config, errorMessage: 'No OS assessment data found.' });
        });
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
                if (hostUtilsData && !supportedOracleOsVersions.includes(hostUtilsData?.['os-version'])) {
                    logger.info(`Skipping ONTAP sanlun assessment for ${hostUtilsData?.['os-version']}`, {
                        ec2InstanceId,
                        databaseInstanceName
                    });
                    break;
                }
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
                            'SELINUX=disabled or SELINUX=permissive'
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

            case 'multipath-io-sessions': {
                const iscsiTargetSessions = os?.['iscsi-targets-sessions'];
                if (iscsiTargetSessions?.error) {
                    osDrift.push({ ...config, errorMessage: iscsiTargetSessions.error });
                } else {
                    const targetSessions = iscsiTargetSessions?.['iscsi-sessions-per-target'] || {};
                    violationDetails = Object.entries(targetSessions)
                        .filter(([, sessions]) => sessions < 4)
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

    const asmOSConfigDrift = getAsmOSConfigDrift(os, databaseInstanceName);
    if (!isEmpty(asmOSConfigDrift)) {
        osDrift.push(...asmOSConfigDrift);
    }

    return osDrift;
}

function getBaseVolume(path: string, server: string, exportsByServer: Record<string, string[]>): string {
    const serverExports = exportsByServer[server] || [];

    const matches = serverExports.filter(exp => path === exp || (path.startsWith(exp) && path[exp.length] === '/'));

    return matches.reduce((longest, exp) => (exp.length > longest.length ? exp : longest), '') || path;
}

function getNfsOSConfigDrift(
    ec2InstanceId: string,
    databaseInstanceName: string,
    deploymentType: string,
    storageAssessmentData: StorageNfsAssessment
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching NFS OS configuration drift', { ec2InstanceId, databaseInstanceName, deploymentType });
    const { os, volumes, nfsv4DomainData } = storageAssessmentData;
    const osDrift: (AssessmentItemType | AssessmentErrorItemType)[] = [];

    if (!os || isEmpty(os)) {
        osNfsConfigData.forEach(config => {
            osDrift.push({ ...config, errorMessage: 'No OS assessment data found.' });
        });
        return osDrift;
    }

    const oracleJunctionPaths = new Set(
        compact(volumes?.data?.map(vol => vol.junctionPath)).filter(path => path.trim().length > 0)
    );

    // Filter the host-wide NFS mounts down to just the ones serving this oracleSid once
    // and share the result across SID-scoped consumers (databasefiles/caching/nfsv4-domain-name).
    // Surfaces a single error so consumers can emit one error entry instead of a misleading OPTIMIZED.
    type DbNfsMountsResult =
        | { error: string }
        | { mounts: NonNullable<NonNullable<(typeof os)['nfs-mount-options']>['nfs-mount-options']> };
    const dbMountsResult: DbNfsMountsResult = (() => {
        if (oracleJunctionPaths.size === 0) {
            return { error: 'No mapped DB-instance volumes provided; cannot identify DB mounts for this oracleSid.' };
        }
        const mountData = os?.['nfs-mount-options'];
        if (mountData?.error) {
            return { error: mountData.error };
        }
        const allMounts = mountData?.['nfs-mount-options'] ?? [];
        return { mounts: allMounts.filter(mount => oracleJunctionPaths.has(mount?.['remote-path'] ?? '')) };
    })();

    const recommendedNFSMountOptions = Object.entries(nfsMountOptionExpected)
        .map(([key, expectedValue]) => {
            const recommendedText = Array.isArray(expectedValue)
                ? expectedValue.join(' or ')
                : expectedValue.toString();
            return `${key}=${recommendedText}`;
        })
        .join(', ');

    let isDnfsEnabled = false;

    osNfsConfigData.forEach(config => {
        const violationDetails: GenericViolationResponseType[] = [];

        switch (config.parameter) {
            case 'kernel-parameters': {
                const kernelParamsData = os?.['kernel-parameters'];
                const sunrpcTcpSlotEntries = kernelParamsData?.['sunrpc-tcp-slot-entries'];
                if (kernelParamsData?.error) {
                    osDrift.push({ ...config, errorMessage: kernelParamsData.error });
                } else {
                    const tcpMaxSlotTable = sunrpcTcpSlotEntries?.['tcp-max-slot-table'] || '';
                    const tcpSlotTable = sunrpcTcpSlotEntries?.['tcp-slot-table'] || '';

                    ['tcp-max-slot-table', 'tcp-slot-table'].forEach(param => {
                        const value = param === 'tcp-max-slot-table' ? tcpMaxSlotTable : tcpSlotTable;
                        if (value !== '128') {
                            violationDetails.push(createViolationDetail(param, 'kernel parameter', value, '128'));
                        }
                    });
                    osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                }
                break;
            }
            case 'nfs-mount-options-databasefiles': {
                if ('error' in dbMountsResult) {
                    osDrift.push({ ...config, errorMessage: dbMountsResult.error });
                    break;
                }
                dbMountsResult.mounts.forEach(mount => {
                    const mountPoint = mount?.['mount-point'] || '';
                    const remotePath = mount?.['remote-path'] || '';
                    const options = mount?.options || {};
                    const mountVersion = options.vers;
                    const currentMountOptions = Object.entries(nfsMountOptionExpected)
                        .map(([key]) => {
                            const actualValue = options[key]?.toString() || 'not found';
                            return `${key}=${actualValue}`;
                        })
                        .join(', ');
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
                                'nfs mount mapping',
                                `${currentMountOptions}, vers=${mountVersion}`,
                                `${recommendedNFSMountOptions}, vers=${mountVersion}`
                            )
                        );
                    }
                });
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }
            case 'nfs-caching-options': {
                if (deploymentType !== 'Standalone') {
                    return;
                }
                if ('error' in dbMountsResult) {
                    osDrift.push({ ...config, errorMessage: dbMountsResult.error });
                    break;
                }
                dbMountsResult.mounts.forEach(mount => {
                    const mountPoint = mount?.['mount-point'] || '';
                    const remotePath = mount?.['remote-path'] || '';
                    const options = mount?.options || {};
                    const violations: string[] = [];
                    if (options.noac !== undefined) {
                        violations.push('noac');
                    }

                    ['acregmin', 'acregmax', 'acdirmin', 'acdirmax'].forEach(option => {
                        if (options[option] === '0') {
                            violations.push(`${option}=${options[option]}`);
                        }
                    });

                    if (violations.length > 0) {
                        violationDetails.push(
                            createViolationDetail(
                                `${remotePath}:${mountPoint}`,
                                'nfs mount mapping',
                                violations.join(', '),
                                'Remove noac option and ensure caching options are not set to 0'
                            )
                        );
                    }
                });
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }
            case 'nfs-mount-options-adrhome': {
                const adrMountInfoData = os?.['adr-info'];
                if (adrMountInfoData?.error) {
                    logger.info('Skipping ADR home mount check', {
                        message: adrMountInfoData.error,
                        ec2InstanceId,
                        databaseInstanceName
                    });
                } else {
                    const mountOptions = adrMountInfoData?.['adr-home-mount-info'];

                    if (!mountOptions?.['filesystem-type']?.includes('nfs')) {
                        logger.info('Skipping ADR home mount check as it is not NFS', {
                            ec2InstanceId,
                            databaseInstanceName
                        });
                        return;
                    }

                    const options = mountOptions?.['mount-options'] || {};
                    const mountPoint = mountOptions?.['mount-point'] || '';
                    const mountVersion = options.vers;

                    const expectedOptions = Object.entries(nfsMountOptionExpected).filter(([key]) => key !== 'nointr');

                    const violations = expectedOptions.filter(([key, expectedValue]) => {
                        const actualValue = options[key];
                        return Array.isArray(expectedValue)
                            ? !expectedValue.includes(actualValue as string)
                            : actualValue !== expectedValue;
                    });

                    if (violations.length > 0) {
                        const currentOptions = expectedOptions
                            .map(([key]) => `${key}=${options[key]?.toString() || 'not found'}`)
                            .join(', ');

                        const recommendedOptions = expectedOptions
                            .map(([key, expectedValue]) => {
                                const recommended = Array.isArray(expectedValue)
                                    ? expectedValue.join(' or ')
                                    : expectedValue.toString();
                                return `${key}=${recommended}`;
                            })
                            .join(', ');

                        violationDetails.push(
                            createViolationDetail(
                                mountPoint,
                                'nfs mount mapping',
                                `${currentOptions}, vers=${mountVersion}`,
                                `${recommendedOptions}, vers=${mountVersion}`
                            )
                        );
                    }
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }
            case 'nfsv4-domain-name': {
                const idmapdDomainConfig = os?.['idmapd-domain-config'];
                const dbMountOptions = 'error' in dbMountsResult ? [] : dbMountsResult.mounts;
                const domain = os?.['hostname-domain']?.domain || '';

                // Check if any NFSv4 mount belongs to this oracleSid (host list filtered by junction paths)
                const hasOntapNfsv4Mount = dbMountOptions.some(mount => {
                    const versValue = typeof mount?.options?.vers === 'string' ? (mount.options.vers as string) : '';
                    return versValue.startsWith('4');
                });

                if (
                    !hasOntapNfsv4Mount ||
                    !nfsv4DomainData?.data ||
                    nfsv4DomainData.error ||
                    !idmapdDomainConfig?.['config-exists'] ||
                    (idmapdDomainConfig?.error && !domain)
                ) {
                    const message =
                        nfsv4DomainData?.error ||
                        (!hasOntapNfsv4Mount ? 'No ontap NFSv4 mounts found' : 'No data found');
                    logger.info('Skipping NFSv4 domain name check', { message, ec2InstanceId, databaseInstanceName });
                    return;
                }

                const domainName = nfsv4DomainData.data.v4IdDomain || '';
                const configDomain = idmapdDomainConfig.domain || domain;

                if (domainName !== configDomain) {
                    violationDetails.push(
                        createViolationDetail(
                            'Domain name',
                            'idmapd configuration',
                            `Server domain: ${domainName}, /etc/idmapd.conf: ${configDomain}`,
                            `Domain name should match the ONTAP SVM NFSv4 domain: ${domainName || 'not found'}`
                        )
                    );
                }
                osDrift.push(createAssessment(config, 1, [ec2InstanceId], violationDetails));
                break;
            }
            case 'dnfs-enabled': {
                const dnfsServers = storageAssessmentData?.dnfsServers;
                if (dnfsServers?.error) {
                    osDrift.push({
                        ...config,
                        errorMessage: `Failed to retrieve dNFS server configuration: ${dnfsServers.error}`
                    });
                    break;
                }

                const dnfsData = dnfsServers?.data || [];
                isDnfsEnabled = dnfsData.length > 0;

                if (!isDnfsEnabled) {
                    violationDetails.push(
                        createViolationDetail(
                            'dNFS',
                            'EC2 instance',
                            'dNFS is not enabled',
                            'dNFS should be enabled for optimal performance'
                        )
                    );
                }

                osDrift.push(
                    createAssessment(config, 1, violationDetails.length > 0 ? [ec2InstanceId] : [], violationDetails)
                );
                break;
            }
            case 'dnfs-consistent-ip-resolution': {
                if (!isDnfsEnabled) {
                    logger.info('Skipping dNFS consistent IP resolution check - dNFS not enabled', {
                        ec2InstanceId,
                        databaseInstanceName
                    });
                    break;
                }

                const dnfsIpData = os?.['dnfs-ip-resolution'];
                if (!dnfsIpData) {
                    logger.info('Skipping dNFS consistent IP resolution check - no dNFS hostname found', {
                        ec2InstanceId,
                        databaseInstanceName
                    });
                    break;
                }

                const dnsResolution = dnfsIpData?.dns_resolution || {};

                // Check if any hostname resolves to multiple IPs (round-robin DNS)
                Object.entries(dnsResolution).forEach(([hostname, ips]) => {
                    if (Array.isArray(ips) && ips.length > 1 && !ips[0]?.startsWith('Error:')) {
                        violationDetails.push(
                            createViolationDetail(
                                hostname,
                                'EC2 instance',
                                `Resolves to ${ips.length} IPs: ${(ips as string[]).join(', ')}`,
                                'Single consistent IP address resolution'
                            )
                        );
                    }
                });

                osDrift.push(
                    createAssessment(config, 1, violationDetails.length > 0 ? [ec2InstanceId] : [], violationDetails)
                );
                break;
            }
            case 'dnfs-configuration-file': {
                if (!isDnfsEnabled) {
                    logger.info('Skipping dNFS configuration file check - dNFS is not enabled', {
                        ec2InstanceId,
                        databaseInstanceName
                    });
                    break;
                }

                const oranfstabData = os?.['dnfs-oranfstab'];
                const nfsMountData = os?.['nfs-mount-options'];

                if (oranfstabData?.error || nfsMountData?.error) {
                    const errors = [
                        oranfstabData?.error && `oranfstab: ${oranfstabData.error}`,
                        nfsMountData?.error && `NFS mount options: ${nfsMountData.error}`
                    ].filter(Boolean);
                    osDrift.push({ ...config, errorMessage: `Failed to retrieve configuration: ${errors.join('; ')}` });
                    break;
                }

                const oranfstabServers = oranfstabData?.oranfstab_servers || [];
                const mountOptions = nfsMountData?.['nfs-mount-options'] || [];

                if (oranfstabServers.length === 0 || mountOptions.length === 0) {
                    logger.info('Skipping dNFS configuration file check - no oranfstab or NFS mount data', {
                        ec2InstanceId,
                        databaseInstanceName
                    });
                    break;
                }

                // Filter fstab mounts to only those used by this database (exact volume match, not subdirectories)
                const dbMounts = mountOptions.filter(mount => {
                    const remotePath = mount?.['remote-path'] || '';
                    return oracleJunctionPaths.has(remotePath);
                });

                // Build oranfstab lookup: map of exportPath -> oranfstab entry
                const oranfstabExportsFlattened = oranfstabServers.flatMap(entry =>
                    (entry.exports || []).map(exportEntry => ({
                        server: entry.server,
                        paths: entry.paths || [],
                        nfsVersion: entry.nfs_version,
                        options: entry.options || {},
                        exportPath: exportEntry.export,
                        mountPath: exportEntry.mount
                    }))
                );

                const allOranfstabPaths = new Set(compact(oranfstabServers.flatMap(entry => entry.paths)));
                const allFstabServers = new Set(compact(dbMounts.map(mount => mount?.server)));
                const unmatchedPaths = [...allOranfstabPaths].filter(path => !allFstabServers.has(path));
                if (unmatchedPaths.length > 0) {
                    violationDetails.push(
                        createViolationDetail(
                            'path',
                            'oranfstab path',
                            unmatchedPaths.join(', '),
                            [...allFstabServers].join(', ') || 'not set'
                        )
                    );
                }

                // Check each fstab mount has a matching oranfstab entry with correct configuration
                dbMounts.forEach(fstabMount => {
                    const fstabMountPoint = fstabMount?.['mount-point'] || '';
                    const fstabRemotePath = fstabMount?.['remote-path'] || '';
                    const fstabVersion = fstabMount?.options?.vers?.toString() || '';

                    // Find matching oranfstab entry by export path or mount point
                    const matchingOranfstab = oranfstabExportsFlattened.find(
                        ora => ora.exportPath === fstabRemotePath || ora.mountPath === fstabMountPoint
                    );

                    if (!matchingOranfstab) {
                        // Missing oranfstab entry for this fstab mount
                        violationDetails.push(
                            createViolationDetail(
                                fstabMountPoint,
                                'oranfstab entry',
                                'missing',
                                `export: ${fstabRemotePath}, mount: ${fstabMountPoint}`
                            )
                        );
                        return;
                    }

                    const {
                        nfsVersion: oranfstabNfsVersion,
                        options: oranfstabOptions,
                        exportPath: oranfstabExport,
                        mountPath: oranfstabMount
                    } = matchingOranfstab;

                    const mismatches: { field: string; current: string; recommended: string }[] = [];

                    // Check export path matches
                    if (oranfstabExport !== fstabRemotePath) {
                        mismatches.push({
                            field: 'export',
                            current: oranfstabExport || 'not set',
                            recommended: fstabRemotePath
                        });
                    }

                    // Check mount path matches
                    if (oranfstabMount !== fstabMountPoint) {
                        mismatches.push({
                            field: 'mount',
                            current: oranfstabMount || 'not set',
                            recommended: fstabMountPoint
                        });
                    }

                    // NFS version comparison with normalization
                    const normalizedFstabVersion = normalizeNfsVersion(fstabVersion);
                    const normalizedOranfstabVersion = normalizeNfsVersion(oranfstabNfsVersion);
                    if (fstabVersion && oranfstabNfsVersion && normalizedFstabVersion !== normalizedOranfstabVersion) {
                        mismatches.push({
                            field: 'nfs_version',
                            current: oranfstabNfsVersion,
                            recommended: `NFSv${fstabVersion}`
                        });
                    }

                    // Compare rsize and wsize
                    ['rsize', 'wsize'].forEach(option => {
                        const fstabValue = fstabMount?.options?.[option]?.toString() || '';
                        const oranfstabValue = oranfstabOptions?.[option]?.toString() || '';
                        if (fstabValue && oranfstabValue && fstabValue !== oranfstabValue) {
                            mismatches.push({
                                field: option,
                                current: oranfstabValue,
                                recommended: fstabValue
                            });
                        }
                    });

                    if (mismatches.length > 0) {
                        violationDetails.push(
                            createViolationDetail(
                                fstabMountPoint,
                                'oranfstab configuration',
                                mismatches.map(m => `${m.field}: ${m.current}`).join('; '),
                                mismatches.map(m => `${m.field}: ${m.recommended}`).join('; ')
                            )
                        );
                    }
                });

                osDrift.push(
                    createAssessment(config, 1, violationDetails.length > 0 ? [ec2InstanceId] : [], violationDetails)
                );
                break;
            }
            case 'dnfs-no-shared-cache': {
                const nfsMountData = os?.['nfs-mount-options'];
                const nfsExportsData = os?.['nfs-exports'];

                if (!isDnfsEnabled) {
                    logger.info('Skipping nosharecache check - dNFS is not enabled', {
                        ec2InstanceId,
                        databaseInstanceName
                    });
                    break;
                }

                if (nfsMountData?.error) {
                    osDrift.push({
                        ...config,
                        errorMessage: `Failed to retrieve NFS mount options: ${nfsMountData.error}`
                    });
                    break;
                }

                const mountOptions = nfsMountData?.['nfs-mount-options'] || [];
                const exportsByServer = nfsExportsData?.['nfs-exports'] || {};

                const mountsByVolume: Record<string, typeof mountOptions> = {};
                for (const mount of mountOptions) {
                    const remotePath = mount?.['remote-path'] || '';
                    const server = mount?.server || '';
                    const baseVolume = getBaseVolume(remotePath, server, exportsByServer);
                    (mountsByVolume[baseVolume] ||= []).push(mount);
                }

                const flaggedMounts = new Set<string>();

                // Check 1: Multiple mounts from same base volume (same server export)
                Object.entries(mountsByVolume)
                    .filter(
                        ([, mounts]) =>
                            mounts.length > 1 && mounts.some(m => oracleJunctionPaths.has(m?.['remote-path'] || ''))
                    )
                    .flatMap(([, mounts]) => mounts)
                    .forEach(mount => addNosharecacheViolationIfNeeded(mount, flaggedMounts, violationDetails));

                // Check 2: Nested mount points (one mount-point is subdirectory of another)
                const oracleMounts = mountOptions.filter(m => oracleJunctionPaths.has(m?.['remote-path'] || ''));
                const allMountPoints = mountOptions.map(m => m?.['mount-point'] || '').filter(Boolean);

                for (const mount of oracleMounts) {
                    const mountPoint = mount?.['mount-point'] || '';
                    if (!mountPoint) {
                        // eslint-disable-next-line no-continue
                        continue;
                    }

                    // Check if this mount-point is nested within another mount-point
                    const isNested = allMountPoints.some(
                        other =>
                            other !== mountPoint &&
                            (mountPoint.startsWith(`${other}/`) || other.startsWith(`${mountPoint}/`))
                    );

                    if (isNested) {
                        addNosharecacheViolationIfNeeded(mount, flaggedMounts, violationDetails);
                    }
                }

                osDrift.push(
                    createAssessment(config, 1, violationDetails.length > 0 ? [ec2InstanceId] : [], violationDetails)
                );
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

    const lunsGroupedByDiskGroup = groupBy(luns, lun => lun.diskGroup!);
    if (isEmpty(luns)) {
        goldenConfig = { ...goldenConfig, errorMessage: `No ${diskGroupLabel} volumes found.` };
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

function getNfsVolumeConfigDrift(
    storageAssessmentData: StorageNfsAssessment
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching NFS volume configuration drift');
    const { volumes, dnfsServers, nfsRootonly, binaryVolumes } = storageAssessmentData;
    const { data: volumesData } = volumes;

    const nfsVolumeConfigDrift: (AssessmentItemType | AssessmentErrorItemType)[] = [];

    volumeNfsConfigData.forEach(config => {
        let totalObjectsAssessed = 0;
        const objectsInViolation: string[] = [];
        const violationDetails: GenericViolationResponseType[] = [];
        const recommended = (config.value ?? '').toString();

        switch (config.parameter) {
            case 'nfs-rootonly': {
                if (isEmpty(dnfsServers) || isEmpty(nfsRootonly) || isEmpty(volumes)) {
                    logger.info('Skipping nfs-rootonly check as required data is missing');
                    return;
                }

                const dnfsDirectories = dnfsServers.data?.map(server => server.dirname).filter(Boolean) || [];
                if (dnfsDirectories.length === 0) {
                    logger.info('Skipping nfs-rootonly check as no DNFS directories found');
                    return;
                }

                totalObjectsAssessed = dnfsDirectories.length;

                dnfsDirectories.forEach(dirname => {
                    const matchingVolume = volumesData.find(vol => dirname?.includes(vol.name));
                    if (matchingVolume) {
                        const svmRootonlyConfig = nfsRootonly?.find(
                            configuration => configuration.svmName === matchingVolume.svmName
                        );
                        if (svmRootonlyConfig?.nfsRootonly === 'enabled') {
                            violationDetails.push({
                                objectName: matchingVolume.name,
                                value: 'enabled',
                                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                                recommended
                            });
                            objectsInViolation.push(matchingVolume.name);
                        }
                    }
                });

                nfsVolumeConfigDrift.push({
                    ...config,
                    recommended,
                    status: violationDetails.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
                    objectsInViolation: [...new Set(objectsInViolation)],
                    totalObjectsAssessed,
                    totalObjectsInViolation: violationDetails.length,
                    resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                    violationDetails
                });
                break;
            }

            case 'export-policy': {
                if (isEmpty(binaryVolumes) || isEmpty(volumes)) {
                    logger.info('Skipping export-policy check as required data is missing');
                    return;
                }

                const binaryVolumesData = binaryVolumes.data || [];
                const nfsMountedVolumes = binaryVolumesData.filter(volume => volume.isNfsMount === true);

                if (nfsMountedVolumes.length === 0) {
                    logger.info('Skipping export-policy check as no NFS mounts found');
                    return;
                }

                totalObjectsAssessed = nfsMountedVolumes.length;

                nfsMountedVolumes.forEach(volume => {
                    const { rules, exportPolicyName, svmName } = volume.nfsInfo || {};
                    if (!rules) {
                        logger.info(`Skipping export-policy check for volume ${volume.volumeName} as no rules found`);
                        return;
                    }

                    // Check if any rule violates requirements (missing superuser 'sys' or allow_suid !== true)
                    const hasViolations = rules.some(
                        rule => !rule.superuser?.includes('sys') || rule.allow_suid !== true
                    );

                    if (hasViolations) {
                        const violatingRules = rules.filter(
                            rule => !rule.superuser?.includes('sys') || rule.allow_suid !== true
                        );

                        const currentRules = `vserver: ${svmName}, export-policy: ${exportPolicyName}, ${violatingRules
                            .map(
                                rule =>
                                    `clients: [${rule.clients?.join(',')}], superuser: ${rule.superuser?.join(
                                        ','
                                    )}, allow_suid: ${rule.allow_suid}`
                            )
                            .join('; ')}`;

                        violationDetails.push({
                            objectName: volume.volumeName,
                            value: currentRules,
                            objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                            recommended,
                            additionalInfo: {
                                vserverName: svmName,
                                exportPolicyName,
                                clients: violatingRules.map(({ clients }) => clients || []).flat()
                            }
                        });
                        objectsInViolation.push(volume.volumeName);
                    }
                });

                nfsVolumeConfigDrift.push({
                    ...config,
                    recommended,
                    status: violationDetails.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
                    objectsInViolation: [...new Set(objectsInViolation)],
                    totalObjectsAssessed,
                    totalObjectsInViolation: violationDetails.length,
                    resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                    violationDetails
                });
                break;
            }

            default:
                break;
        }
    });

    return nfsVolumeConfigDrift;
}

// Normalized per-volume outcome for shared parameter evaluation. `current === undefined` means
// the volume is outside this parameter's assessment universe and should be skipped (e.g.
// tieringMinCoolingDays on redo/control volumes in the combined path).
type EvaluateOneVolumeParameterResult = {
    isViolated: boolean;
    current: string | undefined;
    recommended: string;
    dataCategory: string;
};

type EvaluateOneVolumeParameterContext = {
    controlDataFileVolumeIds: string[];
    redoLogsTempLogsVolumeIds: string[];
    archiveLogVolumeIds: string[];
    fraEnabled?: string;
    rmanCompressionEnabled?: string;
    tieringPolicyRecommendations: {
        'data-control-files': string;
        'log-files': string;
        'archive-log-files': string;
    };
    compressionRecommendations: {
        'log-files': string;
        others: string;
    };
    deduplicationRecommendations: {
        'log-files': string[];
        others: string[];
    };
    compactionRecommendations: {
        'log-files': string;
        others: string;
    };
};

// Shared volume-config switch for legacy golden-config rows and combined sub-parameters.
// Kept at module scope (not inside getVolumeConfigDrift) so diffs on that function stay minimal.
function evaluateOneVolumeParameter(
    parameter: string,
    volume: Record<string, unknown>,
    fallbackRecommended: string,
    context: EvaluateOneVolumeParameterContext
): EvaluateOneVolumeParameterResult {
    const {
        controlDataFileVolumeIds,
        redoLogsTempLogsVolumeIds,
        archiveLogVolumeIds,
        fraEnabled,
        rmanCompressionEnabled,
        tieringPolicyRecommendations,
        compressionRecommendations,
        deduplicationRecommendations,
        compactionRecommendations
    } = context;
    const isIn = (list: string[], id: string) => list.includes(id);

    const objectId = (volume.uuid as string) || '';
    let value = (volume[parameter] ?? '').toString();
    let recommended = fallbackRecommended;
    let isViolated = false;
    let dataCategory = '';

    const volumeMembership = [controlDataFileVolumeIds, redoLogsTempLogsVolumeIds, archiveLogVolumeIds].filter(list =>
        isIn(list, objectId)
    ).length;

    switch (parameter) {
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
            if (isIn(redoLogsTempLogsVolumeIds, objectId) || isIn(controlDataFileVolumeIds, objectId)) {
                return { isViolated: false, current: undefined, recommended: '', dataCategory: '' };
            }
            if (isIn(archiveLogVolumeIds, objectId)) {
                dataCategory = 'archive-log-files';
            }
            recommended = getArchiveLogTieringMinCoolingDaysRecommendation(
                isIn(archiveLogVolumeIds, objectId),
                fraEnabled,
                rmanCompressionEnabled
            );
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
            } else {
                recommended = 'snapshot_only';
            }

            isViolated = value !== recommended;
            break;

        case 'compressionType': {
            const currentCompression = (volume.compression ?? '').toString();
            if (isIn(redoLogsTempLogsVolumeIds, objectId)) {
                value = currentCompression === 'none' ? 'none' : value;
                recommended = compressionRecommendations['log-files'];
                dataCategory = volumeMembership >= 2 ? 'mixed' : 'log-files';
            } else {
                value = currentCompression === 'none' ? 'none' : value;
                recommended = compressionRecommendations.others;
                dataCategory = 'non-log-files';
            }
            isViolated = value !== recommended;
            break;
        }

        case 'deduplication': {
            let multirecommendations = deduplicationRecommendations['log-files'];
            if (isIn(redoLogsTempLogsVolumeIds, objectId)) {
                dataCategory = volumeMembership >= 2 ? 'mixed' : 'log-files';
                recommended = 'none';
            } else {
                multirecommendations = deduplicationRecommendations.others;
                dataCategory = 'non-log-files';
                recommended = 'inline';
            }
            isViolated = !multirecommendations.includes(value);
            break;
        }

        case 'snapshotAutodelete':
            recommended = value === 'true' ? 'oldest_first' : 'enabled';
            value = value === 'true' ? (volume.snapshotDeleteOrder ?? '').toString() : 'disabled';
            isViolated = value !== recommended;
            break;

        default:
            isViolated = value !== recommended;
            break;
    }

    return {
        isViolated,
        current: value,
        recommended,
        dataCategory
    };
}

function getVolumeConfigDrift(
    volumeTypeMap: Record<OracleSysFileTypes, OracleVolumeRecord[]>,
    storageAssessmentData: StorageAssessment,
    storageProtocol: string
): (WadManagerOracleAssessmentItemType | AssessmentErrorItemType)[] {
    logger.info(`Fetching volume configuration drift ${storageProtocol}`);
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
        return [
            ...volumeConfigData.map(config => ({
                ...config,
                errorMessage: 'Found no FSx for ONTAP volumes for the database.'
            }))
        ];
    }

    const { volumes, fraEnabled, rmanCompressionEnabled } = storageAssessmentData;
    const { data: volumesData, error } = volumes;

    if (error) {
        return [
            ...volumeConfigData.map(config => ({
                ...config,
                errorMessage: error
            }))
        ];
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

    const volumeEvalContext: EvaluateOneVolumeParameterContext = {
        controlDataFileVolumeIds,
        redoLogsTempLogsVolumeIds,
        archiveLogVolumeIds,
        fraEnabled,
        rmanCompressionEnabled,
        tieringPolicyRecommendations,
        compressionRecommendations,
        deduplicationRecommendations,
        compactionRecommendations
    };

    const volumeConfigDrift: (WadManagerOracleAssessmentItemType | AssessmentErrorItemType)[] = volumeConfigData
        .filter(
            config => !COMBINED_VOLUME_CONFIG_IDS.includes(config.id as (typeof COMBINED_VOLUME_CONFIG_IDS)[number])
        )
        .map(config => {
            const objectsInViolation: GenericViolationResponseType[] = [];
            const objectsInViolationNames: string[] = [];
            const assessmentDetails: DriftAssessmentDetail[] = [];
            let totalObjectsAssessed = volumesData.length;
            if (config.parameter === 'tieringMinCoolingDays') {
                totalObjectsAssessed = archiveLogVolumeIds.length;
            }
            const fallbackRecommended = (config.value ?? '').toString();
            volumesData.forEach(volume => {
                const objectId = (volume.uuid as string) || '';
                if (config.parameter === 'tieringMinCoolingDays' && !isIn(archiveLogVolumeIds, objectId)) {
                    return;
                }
                const objectName = (volume.name as string) || '';
                const { isViolated, current, recommended, dataCategory } = evaluateOneVolumeParameter(
                    config.parameter!,
                    volume,
                    fallbackRecommended,
                    volumeEvalContext
                );

                if (current === undefined) {
                    return;
                }

                if (isViolated) {
                    objectsInViolation.push({
                        objectName,
                        value: current?.toString() || '',
                        objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                        recommended,
                        ...(dataCategory ? { dataCategory } : {})
                    });
                    objectsInViolationNames.push(objectName);
                }

                const status = isViolated ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
                const isThinProvision = config.id === OptimizeStorageConfigs.THIN_PROVISIONING;
                assessmentDetails.push({
                    id: objectId || objectName,
                    name: objectName,
                    status,
                    metadata: {
                        components: [
                            {
                                parameter: config.id,
                                current: isThinProvision
                                    ? status === AssessmentStatus.OPTIMIZED
                                        ? 'enabled'
                                        : 'disabled'
                                    : current?.toString() || '',
                                recommended: isThinProvision ? 'enabled' : recommended,
                                status
                            }
                        ]
                    }
                });
            });

            return {
                ...config,
                recommended: fallbackRecommended,
                status: objectsInViolation.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
                objectsInViolation: [...new Set(objectsInViolationNames)],
                totalObjectsAssessed,
                totalObjectsInViolation: objectsInViolation.length,
                violationDetails: objectsInViolation,
                assessmentDetails
            };
        });

    // Append combined golden-config entries after legacy per-parameter rows. Reuses evaluateOneVolumeParameter per
    // sub-parameter, aggregates violatedConfigs into one drift row, and attaches configDetails so
    // the optimize path can resolve recommendations from drift without re-evaluating volumes.
    volumeConfigData
        .filter(config => COMBINED_VOLUME_CONFIG_IDS.includes(config.id as (typeof COMBINED_VOLUME_CONFIG_IDS)[number]))
        .forEach(combined => {
            const detailMap =
                combined.id === 'storage-efficiencies'
                    ? STORAGE_EFFICIENCIES_CONFIG_DETAILS
                    : TIERING_TCO_OPTIMIZATION_CONFIG_DETAILS;
            const subNames = Object.keys(detailMap);
            const violationDetails: GenericViolationResponseType[] = [];
            const assessmentDetails: DriftAssessmentDetail[] = [];

            volumesData.forEach(volume => {
                const componentsStatus: { name: string; current: string; recommended: string; optimized: boolean }[] =
                    [];
                const { name: volumeName, uuid: volumeUuid } = volume;
                let combinedCategory = '';
                subNames.forEach(subName => {
                    const parameter = COMBINED_SUB_PARAMETER_TO_PROPERTY[subName];
                    const objectId = (volume.uuid as string) || '';
                    if (parameter === 'tieringMinCoolingDays' && !isIn(archiveLogVolumeIds, objectId)) {
                        return;
                    }
                    const { isViolated, current, recommended, dataCategory } = evaluateOneVolumeParameter(
                        parameter,
                        volume,
                        '',
                        volumeEvalContext
                    );

                    componentsStatus.push({
                        name: subName,
                        current: current || '',
                        recommended: recommended ?? undefined,
                        optimized: !isViolated
                    });
                    combinedCategory =
                        combinedCategory && dataCategory && combinedCategory !== dataCategory
                            ? 'mixed'
                            : combinedCategory || dataCategory;
                });
                const violatedConfigs = componentsStatus
                    .filter(c => !c.optimized)
                    .map(({ name, current, recommended }) => ({ id: name, current, recommended }));
                if (violatedConfigs.length > 0) {
                    violationDetails.push({
                        objectName: volumeName ?? '',
                        value: '',
                        objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                        ...(combinedCategory ? { dataCategory: combinedCategory } : {}),
                        violatedConfigs
                    });
                }

                assessmentDetails.push({
                    id: volumeUuid || volumeName,
                    name: volumeName,
                    status: componentsStatus.every(component => component.optimized)
                        ? AssessmentStatus.OPTIMIZED
                        : AssessmentStatus.NOT_OPTIMIZED,
                    metadata: {
                        components: componentsStatus.map(({ name, current, recommended, optimized }) => ({
                            parameter: name,
                            current,
                            recommended,
                            status: optimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED
                        }))
                    }
                });
            });

            const objectsInViolation = violationDetails.map(detail => detail.objectName);
            const totalObjectsAssessed =
                combined.id === 'tiering-tco-optimization'
                    ? Math.max(volumesData.length, archiveLogVolumeIds.length)
                    : volumesData.length;

            volumeConfigDrift.push({
                ...combined,
                recommended: '',
                status: objectsInViolation.length === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
                objectsInViolation,
                totalObjectsAssessed,
                totalObjectsInViolation: objectsInViolation.length,
                configDetails: (combined.components ?? []).map(component => {
                    const name = component.name ?? component.parameter!;
                    const overrides = detailMap[name] ?? {};
                    const recommendedByDataCategory =
                        combined.id === 'tiering-tco-optimization' &&
                        name === 'tiering-min-cooling-days' &&
                        overrides.recommendedByDataCategory
                            ? {
                                  ...overrides.recommendedByDataCategory,
                                  'archive-log-files': getArchiveLogTieringMinCoolingDaysRecommendation(
                                      true,
                                      fraEnabled,
                                      rmanCompressionEnabled
                                  )
                              }
                            : overrides.recommendedByDataCategory;
                    return {
                        id: name,
                        recommended: overrides.recommended ?? String(component.value ?? ''),
                        objectType: component.objectType ?? ASSESSMENT_RESOURCE_TYPE.VOLUME,
                        ...(recommendedByDataCategory ? { recommendedByDataCategory } : {}),
                        ...(overrides.recommendedNote ? { recommendedNote: overrides.recommendedNote } : {})
                    };
                }),
                violationDetails,
                assessmentDetails
            });
        });

    if (storageProtocol === 'NFS') {
        volumeConfigDrift.push(...getNfsVolumeConfigDrift(storageAssessmentData as StorageNfsAssessment));
    }
    return volumeConfigDrift;
}

function getLunConfigDrift(
    storageAssessmentData: StorageAssessment
): (WadManagerOracleAssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching LUN configuration drift');
    const { luns = { data: [], error: '' } } = storageAssessmentData;
    const { data: lunsData, error } = luns;

    if (error) {
        return [...ORACLE_GOLDEN_CONFIG.filter(e => e.type === 'storage' && e.subType === 'configuration')].map(
            config => ({
                ...config,
                errorMessage: error
            })
        );
    }

    return lunConfigData.map(config => {
        const param = config.parameter!;
        const violationDetails = lunsData
            .filter(lun => lun[param] !== config.value)
            .map(lun => ({
                objectName: lun.name,
                objectType: ASSESSMENT_RESOURCE_TYPE.LUN,
                value: lun[param]?.toString() || '',
                recommended: (config.value ?? '').toString()
            }));

        const assessmentDetails: DriftAssessmentDetail[] = lunsData.map(lun => {
            const status = lun[param] !== config.value ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
            return {
                id: lun.uuid || lun.name || '',
                name: lun.name || '',
                status,
                metadata: {
                    components: [
                        {
                            parameter: config.id,
                            current: lun[param]?.toString() || '',
                            recommended: (config.value ?? '').toString(),
                            status
                        }
                    ]
                }
            };
        });

        return {
            ...config,
            recommended: (config.value ?? '').toString(),
            status: violationDetails.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
            objectsInViolation: violationDetails.map(detail => detail.objectName),
            violationDetails,
            totalObjectsAssessed: lunsData.length,
            totalObjectsInViolation: violationDetails.length,
            assessmentDetails
        };
    });
}

function getSharedFileTypeLabels(
    conflictVolumeIds: string[],
    volumeTypeMap: Record<OracleSysFileTypes, OracleVolumeRecord[]>,
    excludeTypes: OracleSysFileTypes[]
): string[] {
    if (conflictVolumeIds.length === 0) {
        return [];
    }
    const excluded = new Set(excludeTypes);
    const conflictIdSet = new Set(conflictVolumeIds);
    const { labels } = ORACLE_FILE_TYPE_LABEL_ORDER.reduce(
        (acc, type) => {
            if (excluded.has(type)) {
                return acc;
            }
            const volumes = volumeTypeMap[type];
            if (!(volumes ?? []).some(v => conflictIdSet.has(v.volumeId))) {
                return acc;
            }
            const label = ORACLE_FILE_TYPE_LABELS[type];
            if (!acc.seen.has(label)) {
                acc.seen.add(label);
                acc.labels.push(label);
            }
            return acc;
        },
        { labels: [] as string[], seen: new Set<string>() }
    );
    return labels;
}

/** One Intl.ListFormat for the lifetime of this module — avoids reallocating native formatter objects per message. */
const formatTypeList = (() => {
    const formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
    return (labels: string[]): string => formatter.format(labels);
})();

function volumeIdsSet(...groups: readonly OracleVolumeRecord[][]): Set<string> {
    return new Set(groups.flat().map(({ volumeId }) => volumeId));
}

function getVolumeLayoutDrift(
    volumeTypeMap: Record<OracleSysFileTypes, OracleVolumeRecord[]>,
    storageAssessmentData: StorageAssessment
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching volume layout drift');
    const volumeLayoutDrift: (AssessmentItemType | AssessmentErrorItemType)[] = [];

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
        volumeLayoutDrift.push({ ...archivePlacementConfig, errorMessage: 'No archive log volumes found.' });
    } else {
        const archiveSharesWithVolumeIds = volumeIdsSet(
            controlFileVolumes,
            dataFileVolumes,
            redoLogVolumes,
            tempFileVolumes
        );
        const archiveLogConflicts = [
            ...new Set(archiveFraLogVolumes.filter(v => archiveSharesWithVolumeIds.has(v.volumeId)))
        ];
        status = archiveLogConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const archiveSharedLabels = getSharedFileTypeLabels(
            archiveLogConflicts.map(c => c.volumeId),
            volumeTypeMap,
            [OracleSysFileTypes.ARCHIVE_LOGS, OracleSysFileTypes.FRA]
        );
        const archiveCurrent =
            status === AssessmentStatus.NOT_OPTIMIZED && archiveSharedLabels.length > 0
                ? `Archive logs currently shared with ${formatTypeList(archiveSharedLabels)}`
                : undefined;
        const archiveEntryRecommended = archivePlacementConfig.recommended ?? '';
        const archiveObjectsInViolation =
            status === AssessmentStatus.NOT_OPTIMIZED ? archiveLogConflicts.map(conflict => conflict.volumeName) : [];
        volumeLayoutDrift.push({
            ...archivePlacementConfig,
            recommended: archiveEntryRecommended,
            status,
            ...(archiveCurrent && { current: archiveCurrent }),
            objectsInViolation: archiveObjectsInViolation,
            totalObjectsAssessed: archiveFraLogVolumes.length,
            totalObjectsInViolation: archiveObjectsInViolation.length,
            violationDetails: archiveObjectsInViolation.map(volName => ({
                objectName: volName,
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                value: archiveCurrent!,
                recommended: archiveEntryRecommended
            }))
        });
    }

    if (isEmpty(dataFileVolumes)) {
        volumeLayoutDrift.push({ ...datafilesPlacementConfig, errorMessage: 'No data file volumes found.' });
    } else {
        const dataSharesWithVolumeIds = volumeIdsSet(redoLogVolumes, archiveLogVolumes, tempFileVolumes);
        const dataFileConflicts = [...new Set(dataFileVolumes.filter(v => dataSharesWithVolumeIds.has(v.volumeId)))];
        status = dataFileConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const dataSharedLabels = getSharedFileTypeLabels(
            dataFileConflicts.map(c => c.volumeId),
            volumeTypeMap,
            [OracleSysFileTypes.DATA_FILES, OracleSysFileTypes.CONTROL_FILES]
        );
        const dataCurrent =
            status === AssessmentStatus.NOT_OPTIMIZED && dataSharedLabels.length > 0
                ? `Data files currently shared with ${formatTypeList(dataSharedLabels)}`
                : undefined;
        const dataEntryRecommended = datafilesPlacementConfig.recommended ?? '';
        const dataObjectsInViolation =
            status === AssessmentStatus.NOT_OPTIMIZED ? dataFileConflicts.map(conflict => conflict.volumeName) : [];
        volumeLayoutDrift.push({
            ...datafilesPlacementConfig,
            recommended: dataEntryRecommended,
            status,
            ...(dataCurrent && { current: dataCurrent }),
            objectsInViolation: dataObjectsInViolation,
            totalObjectsAssessed: dataFileVolumes.length,
            totalObjectsInViolation: dataObjectsInViolation.length,
            violationDetails: dataObjectsInViolation.map(volName => ({
                objectName: volName,
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                value: dataCurrent!,
                recommended: dataEntryRecommended
            }))
        });
    }

    let hasConflicts;
    let insufficientMultiplexing;
    if (isEmpty(controlFileVolumes)) {
        volumeLayoutDrift.push({ ...controlfilesPlacementConfig, errorMessage: 'No control file volumes found.' });
    } else {
        // Control files can be on separate volume or shared with data/redo/temp and maintain at least two, preferably three, control file copies across separate volumes
        const archiveVolumeIdSet = volumeIdsSet(archiveLogVolumes);
        const controlFileConflicts = [
            ...new Set(controlFileVolumes.filter(controlVolume => archiveVolumeIdSet.has(controlVolume.volumeId)))
        ];

        hasConflicts = controlFileConflicts.length > 0;

        const uniqueControlFileVolumesWithoutSharingViolation = [
            ...new Set(
                controlFileVolumes
                    .filter(controlVolume => !archiveVolumeIdSet.has(controlVolume.volumeId))
                    .map(volume => volume.volumeId)
            )
        ];
        // Best practice is to have at least two multiplexed control files on separate volumes. So we need at least two separate volumes if there are multiplexed control files
        insufficientMultiplexing = uniqueControlFileVolumesWithoutSharingViolation.length < 2;

        status = hasConflicts || insufficientMultiplexing ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const recommended =
            hasConflicts && insufficientMultiplexing
                ? 'Separate volume or shared with data, redo, or temp files, with two multiplexed volumes'
                : hasConflicts
                ? 'Separate volume or shared with data, redo, or temp files'
                : 'Two multiplexed volumes';
        const controlSharedLabels = hasConflicts
            ? getSharedFileTypeLabels(
                  controlFileConflicts.map(c => c.volumeId),
                  volumeTypeMap,
                  [
                      OracleSysFileTypes.CONTROL_FILES,
                      OracleSysFileTypes.DATA_FILES,
                      OracleSysFileTypes.REDO_LOGS,
                      OracleSysFileTypes.TEMP_FILES
                  ]
              )
            : [];
        const controlMultiplexCount = uniqueControlFileVolumesWithoutSharingViolation.length;
        const controlSharingMessage =
            hasConflicts && controlSharedLabels.length > 0
                ? `Control files currently shared with ${formatTypeList(controlSharedLabels)}`
                : '';
        const controlMultiplexingFragment = insufficientMultiplexing
            ? controlMultiplexCount === 0
                ? 'no separate volumes available for multiplexed copies'
                : `only ${controlMultiplexCount} separate volume available for multiplexed copies`
            : '';
        let controlCurrent: string | undefined;
        if (controlSharingMessage && controlMultiplexingFragment) {
            controlCurrent = `${controlSharingMessage}; ${controlMultiplexingFragment}`;
        } else if (controlSharingMessage) {
            controlCurrent = controlSharingMessage;
        } else if (controlMultiplexingFragment) {
            controlCurrent = `Control files have ${controlMultiplexingFragment}`;
        }
        const controlObjectsInViolation = hasConflicts ? controlFileConflicts.map(conflict => conflict.volumeName) : [];
        volumeLayoutDrift.push({
            ...controlfilesPlacementConfig,
            recommended,
            status,
            ...(controlCurrent && { current: controlCurrent }),
            objectsInViolation: controlObjectsInViolation,
            totalObjectsAssessed: controlFileVolumes.length,
            totalObjectsInViolation: controlObjectsInViolation.length,
            violationDetails: controlObjectsInViolation.map(volName => ({
                objectName: volName,
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                value: controlCurrent!,
                recommended
            }))
        });
    }

    if (isEmpty(redoLogVolumes)) {
        volumeLayoutDrift.push({ ...redologsPlacementConfig, errorMessage: 'No redo log volumes found.' });
    } else {
        // Redo logs can be on separate or shared with temp/control
        const redoSharesWithVolumeIds = volumeIdsSet(dataFileVolumes, archiveLogVolumes);
        const redoFileConflicts = [
            ...new Set(redoLogVolumes.filter(redoVolume => redoSharesWithVolumeIds.has(redoVolume.volumeId)))
        ];

        hasConflicts = redoFileConflicts.length > 0;

        const uniqueRedoLogVolumesWithoutSharingViolation = [
            ...new Set(
                redoLogVolumes
                    .filter(redoVolume => !redoSharesWithVolumeIds.has(redoVolume.volumeId))
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

        const uniqueRedoVolumesNoShareViolationSet = new Set(uniqueRedoLogVolumesWithoutSharingViolation);
        // Find volumes with multiple copies when there's insufficient multiplexing
        const volumesWithMultipleCopies = insufficientMultiplexing
            ? redoLogVolumes.filter(vol => uniqueRedoVolumesNoShareViolationSet.has(vol.volumeId))
            : [];

        status = hasConflicts || insufficientMultiplexing ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const recommended =
            hasConflicts && insufficientMultiplexing
                ? 'Separate volume or shared with control or temp files, with multiplexed copies on two or more volumes'
                : hasConflicts
                ? 'Separate volume or shared with control or temp files'
                : 'Multiplexed copies on two or more volumes';

        const redoSharedLabels = hasConflicts
            ? getSharedFileTypeLabels(
                  redoFileConflicts.map(c => c.volumeId),
                  volumeTypeMap,
                  [OracleSysFileTypes.REDO_LOGS, OracleSysFileTypes.CONTROL_FILES, OracleSysFileTypes.TEMP_FILES]
              )
            : [];
        const redoMultiplexCount = uniqueRedoLogVolumesWithoutSharingViolation.length;
        const redoSharingMessage =
            hasConflicts && redoSharedLabels.length > 0
                ? `Redo logs currently shared with ${formatTypeList(redoSharedLabels)}`
                : '';
        const redoMultiplexingFragment = insufficientMultiplexing
            ? redoMultiplexCount === 0
                ? 'no separate volumes available for multiplexed copies'
                : `only ${redoMultiplexCount} separate volume available for multiplexed copies`
            : '';
        let redoCurrent: string | undefined;
        if (redoSharingMessage && redoMultiplexingFragment) {
            redoCurrent = `${redoSharingMessage}; ${redoMultiplexingFragment}`;
        } else if (redoSharingMessage) {
            redoCurrent = redoSharingMessage;
        } else if (redoMultiplexingFragment) {
            redoCurrent = `Redo logs have ${redoMultiplexingFragment}`;
        }

        const redoObjectsInViolation = hasConflicts
            ? redoFileConflicts.map(conflict => conflict.volumeName)
            : insufficientMultiplexing
            ? volumesWithMultipleCopies.map(v => v.volumeName)
            : [];
        volumeLayoutDrift.push({
            ...redologsPlacementConfig,
            recommended,
            status,
            ...(redoCurrent && { current: redoCurrent }),
            objectsInViolation: redoObjectsInViolation,
            totalObjectsAssessed: redoLogVolumes.length,
            totalObjectsInViolation: redoObjectsInViolation.length,
            violationDetails: redoObjectsInViolation.map(volName => ({
                objectName: volName,
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                value: redoCurrent!,
                recommended
            }))
        });
    }

    if (isEmpty(tempFileVolumes)) {
        volumeLayoutDrift.push({ ...templogsPlacementConfig, errorMessage: 'No temp log volumes found.' });
    } else {
        // Temp logs can be on separate or shared with redo/control
        const tempSharesWithVolumeIds = volumeIdsSet(dataFileVolumes, archiveLogVolumes);
        const tempFileConflicts = [...new Set(tempFileVolumes.filter(v => tempSharesWithVolumeIds.has(v.volumeId)))];
        status = tempFileConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const tempSharedLabels = getSharedFileTypeLabels(
            tempFileConflicts.map(c => c.volumeId),
            volumeTypeMap,
            [OracleSysFileTypes.TEMP_FILES, OracleSysFileTypes.REDO_LOGS, OracleSysFileTypes.CONTROL_FILES]
        );
        const tempCurrent =
            status === AssessmentStatus.NOT_OPTIMIZED && tempSharedLabels.length > 0
                ? `Temp files currently shared with ${formatTypeList(tempSharedLabels)}`
                : undefined;
        const tempEntryRecommended = templogsPlacementConfig.recommended ?? '';
        const tempObjectsInViolation = tempFileConflicts.map(conflict => conflict.volumeName);
        volumeLayoutDrift.push({
            ...templogsPlacementConfig,
            recommended: tempEntryRecommended,
            status,
            ...(tempCurrent && { current: tempCurrent }),
            objectsInViolation: tempObjectsInViolation,
            totalObjectsAssessed: tempFileVolumes.length,
            totalObjectsInViolation: tempObjectsInViolation.length,
            violationDetails: tempObjectsInViolation.map(volName => ({
                objectName: volName,
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                value: tempCurrent!,
                recommended: tempEntryRecommended
            }))
        });
    }

    if (isEmpty(binaryVolumeIds)) {
        volumeLayoutDrift.push({ ...oracleBinaryPlacementConfig, errorMessage: 'No binary log volumes found.' });
    } else {
        const oracleDataVolumeIds = volumeIdsSet(
            controlFileVolumes,
            dataFileVolumes,
            redoLogVolumes,
            archiveLogVolumes,
            tempFileVolumes
        );
        const binaryVolumeConflicts = binaryVolumeIds.filter(id => oracleDataVolumeIds.has(id));
        status = binaryVolumeConflicts.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const binarySharedLabels = getSharedFileTypeLabels(binaryVolumeConflicts, volumeTypeMap, []);
        const binaryCurrent =
            status === AssessmentStatus.NOT_OPTIMIZED && binarySharedLabels.length > 0
                ? `Oracle binaries currently shared with ${formatTypeList(binarySharedLabels)}`
                : undefined;
        const binaryEntryRecommended = oracleBinaryPlacementConfig.recommended ?? '';
        volumeLayoutDrift.push({
            ...oracleBinaryPlacementConfig,
            recommended: binaryEntryRecommended,
            status,
            ...(binaryCurrent && { current: binaryCurrent }),
            objectsInViolation: binaryVolumeConflicts,
            totalObjectsAssessed: binaryVolumeIds.length,
            totalObjectsInViolation: binaryVolumeConflicts.length,
            violationDetails: binaryVolumeConflicts.map(volId => ({
                objectName: volId,
                objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
                value: binaryCurrent!,
                recommended: binaryEntryRecommended
            }))
        });
    }

    return volumeLayoutDrift;
}

function getLunLayoutDrift(
    volumeTypeMap: Record<OracleSysFileTypes, OracleVolumeRecord[]>,
    storageAssessmentData: StorageAssessment
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching LUN layout drift');
    const {
        DATA_FILES: dataFileLuns,
        REDO_LOGS: redoLogLuns,
        ARCHIVE_LOGS: archiveLogLuns,
        FRA: fraLuns
    } = volumeTypeMap;
    const { fraEnabled } = storageAssessmentData;
    const result: (AssessmentItemType | AssessmentErrorItemType)[] = [];
    result.push(
        prepareASMLunLayoutAssessment(dataDiskLunLayoutConfig, dataFileLuns, MIN_OPTIMAL_LUN_PER_DG.DATA, 'Data')
    );
    result.push(
        prepareASMLunLayoutAssessment(
            redoLogDiskLunLayoutConfig,
            redoLogLuns,
            MIN_OPTIMAL_LUN_PER_DG.LOG_RECOVERY,
            'Redo Log'
        )
    );
    if (fraEnabled === 'yes') {
        result.push(
            prepareASMLunLayoutAssessment(fraDiskLunLayoutConfig, fraLuns, MIN_OPTIMAL_LUN_PER_DG.LOG_RECOVERY, 'FRA')
        );
    } else {
        result.push(
            prepareASMLunLayoutAssessment(
                archivelogDiskLunLayoutConfig,
                archiveLogLuns,
                MIN_OPTIMAL_LUN_PER_DG.LOG_RECOVERY,
                'Archive Log'
            )
        );
    }
    return result;
}

function getSwapSpaceDrift(
    accountId: string,
    ec2InstanceId: string,
    databaseInstanceName: string,
    storageAssessmentData: StorageAssessment
): AssessmentItemType | AssessmentErrorItemType {
    logger.info('Fetching swap space drift', { accountId, ec2InstanceId, databaseInstanceName });

    const swapSpaceConfig = sizingConfigData.find(config => config.parameter === 'swap-space');
    const { swapSpace } = storageAssessmentData.sizing!;
    if (!swapSpace) {
        logger.info('No swap space sizing data found in the assessment.', {
            accountId,
            ec2InstanceId,
            databaseInstanceName
        });
        return { ...swapSpaceConfig!, errorMessage: 'No swap space sizing data found in the assessment.' };
    }

    const { ramSizeInKb, swapSizeInKb, hugepagesSizeInKb, error } = swapSpace;

    if (error) {
        logger.error('Error in stored swap space sizing data', accountId, error);
        return { ...swapSpaceConfig!, errorMessage: 'Error in stored swap space sizing data' };
    }

    const ramTotal = Math.round(sizeInGigaBytes(ramSizeInKb, 'KiB') * 100) / 100;
    const swapTotal = Math.round(sizeInGigaBytes(swapSizeInKb, 'KiB') * 100) / 100;
    const hugepageSize = Math.round(sizeInGigaBytes(hugepagesSizeInKb, 'KiB') * 100) / 100; // hugepageSize will be 0 if hugepage is not enabled; else it will be the total hugepage size
    const effectiveRam = ramTotal - hugepageSize;

    let recommendedSwapSpace = 0;
    let recommendedSwapSpaceMin = 0;
    let recommendedSwapSpaceMax = 0;
    let isRangeRecommendation = false;

    if (effectiveRam >= 1 && effectiveRam <= 2) {
        isRangeRecommendation = true;
        recommendedSwapSpaceMin = Math.round(effectiveRam * 1.5 * 100) / 100;
        recommendedSwapSpaceMax = Math.round(effectiveRam * 2 * 100) / 100;
    } else if (effectiveRam > 2 && effectiveRam <= 16) {
        recommendedSwapSpace = effectiveRam;
    } else if (effectiveRam > 16) {
        recommendedSwapSpace = 16;
    }

    if (!isRangeRecommendation && recommendedSwapSpace === 0) {
        logger.info('Unable to determine recommended swap space due to insufficient RAM data.', {
            accountId,
            ec2InstanceId,
            databaseInstanceName,
            ramTotal,
            hugepageSize
        });
        return {
            ...swapSpaceConfig!,
            errorMessage: 'Unable to determine recommended swap space due to insufficient RAM data.'
        };
    }

    if (!isRangeRecommendation) {
        recommendedSwapSpace = Math.round(recommendedSwapSpace * 100) / 100;
    }

    const lowerBound = Math.round(recommendedSwapSpace * 0.9 * 100) / 100;
    const upperBound = Math.round(recommendedSwapSpace * 1.1 * 100) / 100;
    const isViolation = isRangeRecommendation
        ? swapTotal < recommendedSwapSpaceMin || swapTotal > recommendedSwapSpaceMax
        : swapTotal < lowerBound || swapTotal > upperBound;
    const status = isViolation ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;

    const swapRecommended = isRangeRecommendation
        ? `${recommendedSwapSpaceMin} - ${recommendedSwapSpaceMax} GB`
        : `${recommendedSwapSpace} GB`;
    const swapCurrent = `${swapTotal} GB`;
    return {
        ...swapSpaceConfig!,
        status,
        recommended: swapRecommended,
        current: swapCurrent,
        objectsInViolation: isViolation ? [ec2InstanceId] : [],
        totalObjectsAssessed: 1,
        totalObjectsInViolation: isViolation ? 1 : 0,
        violationDetails: isViolation
            ? [
                  {
                      objectName: ec2InstanceId,
                      objectType: 'EC2 Instance',
                      value: swapCurrent,
                      recommended: swapRecommended
                  }
              ]
            : []
    };
}

async function getOracleHeadroomDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    databaseInstanceName: string,
    fileSystemId: string
): Promise<AssessmentItemType | AssessmentErrorItemType> {
    logger.info('Fetching storage headroom drift', { accountId, ec2InstanceId, databaseInstanceName });

    const headroomConfig = sizingConfigData.find(config => config.parameter === 'headroom');

    try {
        const { status, headroomPercent, missingPermissions, newFsxStorageCapacityGiB } = await getHeadroomDrift(
            credentialsId,
            region,
            fileSystemId,
            RESOURCESTYPE.ORACLE,
            accountId
        );

        return {
            ...headroomConfig!,
            status,
            current: `${headroomPercent}%`,
            recommended: `${MIN_OPTIMIZED_HEADROOM_PERCENTAGE.ORACLE}%`,
            recommendedSizeInGib: newFsxStorageCapacityGiB ? Math.ceil(newFsxStorageCapacityGiB) : 0,
            objectsInViolation: status !== AssessmentStatus.OPTIMIZED ? [fileSystemId] : [],
            totalObjectsAssessed: 1,
            totalObjectsInViolation: status !== AssessmentStatus.OPTIMIZED ? 1 : 0,
            missingPermissions
        };
    } catch (error) {
        logger.error('Error fetching FSx storage details or CloudWatch metrics', {
            accountId,
            ec2InstanceId,
            databaseInstanceName,
            fileSystemId,
            error
        });
        return {
            ...headroomConfig!,
            errorMessage: `Failed to fetch FSx storage details or CloudWatch metrics; Error: ${error}`
        };
    }
}

async function getStorageSizingDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    databaseInstanceName: string,
    storageAssessmentData: StorageAssessment,
    fsxFileSystemId: string,
    skipHeadroom: boolean = false
): Promise<(AssessmentItemType | AssessmentErrorItemType)[]> {
    logger.info('Fetching storage sizing drift', { accountId, ec2InstanceId, databaseInstanceName });

    const result: (AssessmentItemType | AssessmentErrorItemType)[] = [];
    const { sizing: sizingData } = storageAssessmentData;

    if (!sizingData || isEmpty(sizingData)) {
        return [...ORACLE_GOLDEN_CONFIG.filter(e => e.type === 'storage' && e.subType === 'sizing')].map(config => ({
            ...config,
            errorMessage: 'No sizing assessment data found.'
        }));
    }

    const asyncAssessments: Promise<void>[] = [];

    sizingConfigData.forEach(config => {
        switch (config.parameter) {
            case 'swap-space':
                result.push(getSwapSpaceDrift(accountId, ec2InstanceId, databaseInstanceName, storageAssessmentData));
                break;

            case 'headroom':
                if (skipHeadroom) {
                    logger.info('Skipping headroom calculation for one-time WAD assessment');
                    break;
                }
                // Headroom we wont be fetching from the database as it's a calculated field
                asyncAssessments.push(
                    getOracleHeadroomDrift(
                        accountId,
                        credentialsId,
                        region,
                        ec2InstanceId,
                        databaseInstanceName,
                        fsxFileSystemId
                    ).then(headroomDrift => {
                        result.push(headroomDrift);
                    })
                );
                break;

            default:
                logger.warn('Unknown sizing parameter encountered', { parameter: config.parameter });
                break;
        }
    });

    await Promise.all(asyncAssessments);

    return result;
}

async function calculateStorageDrift(
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
    storageAssessmentData: StorageAssessment,
    skipHeadroom: boolean = false,
    skipVolumeLayout: boolean = false
): Promise<(AssessmentItemType | AssessmentErrorItemType)[]> {
    logger.info('Calculating storage drift', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        deploymentType
    });

    const mappedVolumeError = mappedOntapVolumes?.[fsxFileSystemId]?.volumeMappings?.find(
        mapping => mapping[databaseInstanceName]?.error
    )?.[databaseInstanceName]?.error;

    if (isEmpty(storageAssessmentData)) {
        if (mappedVolumeError) {
            return [...storageConfigData].map(config => ({
                ...config,
                errorMessage: `Mapped ONTAP volume discovery failed for ${databaseInstanceName}: ${mappedVolumeError}`
            }));
        }
        const errorMessage = `No ${AssessmentCategories.STORAGE} assessment data found. Assessment is scheduled to run every 24hours and may not have run on the instance. Please try again later.`;
        return [...storageConfigData].map(config => ({
            ...config,
            errorMessage
        }));
    }

    if (!mappedOntapVolumes || isEmpty(mappedOntapVolumes)) {
        const errorMessage = `No mapped ONTAP volumes found for file system ${fsxFileSystemId}. Please ensure the instance has been properly discovered and configured.`;
        return [...storageConfigData].map(config => ({
            ...config,
            errorMessage
        }));
    }

    const protocol = mappedOntapVolumes[fsxFileSystemId]?.protocol;
    const isASMManaged = mappedOntapVolumes[fsxFileSystemId]?.isASMManaged;

    const volumeTypeMap = mapVolumeTypesToIdName(databaseInstanceName, fsxFileSystemId, mappedOntapVolumes);

    const items: (AssessmentItemType | AssessmentErrorItemType)[] = [];

    items.push(
        ...(await getStorageSizingDrift(
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            databaseInstanceName,
            storageAssessmentData,
            fsxFileSystemId,
            skipHeadroom
        ))
    );

    if (!skipVolumeLayout) {
        items.push(...getVolumeLayoutDrift(volumeTypeMap, storageAssessmentData));
    }
    if (protocol === STORAGE_PROTOCOLS.ISCSI && isASMManaged) {
        items.push(...getLunLayoutDrift(volumeTypeMap, storageAssessmentData));
    }

    items.push(...getVolumeConfigDrift(volumeTypeMap, storageAssessmentData, protocol!));

    if (protocol === STORAGE_PROTOCOLS.ISCSI) {
        items.push(...getLunConfigDrift(storageAssessmentData));
        if (blockDeviceConfig && !storageAssessmentData?.luns?.error && !storageAssessmentData?.volumes?.error) {
            items.push(
                buildBlockDeviceSpaceManagementEntry(
                    blockDeviceConfig,
                    storageAssessmentData?.luns?.data ?? [],
                    storageAssessmentData?.volumes?.data ?? []
                )
            );
        }
        items.push(...getOSConfigDrift(ec2InstanceId, databaseInstanceName, storageAssessmentData));
    } else {
        items.push(
            ...getNfsOSConfigDrift(
                ec2InstanceId,
                databaseInstanceName,
                deploymentType,
                storageAssessmentData as StorageNfsAssessment
            )
        );
    }

    return items;
}

async function registerAssessmentJobs(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceWithInstanceName: string,
    parentJobId: string,
    jobStatus: JOBSTATUS,
    errorMessage?: string
) {
    const assessmentTypes = [
        'Storage configuration assessment',
        'Storage layout assessment',
        'Storage sizing assessment'
    ];

    await Promise.all(
        assessmentTypes.map(assessmentName =>
            registerJob(accountId, credentialsId, region, {
                name: assessmentName,
                description: assessmentName,
                resourceName: resourceWithInstanceName,
                startTime: Date.now(),
                endTime: Date.now(),
                status: jobStatus,
                type: JOBTYPE.ASSESSMENT,
                parentJobId,
                ...(errorMessage && { error: errorMessage })
            })
        )
    );
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
        mappedVolumeError,
        fsxFileSystem,
        storageProtocol,
        isASMManaged = false,
        mappedDiskGroups
    } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    instanceRecord.mappedVolumesUuids = (mappedVolumesUuids ?? []).filter(Boolean);
    if (isEmpty(instanceRecord.mappedVolumesUuids)) {
        errorMessage = mappedVolumeError
            ? `Found no FSx for ONTAP volumes for the database ${databaseInstanceName}. Oracle mount discovery failed: ${mappedVolumeError}`
            : `Found no FSx for ONTAP volumes for the database ${databaseInstanceName}.`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        await registerAssessmentJobs(
            accountId,
            credentialsId,
            region,
            resourceWithInstanceName,
            parentJobId,
            jobStatus,
            errorMessage
        );
        return;
    }

    try {
        const osCommand =
            storageProtocol === 'iSCSI'
                ? OS_ASSESSMENT(
                      activeNodeInstanceid,
                      databaseInstanceName,
                      storageProtocol,
                      isASMManaged,
                      mappedDiskGroups
                  )
                : NFS_OS_ASSESSMENT(activeNodeInstanceid, databaseInstanceName);

        const combinedResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [VOLUME_LUN_CONFIGURATION(instanceRecord), ORACLE_STORAGE_SIZING_ASSESSMENT],
            ec2InstanceId: activeNodeInstanceid,
            comment: 'Get Storage Configuration Assessment for Oracle instance',
            accountId,
            executionTimeout: ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
        const [storageAssessment, storageSizingAssessment] = parseMultipleCommandResponse(combinedResponse);

        const osAssessmentResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [osCommand],
            ec2InstanceId: activeNodeInstanceid,
            comment: 'Get OS Configuration Assessment for Oracle instance',
            accountId,
            executionTimeout: ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

        const [osAssessment] = parseMultipleCommandResponse(osAssessmentResponse);

        const merged = {
            ...storageAssessment,
            ...osAssessment,
            ...storageSizingAssessment
        } as StorageIscsiAssessment;
        const creationTime = new Date(Date.now());

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: creationTime,
                config_data_type: AssessmentCategories.STORAGE,
                config_data: merged
            }
        ]);
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
    } finally {
        await registerAssessmentJobs(
            accountId,
            credentialsId,
            region,
            resourceWithInstanceName,
            parentJobId,
            jobStatus,
            errorMessage
        );
    }
}

export {
    initiateStorageAssessmentCollection,
    calculateStorageDrift,
    getVolumeConfigDrift,
    getVolumeLayoutDrift,
    getSharedFileTypeLabels,
    formatTypeList,
    getNfsOSConfigDrift,
    mapVolumeTypesToIdName,
    getBaseVolume,
    createAssessment,
    createViolationDetail,
    GoldenConfigEntry,
    volumeConfigData,
    volumeNfsConfigData,
    lunConfigData,
    blockDeviceConfig
};
