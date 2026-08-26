import throat from 'throat';
import { DATABASE_TYPE } from '@prisma/client';
import { OntapLunRecord, OntapVolumeRecord, unwrapOntapSettled } from '../../lib/ontap/ontap-gateway';
import { OracleVolumeRecord } from '../workloads/oracle/common-types';
import getLogger from '../../utils/logger';
import { trackSubtask } from '../cloud-manager/tracker-operations';
import { fetchOntapSimulatorRecords } from '../../lib/cloud-manager/fsx-simulator-client';
import {
    listSimulatedFsxFileSystems,
    listSimulatedFsxOntapCredentials,
    listSimulatedFsxVolumes,
    type SimulatedFsxFileSystem,
    type SimulatedFsxVolume
} from '../cloud-manager/fsx-simulator-operations';
import {
    AGGREGATE_FIELDS,
    LUN_FIELDS,
    VOLUME_FIELDS,
    computeHeadroomData,
    buildWadSnapcenterDataFromUuids,
    toMssqlStorageAssessmentFromUuids,
    toOracleStorageAssessmentFromUuids,
    type FsxOntapInventory,
    type FsxOntapQuery,
    type FsxStorageCollectionResult,
    type OntapAggregateRecord,
    type OntapSnapshotRecord
} from './ontap-storage-assessment';

const logger = getLogger();

interface OntapSimulatorCredentials {
    /** Management LIF the ONTAP simulator is addressed by, when the registered credentials carry one. */
    ip?: string;
    userName: string;
    password: string;
}

async function collectFilteredOntapSimulatorRecords<T extends { uuid: string }>(
    managementHost: string,
    fileSystemId: string,
    credentials: OntapSimulatorCredentials,
    ontapPath: string,
    uuids: string[],
    fields: string
): Promise<T[]> {
    logger.info('Collecting filtered ONTAP simulator records', { fileSystemId, ontapPath, uuidCount: uuids.length });
    if (uuids.length === 0) {
        logger.debug('Skipping filtered ONTAP simulator collection, no UUIDs', { fileSystemId, ontapPath });
        return [];
    }

    let records = await fetchOntapSimulatorRecords<T>(managementHost, fileSystemId, credentials, ontapPath, {
        fields,
        uuid: uuids.join('|')
    });
    if (records.length === 0) {
        records = await fetchOntapSimulatorRecords<T>(managementHost, fileSystemId, credentials, ontapPath, {
            fields
        });
    }
    const requestedUuids = new Set(uuids);
    const filtered = records.filter(({ uuid }) => requestedUuids.has(uuid));
    logger.info('Collected filtered ONTAP simulator records', {
        fileSystemId,
        ontapPath,
        recordCount: filtered.length
    });
    return filtered;
}

async function collectOntapSimulatorSnapshots(
    managementHost: string,
    fileSystemId: string,
    credentials: OntapSimulatorCredentials,
    volumeUuids: string[]
) {
    const settled = await Promise.allSettled(
        volumeUuids.map(
            throat(3, async uuid => ({
                uuid,
                hasSnapshots:
                    (
                        await fetchOntapSimulatorRecords<OntapSnapshotRecord>(
                            managementHost,
                            fileSystemId,
                            credentials,
                            `api/storage/volumes/${uuid}/snapshots`,
                            { comment: 'creator=snapcenter', max_records: 1 }
                        )
                    ).length > 0
            }))
        )
    );

    return settled.flatMap(result =>
        result.status === 'fulfilled' && result.value.hasSnapshots ? [result.value.uuid] : []
    );
}

async function fetchSimulatedOntapInventory(
    query: FsxOntapQuery,
    fileSystem: SimulatedFsxFileSystem,
    credentials: OntapSimulatorCredentials
): Promise<FsxOntapInventory> {
    const { fileSystemId, region, volumeUuids, lunUuids } = query;
    logger.info('FSx: fetching simulated ONTAP inventory', { fileSystemId, region });
    const managementHost =
        credentials.ip ??
        fileSystem.endpoints?.management?.dnsName ??
        fileSystem.endpoints?.management?.DNSName ??
        `management.${fileSystemId}.fsx.${region}.amazonaws.com`;
    const [volumesRes, lunsRes, aggregatesRes] = await Promise.allSettled([
        volumeUuids.length === 0
            ? fetchOntapSimulatorRecords<OntapVolumeRecord>(
                  managementHost,
                  fileSystemId,
                  credentials,
                  'api/storage/volumes',
                  { fields: VOLUME_FIELDS }
              )
            : collectFilteredOntapSimulatorRecords<OntapVolumeRecord>(
                  managementHost,
                  fileSystemId,
                  credentials,
                  'api/storage/volumes',
                  volumeUuids,
                  VOLUME_FIELDS
              ),
        lunUuids.length === 0
            ? fetchOntapSimulatorRecords<OntapLunRecord>(
                  managementHost,
                  fileSystemId,
                  credentials,
                  'api/storage/luns',
                  { fields: LUN_FIELDS }
              )
            : collectFilteredOntapSimulatorRecords<OntapLunRecord>(
                  managementHost,
                  fileSystemId,
                  credentials,
                  'api/storage/luns',
                  lunUuids,
                  LUN_FIELDS
              ),
        fetchOntapSimulatorRecords<OntapAggregateRecord>(
            managementHost,
            fileSystemId,
            credentials,
            'api/storage/aggregates',
            { fields: AGGREGATE_FIELDS }
        )
    ]);
    const { data: volumes, error: volumesError } = unwrapOntapSettled(volumesRes, 'volumes', fileSystemId);
    const { data: luns, error: lunsError } = unwrapOntapSettled(lunsRes, 'LUNs', fileSystemId);
    const { data: aggregates, error: aggregatesError } = unwrapOntapSettled(aggregatesRes, 'aggregates', fileSystemId);
    const snapshotVolumeUuids = volumeUuids.length > 0 ? volumeUuids : volumes.map(volume => volume.uuid);
    const snapshotsRes = await Promise.allSettled([
        collectOntapSimulatorSnapshots(managementHost, fileSystemId, credentials, snapshotVolumeUuids)
    ]);
    const { data: snapcenterProtectedVolumeUuids, error: snapshotsError } = unwrapOntapSettled(
        snapshotsRes[0],
        'SnapCenter snapshots',
        fileSystemId
    );

    return {
        fileSystemId,
        volumesByUuid: Object.fromEntries(volumes.map(volume => [volume.uuid, volume])),
        lunsByUuid: Object.fromEntries(luns.map(lun => [lun.uuid, lun])),
        spaceMgmtTryFirstByName: {},
        performanceTierPercentByName: {},
        snapcenterProtectedVolumeUuids: new Set(snapcenterProtectedVolumeUuids),
        headroomData: computeHeadroomData(aggregates),
        errors: {
            volumes: volumesError,
            luns: lunsError,
            aggregates: aggregatesError,
            snapshots: snapshotsError
        }
    };
}

function isFsxAvailable(fileSystem: SimulatedFsxFileSystem): boolean {
    const status = typeof fileSystem.status === 'string' ? fileSystem.status : fileSystem.status?.status;
    return (status ?? 'AVAILABLE').toUpperCase() === 'AVAILABLE';
}

function volumeInventoryFromFsxVolumes(volumes: SimulatedFsxVolume[]) {
    const scopedVolumes = volumes
        .map(volume => ({
            volumeUuid: volume.uuid ?? '',
            volumeName: volume.name ?? '',
            luns: (volume.lunMaps ?? [])
                .map(({ lun }) => ({
                    lunUuid: lun?.uuid ?? '',
                    lunName: lun?.name ?? ''
                }))
                .filter(({ lunUuid }) => Boolean(lunUuid))
        }))
        .filter(({ volumeUuid }) => Boolean(volumeUuid));

    return {
        scopedVolumes,
        volumeUuids: [...new Set(scopedVolumes.map(({ volumeUuid }) => volumeUuid))],
        volumeNames: [...new Set(scopedVolumes.map(({ volumeName }) => volumeName).filter(Boolean))],
        lunUuids: [...new Set(scopedVolumes.flatMap(({ luns }) => luns.map(({ lunUuid }) => lunUuid)))],
        // DescribeVolumes returns both ids: VolumeId (fsvol-…) is what the storage service UI shows,
        // OntapConfiguration.UUID is what every ONTAP REST call and drift record is keyed by.
        fsxVolumeIdByUuid: Object.fromEntries(
            volumes.flatMap(({ uuid, id }) => (uuid && id ? [[uuid, id] as const] : []))
        )
    };
}

function buildSimulatedStorageCollectionResults(
    fileSystemId: string,
    fsxName: string | undefined,
    inventory: FsxOntapInventory,
    scopedVolumes: Array<{ volumeUuid: string; volumeName: string; luns: Array<{ lunUuid: string; lunName: string }> }>,
    volumeUuids: string[],
    lunUuids: string[],
    fsxVolumeIdByUuid: Record<string, string>
): FsxStorageCollectionResult[] {
    const volumeUuidSet = new Set(volumeUuids);
    const lunUuidSet = lunUuids.length > 0 ? new Set(lunUuids) : new Set(Object.keys(inventory.lunsByUuid));
    const volumeRecords: OracleVolumeRecord[] = scopedVolumes.flatMap(({ volumeUuid, volumeName, luns }) => {
        const { svm } = inventory.volumesByUuid[volumeUuid] ?? {};
        const base = {
            volumeId: volumeUuid,
            volumeName: volumeName || inventory.volumesByUuid[volumeUuid]?.name,
            svmId: svm?.uuid,
            svmName: svm?.name
        };
        return luns.length > 0 ? luns.map(({ lunUuid: lunId, lunName }) => ({ ...base, lunId, lunName })) : [base];
    });

    return [DATABASE_TYPE.mssql, DATABASE_TYPE.oracle].map(workloadType => ({
        instanceId: '',
        fileSystemId,
        fsxName,
        workloadType,
        storageAssessment:
            workloadType === DATABASE_TYPE.mssql
                ? toMssqlStorageAssessmentFromUuids(fileSystemId, inventory, volumeUuidSet, lunUuidSet)
                : toOracleStorageAssessmentFromUuids(fileSystemId, inventory, volumeUuidSet, lunUuidSet, volumeRecords),
        headroomData: inventory.headroomData,
        snapcenterData: buildWadSnapcenterDataFromUuids(volumeUuids, inventory),
        fsxVolumeIdByUuid
    }));
}

async function collectSimulatedOntapAssessmentData(
    accountId: string,
    credentialsId: string,
    region: string,
    parentTaskId?: string
): Promise<FsxStorageCollectionResult[]> {
    logger.info('Collecting simulated FSx ONTAP storage assessments', {
        accountId,
        credentialsId,
        region
    });

    const fileSystems = (await listSimulatedFsxFileSystems(accountId, credentialsId, region)).filter(isFsxAvailable);

    const results = (
        await Promise.all(
            fileSystems.map(
                throat(3, async fileSystem => {
                    const collect = async () => {
                        const fsxVolumes = await listSimulatedFsxVolumes(
                            accountId,
                            credentialsId,
                            region,
                            fileSystem.id
                        );
                        const { scopedVolumes, volumeUuids, volumeNames, lunUuids, fsxVolumeIdByUuid } =
                            volumeInventoryFromFsxVolumes(fsxVolumes);
                        const ontapCredentials = await listSimulatedFsxOntapCredentials(accountId, fileSystem.id);
                        if (!ontapCredentials) {
                            logger.warn(
                                'Skipping simulated ONTAP collection; no ONTAP credential is registered ' +
                                    'against the file system in the Credentials service',
                                { fileSystemId: fileSystem.id }
                            );
                            return [];
                        }
                        const inventory = await fetchSimulatedOntapInventory(
                            {
                                fileSystemId: fileSystem.id,
                                fsxName: fileSystem.name,
                                region,
                                volumeUuids,
                                volumeNames,
                                lunUuids
                            },
                            fileSystem,
                            ontapCredentials.credentials
                        );
                        const resolvedVolumeUuids =
                            volumeUuids.length > 0 ? volumeUuids : Object.keys(inventory.volumesByUuid);
                        const resolvedScopedVolumes =
                            scopedVolumes.length > 0
                                ? scopedVolumes
                                : resolvedVolumeUuids.map(volumeUuid => ({
                                      volumeUuid,
                                      volumeName: inventory.volumesByUuid[volumeUuid]?.name ?? '',
                                      luns: []
                                  }));
                        return buildSimulatedStorageCollectionResults(
                            fileSystem.id,
                            fileSystem.name,
                            inventory,
                            resolvedScopedVolumes,
                            resolvedVolumeUuids,
                            lunUuids,
                            fsxVolumeIdByUuid
                        );
                    };

                    return parentTaskId
                        ? trackSubtask(
                              accountId,
                              parentTaskId,
                              {
                                  actionName: 'Databases well-architected analysis for FSx for ONTAP file system',
                                  resourceId: fileSystem.id,
                                  resourceName: fileSystem.id
                              },
                              collect,
                              true
                          )
                        : collect();
                })
            )
        )
    ).flat();

    logger.info('Collected simulated FSx ONTAP storage assessments', {
        accountId,
        resultCount: results.length
    });
    return results;
}

export { collectSimulatedOntapAssessmentData };
