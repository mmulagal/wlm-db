import { compact, uniq, uniqBy } from 'lodash-es';
import throat from 'throat';

import { WorkloadInstance } from '../../../utils/common-types';
import { STORAGE_PROTOCOLS } from '../../../utils/consts';
import {
    buildOntapProxyBase,
    collectAllOntapRecords,
    collectOntapRecordsBatched,
    unwrapOntapSettled,
    type ProxyOperationBaseOpts
} from '../../../lib/ontap/ontap-gateway';
import getLogger from '../../../utils/logger';

const logger = getLogger();

const VOLUME_FIELDS =
    'svm,nas.path,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,space.snapshot.autodelete.delete_order,snapshot_policy,tiering,guarantee,efficiency';
const SPACE_MGMT_TRY_FIRST_FIELDS = 'space-mgmt-try-first';
const LUN_FIELDS = 'space.guarantee.requested,space.scsi_thin_provisioning_support_enabled,os_type';
const NFS_SERVICE_FIELDS = 'protocol.v4_id_domain,protocol.v40_enabled,protocol.v41_enabled';
const NFS_ROOTONLY_FIELDS = 'nfs_rootonly';
const VOLUME_BY_NAME_FIELDS = 'uuid,svm.name,svm.uuid,nas.export_policy.name';
const EXPORT_POLICY_FIELDS = 'rules.superuser,rules.allow_suid,rules.clients.match';

interface OntapVolumeRecord {
    name: string;
    uuid: string;
    nas?: { path?: string };
    guarantee?: { honored?: boolean; type?: string };
    autosize?: { mode?: string };
    space?: {
        fractional_reserve?: number;
        snapshot?: { reserve_percent?: number; autodelete?: { enabled?: boolean; delete_order?: string } };
    };
    snapshot_policy?: { name?: string };
    tiering?: { policy?: string; min_cooling_days?: number };
    svm?: { name?: string };
    efficiency?: {
        compression?: string;
        compression_type?: string;
        compaction?: string;
        dedupe?: string;
        storage_efficiency_mode?: string;
    };
}

interface OntapPrivateCliVolumeRecord {
    volume: string;
    space_mgmt_try_first?: string;
}

interface OntapLunRecord {
    name: string;
    uuid: string;
    os_type?: string;
    space?: { guarantee?: { requested?: boolean }; scsi_thin_provisioning_support_enabled?: boolean };
}

interface OntapNfsServiceRecord {
    protocol?: { v4_id_domain?: string | null; v40_enabled?: boolean; v41_enabled?: boolean };
}

interface OntapNfsRootonlyRecord {
    vserver?: string;
    nfs_rootonly?: string;
}

interface OntapVolumeByNameRecord {
    name?: string;
    uuid?: string;
    svm?: { name?: string; uuid?: string };
    nas?: { export_policy?: { name?: string } };
}

interface OntapExportPolicyRuleRecord {
    superuser?: unknown;
    allow_suid?: boolean;
    clients?: Array<{ match?: string }>;
}

interface OntapExportPolicyRecord {
    rules?: OntapExportPolicyRuleRecord[];
}

interface DirectOntapStorageAssessmentData {
    volumesJson: string;
    lunsJson: string;
    nfsProtocolJson: string;
    nfsRootonlyJson: string;
}

interface RawBinaryVolumeRecord {
    volumeId: string;
    volumeName: string;
    oracleHome: string;
    isNfsMount: boolean;
    hasBinaries: boolean;
    mountPath: string | null;
    oracleSid: string;
    nfsInfo?: null | EnrichedBinaryVolumeRecord['nfsInfo'];
}

interface EnrichedBinaryVolumeRecord extends Omit<RawBinaryVolumeRecord, 'nfsInfo'> {
    nfsInfo?: {
        volumeId?: string;
        svmName?: string;
        svmUuid?: string;
        exportPolicyName?: string;
        rules: Array<{ clients: string[]; superuser?: unknown; allow_suid?: boolean }>;
    } | null;
}

function toStringArray(value: string | string[] | undefined): string[] {
    if (!value) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function toVolumeRow(volume: OntapVolumeRecord, spaceMgmtTryFirstByName: Record<string, string | undefined>) {
    const autosizeMode = volume.autosize?.mode;
    return {
        name: volume.name,
        uuid: volume.uuid,
        junctionPath: volume.nas?.path,
        thinProvision: volume.guarantee?.honored,
        spaceGuarantee: volume.guarantee?.type,
        autosizeMode,
        autosize: autosizeMode && autosizeMode !== 'off' ? 'on' : 'off',
        fractionalReserve: volume.space?.fractional_reserve,
        snapshotCopyReserve: volume.space?.snapshot?.reserve_percent,
        snapshotAutodelete: volume.space?.snapshot?.autodelete?.enabled,
        snapshotPolicy: volume.snapshot_policy?.name,
        tieringPolicy: volume.tiering?.policy,
        tieringMinCoolingDays: volume.tiering?.min_cooling_days,
        svmName: volume.svm?.name,
        compression: volume.efficiency?.compression,
        compressionType: volume.efficiency?.compression_type,
        compaction: volume.efficiency?.compaction,
        deduplication: volume.efficiency?.dedupe,
        efficiencyType: volume.efficiency?.storage_efficiency_mode,
        snapshotDeleteOrder: volume.space?.snapshot?.autodelete?.delete_order,
        spaceMgmtTryFirst: spaceMgmtTryFirstByName[volume.name]
    };
}

function toLunRow(lun: OntapLunRecord) {
    return {
        name: lun.name,
        uuid: lun.uuid,
        osType: lun.os_type,
        spaceReservationEnabled: lun.space?.guarantee?.requested,
        spaceAllocationAllocated: lun.space?.scsi_thin_provisioning_support_enabled
    };
}

function toNfsServiceRow(record: OntapNfsServiceRecord) {
    return {
        v4IdDomain: record.protocol?.v4_id_domain,
        v40Enabled: record.protocol?.v40_enabled,
        v41Enabled: record.protocol?.v41_enabled
    };
}

function toNfsRootonlyRow(record: OntapNfsRootonlyRecord) {
    return { svmName: record.vserver, nfsRootonly: record.nfs_rootonly };
}

/**
 * Prefetches the ONTAP data `VOLUME_LUN_CONFIGURATION` used to hit directly (`storage/volumes`,
 * `private/cli/volume`, `storage/luns`, `protocols/nfs/services`, `private/cli/vserver/nfs`) via
 * the proxy-forwarder, so the SSM script only needs to do host-side OS/Oracle checks.
 */
async function fetchDirectOntapAssessmentData(
    accountId: string,
    credentialsId: string,
    instanceRecord: WorkloadInstance
): Promise<DirectOntapStorageAssessmentData> {
    const base = await buildOntapProxyBase(
        accountId,
        credentialsId,
        instanceRecord.fsxFileSystem,
        instanceRecord.region
    );
    const volumeUuids = instanceRecord.mappedVolumesUuids ?? [];
    const volumeNames = instanceRecord.mappedVolumeNames ?? [];
    const isIscsi = instanceRecord.storageProtocol === STORAGE_PROTOCOLS.ISCSI;
    const isNfs = instanceRecord.storageProtocol === STORAGE_PROTOCOLS.NFS;
    const lunUuids = isIscsi ? instanceRecord.mappedLunUuids ?? [] : [];
    const svmUuids = toStringArray(instanceRecord.svmOntapUuid);
    const svmNames = toStringArray(instanceRecord.svmOntapName);

    logger.info('Fetching direct ONTAP storage assessment data for Oracle via proxy-forwarder', {
        accountId,
        targetId: base.targetId,
        volumeCount: volumeUuids.length,
        lunCount: lunUuids.length,
        storageProtocol: instanceRecord.storageProtocol
    });

    const [volumesRes, spaceMgmtRes, lunsRes, nfsServiceRes, nfsRootonlyRes] = await Promise.allSettled([
        volumeUuids.length === 0
            ? Promise.reject(
                  new Error(
                      'Unable to fetch ONTAP volumes details as the mapped volume UUIDs are either null or empty.'
                  )
              )
            : collectOntapRecordsBatched<OntapVolumeRecord>(base, 'api/storage/volumes', 'uuid', volumeUuids, {
                  fields: VOLUME_FIELDS
              }),
        volumeNames.length === 0
            ? Promise.reject(
                  new Error(
                      'Unable to fetch ONTAP space-mgmt-try-first details as the mapped volume names are either null or empty.'
                  )
              )
            : collectOntapRecordsBatched<OntapPrivateCliVolumeRecord>(
                  base,
                  'api/private/cli/volume',
                  'volume',
                  volumeNames,
                  {
                      fields: SPACE_MGMT_TRY_FIRST_FIELDS
                  }
              ),
        !isIscsi || lunUuids.length === 0
            ? Promise.resolve([])
            : collectOntapRecordsBatched<OntapLunRecord>(base, 'api/storage/luns', 'uuid', lunUuids, {
                  fields: LUN_FIELDS
              }),
        !isNfs || svmUuids.length === 0
            ? Promise.resolve([])
            : collectOntapRecordsBatched<OntapNfsServiceRecord>(
                  base,
                  'api/protocols/nfs/services',
                  'svm.uuid',
                  svmUuids,
                  {
                      fields: NFS_SERVICE_FIELDS
                  }
              ),
        !isNfs || svmNames.length === 0
            ? Promise.resolve([])
            : collectOntapRecordsBatched<OntapNfsRootonlyRecord>(
                  base,
                  'api/private/cli/vserver/nfs',
                  'vserver',
                  svmNames,
                  {
                      fields: NFS_ROOTONLY_FIELDS
                  }
              )
    ]);

    const { data: volumeRecords, error: volumesError } = unwrapOntapSettled(
        volumesRes,
        'volumes for Oracle storage assessment',
        base.targetId
    );

    const { data: spaceMgmtRecords } = unwrapOntapSettled(
        spaceMgmtRes,
        'space-mgmt-try-first for Oracle storage assessment',
        base.targetId
    );
    const { data: lunRecords, error: lunsFetchError } = unwrapOntapSettled(
        lunsRes,
        'luns for Oracle storage assessment',
        base.targetId
    );
    const { data: nfsServiceRecords, error: nfsServiceFetchError } = unwrapOntapSettled(
        nfsServiceRes,
        'NFS service config for Oracle storage assessment',
        base.targetId
    );

    const { data: nfsRootonlyRecords } = unwrapOntapSettled(
        nfsRootonlyRes,
        'NFS rootonly config for Oracle storage assessment',
        base.targetId
    );

    const spaceMgmtByVolumeName = Object.fromEntries(
        spaceMgmtRecords.map(record => [record.volume, record.space_mgmt_try_first])
    );

    const volumesJson = JSON.stringify({
        error: volumesError ?? '',
        filesystemId: instanceRecord.fsxFileSystem,
        data: volumeRecords.map(volume => toVolumeRow(volume, spaceMgmtByVolumeName))
    });

    const lunsJson = JSON.stringify(
        !isIscsi || lunUuids.length === 0
            ? { error: 'LUNs not applicable', data: [] }
            : {
                  error: lunRecords.length === 0 ? lunsFetchError ?? 'No lun records found in response' : '',
                  data: lunRecords.map(toLunRow)
              }
    );

    const nfsProtocolJson = JSON.stringify(
        !isNfs
            ? { error: 'NFS protocol not applicable', data: {} }
            : {
                  error:
                      nfsServiceRecords.length === 0
                          ? nfsServiceFetchError ?? 'No NFS service records found in response'
                          : '',
                  data: nfsServiceRecords[0] ? toNfsServiceRow(nfsServiceRecords[0]) : {}
              }
    );

    const nfsRootonlyJson = JSON.stringify(isNfs ? nfsRootonlyRecords.map(toNfsRootonlyRow) : []);

    return { volumesJson, lunsJson, nfsProtocolJson, nfsRootonlyJson };
}

function exportPolicyKey(svmName: string, policyName: string): string {
    return `${svmName}::${policyName}`;
}

async function resolveExportPolicies(
    base: ProxyOperationBaseOpts,
    volumes: OntapVolumeByNameRecord[]
): Promise<Map<string, OntapExportPolicyRecord>> {
    const pairs = uniqBy(
        compact(
            volumes.map(volume =>
                volume.svm?.name && volume.nas?.export_policy?.name
                    ? { svmName: volume.svm.name, policyName: volume.nas.export_policy.name }
                    : undefined
            )
        ),
        pair => exportPolicyKey(pair.svmName, pair.policyName)
    );

    const resolved = await Promise.all(
        pairs.map(
            throat(3, async ({ svmName, policyName }) => {
                try {
                    const records = await collectAllOntapRecords<OntapExportPolicyRecord>(
                        base,
                        'api/protocols/nfs/export-policies',
                        { 'svm.name': svmName, name: policyName, fields: EXPORT_POLICY_FIELDS },
                        1
                    );
                    return { key: exportPolicyKey(svmName, policyName), policy: records[0] };
                } catch (error) {
                    logger.warn('Failed to resolve export policy for Oracle binary volume', {
                        targetId: base.targetId,
                        svmName,
                        policyName,
                        err: error
                    });
                    return { key: exportPolicyKey(svmName, policyName), policy: undefined };
                }
            })
        )
    );

    return new Map(compact(resolved.map(({ key, policy }) => (policy ? ([key, policy] as const) : undefined))));
}

async function resolveBinaryVolumesNfsInfo(
    accountId: string,
    credentialsId: string,
    instanceRecord: WorkloadInstance,
    rawBinaryVolumes: RawBinaryVolumeRecord[]
): Promise<EnrichedBinaryVolumeRecord[]> {
    const nfsVolumes = rawBinaryVolumes.filter(volume => volume.isNfsMount);
    if (nfsVolumes.length === 0) {
        return rawBinaryVolumes;
    }

    const base = await buildOntapProxyBase(
        accountId,
        credentialsId,
        instanceRecord.fsxFileSystem,
        instanceRecord.region
    );
    const volumeNames = uniq(compact(nfsVolumes.map(volume => volume.volumeName)));

    let volumeRecords: OntapVolumeByNameRecord[] = [];
    try {
        volumeRecords = await collectOntapRecordsBatched<OntapVolumeByNameRecord>(
            base,
            'api/storage/volumes',
            'name',
            volumeNames,
            { fields: VOLUME_BY_NAME_FIELDS }
        );
    } catch (error) {
        logger.warn('Failed to resolve Oracle binary volume ONTAP identity by name', {
            targetId: base.targetId,
            volumeNames,
            err: error
        });
    }
    const volumeByName = new Map(
        compact(volumeRecords.map(volume => (volume.name ? ([volume.name, volume] as const) : undefined)))
    );

    const exportPolicyByKey = await resolveExportPolicies(base, [...volumeByName.values()]);

    return rawBinaryVolumes.map((volume): EnrichedBinaryVolumeRecord => {
        if (!volume.isNfsMount) {
            return volume;
        }
        const ontapVolume = volumeByName.get(volume.volumeName);
        const svmName = ontapVolume?.svm?.name;
        const exportPolicyName = ontapVolume?.nas?.export_policy?.name;
        if (!svmName || !exportPolicyName) {
            return { ...volume, nfsInfo: undefined };
        }
        const exportPolicy = exportPolicyByKey.get(exportPolicyKey(svmName, exportPolicyName));
        return {
            ...volume,
            volumeId: ontapVolume?.uuid ?? '',
            nfsInfo: {
                volumeId: ontapVolume?.uuid,
                svmName,
                svmUuid: ontapVolume?.svm?.uuid,
                exportPolicyName,
                rules: (exportPolicy?.rules ?? []).map(rule => ({
                    clients: compact((rule.clients ?? []).map(client => client.match)),
                    superuser: rule.superuser,
                    allow_suid: rule.allow_suid
                }))
            }
        };
    });
}

export {
    fetchDirectOntapAssessmentData,
    resolveBinaryVolumesNfsInfo,
    DirectOntapStorageAssessmentData,
    RawBinaryVolumeRecord
};
