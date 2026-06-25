import { describe, it, expect } from 'vitest';
import {
    formatTypeList,
    getBaseVolume,
    getSharedFileTypeLabels,
    getVolumeLayoutDrift,
    getNfsOSConfigDrift,
    getVolumeConfigDrift
} from '../../../../src/operations/continuous-optimization/oracle/storage-assessment-operations';
import {
    StorageAssessment,
    StorageNfsAssessment
} from '../../../../src/operations/continuous-optimization/oracle/common-types';
import { OracleSysFileTypes, OracleVolumeRecord } from '../../../../src/operations/workloads/oracle/common-types';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';

type LayoutAssessment = {
    name: string;
    status?: AssessmentStatus;
    current?: string;
    errorMessage?: string;
    objectsInViolation?: string[];
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
    violationDetails?: Array<{ objectName: string; value: string; objectType: string; recommended?: string }>;
};

const vol = (volumeId: string, volumeName?: string, copiesCount?: number): OracleVolumeRecord => ({
    volumeId,
    volumeName: volumeName ?? volumeId,
    ...(copiesCount !== undefined && { copiesCount })
});

const buildVolumeTypeMap = (
    overrides: Partial<Record<OracleSysFileTypes, OracleVolumeRecord[]>> = {}
): Record<OracleSysFileTypes, OracleVolumeRecord[]> => ({
    [OracleSysFileTypes.CONTROL_FILES]: [],
    [OracleSysFileTypes.DATA_FILES]: [],
    [OracleSysFileTypes.REDO_LOGS]: [],
    [OracleSysFileTypes.ARCHIVE_LOGS]: [],
    [OracleSysFileTypes.TEMP_FILES]: [],
    [OracleSysFileTypes.FRA]: [],
    ...overrides
});

const buildStorageAssessment = (binaryVolumes: { volumeId: string; volumeName: string }[] = []) =>
    ({
        volumes: { error: '', data: [], filesystemId: 'fs-test' },
        binaryVolumes: { error: '', data: binaryVolumes }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

const findAssessment = (drift: ReturnType<typeof getVolumeLayoutDrift>, name: string): LayoutAssessment =>
    drift.find(d => d.id === name) as LayoutAssessment;

describe('getBaseVolume', () => {
    const exportsByServer: Record<string, string[]> = {
        '10.0.49.228': [
            '/data_270126141652',
            '/data_280126120450',
            '/log_270126141652',
            '/log_280126120450',
            '/data_270126141652/nest',
            '/orabase',
            '/oraredoctl_270126141652',
            '/oraredoctl_280126120450'
        ]
    };

    describe('exact match scenarios', () => {
        it('should return the exact path when it matches an export exactly', () => {
            const result = getBaseVolume('/data_270126141652', '10.0.49.228', exportsByServer);
            expect(result).toBe('/data_270126141652');
        });

        it('should return the exact nested export when path matches exactly', () => {
            const result = getBaseVolume('/data_270126141652/nest', '10.0.49.228', exportsByServer);
            expect(result).toBe('/data_270126141652/nest');
        });

        it('should return the base volume for a subdirectory path', () => {
            const result = getBaseVolume('/log_270126141652/test', '10.0.49.228', exportsByServer);
            expect(result).toBe('/log_270126141652');
        });

        it('should return the base volume for a deeply nested path', () => {
            const result = getBaseVolume('/data_270126141652/data', '10.0.49.228', exportsByServer);
            expect(result).toBe('/data_270126141652');
        });

        it('should return the longest matching export (nested export wins over parent)', () => {
            const result = getBaseVolume('/data_270126141652/nest/subdir', '10.0.49.228', exportsByServer);
            expect(result).toBe('/data_270126141652/nest');
        });

        it('should not match partial segment names', () => {
            const result = getBaseVolume('/log_280126120450/as/subdir', '10.0.49.228', exportsByServer);
            expect(result).toBe('/log_280126120450');
        });
    });
});

describe('formatTypeList', () => {
    it('returns an empty string for an empty list', () => {
        expect(formatTypeList([])).toBe('');
    });

    it('returns the single label as-is', () => {
        expect(formatTypeList(['data files'])).toBe('data files');
    });

    it('joins two labels with " and "', () => {
        expect(formatTypeList(['data files', 'redo logs'])).toBe('data files and redo logs');
    });

    it('joins three or more labels with comma separators and an Oxford comma', () => {
        expect(formatTypeList(['control files', 'data files', 'redo logs'])).toBe(
            'control files, data files, and redo logs'
        );
        expect(formatTypeList(['control files', 'data files', 'redo logs', 'temp files'])).toBe(
            'control files, data files, redo logs, and temp files'
        );
    });
});

describe('getSharedFileTypeLabels', () => {
    it('returns an empty array when there are no conflict volume ids', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.DATA_FILES]: [vol('v1')]
        });
        expect(getSharedFileTypeLabels([], map, [])).toEqual([]);
    });

    it('returns labels for file types that occupy any of the conflict volumes', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.DATA_FILES]: [vol('v1')],
            [OracleSysFileTypes.REDO_LOGS]: [vol('v1')],
            [OracleSysFileTypes.TEMP_FILES]: [vol('v2')]
        });
        expect(getSharedFileTypeLabels(['v1'], map, [])).toEqual(['data files', 'redo logs']);
    });

    it('skips file types listed in excludeTypes', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.DATA_FILES]: [vol('v1')],
            [OracleSysFileTypes.CONTROL_FILES]: [vol('v1')]
        });
        expect(getSharedFileTypeLabels(['v1'], map, [OracleSysFileTypes.CONTROL_FILES])).toEqual(['data files']);
    });

    it('dedupes archive logs when both ARCHIVE_LOGS and FRA contain the conflict volume', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v1')],
            [OracleSysFileTypes.FRA]: [vol('v1')]
        });
        expect(getSharedFileTypeLabels(['v1'], map, [])).toEqual(['archive logs']);
    });

    it('returns labels in deterministic enum-defined order (control, data, redo, archive, temp)', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.TEMP_FILES]: [vol('v1')],
            [OracleSysFileTypes.CONTROL_FILES]: [vol('v1')],
            [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v1')],
            [OracleSysFileTypes.DATA_FILES]: [vol('v1')],
            [OracleSysFileTypes.REDO_LOGS]: [vol('v1')]
        });
        expect(getSharedFileTypeLabels(['v1'], map, [])).toEqual([
            'control files',
            'data files',
            'redo logs',
            'archive logs',
            'temp files'
        ]);
    });
});

describe('getVolumeLayoutDrift - current message', () => {
    describe('archive-placement', () => {
        it('returns errorMessage with no current when no archive volumes are present', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.DATA_FILES]: [vol('v1')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const archive = findAssessment(drift, 'archive-placement');
            expect(archive.errorMessage).toBe('No archive log volumes found.');
            expect(archive.current).toBeUndefined();
        });

        it('omits current when archive logs are on a dedicated volume', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-arch')],
                [OracleSysFileTypes.DATA_FILES]: [vol('v-data')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const archive = findAssessment(drift, 'archive-placement');
            expect(archive.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(archive.current).toBeUndefined();
        });

        it('sets current describing every file type the archive volume is shared with', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-shared')],
                [OracleSysFileTypes.DATA_FILES]: [vol('v-shared')],
                [OracleSysFileTypes.REDO_LOGS]: [vol('v-shared')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const archive = findAssessment(drift, 'archive-placement');
            expect(archive.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(archive.current).toBe('Archive logs currently shared with data files and redo logs');
        });

        it('treats FRA volumes as archive logs when checking for placement violations', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.FRA]: [vol('v-fra')],
                [OracleSysFileTypes.TEMP_FILES]: [vol('v-fra')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const archive = findAssessment(drift, 'archive-placement');
            expect(archive.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(archive.current).toBe('Archive logs currently shared with temp files');
        });
    });

    describe('datafiles-placement', () => {
        it('omits current when data files are shared only with control files (allowed)', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.DATA_FILES]: [vol('v-data')],
                [OracleSysFileTypes.CONTROL_FILES]: [vol('v-data')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const data = findAssessment(drift, 'datafiles-placement');
            expect(data.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(data.current).toBeUndefined();
        });

        it('sets current listing temp files and archive logs when data files share with both', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.DATA_FILES]: [vol('v-data')],
                [OracleSysFileTypes.TEMP_FILES]: [vol('v-data')],
                [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-data')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const data = findAssessment(drift, 'datafiles-placement');
            expect(data.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(data.current).toBe('Data files currently shared with archive logs and temp files');
        });
    });

    describe('controlfiles-placement', () => {
        it('omits current when 2+ control file volumes exist with no sharing violation', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.CONTROL_FILES]: [vol('v-c1'), vol('v-c2')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const control = findAssessment(drift, 'controlfiles-placement');
            expect(control.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(control.current).toBeUndefined();
        });

        it('sets sharing-only current when control shares with archive but multiplexing is sufficient', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.CONTROL_FILES]: [vol('v-c1'), vol('v-c2'), vol('v-shared')],
                [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-shared')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const control = findAssessment(drift, 'controlfiles-placement');
            expect(control.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(control.current).toBe('Control files currently shared with archive logs');
        });

        it('sets multiplexing-only current when there is a single dedicated control volume', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.CONTROL_FILES]: [vol('v-c1')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const control = findAssessment(drift, 'controlfiles-placement');
            expect(control.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(control.current).toBe('Control files have only 1 separate volume available for multiplexed copies');
        });

        it('combines sharing and multiplexing fragments when both violations occur (count=0)', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.CONTROL_FILES]: [vol('v-shared')],
                [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-shared')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const control = findAssessment(drift, 'controlfiles-placement');
            expect(control.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(control.current).toBe(
                'Control files currently shared with archive logs; no separate volumes available for multiplexed copies'
            );
        });
    });

    describe('redologs-placement', () => {
        it('omits current when there is a single redo volume with copiesCount=1', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.REDO_LOGS]: [vol('v-redo', 'v-redo', 1)]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const redo = findAssessment(drift, 'redologs-placement');
            expect(redo.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(redo.current).toBeUndefined();
        });

        it('omits current when redo logs are on 2+ dedicated volumes', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.REDO_LOGS]: [vol('v-r1'), vol('v-r2')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const redo = findAssessment(drift, 'redologs-placement');
            expect(redo.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(redo.current).toBeUndefined();
        });

        it('sets sharing-only current when redo shares with data files but multiplexing is fine', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.REDO_LOGS]: [vol('v-r1'), vol('v-r2'), vol('v-shared')],
                [OracleSysFileTypes.DATA_FILES]: [vol('v-shared')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const redo = findAssessment(drift, 'redologs-placement');
            expect(redo.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(redo.current).toBe('Redo logs currently shared with data files');
        });

        it('sets multiplexing-only current when one redo volume hosts multiple copies', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.REDO_LOGS]: [vol('v-r1', 'v-r1', 2)]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const redo = findAssessment(drift, 'redologs-placement');
            expect(redo.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(redo.current).toBe('Redo logs have only 1 separate volume available for multiplexed copies');
        });

        it('combines sharing and multiplexing fragments when the only redo volume is shared (count=0)', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.REDO_LOGS]: [vol('v-shared')],
                [OracleSysFileTypes.DATA_FILES]: [vol('v-shared')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const redo = findAssessment(drift, 'redologs-placement');
            expect(redo.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(redo.current).toBe(
                'Redo logs currently shared with data files; no separate volumes available for multiplexed copies'
            );
        });
    });

    describe('templogs-placement', () => {
        it('omits current when temp files share only with redo logs (allowed)', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.TEMP_FILES]: [vol('v-temp')],
                [OracleSysFileTypes.REDO_LOGS]: [vol('v-temp')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const temp = findAssessment(drift, 'templogs-placement');
            expect(temp.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(temp.current).toBeUndefined();
        });

        it('sets current when temp files share with data files and archive logs', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.TEMP_FILES]: [vol('v-temp')],
                [OracleSysFileTypes.DATA_FILES]: [vol('v-temp')],
                [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-temp')]
            });
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const temp = findAssessment(drift, 'templogs-placement');
            expect(temp.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(temp.current).toBe('Temp files currently shared with data files and archive logs');
        });
    });

    describe('oracle-binary-placement', () => {
        it('returns errorMessage with no current when no binary volumes are present', () => {
            const map = buildVolumeTypeMap();
            const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
            const binary = findAssessment(drift, 'oracle-binary-placement');
            expect(binary.errorMessage).toBe('No binary log volumes found.');
            expect(binary.current).toBeUndefined();
        });

        it('omits current when the binary volume is dedicated', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.DATA_FILES]: [vol('v-data')]
            });
            const drift = getVolumeLayoutDrift(
                map,
                buildStorageAssessment([{ volumeId: 'v-bin', volumeName: 'v-bin' }])
            );
            const binary = findAssessment(drift, 'oracle-binary-placement');
            expect(binary.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(binary.current).toBeUndefined();
        });

        it('sets current listing every file type the binary volume is shared with', () => {
            const map = buildVolumeTypeMap({
                [OracleSysFileTypes.CONTROL_FILES]: [vol('v-bin')],
                [OracleSysFileTypes.DATA_FILES]: [vol('v-bin')]
            });
            const drift = getVolumeLayoutDrift(
                map,
                buildStorageAssessment([{ volumeId: 'v-bin', volumeName: 'v-bin' }])
            );
            const binary = findAssessment(drift, 'oracle-binary-placement');
            expect(binary.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(binary.current).toBe('Oracle binaries currently shared with control files and data files');
        });
    });
});

describe('getVolumeLayoutDrift - violationDetails', () => {
    it('populates violationDetails entries for each violating volume in archive-placement', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-arch')],
            [OracleSysFileTypes.DATA_FILES]: [vol('v-arch')]
        });
        const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
        const archive = findAssessment(drift, 'archive-placement');
        expect(archive.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(archive.violationDetails).toHaveLength(1);
        expect(archive.violationDetails?.[0]).toMatchObject({
            objectName: 'v-arch',
            objectType: 'Volume'
        });
        expect(archive.violationDetails?.[0].value).toBeTruthy();
    });

    it('emits empty violationDetails when archive-placement is OPTIMIZED', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-arch')],
            [OracleSysFileTypes.DATA_FILES]: [vol('v-data')]
        });
        const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
        const archive = findAssessment(drift, 'archive-placement');
        expect(archive.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(archive.violationDetails).toHaveLength(0);
    });

    it('populates violationDetails for datafiles-placement conflicts', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.DATA_FILES]: [vol('v-shared')],
            [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-shared')]
        });
        const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
        const data = findAssessment(drift, 'datafiles-placement');
        expect(data.violationDetails).toHaveLength(1);
        expect(data.violationDetails?.[0].objectName).toBe('v-shared');
    });

    it('populates violationDetails for controlfiles-placement sharing conflicts', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.CONTROL_FILES]: [vol('v-ctrl'), vol('v-shared')],
            [OracleSysFileTypes.ARCHIVE_LOGS]: [vol('v-shared')]
        });
        const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
        const control = findAssessment(drift, 'controlfiles-placement');
        expect(control.violationDetails).toHaveLength(1);
        expect(control.violationDetails?.[0].objectName).toBe('v-shared');
    });

    it('emits empty violationDetails for controlfiles-placement when only multiplexing violation (no sharing conflicts)', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.CONTROL_FILES]: [vol('v-c1')]
        });
        const drift = getVolumeLayoutDrift(map, buildStorageAssessment());
        const control = findAssessment(drift, 'controlfiles-placement');
        expect(control.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(control.violationDetails).toHaveLength(0);
    });

    it('populates violationDetails for oracle-binary-placement conflicts', () => {
        const map = buildVolumeTypeMap({
            [OracleSysFileTypes.DATA_FILES]: [vol('v-data')]
        });
        const drift = getVolumeLayoutDrift(map, buildStorageAssessment([{ volumeId: 'v-data', volumeName: 'v-data' }]));
        const binary = findAssessment(drift, 'oracle-binary-placement');
        expect(binary.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(binary.violationDetails).toHaveLength(1);
        expect(binary.violationDetails?.[0].objectName).toBe('v-data');
    });
});

type DriftEntry = {
    id?: string;
    name?: string;
    errorMessage?: string;
    status?: AssessmentStatus;
    violationDetails?: Array<{ objectName?: string; value?: string; recommended?: string }>;
    totalObjectsInViolation?: number;
};

const findEntry = (drift: unknown[], id: string): DriftEntry | undefined =>
    (drift as DriftEntry[]).find(entry => entry?.id === id);

describe('getNfsOSConfigDrift - SID-scoped mount filtering (TS-side filter on host-wide nfs-mount-options)', () => {
    const ec2InstanceId = 'i-1234567890abcdef0';
    const databaseInstanceName = 'orcl1';
    const recommendedMountOptions = {
        rw: true,
        bg: true,
        hard: true,
        proto: 'tcp',
        rsize: '262144',
        wsize: '262144',
        nointr: true,
        timeo: '600'
    } as const;

    const sidJunctionPath = '/oradata_orcl1';
    const sidLogJunctionPath = '/oralog_orcl1';

    type Mount = {
        server: string;
        'remote-path': string;
        'mount-point': string;
        'filesystem-type': string;
        options: Record<string, string | boolean>;
    };

    const buildMount = (overrides: Partial<Mount>): Mount => ({
        server: '10.0.0.1',
        'remote-path': sidJunctionPath,
        'mount-point': '/u01/oradata',
        'filesystem-type': 'nfs',
        options: { ...recommendedMountOptions, vers: '3' },
        ...overrides
    });

    const badMountOptions = { rw: true, vers: '3' } as Record<string, string | boolean>;

    type BuildOpts = {
        sidJunctionPaths?: string[];
        hostMounts?: Mount[];
        hostMountError?: string;
        nfsv4DomainData?: StorageNfsAssessment['nfsv4DomainData'];
        idmapdDomain?: string;
    };

    // The script emits only the host-wide nfs-mount-options. The TS layer filters down to
    // SID-scoped mounts using the junction paths discovered on the volumes side.
    const buildAssessmentData = (overrides: BuildOpts): StorageNfsAssessment => ({
        volumes: {
            error: '',
            filesystemId: 'fs-1',
            data: (overrides.sidJunctionPaths ?? [sidJunctionPath]).map((junctionPath, idx) => ({
                junctionPath,
                name: `vol-${idx}`,
                uuid: `u-${idx}`
            }))
        },
        os: {
            'nfs-mount-options': overrides.hostMountError
                ? { error: overrides.hostMountError }
                : { 'nfs-mount-options': overrides.hostMounts ?? [] },
            'idmapd-domain-config': {
                'config-exists': true,
                domain: overrides.idmapdDomain ?? 'host.example.com'
            },
            'hostname-domain': { domain: 'host.example.com' }
        },
        nfsv4DomainData: overrides.nfsv4DomainData
    });

    describe('nfs-mount-options-databasefiles', () => {
        it('flags only host-wide mounts whose remote-path is in the SID junction set', () => {
            const data = buildAssessmentData({
                hostMounts: [
                    buildMount({ 'remote-path': sidJunctionPath, options: badMountOptions }),
                    buildMount({
                        'remote-path': '/random/non_db_mount',
                        'mount-point': '/mnt/share',
                        options: badMountOptions
                    })
                ]
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);

            const dbFilesEntry = findEntry(drift, 'nfs-mount-options-databasefiles');
            expect(dbFilesEntry).toBeDefined();
            expect(dbFilesEntry?.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(dbFilesEntry?.violationDetails).toHaveLength(1);
            expect(dbFilesEntry?.violationDetails?.[0]?.objectName).toBe(`${sidJunctionPath}:/u01/oradata`);
        });

        it('reports OPTIMIZED when the only SID mount has recommended options, even if host has bad non-SID mounts', () => {
            const data = buildAssessmentData({
                hostMounts: [
                    buildMount({ 'remote-path': sidJunctionPath }),
                    buildMount({
                        'remote-path': '/random/non_db_mount',
                        'mount-point': '/mnt/share',
                        options: badMountOptions
                    })
                ]
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const dbFilesEntry = findEntry(drift, 'nfs-mount-options-databasefiles');
            expect(dbFilesEntry?.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(dbFilesEntry?.violationDetails).toHaveLength(0);
        });

        it('emits a single error entry (no duplicate OPTIMIZED) when no SID junction paths are mapped', () => {
            const data = buildAssessmentData({
                sidJunctionPaths: [],
                hostMounts: [buildMount({ 'remote-path': sidJunctionPath, options: badMountOptions })]
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const dbFilesEntries = (drift as DriftEntry[]).filter(e => e?.id === 'nfs-mount-options-databasefiles');
            expect(dbFilesEntries).toHaveLength(1);
            expect(dbFilesEntries[0].errorMessage).toContain('No mapped DB-instance volumes');
            expect(dbFilesEntries[0].status).toBeUndefined();
        });

        it('propagates an nfs-mount-options script error as errorMessage with no duplicate assessment', () => {
            const data = buildAssessmentData({
                hostMountError: 'mount: command failed'
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const dbFilesEntries = (drift as DriftEntry[]).filter(e => e?.id === 'nfs-mount-options-databasefiles');
            expect(dbFilesEntries).toHaveLength(1);
            expect(dbFilesEntries[0].errorMessage).toBe('mount: command failed');
            expect(dbFilesEntries[0].status).toBeUndefined();
        });

        it('treats a missing nfs-mount-options field as no SID mounts (OPTIMIZED, no violations)', () => {
            const data: StorageNfsAssessment = {
                volumes: {
                    error: '',
                    filesystemId: 'fs-1',
                    data: [{ junctionPath: sidJunctionPath, name: 'vol', uuid: 'u' }]
                },
                os: {
                    'idmapd-domain-config': { 'config-exists': true, domain: 'host.example.com' },
                    'hostname-domain': { domain: 'host.example.com' }
                }
            };

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const dbFilesEntry = findEntry(drift, 'nfs-mount-options-databasefiles');
            expect(dbFilesEntry?.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(dbFilesEntry?.violationDetails).toHaveLength(0);
        });
    });

    describe('nfs-caching-options', () => {
        it('flags only SID-scoped host mounts with cache-disabling options', () => {
            const data = buildAssessmentData({
                sidJunctionPaths: [sidJunctionPath, sidLogJunctionPath],
                hostMounts: [
                    buildMount({
                        'remote-path': sidJunctionPath,
                        options: { ...recommendedMountOptions, vers: '3', noac: true }
                    }),
                    buildMount({
                        'remote-path': sidLogJunctionPath,
                        'mount-point': '/u01/oralog',
                        options: { ...recommendedMountOptions, vers: '3' }
                    }),
                    buildMount({
                        'remote-path': '/random/non_db_mount',
                        'mount-point': '/mnt/share',
                        options: { ...recommendedMountOptions, vers: '3', noac: true }
                    })
                ]
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const cachingEntry = findEntry(drift, 'nfs-caching-options');
            expect(cachingEntry).toBeDefined();
            expect(cachingEntry?.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(cachingEntry?.violationDetails).toHaveLength(1);
            expect(cachingEntry?.violationDetails?.[0]?.objectName).toBe(`${sidJunctionPath}:/u01/oradata`);
        });

        it('emits a single error entry when no SID junction paths are mapped', () => {
            const data = buildAssessmentData({
                sidJunctionPaths: [],
                hostMounts: [
                    buildMount({
                        'remote-path': sidJunctionPath,
                        options: { ...recommendedMountOptions, vers: '3', noac: true }
                    })
                ]
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const cachingEntries = (drift as DriftEntry[]).filter(e => e?.id === 'nfs-caching-options');
            expect(cachingEntries).toHaveLength(1);
            expect(cachingEntries[0].errorMessage).toContain('No mapped DB-instance volumes');
            expect(cachingEntries[0].status).toBeUndefined();
        });

        it('is skipped entirely for non-Standalone deployments', () => {
            const data = buildAssessmentData({
                hostMounts: [
                    buildMount({
                        'remote-path': sidJunctionPath,
                        options: { ...recommendedMountOptions, vers: '3', noac: true }
                    })
                ]
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'RAC', data);
            const cachingEntry = findEntry(drift, 'nfs-caching-options');
            expect(cachingEntry).toBeUndefined();
        });
    });

    describe('nfsv4-domain-name', () => {
        const nfsv4DomainData = { data: { v4IdDomain: 'ontap.example.com' } };

        it('runs the check only when a SID-scoped NFSv4 mount exists', () => {
            const data = buildAssessmentData({
                hostMounts: [
                    buildMount({
                        'remote-path': sidJunctionPath,
                        options: { ...recommendedMountOptions, vers: '4.1' }
                    })
                ],
                nfsv4DomainData,
                idmapdDomain: 'host.example.com'
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const nfsv4Entry = findEntry(drift, 'nfsv4-domain-name');
            expect(nfsv4Entry).toBeDefined();
            expect(nfsv4Entry?.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(nfsv4Entry?.violationDetails).toHaveLength(1);
        });

        it('is skipped when only a non-SID host mount is NFSv4', () => {
            const data = buildAssessmentData({
                hostMounts: [
                    buildMount({
                        'remote-path': sidJunctionPath,
                        options: { ...recommendedMountOptions, vers: '3' }
                    }),
                    buildMount({
                        'remote-path': '/random/non_db_mount',
                        'mount-point': '/mnt/share',
                        options: { ...recommendedMountOptions, vers: '4.1' }
                    })
                ],
                nfsv4DomainData,
                idmapdDomain: 'host.example.com'
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const nfsv4Entry = findEntry(drift, 'nfsv4-domain-name');
            expect(nfsv4Entry).toBeUndefined();
        });

        it('is skipped when no SID junction paths are mapped', () => {
            const data = buildAssessmentData({
                sidJunctionPaths: [],
                hostMounts: [
                    buildMount({
                        'remote-path': sidJunctionPath,
                        options: { ...recommendedMountOptions, vers: '4.1' }
                    })
                ],
                nfsv4DomainData,
                idmapdDomain: 'host.example.com'
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const nfsv4Entry = findEntry(drift, 'nfsv4-domain-name');
            expect(nfsv4Entry).toBeUndefined();
        });

        it('is skipped when the SID mounts are NFSv3 only', () => {
            const data = buildAssessmentData({
                hostMounts: [
                    buildMount({
                        'remote-path': sidJunctionPath,
                        options: { ...recommendedMountOptions, vers: '3' }
                    })
                ],
                nfsv4DomainData,
                idmapdDomain: 'host.example.com'
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const nfsv4Entry = findEntry(drift, 'nfsv4-domain-name');
            expect(nfsv4Entry).toBeUndefined();
        });
    });
});

describe('getVolumeConfigDrift - combined configs and snapshot rename', () => {
    type RawVolume = {
        name: string;
        uuid: string;
        compressionType?: string;
        compression?: string;
        deduplication?: string;
        compaction?: string;
        tieringPolicy?: string;
        tieringMinCoolingDays?: string;
        snapshotPolicy?: string;
        spaceGuarantee?: string;
        autosize?: string;
        autosizeMode?: string;
        fractionalReserve?: string;
        snapshotCopyReserve?: string;
        snapshotAutodelete?: string;
        snapshotDeleteOrder?: string;
        spaceMgmtTryFirst?: string;
    };

    const optimalVolumeDefaults = {
        spaceGuarantee: 'none',
        autosize: 'on',
        autosizeMode: 'grow',
        fractionalReserve: '0',
        snapshotPolicy: 'none',
        snapshotCopyReserve: '0',
        snapshotAutodelete: 'true',
        snapshotDeleteOrder: 'oldest_first',
        spaceMgmtTryFirst: 'volume_grow'
    };

    const dataVolumeOptimal: RawVolume = {
        name: 'data_vol',
        uuid: 'uuid-data',
        compressionType: 'adaptive',
        compression: 'adaptive',
        deduplication: 'inline',
        compaction: 'enabled',
        tieringPolicy: 'none',
        tieringMinCoolingDays: '',
        ...optimalVolumeDefaults
    };

    const redoVolumeOptimal: RawVolume = {
        name: 'redo_vol',
        uuid: 'uuid-redo',
        compressionType: 'none',
        compression: 'none',
        deduplication: 'none',
        compaction: 'none',
        tieringPolicy: 'none',
        tieringMinCoolingDays: '',
        ...optimalVolumeDefaults
    };

    const archiveVolumeOptimal: RawVolume = {
        name: 'archive_vol',
        uuid: 'uuid-archive',
        compressionType: 'adaptive',
        compression: 'adaptive',
        deduplication: 'inline',
        compaction: 'enabled',
        tieringPolicy: 'auto',
        tieringMinCoolingDays: '2',
        ...optimalVolumeDefaults
    };

    const buildVolumeMap = () => ({
        [OracleSysFileTypes.CONTROL_FILES]: [],
        [OracleSysFileTypes.DATA_FILES]: [{ volumeId: 'uuid-data', volumeName: 'data_vol' } as OracleVolumeRecord],
        [OracleSysFileTypes.REDO_LOGS]: [{ volumeId: 'uuid-redo', volumeName: 'redo_vol' } as OracleVolumeRecord],
        [OracleSysFileTypes.ARCHIVE_LOGS]: [
            { volumeId: 'uuid-archive', volumeName: 'archive_vol' } as OracleVolumeRecord
        ],
        [OracleSysFileTypes.TEMP_FILES]: [],
        [OracleSysFileTypes.FRA]: []
    });

    const buildAssessment = (volumes: RawVolume[]): StorageAssessment =>
        ({
            fraEnabled: 'no',
            rmanCompressionEnabled: 'no',
            volumes: { error: '', data: volumes as unknown as Record<string, unknown>[], filesystemId: 'fs-test' }
        } as unknown as StorageAssessment);

    type CombinedDriftEntry = {
        name?: string;
        id?: string;
        status?: string;
        recommended?: string;
        objectsInViolation?: string[];
        totalObjectsAssessed?: number;
        totalObjectsInViolation?: number;
        configDetails?: Array<{
            id: string;
            recommended: string;
            objectType: string;
            recommendedByDataCategory?: Record<string, string>;
            recommendedNote?: string;
        }>;
        violationDetails?: Array<{
            objectName: string;
            value?: string;
            objectType?: string;
            dataCategory?: string;
            recommended?: string;
            violatedConfigs?: Array<{ id: string; current: string }>;
        }>;
    };

    // Combined entries are matched by `id` (flat schema's stable key); legacy entries by `id` too.
    const findById = (drift: ReturnType<typeof getVolumeConfigDrift>, id: string): CombinedDriftEntry =>
        drift.find(d => (d as CombinedDriftEntry).id === id) as unknown as CombinedDriftEntry;

    const storageEfficienciesConfigDetails = [
        {
            id: 'compression',
            recommended: '',
            objectType: 'Volume',
            recommendedByDataCategory: {
                'log-files': 'none',
                'non-log-files': 'adaptive',
                mixed: 'varies'
            }
        },
        {
            id: 'deduplication',
            recommended: '',
            objectType: 'Volume',
            recommendedByDataCategory: {
                'log-files': 'none',
                'non-log-files': 'inline',
                mixed: 'varies'
            },
            recommendedNote: '`both` is also acceptable for non-log-files volumes'
        },
        {
            id: 'compaction',
            recommended: '',
            objectType: 'Volume',
            recommendedByDataCategory: {
                'log-files': 'none',
                'non-log-files': 'enabled',
                mixed: 'varies'
            }
        }
    ];

    const tieringTcoConfigDetails = [
        {
            id: 'tiering-policy',
            recommended: '',
            objectType: 'Volume',
            recommendedByDataCategory: {
                'data-control-files': 'none',
                'log-files': 'none',
                'archive-log-files': 'auto',
                mixed: 'varies'
            }
        },
        {
            id: 'tiering-min-cooling-days',
            recommended: '',
            objectType: 'Volume',
            recommendedByDataCategory: {
                'archive-log-files': '2'
            },
            recommendedNote:
                '14 when FRA is enabled and RMAN compression is disabled; not assessed on non-archive volumes'
        }
    ];

    describe('storage-efficiencies combined config', () => {
        it('reports OPTIMIZED when every relevant volume passes every sub-parameter', () => {
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([dataVolumeOptimal, redoVolumeOptimal, archiveVolumeOptimal]),
                'iSCSI'
            );

            const entry = findById(drift, 'storage-efficiencies');
            expect(entry).toBeDefined();
            expect(entry.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(entry.recommended).toBe('');
            expect(entry.totalObjectsInViolation).toBe(0);
            expect(entry.totalObjectsAssessed).toBe(3);
            expect(entry.configDetails).toEqual(storageEfficienciesConfigDetails);
            expect(entry.violationDetails).toEqual([]);
        });

        it('flags one volume bad on two sub-parameters with both recorded under violatedConfigs', () => {
            const badData: RawVolume = {
                ...dataVolumeOptimal,
                compressionType: 'none',
                compression: 'none',
                deduplication: 'none'
            };

            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([badData, redoVolumeOptimal, archiveVolumeOptimal]),
                'iSCSI'
            );

            const entry = findById(drift, 'storage-efficiencies');
            expect(entry.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(entry.totalObjectsInViolation).toBe(1);
            expect(entry.objectsInViolation).toEqual(['data_vol']);
            expect(entry.violationDetails).toHaveLength(1);

            const detail = entry.violationDetails?.[0];
            expect(detail?.objectName).toBe('data_vol');
            expect(detail?.objectType).toBe('Volume');
            expect(detail?.dataCategory).toBe('non-log-files');
            expect(detail?.violatedConfigs).toEqual([
                { id: 'compression', current: 'none' },
                { id: 'deduplication', current: 'none' }
            ]);
        });

        it('merges dataCategory to "mixed" when components on the same volume disagree', () => {
            const sharedVolumeMap = {
                [OracleSysFileTypes.CONTROL_FILES]: [],
                [OracleSysFileTypes.DATA_FILES]: [
                    { volumeId: 'uuid-shared', volumeName: 'shared_vol' } as OracleVolumeRecord
                ],
                [OracleSysFileTypes.REDO_LOGS]: [
                    { volumeId: 'uuid-shared', volumeName: 'shared_vol' } as OracleVolumeRecord
                ],
                [OracleSysFileTypes.ARCHIVE_LOGS]: [],
                [OracleSysFileTypes.TEMP_FILES]: [],
                [OracleSysFileTypes.FRA]: []
            };

            const sharedVolume: RawVolume = {
                name: 'shared_vol',
                uuid: 'uuid-shared',
                compressionType: 'adaptive',
                compression: 'adaptive',
                deduplication: 'inline',
                compaction: 'enabled',
                tieringPolicy: 'none',
                tieringMinCoolingDays: '',
                ...optimalVolumeDefaults
            };

            const drift = getVolumeConfigDrift(sharedVolumeMap, buildAssessment([sharedVolume]), 'iSCSI');
            const entry = findById(drift, 'storage-efficiencies');
            expect(entry.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            const detail = entry.violationDetails?.[0];
            expect(detail?.dataCategory).toBe('mixed');
            expect(detail?.violatedConfigs?.map(v => v.id)).toEqual(['compression', 'deduplication', 'compaction']);
        });
    });

    describe('tiering-tco-optimization combined config', () => {
        it('flags only tiering-policy on a data-files volume (not cooling-days)', () => {
            const badPolicyData: RawVolume = { ...dataVolumeOptimal, tieringPolicy: 'auto' };
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([badPolicyData, redoVolumeOptimal, archiveVolumeOptimal]),
                'iSCSI'
            );

            const entry = findById(drift, 'tiering-tco-optimization');
            expect(entry.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(entry.configDetails).toEqual(tieringTcoConfigDetails);
            expect(entry.objectsInViolation).toEqual(['data_vol']);
            const detail = entry.violationDetails?.find(d => d.objectName === 'data_vol');
            expect(detail?.violatedConfigs).toEqual([{ id: 'tiering-policy', current: 'auto' }]);
        });

        it('flags only tiering-min-cooling-days on an archive volume when policy is correct', () => {
            const badCoolingArchive: RawVolume = { ...archiveVolumeOptimal, tieringMinCoolingDays: '30' };
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([dataVolumeOptimal, redoVolumeOptimal, badCoolingArchive]),
                'iSCSI'
            );

            const entry = findById(drift, 'tiering-tco-optimization');
            expect(entry.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(entry.objectsInViolation).toEqual(['archive_vol']);
            const detail = entry.violationDetails?.find(d => d.objectName === 'archive_vol');
            expect(detail?.violatedConfigs).toEqual([{ id: 'tiering-min-cooling-days', current: '30' }]);
        });

        it('does not flag tiering-min-cooling-days on a data-files volume even when value differs', () => {
            const badCoolingData: RawVolume = { ...dataVolumeOptimal, tieringMinCoolingDays: '30' };
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([badCoolingData, redoVolumeOptimal, archiveVolumeOptimal]),
                'iSCSI'
            );

            const entry = findById(drift, 'tiering-tco-optimization');
            expect(entry.status).toBe(AssessmentStatus.OPTIMIZED);
            expect(entry.objectsInViolation).toEqual([]);
        });

        it('flags tiering-min-cooling-days on an FRA volume with dataCategory archive-log-files', () => {
            const fraVolumeMap = () => ({
                ...buildVolumeMap(),
                [OracleSysFileTypes.ARCHIVE_LOGS]: [],
                [OracleSysFileTypes.FRA]: [{ volumeId: 'uuid-fra', volumeName: 'fra_vol' } as OracleVolumeRecord]
            });
            const fraVolume: RawVolume = {
                ...archiveVolumeOptimal,
                name: 'fra_vol',
                uuid: 'uuid-fra'
            };
            const badCoolingFra: RawVolume = { ...fraVolume, tieringMinCoolingDays: '30' };
            const drift = getVolumeConfigDrift(
                fraVolumeMap(),
                buildAssessment([dataVolumeOptimal, redoVolumeOptimal, badCoolingFra]),
                'iSCSI'
            );

            const entry = findById(drift, 'tiering-tco-optimization');
            expect(entry.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(entry.objectsInViolation).toEqual(['fra_vol']);
            const detail = entry.violationDetails?.find(d => d.objectName === 'fra_vol');
            expect(detail?.violatedConfigs).toEqual([{ id: 'tiering-min-cooling-days', current: '30' }]);
            expect(detail?.dataCategory).toBe('archive-log-files');
        });

        it('recommends 14 cooling days on FRA when fraEnabled yes and rmanCompressionEnabled no', () => {
            const fraVolumeMap = () => ({
                ...buildVolumeMap(),
                [OracleSysFileTypes.ARCHIVE_LOGS]: [],
                [OracleSysFileTypes.FRA]: [{ volumeId: 'uuid-fra', volumeName: 'fra_vol' } as OracleVolumeRecord]
            });
            const fraVolumeCompliant: RawVolume = {
                ...archiveVolumeOptimal,
                name: 'fra_vol',
                uuid: 'uuid-fra',
                tieringMinCoolingDays: '14'
            };
            const fraVolumeNonCompliant: RawVolume = {
                ...fraVolumeCompliant,
                tieringMinCoolingDays: '2'
            };
            const assessment = (volumes: RawVolume[]) =>
                ({
                    fraEnabled: 'yes',
                    rmanCompressionEnabled: 'no',
                    volumes: {
                        error: '',
                        data: volumes as unknown as Record<string, unknown>[],
                        filesystemId: 'fs-test'
                    }
                } as unknown as StorageAssessment);

            const compliantDrift = getVolumeConfigDrift(
                fraVolumeMap(),
                assessment([dataVolumeOptimal, redoVolumeOptimal, fraVolumeCompliant]),
                'iSCSI'
            );
            expect(findById(compliantDrift, 'tiering-tco-optimization').status).toBe(AssessmentStatus.OPTIMIZED);

            const nonCompliantDrift = getVolumeConfigDrift(
                fraVolumeMap(),
                assessment([dataVolumeOptimal, redoVolumeOptimal, fraVolumeNonCompliant]),
                'iSCSI'
            );
            const entry = findById(nonCompliantDrift, 'tiering-tco-optimization');
            expect(entry.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            const detail = entry.violationDetails?.find(d => d.objectName === 'fra_vol');
            expect(detail?.violatedConfigs).toEqual([{ id: 'tiering-min-cooling-days', current: '2' }]);
        });

        it('treats snapshot_only as compliant on volumes outside mapped file-type lists', () => {
            const uncategorizedVol: RawVolume = {
                name: 'other_vol',
                uuid: 'uuid-other',
                tieringPolicy: 'snapshot_only',
                ...optimalVolumeDefaults
            };

            const drift = getVolumeConfigDrift(buildVolumeMap(), buildAssessment([uncategorizedVol]), 'iSCSI');

            expect(findById(drift, 'tiering-tco-optimization').status).toBe(AssessmentStatus.OPTIMIZED);
        });

        it('aggregates violations across multiple object types and reports totalObjectsAssessed = max(universes)', () => {
            const badPolicyData: RawVolume = { ...dataVolumeOptimal, tieringPolicy: 'auto' };
            const badCoolingArchive: RawVolume = { ...archiveVolumeOptimal, tieringMinCoolingDays: '30' };
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([badPolicyData, redoVolumeOptimal, badCoolingArchive]),
                'iSCSI'
            );

            const entry = findById(drift, 'tiering-tco-optimization');
            expect(entry.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            expect(entry.totalObjectsInViolation).toBe(2);
            expect(entry.totalObjectsAssessed).toBe(3);
            expect(new Set(entry.objectsInViolation)).toEqual(new Set(['data_vol', 'archive_vol']));
        });
    });

    describe('snapshotAutodelete legacy config', () => {
        it('should flag disabled autodelete when golden config expects enabled', () => {
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([
                    { ...dataVolumeOptimal, snapshotAutodelete: 'false' },
                    redoVolumeOptimal,
                    archiveVolumeOptimal
                ]),
                'iSCSI'
            );

            const entry = findById(drift, 'snapshot-autodelete');
            expect(entry?.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            const detail = entry?.violationDetails?.find(d => d.objectName === 'data_vol');
            expect(detail).toEqual({
                objectName: 'data_vol',
                value: 'disabled',
                objectType: 'Volume',
                recommended: 'enabled'
            });
        });

        it('should flag wrong delete order when autodelete is enabled', () => {
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([
                    { ...dataVolumeOptimal, snapshotAutodelete: 'true', snapshotDeleteOrder: 'newest_first' },
                    redoVolumeOptimal,
                    archiveVolumeOptimal
                ]),
                'iSCSI'
            );

            const entry = findById(drift, 'snapshot-autodelete');
            expect(entry?.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
            const detail = entry?.violationDetails?.find(d => d.objectName === 'data_vol');
            expect(detail).toEqual({
                objectName: 'data_vol',
                value: 'newest_first',
                objectType: 'Volume',
                recommended: 'oldest_first'
            });
        });
    });

    describe('snapshot policy rename', () => {
        it('emits the entry under the new "Scheduled local snapshots" name and not the old slug', () => {
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([dataVolumeOptimal, redoVolumeOptimal, archiveVolumeOptimal]),
                'iSCSI'
            );

            const snapshotPolicyEntry = findById(drift, 'snapshot-policy') as CombinedDriftEntry | undefined;
            expect(snapshotPolicyEntry).toBeDefined();
            expect(snapshotPolicyEntry?.name).toBe('Scheduled Local Snapshots');
        });
    });

    describe('legacy standalone drift entries', () => {
        it('should not assess standalone legacy sub-parameter ids for iSCSI', () => {
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([dataVolumeOptimal, redoVolumeOptimal, archiveVolumeOptimal]),
                'iSCSI'
            );

            expect(findById(drift, 'storage-efficiencies')).toBeDefined();
            expect(findById(drift, 'tiering-tco-optimization')).toBeDefined();
            expect(findById(drift, 'compression')).toBeUndefined();
            expect(findById(drift, 'deduplication')).toBeUndefined();
            expect(findById(drift, 'compaction')).toBeUndefined();
            expect(findById(drift, 'tiering-policy')).toBeUndefined();
            expect(findById(drift, 'tiering-min-cooling-days')).toBeUndefined();
            expect(findById(drift, 'fractional-reserve')).toBeUndefined();
            expect(findById(drift, 'space-reservation-enabled')).toBeUndefined();
            expect(findById(drift, 'space-allocation-allocated')).toBeUndefined();
        });

        it('should not assess standalone legacy sub-parameter ids for NFS', () => {
            const drift = getVolumeConfigDrift(
                buildVolumeMap(),
                buildAssessment([dataVolumeOptimal, redoVolumeOptimal, archiveVolumeOptimal]),
                'NFS'
            );

            expect(findById(drift, 'storage-efficiencies')).toBeDefined();
            expect(findById(drift, 'tiering-tco-optimization')).toBeDefined();
            expect(findById(drift, 'compression')).toBeUndefined();
            expect(findById(drift, 'deduplication')).toBeUndefined();
            expect(findById(drift, 'compaction')).toBeUndefined();
            expect(findById(drift, 'tiering-policy')).toBeUndefined();
            expect(findById(drift, 'tiering-min-cooling-days')).toBeUndefined();
            expect(findById(drift, 'fractional-reserve')).toBeUndefined();
        });
    });
});
