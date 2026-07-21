import throat from 'throat';
import { Ec2FsxRelationship, Ec2WithStorage } from '../cloud-manager/tagging-service-operations';
import { collectOntapRecordsBatched } from '../../lib/ontap/ontap-gateway';
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

const VOLUME_FIELDS =
    'name,uuid,svm,nas.path,autosize,space.fractional_reserve,space.snapshot.reserve_percent,' +
    'space.snapshot.autodelete.enabled,space.snapshot.autodelete.delete_order,snapshot_policy,' +
    'tiering,guarantee,efficiency';

const LUN_FIELDS = 'name,uuid,os_type,space.guarantee.requested,space.scsi_thin_provisioning_support_enabled';

interface OntapVolumeRecord {
    name: string;
    uuid: string;
    svm?: { name?: string; uuid?: string };
    nas?: { path?: string };
    autosize?: { mode?: string };
    space?: {
        fractional_reserve?: number;
        snapshot?: {
            reserve_percent?: number;
            autodelete?: { enabled?: boolean; delete_order?: string };
        };
    };
    snapshot_policy?: { name?: string };
    tiering?: { policy?: string; min_cooling_days?: number };
    guarantee?: { honored?: boolean; type?: string };
    efficiency?: {
        compression?: string;
        compression_type?: string;
        compaction?: string;
        dedupe?: string;
        storage_efficiency_mode?: string;
    };
}

interface OntapLunRecord {
    name: string;
    uuid: string;
    os_type?: string;
    space?: {
        guarantee?: { requested?: boolean };
        scsi_thin_provisioning_support_enabled?: boolean;
    };
}

interface OntapPrivateCliVolumeRecord {
    volume: string;
    space_mgmt_try_first?: string;
}

interface FsxOntapInventory {
    fileSystemId: string;
    volumesByUuid: Record<string, OntapVolumeRecord>;
    lunsByUuid: Record<string, OntapLunRecord>;
    spaceMgmtTryFirstByName: Record<string, string | undefined>;
    errors: {
        volumes?: string;
        luns?: string;
        privateCliVolumes?: string;
    };
}

interface FsxOntapQuery {
    fileSystemId: string;
    region: string;
    volumeUuids: string[];
    volumeNames: string[];
    lunUuids: string[];
}

interface FsxStorageCollectionResult {
    instanceId: string;
    fileSystemId: string;
    workloadType: string;
    storageAssessment: MssqlStorageAssessment | OracleStorageAssessment;
}

function getAttachedUuids(ec2: Ec2WithStorage, fileSystemId: string) {
    const volumes = ec2.fsxs.find(fsx => fsx.fileSystemId === fileSystemId)?.volumes ?? [];
    return {
        volumeUuids: new Set(volumes.map(v => v.volumeUuid)),
        lunUuids: new Set(volumes.flatMap(({ luns }) => luns.map(l => l.lunUuid)))
    };
}

async function fetchOntapInventory(accountId: string, query: FsxOntapQuery): Promise<FsxOntapInventory> {
    const { fileSystemId, region, volumeUuids, volumeNames, lunUuids } = query;
    logger.debug('FSx: fetching ONTAP inventory', { accountId, fileSystemId });

    const endpoint = `management.${fileSystemId}.fsx.${region}.amazonaws.com`;
    const base = { accountId, targetId: fileSystemId, endpoint };

    const [volumesRes, lunsRes, privateCliRes] = await Promise.allSettled([
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
              )
    ]);

    const errors: FsxOntapInventory['errors'] = {};
    const volumes = volumesRes.status === 'fulfilled' ? volumesRes.value : [];
    const luns = lunsRes.status === 'fulfilled' ? lunsRes.value : [];
    const privateCli = privateCliRes.status === 'fulfilled' ? privateCliRes.value : [];

    if (volumesRes.status === 'rejected') {
        logger.warn('FSx: failed to fetch volumes', { fileSystemId, err: volumesRes.reason });
        errors.volumes = String(volumesRes.reason);
    }

    if (lunsRes.status === 'rejected') {
        logger.warn('FSx: failed to fetch LUNs', { fileSystemId, err: lunsRes.reason });
        errors.luns = String(lunsRes.reason);
    }

    if (privateCliRes.status === 'rejected') {
        logger.warn('FSx: failed to fetch private CLI volumes', { fileSystemId, err: privateCliRes.reason });
        errors.privateCliVolumes = String(privateCliRes.reason);
    }

    return {
        fileSystemId,
        volumesByUuid: Object.fromEntries(volumes.map(v => [v.uuid, v])),
        lunsByUuid: Object.fromEntries(luns.map(l => [l.uuid, l])),
        spaceMgmtTryFirstByName: Object.fromEntries(privateCli.map(p => [p.volume, p.space_mgmt_try_first])),
        errors
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
                    'efficiency-type': efficiency?.storage_efficiency_mode
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

    return {
        filesystemId: fileSystemId,
        volumes: volumes as unknown as MssqlStorageAssessment['volumes'],
        luns: luns as unknown as MssqlStorageAssessment['luns'],
        os: [] as unknown as MssqlStorageAssessment['os'],
        layout: undefined as unknown as MssqlStorageAssessment['layout'],
        sizing: undefined as unknown as MssqlStorageAssessment['sizing'],
        errors: {
            volumes: inventory.errors.volumes ?? '',
            luns: inventory.errors.luns ?? '',
            'volumes-footprint': HOST_SIDE_NOT_COLLECTED,
            layout: HOST_SIDE_NOT_COLLECTED,
            sizing: HOST_SIDE_NOT_COLLECTED,
            'mpio-policy': HOST_SIDE_NOT_COLLECTED,
            'iscsi-sessions': HOST_SIDE_NOT_COLLECTED,
            'ntfs-allocation': HOST_SIDE_NOT_COLLECTED,
            'tempdb-files-location': HOST_SIDE_NOT_COLLECTED,
            'default-log-files-location': HOST_SIDE_NOT_COLLECTED,
            'default-data-files-location': HOST_SIDE_NOT_COLLECTED,
            'data-tempdb-drive-details': HOST_SIDE_NOT_COLLECTED
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
    ).flatMap(({ volumeUuid, volumeName, luns }) => {
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
    relationship: Ec2FsxRelationship
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
        const { fileSystemId, region } = entries[0];
        const volumes = entries.flatMap(({ volumes: vs }) => vs);
        return {
            fileSystemId,
            region,
            volumeUuids: [...new Set(volumes.map(v => v.volumeUuid).filter(Boolean))],
            volumeNames: [...new Set(volumes.map(v => v.volumeName).filter(Boolean))],
            lunUuids: [...new Set(volumes.flatMap(({ luns }) => luns.map(l => l.lunUuid)).filter(Boolean))]
        };
    });

    const inventoryList = await Promise.all(fsxQueries.map(throat(3, query => fetchOntapInventory(accountId, query))));
    const inventoryByFsx = Object.fromEntries(inventoryList.map(inv => [inv.fileSystemId, inv]));

    const results: FsxStorageCollectionResult[] = relationship.ec2s.flatMap(ec2 =>
        ec2.fsxs.flatMap(({ fileSystemId }) => {
            const inventory = inventoryByFsx[fileSystemId];

            return ec2.workloadTypes.map(workloadType => ({
                instanceId: ec2.instanceId,
                fileSystemId,
                workloadType,
                storageAssessment:
                    workloadType === 'mssql'
                        ? toMssqlStorageAssessment(ec2, fileSystemId, inventory)
                        : toOracleStorageAssessment(ec2, fileSystemId, inventory)
            }));
        })
    );

    logger.info('Collected data for FSx ONTAP storage assessments', { accountId, resultCount: results.length });

    return results;
}

export { collectOntapAssessmentData, FsxStorageCollectionResult };
