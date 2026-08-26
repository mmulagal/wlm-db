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
import { OracleVolumeRecord } from '../workloads/oracle/common-types';
import getLogger from '../../utils/logger';
import {
    AGGREGATE_FIELDS,
    LUN_FIELDS,
    VOLUME_FIELDS,
    computeHeadroomData,
    buildWadSnapcenterDataFromUuids,
    toMssqlStorageAssessmentFromUuids,
    toOracleStorageAssessmentFromUuids,
    type AggregateHeadroomData,
    type FsxOntapInventory,
    type FsxOntapQuery,
    type FsxStorageCollectionResult,
    type OntapAggregateRecord,
    type OntapSnapshotRecord,
    type WadSnapcenterData
} from './ontap-storage-assessment';

const logger = getLogger();

const FOOTPRINT_FIELDS = 'volume-blocks-footprint-bin0-percent';

interface OntapPrivateCliVolumeRecord {
    volume: string;
    space_mgmt_try_first?: string;
}

interface OntapFootprintRecord {
    volume: string;
    volume_blocks_footprint_bin0_percent?: number;
}

/** Proxy-forwarded collection needs the credentials the ONTAP management LIF is reached with. */
interface FsxOntapProxyQuery extends FsxOntapQuery {
    credentialsId: string;
}

async function collectOntapHeadroomData(
    accountId: string,
    fileSystemId: string,
    region: string,
    credentialsId: string
): Promise<AggregateHeadroomData | undefined> {
    const base = await buildOntapProxyBase(accountId, credentialsId, fileSystemId, region);
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
    return buildWadSnapcenterDataFromUuids([...volumeUuids], inventory);
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
                collectAllOntapRecords<OntapSnapshotRecord>(
                    base,
                    `api/storage/volumes/${uuid}/snapshots`,
                    { comment: 'creator=snapcenter', max_records: 1, fields: 'comment' },
                    1
                ).then(records => ({ uuid, hasSnapshots: records.length > 0 }))
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

async function fetchOntapInventory(accountId: string, query: FsxOntapProxyQuery): Promise<FsxOntapInventory> {
    const { fileSystemId, region, credentialsId, volumeUuids, volumeNames, lunUuids } = query;
    logger.debug('FSx: fetching ONTAP inventory', { accountId, fileSystemId });

    const base = await buildOntapProxyBase(accountId, credentialsId, fileSystemId, region);

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
        collectOntapHeadroomData(accountId, fileSystemId, region, credentialsId),
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
    return toMssqlStorageAssessmentFromUuids(fileSystemId, inventory, volumeUuids, lunUuids);
}

function toOracleStorageAssessment(
    ec2: Ec2WithStorage,
    fileSystemId: string,
    inventory: FsxOntapInventory
): OracleStorageAssessment {
    const { volumeUuids, lunUuids } = getAttachedUuids(ec2, fileSystemId);
    const volumeRecords: OracleVolumeRecord[] = (
        ec2.fsxs.find(({ fileSystemId: id }) => id === fileSystemId)?.volumes ?? []
    ).flatMap(({ volumeUuid, volumeName, luns = [] }) => {
        const { svm } = inventory.volumesByUuid[volumeUuid] ?? {};
        const base = { volumeId: volumeUuid, volumeName, svmId: svm?.uuid, svmName: svm?.name };
        return luns.length > 0 ? luns.map(({ lunUuid: lunId, lunName }) => ({ ...base, lunId, lunName })) : [base];
    });
    return toOracleStorageAssessmentFromUuids(fileSystemId, inventory, volumeUuids, lunUuids, volumeRecords);
}

function buildFsxOntapQueries(relationship: Ec2FsxRelationship, credentialsId: string): FsxOntapProxyQuery[] {
    const allFsxs = relationship.ec2s.flatMap(({ fsxs }) => fsxs);
    const fsxByFileSystem = allFsxs.reduce<Record<string, typeof allFsxs>>((acc, fsx) => {
        (acc[fsx.fileSystemId] ??= []).push(fsx);
        return acc;
    }, {});

    return Object.values(fsxByFileSystem).map(entries => {
        const { fileSystemId, fsxName, region } = entries[0];
        const volumes = entries.flatMap(({ volumes: attachedVolumes }) => attachedVolumes);
        return {
            fileSystemId,
            fsxName,
            region,
            credentialsId,
            volumeUuids: [...new Set(volumes.map(volume => volume.volumeUuid).filter(Boolean))],
            volumeNames: [...new Set(volumes.map(volume => volume.volumeName).filter(Boolean))],
            lunUuids: [...new Set(volumes.flatMap(({ luns = [] }) => luns.map(lun => lun.lunUuid)).filter(Boolean))]
        };
    });
}

function buildStorageCollectionResults(
    relationship: Ec2FsxRelationship,
    inventoryByFsx: Record<string, FsxOntapInventory>
): FsxStorageCollectionResult[] {
    return relationship.ec2s.flatMap(ec2 =>
        ec2.fsxs.flatMap(({ fileSystemId, fsxName }) => {
            const inventory = inventoryByFsx[fileSystemId];
            if (!inventory) {
                return [];
            }

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
}

async function collectOntapAssessmentData(
    accountId: string,
    credentialsId: string,
    relationship: Ec2FsxRelationship,
    parentTaskId?: string
): Promise<FsxStorageCollectionResult[]> {
    logger.info('Collecting data for FSx ONTAP storage assessments', { accountId, ec2Count: relationship.ec2s.length });

    // Multiple EC2s can share the same FSx, each contributing its own subset of volumes/LUNs.
    // Merge them per fileSystemId so the ONTAP inventory query covers every UUID at once;
    // per-EC2 filtering still happens later in to{Mssql,Oracle}StorageAssessment.
    const fsxQueries = buildFsxOntapQueries(relationship, credentialsId);

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

    const results = buildStorageCollectionResults(relationship, inventoryByFsx);

    logger.info('Collected data for FSx ONTAP storage assessments', { accountId, resultCount: results.length });

    return results;
}

export {
    collectOntapAssessmentData,
    collectOntapHeadroomData,
    type AggregateHeadroomData,
    type FsxStorageCollectionResult,
    type WadSnapcenterData
};
