import { OntapLunRecord, OntapVolumeRecord } from '../../lib/ontap/ontap-gateway';
import { StorageAssessment as MssqlStorageAssessment } from '../../utils/common-types';
import { StorageAssessment as OracleStorageAssessment } from './oracle/common-types';
import {
    OracleMappedOntapVolumesResponse,
    OracleVolumeRecord,
    OracleSysFileTypes
} from '../workloads/oracle/common-types';
import getLogger from '../../utils/logger';

const logger = getLogger();

const HOST_SIDE_NOT_COLLECTED = 'Not collected via proxy forwarder';

const AGGREGATE_FIELDS = 'space.block_storage.size,space.block_storage.used,space.block_storage.available';

const VOLUME_FIELDS =
    'name,uuid,svm,nas.path,autosize,space.fractional_reserve,space.snapshot.reserve_percent,' +
    'space.snapshot.autodelete.enabled,space.snapshot.autodelete.delete_order,snapshot_policy,' +
    'tiering,guarantee,efficiency,clone.is_flexclone,clone.parent_volume.name,create_time,' +
    'space.size,space.used,space.physical_used';

const LUN_FIELDS = 'name,uuid,os_type,space.guarantee.requested,space.scsi_thin_provisioning_support_enabled';

interface OntapSnapshotRecord {
    uuid?: string;
    comment?: string;
}

interface WadSnapcenterVolumeResult {
    svmId: string;
    svmName: string;
    volumeId: string;
    volumeName: string;
    hasSnapcenterSnapshot: boolean;
    foundInSnapcenterLogs: false;
}

interface WadSnapcenterData {
    volumes: WadSnapcenterVolumeResult[];
    standaloneCheck: {
        pluginServiceRunning: false;
        sidFoundInLogs: false;
    };
    isDataguardPrimary: false;
    errorMessage: '';
}

interface OntapAggregateRecord {
    space?: {
        block_storage?: {
            size?: number;
            used?: number;
            available?: number;
        };
    };
}

interface AggregateHeadroomData {
    ssdStorageCapacityInBytes: number;
    storageUsedInBytes: number;
    storageAvailableInBytes: number;
    headroomPercent: number;
    aggregateCount: number;
}

interface FsxOntapInventory {
    fileSystemId: string;
    volumesByUuid: Record<string, OntapVolumeRecord>;
    lunsByUuid: Record<string, OntapLunRecord>;
    spaceMgmtTryFirstByName: Record<string, string | undefined>;
    performanceTierPercentByName: Record<string, number | undefined>;
    snapcenterProtectedVolumeUuids: Set<string>;
    headroomData?: AggregateHeadroomData;
    errors: {
        volumes?: string;
        luns?: string;
        privateCliVolumes?: string;
        footprint?: string;
        aggregates?: string;
        snapshots?: string;
    };
}

interface FsxOntapQuery {
    fileSystemId: string;
    fsxName?: string;
    region: string;
    volumeUuids: string[];
    volumeNames: string[];
    lunUuids: string[];
}

interface FsxStorageCollectionResult {
    instanceId: string;
    fileSystemId: string;
    fsxName?: string;
    workloadType: string;
    storageAssessment: MssqlStorageAssessment | OracleStorageAssessment;
    headroomData?: AggregateHeadroomData;
    snapcenterData?: WadSnapcenterData;
    /** ONTAP volume UUID -> FSx volume id (`fsvol-…`), when the collector can resolve it. */
    fsxVolumeIdByUuid?: Record<string, string>;
}

function computeHeadroomData(aggregates: OntapAggregateRecord[]) {
    logger.info('FSx: computing headroom data', { aggregateCount: aggregates.length });
    if (!aggregates.length) {
        logger.debug('FSx: no aggregates returned, skipping headroom computation');
        return undefined;
    }

    const { totalSize, totalUsed, totalAvailable } = aggregates.reduce(
        (acc, { space }) => ({
            totalSize: acc.totalSize + (space?.block_storage?.size ?? 0),
            totalUsed: acc.totalUsed + (space?.block_storage?.used ?? 0),
            totalAvailable: acc.totalAvailable + (space?.block_storage?.available ?? 0)
        }),
        { totalSize: 0, totalUsed: 0, totalAvailable: 0 }
    );

    if (!totalSize) {
        logger.warn('FSx: aggregate total size is zero, skipping headroom computation');
        return undefined;
    }

    const headroomPercent = Math.ceil(((totalSize - totalUsed) / totalSize) * 100);

    logger.info('FSx: computed aggregate headroom data', {
        aggregateCount: aggregates.length,
        ssdStorageCapacityInBytes: totalSize,
        storageUsedInBytes: totalUsed,
        headroomPercent
    });

    return {
        ssdStorageCapacityInBytes: totalSize,
        storageUsedInBytes: totalUsed,
        storageAvailableInBytes: totalAvailable,
        headroomPercent,
        aggregateCount: aggregates.length
    };
}

function buildWadSnapcenterDataFromUuids(volumeUuids: string[], inventory: FsxOntapInventory): WadSnapcenterData {
    const volumes: WadSnapcenterVolumeResult[] = volumeUuids
        .filter(uuid => inventory.volumesByUuid[uuid])
        .map(uuid => {
            const { name = '', svm } = inventory.volumesByUuid[uuid] ?? {};
            return {
                svmId: svm?.uuid ?? '',
                svmName: svm?.name ?? '',
                volumeId: uuid,
                volumeName: name,
                hasSnapcenterSnapshot: inventory.snapcenterProtectedVolumeUuids.has(uuid),
                foundInSnapcenterLogs: false
            };
        });
    return {
        volumes,
        standaloneCheck: { pluginServiceRunning: false, sidFoundInLogs: false },
        isDataguardPrimary: false,
        errorMessage: ''
    };
}

function toMssqlStorageAssessmentFromUuids(
    fileSystemId: string,
    inventory: FsxOntapInventory,
    volumeUuids: Set<string>,
    lunUuids: Set<string>
): MssqlStorageAssessment {
    const volumes = Object.values(inventory.volumesByUuid)
        .filter(({ uuid }) => volumeUuids.has(uuid))
        .map(
            ({
                name,
                uuid,
                create_time: createTime,
                clone,
                autosize,
                guarantee,
                space,
                snapshot_policy: snapshotPolicy,
                tiering,
                svm,
                efficiency
            }) => {
                const autosizeMode = autosize?.mode;
                return {
                    name,
                    uuid,
                    ...(createTime && { create_time: createTime }),
                    ...(clone && { clone }),
                    ...(space?.size !== undefined || space?.used !== undefined || space?.physical_used !== undefined
                        ? {
                              space: {
                                  size: space.size,
                                  used: space.used,
                                  physical_used: space.physical_used
                              }
                          }
                        : {}),
                    svmName: svm?.name,
                    svmUuid: svm?.uuid,
                    'thin-provision': guarantee?.honored,
                    'space-guarantee': guarantee?.type,
                    'autosize-mode': autosizeMode,
                    autosize: autosizeMode && autosizeMode !== 'off' ? 'on' : 'off',
                    'fractional-reserve': space?.fractional_reserve,
                    'snapshot-copy-reserve': space?.snapshot?.reserve_percent,
                    'snapshot-autodelete': space?.snapshot?.autodelete?.enabled,
                    'snapshot-policy': snapshotPolicy?.name,
                    'tiering-policy': tiering?.policy,
                    'tiering-min-cooling-days': tiering?.min_cooling_days,
                    compression: efficiency?.compression,
                    compressionType: efficiency?.compression_type,
                    compaction: efficiency?.compaction,
                    deduplication: efficiency?.dedupe,
                    'efficiency-type': efficiency?.storage_efficiency_mode,
                    'space-mgmt-try-first': inventory.spaceMgmtTryFirstByName[name]
                };
            }
        );

    const luns = Object.values(inventory.lunsByUuid)
        .filter(({ uuid }) => lunUuids.has(uuid))
        .map(({ name, os_type: osType, space }) => ({
            name,
            'os-type': osType,
            'space-reservation-enabled': space?.guarantee?.requested,
            'space-allocation-allocated': space?.scsi_thin_provisioning_support_enabled
        }));

    const performanceTier = volumes.map(({ name }) => ({
        volumeName: name,
        performanceTierPercent: inventory.performanceTierPercentByName[name]
    }));

    return {
        filesystemId: fileSystemId,
        volumes: volumes as unknown as MssqlStorageAssessment['volumes'],
        luns: luns as unknown as MssqlStorageAssessment['luns'],
        os: [] as unknown as MssqlStorageAssessment['os'],
        layout: undefined as unknown as MssqlStorageAssessment['layout'],
        sizing: { 'performance-tier': performanceTier } as unknown as MssqlStorageAssessment['sizing'],
        errors: {
            volumes: inventory.errors.volumes ?? '',
            luns: inventory.errors.luns ?? '',
            'volumes-footprint': inventory.errors.footprint ?? '',
            layout: HOST_SIDE_NOT_COLLECTED,
            sizing: inventory.errors.footprint ?? '',
            'mpio-policy': HOST_SIDE_NOT_COLLECTED,
            'iscsi-sessions': HOST_SIDE_NOT_COLLECTED,
            'ntfs-allocation': HOST_SIDE_NOT_COLLECTED,
            'tempdb-files-location': HOST_SIDE_NOT_COLLECTED,
            'default-log-files-location': HOST_SIDE_NOT_COLLECTED,
            'default-data-files-location': HOST_SIDE_NOT_COLLECTED,
            'data-tempdb-drive-details': HOST_SIDE_NOT_COLLECTED,
            spaceMgmtTryFirst: inventory.errors.privateCliVolumes ?? ''
        }
    };
}

function toOracleStorageAssessmentFromUuids(
    fileSystemId: string,
    inventory: FsxOntapInventory,
    volumeUuids: Set<string>,
    lunUuids: Set<string>,
    volumeRecords: OracleVolumeRecord[]
): OracleStorageAssessment {
    const volumesData = Object.values(inventory.volumesByUuid)
        .filter(({ uuid }) => volumeUuids.has(uuid))
        .map(
            ({
                name,
                uuid,
                create_time: createTime,
                clone,
                nas,
                autosize,
                guarantee,
                space,
                snapshot_policy: snapshotPolicy,
                tiering,
                svm,
                efficiency
            }) => {
                const autosizeMode = autosize?.mode;
                return {
                    name,
                    uuid,
                    // Clone/space fields stay snake_case to match VolumeRecord, which the shared
                    // clone assessment reads directly off these records.
                    ...(createTime && { create_time: createTime }),
                    ...(clone && { clone }),
                    ...(space && {
                        space: {
                            size: space.size,
                            used: space.used,
                            physical_used: space.physical_used
                        }
                    }),
                    junctionPath: nas?.path,
                    thinProvision: guarantee?.honored,
                    spaceGuarantee: guarantee?.type,
                    autosizeMode,
                    autosize: autosizeMode && autosizeMode !== 'off' ? 'on' : 'off',
                    fractionalReserve: space?.fractional_reserve,
                    snapshotCopyReserve: space?.snapshot?.reserve_percent,
                    snapshotAutodelete: space?.snapshot?.autodelete?.enabled,
                    snapshotPolicy: snapshotPolicy?.name,
                    tieringPolicy: tiering?.policy,
                    tieringMinCoolingDays: tiering?.min_cooling_days,
                    svmName: svm?.name,
                    svmUuid: svm?.uuid,
                    compression: efficiency?.compression,
                    compressionType: efficiency?.compression_type,
                    compaction: efficiency?.compaction,
                    deduplication: efficiency?.dedupe,
                    efficiencyType: efficiency?.storage_efficiency_mode,
                    snapshotDeleteOrder: space?.snapshot?.autodelete?.delete_order,
                    spaceMgmtTryFirst: inventory.spaceMgmtTryFirstByName[name] ?? null
                };
            }
        );

    const lunsData = Object.values(inventory.lunsByUuid)
        .filter(({ uuid }) => lunUuids.has(uuid))
        .map(({ name, uuid, os_type: osType, space }) => ({
            name,
            uuid,
            osType,
            spaceReservationEnabled: space?.guarantee?.requested,
            spaceAllocationAllocated: space?.scsi_thin_provisioning_support_enabled
        }));

    const protocol = volumeRecords.some(({ lunId }) => lunId) ? 'iSCSI' : 'NFS';
    const ontapVolumes = Object.fromEntries(Object.values(OracleSysFileTypes).map(ft => [ft, volumeRecords]));
    const mappedOntapVolumes: Record<string, OracleMappedOntapVolumesResponse> = {
        [fileSystemId]: {
            protocol,
            isASMManaged: false,
            lunRecords: [],
            volumeMappings: [{ '': { isCDB: false, ontapVolumes } }]
        }
    };

    return {
        volumes: { filesystemId: fileSystemId, error: inventory.errors.volumes ?? '', data: volumesData },
        luns: {
            error:
                lunsData.length === 0 && !inventory.errors.luns ? 'LUNs not applicable' : inventory.errors.luns ?? '',
            data: lunsData
        },
        mappedOntapVolumes
    };
}

export {
    HOST_SIDE_NOT_COLLECTED,
    AGGREGATE_FIELDS,
    VOLUME_FIELDS,
    LUN_FIELDS,
    computeHeadroomData,
    buildWadSnapcenterDataFromUuids,
    toMssqlStorageAssessmentFromUuids,
    toOracleStorageAssessmentFromUuids,
    type OntapSnapshotRecord,
    type WadSnapcenterVolumeResult,
    type WadSnapcenterData,
    type OntapAggregateRecord,
    type AggregateHeadroomData,
    type FsxOntapInventory,
    type FsxOntapQuery,
    type FsxStorageCollectionResult
};
