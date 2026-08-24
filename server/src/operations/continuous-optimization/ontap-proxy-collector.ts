import throat from 'throat';
import { Ec2FsxRelationship, Ec2WithStorage } from '../cloud-manager/tagging-service-operations';
import { trackSubtask } from '../cloud-manager/tracker-operations';
import {
    buildOntapProxyBase,
    collectAllOntapRecords,
    collectOntapRecordsBatched,
    unwrapOntapSettled,
    OntapLunRecord,
    OntapVolumeRecord,
    ProxyOperationBaseOpts
} from '../../lib/ontap/ontap-gateway';
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
    'tiering,guarantee,efficiency';

const LUN_FIELDS = 'name,uuid,os_type,space.guarantee.requested,space.scsi_thin_provisioning_support_enabled';

const FOOTPRINT_FIELDS = 'volume-blocks-footprint-bin0-percent';

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

interface OntapPrivateCliVolumeRecord {
    volume: string;
    space_mgmt_try_first?: string;
}

interface OntapFootprintRecord {
    volume: string;
    volume_blocks_footprint_bin0_percent?: number;
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

async function collectOntapHeadroomData(
    accountId: string,
    fileSystemId: string,
    region: string
): Promise<AggregateHeadroomData | undefined> {
    const base = buildOntapProxyBase(accountId, fileSystemId, region);
    const aggregates = await collectAllOntapRecords<OntapAggregateRecord>(base, 'api/storage/aggregates', {
        fields: AGGREGATE_FIELDS
    });
    return computeHeadroomData(aggregates);
}

function buildWadSnapcenterData(
    ec2: Ec2WithStorage,
    fileSystemId: string,
    inventory: FsxOntapInventory
): WadSnapcenterData {
    const { volumeUuids } = getAttachedUuids(ec2, fileSystemId);
    const volumes: WadSnapcenterVolumeResult[] = [...volumeUuids]
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

function getAttachedUuids(ec2: Ec2WithStorage, fileSystemId: string) {
    const volumes = ec2.fsxs.find(fsx => fsx.fileSystemId === fileSystemId)?.volumes ?? [];
    return {
        volumeUuids: new Set(volumes.map(v => v.volumeUuid)),
        lunUuids: new Set(volumes.flatMap(({ luns = [] }) => luns.map(l => l.lunUuid)))
    };
}

async function collectVolumeSnapshots(base: ProxyOperationBaseOpts, volumeUuids: string[]) {
    logger.info('FSx: collecting volume snapshots', { volumeUuids });
    if (volumeUuids.length === 0) {
        return [];
    }

    const settled = await Promise.allSettled(
        volumeUuids.map(
            throat(3, uuid =>
                collectAllOntapRecords<OntapSnapshotRecord>(base, `api/storage/volumes/${uuid}/snapshots`, {
                    comment: 'creator=snapcenter',
                    max_records: 1
                }).then(records => ({ uuid, hasSnapshots: records.length > 0 }))
            )
        )
    );

    return settled.flatMap((result, i) => {
        if (result.status === 'fulfilled') {
            return result.value.hasSnapshots ? [result.value.uuid] : [];
        }
        logger.warn('Failed to fetch ONTAP snapshots for volume, skipping', {
            targetId: base.targetId,
            volumeUuid: volumeUuids[i],
            err: result.reason
        });
        return [];
    });
}

async function fetchOntapInventory(accountId: string, query: FsxOntapQuery): Promise<FsxOntapInventory> {
    const { fileSystemId, region, volumeUuids, volumeNames, lunUuids } = query;
    logger.debug('FSx: fetching ONTAP inventory', { accountId, fileSystemId });

    const base = buildOntapProxyBase(accountId, fileSystemId, region);

    const [volumesRes, lunsRes, privateCliRes, footprintRes, headroomRes, snapshotsRes] = await Promise.allSettled([
        volumeUuids.length === 0
            ? Promise.resolve<OntapVolumeRecord[]>([])
            : collectOntapRecordsBatched<OntapVolumeRecord>(base, 'api/storage/volumes', 'uuid', volumeUuids, {
                  fields: VOLUME_FIELDS
              }),
        lunUuids.length === 0
            ? Promise.resolve<OntapLunRecord[]>([])
            : collectOntapRecordsBatched<OntapLunRecord>(base, 'api/storage/luns', 'uuid', lunUuids, {
                  fields: LUN_FIELDS
              }),
        volumeNames.length === 0
            ? Promise.resolve<OntapPrivateCliVolumeRecord[]>([])
            : collectOntapRecordsBatched<OntapPrivateCliVolumeRecord>(
                  base,
                  'api/private/cli/volume',
                  'volume',
                  volumeNames,
                  {
                      fields: 'space-mgmt-try-first'
                  }
              ),
        volumeNames.length === 0
            ? Promise.resolve<OntapFootprintRecord[]>([])
            : collectOntapRecordsBatched<OntapFootprintRecord>(
                  base,
                  'api/private/cli/volume/show-footprint',
                  'volume',
                  volumeNames,
                  { fields: FOOTPRINT_FIELDS }
              ),
        collectOntapHeadroomData(accountId, fileSystemId, region),
        collectVolumeSnapshots(base, volumeUuids)
    ]);

    const { data: volumes, error: volumesError } = unwrapOntapSettled(volumesRes, 'volumes', fileSystemId);
    const { data: luns, error: lunsError } = unwrapOntapSettled(lunsRes, 'LUNs', fileSystemId);
    const { data: privateCli, error: privateCliError } = unwrapOntapSettled(
        privateCliRes,
        'private CLI volumes',
        fileSystemId
    );
    const { data: footprint, error: footprintError } = unwrapOntapSettled(
        footprintRes,
        'volume footprint',
        fileSystemId
    );
    let headroomData: AggregateHeadroomData | undefined;
    let aggregatesError: string | undefined;
    if (headroomRes.status === 'fulfilled') {
        headroomData = headroomRes.value;
    } else {
        aggregatesError = headroomRes.reason instanceof Error ? headroomRes.reason.message : String(headroomRes.reason);
        logger.warn('Failed to fetch ONTAP aggregates', { fileSystemId, err: headroomRes.reason });
    }
    const { data: snapcenterProtectedVolumeUuids, error: snapshotsError } = unwrapOntapSettled(
        snapshotsRes,
        'SnapCenter snapshots',
        fileSystemId
    );

    if (!aggregatesError) {
        logger.debug('FSx: fetched aggregates', { fileSystemId, aggregateCount: headroomData?.aggregateCount ?? 0 });
    }

    return {
        fileSystemId,
        volumesByUuid: Object.fromEntries(volumes.map(v => [v.uuid, v])),
        lunsByUuid: Object.fromEntries(luns.map(l => [l.uuid, l])),
        spaceMgmtTryFirstByName: Object.fromEntries(privateCli.map(p => [p.volume, p.space_mgmt_try_first])),
        // ONTAP's "bin0" footprint bin is the performance tier of the aggregate (bin1+ is the
        // FabricPool capacity tier), so volume_blocks_footprint_bin0_percent is the performance-tier
        // footprint percentage: https://docs.netapp.com/us-en/ontap-cli/volume-show-footprint.html
        performanceTierPercentByName: Object.fromEntries(
            footprint.map(f => [f.volume, f.volume_blocks_footprint_bin0_percent])
        ),
        snapcenterProtectedVolumeUuids: new Set(snapcenterProtectedVolumeUuids),
        headroomData,
        errors: {
            volumes: volumesError,
            luns: lunsError,
            privateCliVolumes: privateCliError,
            footprint: footprintError,
            aggregates: aggregatesError,
            snapshots: snapshotsError
        }
    };
}

function toMssqlStorageAssessment(
    ec2: Ec2WithStorage,
    fileSystemId: string,
    inventory: FsxOntapInventory
): MssqlStorageAssessment {
    const { volumeUuids, lunUuids } = getAttachedUuids(ec2, fileSystemId);

    const volumes = Object.values(inventory.volumesByUuid)
        .filter(({ uuid }) => volumeUuids.has(uuid))
        .map(
            ({ name, uuid, autosize, guarantee, space, snapshot_policy: snapshotPolicy, tiering, svm, efficiency }) => {
                const autosizeMode = autosize?.mode;
                return {
                    name,
                    uuid,
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

    // performanceTierPercentByName is keyed from volume_blocks_footprint_bin0_percent (see fetchOntapInventory),
    // ONTAP's performance-tier footprint percentage.
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

function toOracleStorageAssessment(
    ec2: Ec2WithStorage,
    fileSystemId: string,
    inventory: FsxOntapInventory
): OracleStorageAssessment {
    const { volumeUuids, lunUuids } = getAttachedUuids(ec2, fileSystemId);

    const volumesData = Object.values(inventory.volumesByUuid)
        .filter(({ uuid }) => volumeUuids.has(uuid))
        .map(
            ({
                name,
                uuid,
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

    const volumeRecords: OracleVolumeRecord[] = (
        ec2.fsxs.find(({ fileSystemId: id }) => id === fileSystemId)?.volumes ?? []
    ).flatMap(({ volumeUuid, volumeName, luns = [] }) => {
        const { svm } = inventory.volumesByUuid[volumeUuid] ?? {};
        const base = { volumeId: volumeUuid, volumeName, svmId: svm?.uuid, svmName: svm?.name };
        return luns.length > 0 ? luns.map(({ lunUuid: lunId, lunName }) => ({ ...base, lunId, lunName })) : [base];
    });

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

async function collectOntapAssessmentData(
    accountId: string,
    relationship: Ec2FsxRelationship,
    parentTaskId?: string
): Promise<FsxStorageCollectionResult[]> {
    logger.info('Collecting data for FSx ONTAP storage assessments', { accountId, ec2Count: relationship.ec2s.length });

    // Multiple EC2s can share the same FSx, each contributing its own subset of volumes/LUNs.
    // Merge them per fileSystemId so the ONTAP inventory query covers every UUID at once;
    // per-EC2 filtering still happens later in to{Mssql,Oracle}StorageAssessment.
    const allFsxs = relationship.ec2s.flatMap(({ fsxs }) => fsxs);
    const fsxByFileSystem = allFsxs.reduce<Record<string, typeof allFsxs>>((acc, fsx) => {
        (acc[fsx.fileSystemId] ??= []).push(fsx);
        return acc;
    }, {});
    const fsxQueries: FsxOntapQuery[] = Object.values(fsxByFileSystem).map(entries => {
        const { fileSystemId, fsxName, region } = entries[0];
        const volumes = entries.flatMap(({ volumes: vs }) => vs);
        return {
            fileSystemId,
            fsxName,
            region,
            volumeUuids: [...new Set(volumes.map(v => v.volumeUuid).filter(Boolean))],
            volumeNames: [...new Set(volumes.map(v => v.volumeName).filter(Boolean))],
            lunUuids: [...new Set(volumes.flatMap(({ luns = [] }) => luns.map(l => l.lunUuid)).filter(Boolean))]
        };
    });

    const inventoryList = await Promise.all(
        fsxQueries.map(
            throat(3, query =>
                parentTaskId
                    ? trackSubtask(
                          accountId,
                          parentTaskId,
                          {
                              actionName: 'Databases well-architected analysis for FSx for ONTAP file system',
                              resourceId: query.fileSystemId,
                              resourceName: query.fsxName ?? query.fileSystemId
                          },
                          () => fetchOntapInventory(accountId, query)
                      )
                    : fetchOntapInventory(accountId, query)
            )
        )
    );
    const inventoryByFsx = Object.fromEntries(inventoryList.map(inv => [inv.fileSystemId, inv]));

    const results: FsxStorageCollectionResult[] = relationship.ec2s.flatMap(ec2 =>
        ec2.fsxs.flatMap(({ fileSystemId, fsxName }) => {
            const inventory = inventoryByFsx[fileSystemId];

            return ec2.workloadTypes.map(workloadType => ({
                instanceId: ec2.instanceId,
                fileSystemId,
                fsxName,
                workloadType,
                storageAssessment:
                    workloadType === 'mssql'
                        ? toMssqlStorageAssessment(ec2, fileSystemId, inventory)
                        : toOracleStorageAssessment(ec2, fileSystemId, inventory),
                headroomData: inventory.headroomData,
                snapcenterData: buildWadSnapcenterData(ec2, fileSystemId, inventory)
            }));
        })
    );

    logger.info('Collected data for FSx ONTAP storage assessments', { accountId, resultCount: results.length });

    return results;
}

export {
    collectOntapAssessmentData,
    collectOntapHeadroomData,
    AggregateHeadroomData,
    FsxStorageCollectionResult,
    WadSnapcenterData
};
