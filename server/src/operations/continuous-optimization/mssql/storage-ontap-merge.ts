import { WorkloadInstance } from '../../../utils/common-types';
import {
    buildOntapProxyBase,
    collectOntapRecordsBatched,
    extractErrorMessage,
    unwrapOntapSettled,
    OntapLunRecord,
    OntapVolumeRecord
} from '../../../lib/ontap/ontap-gateway';
import { DirectOntapAssessmentData } from '../../workloads/mssql/storage-scripts';
import getLogger from '../../../utils/logger';

const logger = getLogger();

const VOLUME_FIELDS =
    'svm,autosize,space.fractional_reserve,space.snapshot.reserve_percent,space.snapshot.autodelete.enabled,snapshot_policy,tiering,guarantee,efficiency';
const FOOTPRINT_FIELDS = 'volume-blocks-footprint-bin0-percent';
const LUN_FIELDS = 'space.guarantee.requested,space.scsi_thin_provisioning_support_enabled,os_type';
const LUN_BY_SERIAL_FIELDS = 'svm.name,location.volume.*';
const SPACE_MGMT_TRY_FIRST_FIELDS = 'space-mgmt-try-first';

interface OntapFootprintRecord {
    volume: string;
    volume_blocks_footprint_bin0_percent?: number;
}

interface OntapPrivateCliVolumeRecord {
    volume: string;
    space_mgmt_try_first?: string;
}

interface OntapLunBySerialRecord {
    name: string;
    uuid: string;
    serial_number?: string;
    svm?: { name?: string };
    location?: { volume?: { name?: string; uuid?: string } };
}

interface RawDriveRecord {
    name?: string;
    lunSerialNumber?: string;
    sizeInMb?: number;
    diskNumber?: number;
    accessPaths?: string[];
    driveLetter?: string;
}

interface RawDriveDetails {
    data?: RawDriveRecord[];
    log?: RawDriveRecord[];
    tempDb?: RawDriveRecord[];
    error?: string;
}

interface EnrichedDriveRecord extends RawDriveRecord {
    lunPath?: string;
    lunUuid?: string;
    ontapVolumeName?: string;
    ontapVolumeUuid?: string;
    svmName?: string;
}

interface AllDriveDetailRow {
    databaseName: string;
    dataDriveLetter: string;
    dataDriveTotalSizeMB: number;
    logDriveLetter?: string;
    logDriveTotalSizeMB?: number;
}

interface DefaultTempDbDriveRow {
    tempdbDriveLetter: string;
    tempdbDrivePath?: string;
    tempdbDriveTotalSizeMB: number;
    dataDriveLetter?: string;
    dataDriveTotalSizeMB?: number;
}

interface RawStorageLayoutInputs {
    allDriveDetails: AllDriveDetailRow[];
    defaultTempDBDriveDetails: DefaultTempDbDriveRow[];
    serialKeyedDriveDetails: RawDriveDetails;
}

function buildInstanceOntapProxyBase(accountId: string, instanceRecord: WorkloadInstance) {
    const { fsxFileSystem: targetId, region } = instanceRecord;
    return buildOntapProxyBase(accountId, targetId, region);
}

function toVolumeRow(volume: OntapVolumeRecord, spaceMgmtTryFirstByName: Record<string, string | undefined>) {
    const autosizeMode = volume.autosize?.mode;
    return {
        name: volume.name,
        uuid: volume.uuid,
        'thin-provision': volume.guarantee?.honored,
        'space-guarantee': volume.guarantee?.type,
        'autosize-mode': autosizeMode,
        autosize: autosizeMode && autosizeMode !== 'off' ? 'on' : 'off',
        'fractional-reserve': volume.space?.fractional_reserve,
        'snapshot-copy-reserve': volume.space?.snapshot?.reserve_percent,
        'snapshot-autodelete': volume.space?.snapshot?.autodelete?.enabled,
        'snapshot-policy': volume.snapshot_policy?.name,
        'tiering-policy': volume.tiering?.policy,
        'tiering-min-cooling-days': volume.tiering?.min_cooling_days,
        compression: volume.efficiency?.compression,
        compressionType: volume.efficiency?.compression_type,
        deduplication: volume.efficiency?.dedupe,
        compaction: volume.efficiency?.compaction,
        'space-mgmt-try-first': spaceMgmtTryFirstByName[volume.name]
    };
}

function toFootprintRow(footprint: OntapFootprintRecord) {
    return { volumeName: footprint.volume, performanceTierPercent: footprint.volume_blocks_footprint_bin0_percent };
}

function toLunRow(lun: OntapLunRecord) {
    return {
        name: lun.name,
        'os-type': lun.os_type,
        'space-reservation-enabled': lun.space?.guarantee?.requested,
        'space-allocation-allocated': lun.space?.scsi_thin_provisioning_support_enabled
    };
}

async function fetchDirectOntapAssessmentData(
    accountId: string,
    instanceRecord: WorkloadInstance
): Promise<DirectOntapAssessmentData> {
    const base = buildInstanceOntapProxyBase(accountId, instanceRecord);
    const volumeUuids = instanceRecord.mappedVolumesUuids ?? [];
    const volumeNames = instanceRecord.mappedVolumeNames ?? [];
    const lunNames = instanceRecord.mappedLunNames ?? [];
    const svmUuid = Array.isArray(instanceRecord.svmOntapUuid)
        ? instanceRecord.svmOntapUuid[0]
        : instanceRecord.svmOntapUuid;

    logger.info('Fetching direct ONTAP storage assessment data via proxy-forwarder', {
        accountId,
        targetId: base.targetId,
        volumeCount: volumeUuids.length,
        lunCount: lunNames.length
    });

    const [volumesRes, footprintRes, lunsRes, spaceMgmtTryFirstRes] = await Promise.allSettled([
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
                      'Unable to fetch ONTAP volumes details as the mapped volume names are either null or empty.'
                  )
              )
            : collectOntapRecordsBatched<OntapFootprintRecord>(
                  base,
                  'api/private/cli/volume/show-footprint',
                  'volume',
                  volumeNames,
                  { fields: FOOTPRINT_FIELDS }
              ),
        lunNames.length === 0
            ? Promise.reject(
                  new Error('Unable to fetch ONTAP lun details as the mapped lun names are either null or empty.')
              )
            : collectOntapRecordsBatched<OntapLunRecord>(base, 'api/storage/luns', 'name', lunNames, {
                  fields: LUN_FIELDS,
                  ...(svmUuid ? { 'svm.uuid': svmUuid } : {})
              }),
        // space-mgmt-try-first is only exposed via the private CLI endpoint, not the storage/volumes API.
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
                  { fields: SPACE_MGMT_TRY_FIRST_FIELDS }
              )
    ]);

    const { data: volumes, error: volumesError } = unwrapOntapSettled(
        volumesRes,
        'volumes for storage assessment',
        base.targetId
    );
    const { data: footprint, error: sizingError } = unwrapOntapSettled(
        footprintRes,
        'volume footprint for storage assessment',
        base.targetId
    );
    const { data: luns, error: lunsError } = unwrapOntapSettled(lunsRes, 'luns for storage assessment', base.targetId);
    const { data: spaceMgmtTryFirstRecords, error: spaceMgmtTryFirstError } = unwrapOntapSettled(
        spaceMgmtTryFirstRes,
        'space-mgmt-try-first for storage assessment',
        base.targetId
    );
    const spaceMgmtTryFirstByName = Object.fromEntries(
        spaceMgmtTryFirstRecords.map(record => [record.volume, record.space_mgmt_try_first])
    );

    const errors: DirectOntapAssessmentData['errors'] = {
        ...(volumesError ? { volumes: volumesError } : {}),
        ...(sizingError ? { sizing: sizingError } : {}),
        ...(lunsError ? { luns: lunsError } : {}),
        ...(spaceMgmtTryFirstError ? { spaceMgmtTryFirst: spaceMgmtTryFirstError } : {})
    };

    return {
        volumesJson: JSON.stringify(volumes.map(volume => toVolumeRow(volume, spaceMgmtTryFirstByName))),
        performanceTierJson: JSON.stringify(footprint.map(toFootprintRow)),
        lunsJson: JSON.stringify(luns.map(toLunRow)),
        errors
    };
}

/**
 * The 4th ONTAP call (previously `Get-LunFromSerialNumber` inside `DATABASE_VOLUME_LUN_DETAILS`) -
 * looks up LUNs by the disk serial numbers the host discovered locally via WMI/`Get-Disk`.
 */
async function fetchLunsBySerialNumbers(
    accountId: string,
    instanceRecord: WorkloadInstance,
    serialNumbers: string[]
): Promise<{ luns: OntapLunBySerialRecord[]; error?: string }> {
    if (serialNumbers.length === 0) {
        return { luns: [] };
    }
    const base = buildInstanceOntapProxyBase(accountId, instanceRecord);
    try {
        const luns = await collectOntapRecordsBatched<OntapLunBySerialRecord>(
            base,
            'api/storage/luns',
            'serial_number',
            serialNumbers,
            { fields: LUN_BY_SERIAL_FIELDS }
        );
        if (luns.length === 0) {
            throw new Error('Unable to fetch lun details for the serial numbers.');
        }
        return { luns };
    } catch (error) {
        logger.warn('Failed to fetch ONTAP luns by serial number', { targetId: base.targetId, err: error });
        return { luns: [], error: extractErrorMessage(error) };
    }
}

function enrichDrives(drives: RawDriveRecord[] | undefined, lunBySerial: Map<string, OntapLunBySerialRecord>) {
    return (drives ?? []).map((drive): EnrichedDriveRecord => {
        const lun = drive.lunSerialNumber ? lunBySerial.get(drive.lunSerialNumber) : undefined;
        if (!lun) {
            return { ...drive };
        }
        return {
            ...drive,
            lunPath: lun.name,
            lunUuid: lun.uuid,
            ontapVolumeName: lun.location?.volume?.name,
            ontapVolumeUuid: lun.location?.volume?.uuid,
            svmName: lun.svm?.name
        };
    });
}

/** TS port of `Get-LunFromSerialNumber`'s matching logic: attach ONTAP identity by disk serial number. */
function enrichRawDriveDetailsWithOntapIdentity(
    rawDriveDetails: RawDriveDetails,
    lunsBySerial: OntapLunBySerialRecord[]
) {
    const lunBySerial = new Map(
        lunsBySerial.filter(lun => lun.serial_number).map(lun => [lun.serial_number as string, lun])
    );

    return {
        data: enrichDrives(rawDriveDetails.data, lunBySerial),
        log: enrichDrives(rawDriveDetails.log, lunBySerial),
        tempDb: enrichDrives(rawDriveDetails.tempDb, lunBySerial)
    };
}

function buildConsolidatedDriveDetails(
    allDriveDetails: AllDriveDetailRow[],
    enrichedData: EnrichedDriveRecord[],
    enrichedLog: EnrichedDriveRecord[]
) {
    const consolidated: Array<Record<string, unknown>> = [];

    for (const drive of allDriveDetails) {
        const logDetails = enrichedLog.filter(d => d.name === drive.databaseName);
        const dataDetails = enrichedData.filter(d => d.name === drive.databaseName);

        if (logDetails.length === 0) {
            consolidated.push({ ...drive });
        } else {
            for (const logDetail of logDetails) {
                const dataAccessPaths = [
                    ...new Set(
                        dataDetails
                            .map(d =>
                                d.accessPaths &&
                                d.accessPaths.length > 0 &&
                                d.accessPaths[0].startsWith(drive.dataDriveLetter)
                                    ? d.accessPaths[0]
                                    : undefined
                            )
                            .filter((path): path is string => Boolean(path))
                    )
                ];
                consolidated.push({
                    ...drive,
                    ontapVolumeUuid: logDetail.ontapVolumeUuid,
                    ontapVolumeName: logDetail.ontapVolumeName,
                    lunUuid: logDetail.lunUuid,
                    svmName: logDetail.svmName,
                    diskNumber: logDetail.diskNumber,
                    diskSerialNumber: logDetail.lunSerialNumber,
                    // Consumers (e.g. `getLogVolumeDrift`) treat this as the comma-joined string the
                    // PowerShell host used to emit, and re-derive the unique paths via `.split(',')`.
                    dataAccessPath: dataAccessPaths.join(','),
                    ...(logDetail.accessPaths && logDetail.accessPaths.length > 0
                        ? { logAccessPath: logDetail.accessPaths[0] }
                        : {})
                });
            }
        }
    }

    return consolidated;
}

function simplifyDriveDetailsByAccessPath(consolidatedDriveDetails: Array<Record<string, unknown>>) {
    const simplified: Array<Record<string, unknown>> = [];
    const keyOf = (drive: Record<string, unknown>) =>
        `${drive.logAccessPath ?? ''}|${
            Array.isArray(drive.dataAccessPath) ? drive.dataAccessPath.join(',') : drive.dataAccessPath ?? ''
        }`;

    for (const drive of consolidatedDriveDetails) {
        const key = keyOf(drive);
        const existing = simplified.find(d => keyOf(d) === key);
        if (!existing) {
            simplified.push({ ...drive });
        } else {
            existing.databaseName = `${existing.databaseName as string},${drive.databaseName as string}`;
        }
    }

    return simplified;
}

function groupDriveDetailsByDisk(drives: EnrichedDriveRecord[]) {
    const grouped: Array<Record<string, unknown>> = [];

    for (const drive of drives) {
        const existing = grouped.find(d => d.diskNumber === drive.diskNumber);
        const databaseDetail = { name: drive.name, sizeInMb: drive.sizeInMb };
        if (!existing) {
            const rest = { ...drive };
            delete rest.name;
            delete rest.sizeInMb;
            grouped.push({ ...rest, databaseDetails: [databaseDetail] });
        } else {
            (existing.databaseDetails as unknown[]).push(databaseDetail);
        }
    }

    return grouped;
}

/**
 * TS port of the `STORAGE_CONFIGURATION_ASSESSMENT` layout/sizing consolidation block (previously
 * PowerShell lines ~494-637) that used to run after `Get-LunFromSerialNumber`. Produces the same
 * `layout['user-database-layout']` / `sizing['data-tempdb-drive-details']` /
 * `sizing['data-log-drive-details']` shapes the host script used to emit.
 */
function buildLayoutAndSizing(rawLayoutInputs: RawStorageLayoutInputs, lunsBySerial: OntapLunBySerialRecord[]) {
    const { allDriveDetails, defaultTempDBDriveDetails, serialKeyedDriveDetails } = rawLayoutInputs;
    const enriched = enrichRawDriveDetailsWithOntapIdentity(serialKeyedDriveDetails, lunsBySerial);

    const consolidatedDriveDetails = buildConsolidatedDriveDetails(allDriveDetails, enriched.data, enriched.log);

    const tempDbIdentity = enriched.tempDb[0];
    const dataTempdbDriveDetails = defaultTempDBDriveDetails.map(drive => ({
        ...drive,
        ...(tempDbIdentity
            ? {
                  ontapVolumeUuid: tempDbIdentity.ontapVolumeUuid,
                  ontapVolumeName: tempDbIdentity.ontapVolumeName,
                  lunUuid: tempDbIdentity.lunUuid,
                  svmName: tempDbIdentity.svmName,
                  diskNumber: tempDbIdentity.diskNumber,
                  diskSerialNumber: tempDbIdentity.lunSerialNumber
              }
            : {})
    }))[0];

    const userDatabaseLayout = {
        data: groupDriveDetailsByDisk(enriched.data),
        log: groupDriveDetailsByDisk(enriched.log),
        tempDb: enriched.tempDb
    };

    return {
        userDatabaseLayout,
        dataTempdbDriveDetails,
        dataLogDriveDetails: simplifyDriveDetailsByAccessPath(consolidatedDriveDetails)
    };
}

export {
    fetchDirectOntapAssessmentData,
    fetchLunsBySerialNumbers,
    enrichRawDriveDetailsWithOntapIdentity,
    buildLayoutAndSizing,
    RawDriveDetails,
    RawStorageLayoutInputs,
    AllDriveDetailRow,
    DefaultTempDbDriveRow,
    OntapLunBySerialRecord
};
