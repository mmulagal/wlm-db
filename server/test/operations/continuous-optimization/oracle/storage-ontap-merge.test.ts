import { beforeEach, describe, expect, it } from 'vitest';
import {
    fetchDirectOntapAssessmentData,
    resolveBinaryVolumesNfsInfo,
    RawBinaryVolumeRecord
} from '../../../../src/operations/continuous-optimization/oracle/storage-ontap-merge';
import { WorkloadInstance } from '../../../../src/utils/common-types';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';

function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

function buildInstanceRecord(overrides: Partial<WorkloadInstance> = {}): WorkloadInstance {
    return {
        id: 'instance-1',
        name: 'ordbsdl',
        type: 'oracle',
        region: 'us-east-1',
        sqlAuthEnabled: false,
        fsxFileSystem: 'fs-1',
        activeNodeInstanceid: 'i-1',
        resourceName: 'test-resource',
        storageProtocol: 'NFS',
        mappedVolumeNames: ['oracledata'],
        mappedVolumesUuids: ['vol-uuid-1'],
        svmOntapUuid: 'svm-uuid-1',
        svmOntapName: 'svm-1',
        ...overrides
    };
}

beforeEach(() => {
    resetProxyOverrides();
});

describe('fetchDirectOntapAssessmentData', () => {
    it('fetches and shapes volumes, NFS protocol/rootonly data like the old bash script did', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([
                {
                    name: 'oracledata',
                    uuid: 'vol-uuid-1',
                    svm: { name: 'svm-1' },
                    nas: { path: '/oracledata' },
                    guarantee: { honored: true, type: 'volume' },
                    autosize: { mode: 'grow' },
                    space: { fractional_reserve: 0, snapshot: { reserve_percent: 5, autodelete: { enabled: false } } },
                    snapshot_policy: { name: 'default' },
                    tiering: { policy: 'none' },
                    efficiency: { compression: 'inline', dedupe: 'both', compaction: 'inline' }
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/private/cli/volume',
            body: ontapPage([{ volume: 'oracledata', space_mgmt_try_first: 'volume_grow' }])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/protocols/nfs/services',
            body: ontapPage([{ protocol: { v4_id_domain: 'example.com', v40_enabled: true, v41_enabled: false } }])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/private/cli/vserver/nfs',
            body: ontapPage([{ vserver: 'svm-1', nfs_rootonly: 'disabled' }])
        });

        const result = await fetchDirectOntapAssessmentData('acct-1', buildInstanceRecord());

        expect(JSON.parse(result.volumesJson)).toEqual({
            error: '',
            filesystemId: 'fs-1',
            data: [
                {
                    name: 'oracledata',
                    uuid: 'vol-uuid-1',
                    junctionPath: '/oracledata',
                    thinProvision: true,
                    spaceGuarantee: 'volume',
                    autosizeMode: 'grow',
                    autosize: 'on',
                    fractionalReserve: 0,
                    snapshotCopyReserve: 5,
                    snapshotAutodelete: false,
                    snapshotPolicy: 'default',
                    tieringPolicy: 'none',
                    tieringMinCoolingDays: undefined,
                    svmName: 'svm-1',
                    compression: 'inline',
                    compressionType: undefined,
                    compaction: 'inline',
                    deduplication: 'both',
                    efficiencyType: undefined,
                    snapshotDeleteOrder: undefined,
                    spaceMgmtTryFirst: 'volume_grow'
                }
            ]
        });
        expect(JSON.parse(result.lunsJson)).toEqual({ error: 'LUNs not applicable', data: [] });
        expect(JSON.parse(result.nfsProtocolJson)).toEqual({
            error: '',
            data: { v4IdDomain: 'example.com', v40Enabled: true, v41Enabled: false }
        });
        expect(JSON.parse(result.nfsRootonlyJson)).toEqual([{ svmName: 'svm-1', nfsRootonly: 'disabled' }]);
    });

    it('fetches LUNs for iSCSI and marks NFS data as not applicable', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ name: 'oracledata', uuid: 'vol-uuid-1' }])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/luns',
            body: ontapPage([
                {
                    name: 'oracledata-lun',
                    uuid: 'lun-uuid-1',
                    os_type: 'linux',
                    space: { guarantee: { requested: false }, scsi_thin_provisioning_support_enabled: true }
                }
            ])
        });

        const result = await fetchDirectOntapAssessmentData(
            'acct-1',
            buildInstanceRecord({ storageProtocol: 'iSCSI', mappedLunUuids: ['lun-uuid-1'] })
        );

        expect(JSON.parse(result.lunsJson)).toEqual({
            error: '',
            data: [
                {
                    name: 'oracledata-lun',
                    uuid: 'lun-uuid-1',
                    osType: 'linux',
                    spaceReservationEnabled: false,
                    spaceAllocationAllocated: true
                }
            ]
        });
        expect(JSON.parse(result.nfsProtocolJson)).toEqual({ error: 'NFS protocol not applicable', data: {} });
        expect(JSON.parse(result.nfsRootonlyJson)).toEqual([]);
    });

    it('surfaces a fetch error when mapped volume UUIDs are missing', async () => {
        const result = await fetchDirectOntapAssessmentData(
            'acct-1',
            buildInstanceRecord({ mappedVolumesUuids: [], mappedVolumeNames: [] })
        );

        const volumes = JSON.parse(result.volumesJson);
        expect(volumes.error).toContain('mapped volume UUIDs');
        expect(volumes.data).toEqual([]);
    });
});

describe('resolveBinaryVolumesNfsInfo', () => {
    const buildRawVolume = (overrides: Partial<RawBinaryVolumeRecord> = {}): RawBinaryVolumeRecord => ({
        volumeId: '',
        volumeName: 'orahome',
        oracleHome: '/mnt/orahome/app/oracle/product/19c/db_1',
        isNfsMount: true,
        hasBinaries: true,
        mountPath: '/mnt/orahome',
        oracleSid: 'ordbsdl',
        ...overrides
    });

    it('resolves ONTAP identity and export-policy rules for NFS-mounted binary volumes', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([
                {
                    name: 'orahome',
                    uuid: 'vol-uuid-orahome',
                    svm: { name: 'svm-1', uuid: 'svm-uuid-1' },
                    nas: { export_policy: { name: 'wf2_policy' } }
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/protocols/nfs/export-policies',
            body: ontapPage([
                {
                    rules: [{ clients: [{ match: '10.0.0.1' }], superuser: ['any'], allow_suid: false }]
                }
            ])
        });

        const [resolved] = await resolveBinaryVolumesNfsInfo('acct-1', buildInstanceRecord(), [buildRawVolume()]);

        expect(resolved.volumeId).toBe('vol-uuid-orahome');
        expect(resolved.nfsInfo).toEqual({
            volumeId: 'vol-uuid-orahome',
            svmName: 'svm-1',
            svmUuid: 'svm-uuid-1',
            exportPolicyName: 'wf2_policy',
            rules: [{ clients: ['10.0.0.1'], superuser: ['any'], allow_suid: false }]
        });
    });

    it('leaves EBS-backed (non-NFS) binary volumes untouched', async () => {
        const rawVolume = buildRawVolume({ isNfsMount: false, volumeId: 'vol-0abc', mountPath: null });

        const [resolved] = await resolveBinaryVolumesNfsInfo('acct-1', buildInstanceRecord(), [rawVolume]);

        expect(resolved).toEqual(rawVolume);
    });

    it('returns nfsInfo undefined when the ONTAP volume cannot be resolved by name', async () => {
        const [resolved] = await resolveBinaryVolumesNfsInfo('acct-1', buildInstanceRecord(), [buildRawVolume()]);

        expect(resolved.nfsInfo).toBeUndefined();
    });
});
