import { compact, groupBy, uniq, uniqBy } from 'lodash-es';

import getLogger from '../../../utils/logger';
import { coerceBooleanFromLooseTrue } from '../../../utils/utils';

import {
    buildOntapProxyBase,
    getLunBySerialNumber,
    junctionKey,
    resolveSvmsByIp,
    resolveVolumesByJunction,
    type OntapGatewayTarget,
    type OntapLunRecord,
    type ResolvedSvm,
    type ResolvedVolume
} from '../../../lib/ontap/ontap-gateway';
import {
    MountPointDetails,
    OracleInstanceMountpointResponse,
    OracleMappedOntapVolumeRecord,
    OracleMappedOntapVolumesResponse,
    OracleSysFileTypes,
    OracleVolumeRecord
} from './common-types';
import { STORAGE_PROTOCOLS } from '../../../utils/consts';

const logger = getLogger();

const LUN_BY_SERIAL_FIELDS = 'uuid,name,serial_number,svm.name,svm.uuid,location.volume.name,location.volume.uuid';

interface LunBySerialRecord extends OntapLunRecord {
    svm?: { name?: string; uuid?: string };
    location?: { volume?: { name?: string; uuid?: string } };
}

interface ResolvedLun {
    lunName?: string;
    lunId?: string;
    svmName?: string;
    svmId?: string;
    volumeName?: string;
    volumeId?: string;
}

interface MountOntapLookups {
    svmByIp: Map<string, ResolvedSvm>;
    lunBySerial: Map<string, ResolvedLun>;
    volumeByJunctionKey: Map<string, ResolvedVolume>;
}

interface MountWithFileType {
    mount: MountPointDetails;
    fileType: OracleSysFileTypes;
}

interface SidMountGroup {
    key: string;
    fileTypeMounts: MountWithFileType[];
}

interface SidEntry {
    sid: string;
    isCDB: boolean;
    error?: string;
    groups: SidMountGroup[];
}

function collectMountsForFileTypes(mountDetails: Record<string, MountPointDetails[]> | undefined): MountWithFileType[] {
    return Object.values(OracleSysFileTypes).flatMap(fileType =>
        (mountDetails?.[fileType] ?? []).map(mount => ({ mount, fileType }))
    );
}

function buildSidEntries(mountPointDataBySid: Record<string, OracleInstanceMountpointResponse>): SidEntry[] {
    return Object.keys(mountPointDataBySid)
        .sort()
        .map(sid => {
            const { isCDB = false, error, mountDetails, pdbMountDetails } = mountPointDataBySid[sid];
            if (error) {
                return { sid, isCDB, error, groups: [] };
            }
            const groups =
                pdbMountDetails && Object.keys(pdbMountDetails).length > 0
                    ? Object.keys(pdbMountDetails)
                          .sort()
                          .map(pdb => ({ key: pdb, fileTypeMounts: collectMountsForFileTypes(pdbMountDetails[pdb]) }))
                    : [{ key: '', fileTypeMounts: collectMountsForFileTypes(mountDetails) }];
            return { sid, isCDB, groups };
        });
}

async function resolveLunsBySerial(target: OntapGatewayTarget, serials: string[]): Promise<Map<string, ResolvedLun>> {
    logger.info('Resolving LUNs by serial', { serials });
    const records = (await getLunBySerialNumber(target, serials, {
        fields: LUN_BY_SERIAL_FIELDS
    })) as LunBySerialRecord[];
    return new Map(
        records.flatMap(record =>
            record.serial_number
                ? [
                      [
                          record.serial_number,
                          {
                              lunName: record.name,
                              lunId: record.uuid,
                              svmName: record.svm?.name,
                              svmId: record.svm?.uuid,
                              volumeName: record.location?.volume?.name,
                              volumeId: record.location?.volume?.uuid
                          }
                      ] as const
                  ]
                : []
        )
    );
}

function resolveMountRecord(mount: MountPointDetails, lookups: MountOntapLookups): OracleVolumeRecord {
    logger.debug('Resolving mount record', { mount });
    const { protocol, mountIP, mountPoint, isAsmManaged, diskName, diskGroup, copiesCount } = mount;
    const asmFields = coerceBooleanFromLooseTrue(isAsmManaged) ? { diskName, diskGroup } : {};

    if (protocol === STORAGE_PROTOCOLS.ISCSI) {
        const lun = mountPoint ? lookups.lunBySerial.get(mountPoint) : undefined;
        return {
            volumeName: lun?.volumeName ?? '',
            volumeId: lun?.volumeId ?? '',
            svmName: lun?.svmName,
            svmId: lun?.svmId,
            lunName: lun?.lunName,
            lunId: lun?.lunId,
            lunPath: lun?.lunName,
            copiesCount: copiesCount ?? 0,
            ...asmFields
        };
    }

    if (protocol === STORAGE_PROTOCOLS.NFS) {
        const svm = mountIP ? lookups.svmByIp.get(mountIP) : undefined;
        const volume =
            svm?.name && mountPoint ? lookups.volumeByJunctionKey.get(junctionKey(svm.name, mountPoint)) : undefined;
        return {
            volumeName: volume?.name ?? '',
            volumeId: volume?.uuid ?? '',
            svmName: svm?.name,
            svmId: svm?.uuid,
            junctionPath: mountPoint,
            copiesCount: copiesCount ?? 0,
            ...asmFields
        };
    }

    return { volumeName: '', volumeId: '', copiesCount: copiesCount ?? 0, ...asmFields };
}

function buildOntapVolumesForGroup(
    fileTypeMounts: MountWithFileType[],
    lookups: MountOntapLookups
): Record<string, OracleVolumeRecord[]> {
    logger.debug('Building ONTAP volumes for group', { fileTypeMounts });
    const mountsByFileType = groupBy(fileTypeMounts, m => m.fileType);
    return Object.fromEntries(
        Object.values(OracleSysFileTypes).map(fileType => [
            fileType,
            (mountsByFileType[fileType] ?? []).map(({ mount }) => resolveMountRecord(mount, lookups))
        ])
    );
}

async function resolveOracleMappedOntapVolumes(
    target: OntapGatewayTarget,
    mountPointDataBySid: Record<string, OracleInstanceMountpointResponse>
): Promise<OracleMappedOntapVolumesResponse> {
    const { accountId, fsxId, region } = target;
    logger.info('Resolving Oracle mapped ONTAP volumes', {
        accountId,
        fsxId,
        sidCount: Object.keys(mountPointDataBySid).length
    });

    const base = buildOntapProxyBase(accountId, fsxId, region);
    const sidEntries = buildSidEntries(mountPointDataBySid);
    const allMounts = sidEntries.flatMap(entry =>
        entry.groups.flatMap(group => group.fileTypeMounts.map(({ mount }) => mount))
    );

    const nfsMounts = allMounts.filter(mount => mount.protocol === STORAGE_PROTOCOLS.NFS);
    const iscsiSerials = uniq(
        compact(allMounts.filter(mount => mount.protocol === STORAGE_PROTOCOLS.ISCSI).map(mount => mount.mountPoint))
    );

    const [svmByIp, lunBySerial] = await Promise.all([
        resolveSvmsByIp(base, uniq(compact(nfsMounts.map(mount => mount.mountIP)))).catch(err => {
            logger.warn('Failed to resolve SVMs by IP; NFS volumes will be left unresolved', { fsxId, err });
            return new Map<string, ResolvedSvm>();
        }),
        resolveLunsBySerial(target, iscsiSerials).catch(err => {
            logger.warn('Failed to resolve LUNs by serial; iSCSI volumes will be left unresolved', { fsxId, err });
            return new Map<string, ResolvedLun>();
        })
    ]);

    const junctionPairs = uniqBy(
        nfsMounts.flatMap(mount => {
            const svmName = mount.mountIP ? svmByIp.get(mount.mountIP)?.name : undefined;
            return svmName && mount.mountPoint ? [{ svmName, junctionPath: mount.mountPoint }] : [];
        }),
        ({ svmName, junctionPath }) => junctionKey(svmName, junctionPath)
    );
    const volumeByJunctionKey = await resolveVolumesByJunction(base, junctionPairs).catch(err => {
        logger.warn('Failed to resolve volumes by junction path; NFS volumes will be left unresolved', { fsxId, err });
        return new Map<string, ResolvedVolume>();
    });

    const lookups: MountOntapLookups = { svmByIp, lunBySerial, volumeByJunctionKey };

    const volumeMappings = sidEntries.map(entry => {
        if (entry.error) {
            return { [entry.sid]: { error: entry.error } as OracleMappedOntapVolumeRecord };
        }
        const ontapVolumes =
            entry.groups.length === 1 && entry.groups[0].key === ''
                ? buildOntapVolumesForGroup(entry.groups[0].fileTypeMounts, lookups)
                : Object.fromEntries(
                      entry.groups.map(group => [group.key, buildOntapVolumesForGroup(group.fileTypeMounts, lookups)])
                  );
        return { [entry.sid]: { isCDB: entry.isCDB, ontapVolumes } as OracleMappedOntapVolumeRecord };
    });

    // Downstream drift checks key off a single protocol per file system, so a mixed or empty set is a data problem.
    const protocols = uniq(compact(allMounts.map(mount => mount.protocol)));
    if (protocols.length !== 1) {
        logger.warn('Could not determine a single storage protocol for the discovered Oracle mounts', {
            accountId,
            fsxId,
            protocols,
            mountCount: allMounts.length
        });
    }
    const [protocol] = protocols;
    const isASMManaged = allMounts.some(mount => coerceBooleanFromLooseTrue(mount.isAsmManaged));
    const lunRecords = iscsiSerials.map(serial => ({ name: lunBySerial.get(serial)?.lunName ?? '', serial }));

    logger.info('Resolved Oracle mapped ONTAP volumes', {
        accountId,
        fsxId,
        protocol,
        isASMManaged,
        sidCount: sidEntries.length
    });

    return {
        protocol,
        isASMManaged,
        lunRecords,
        volumeMappings: volumeMappings as unknown as OracleMappedOntapVolumesResponse['volumeMappings']
    };
}

export { resolveOracleMappedOntapVolumes };
