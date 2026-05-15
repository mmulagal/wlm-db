import { describe, it, expect } from 'vitest';
import {
    getBaseVolume,
    getNfsOSConfigDrift
} from '../../../../src/operations/continuous-optimization/oracle/storage-assessment-operations';
import { StorageNfsAssessment } from '../../../../src/operations/continuous-optimization/oracle/common-types';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';

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

type DriftEntry = {
    name?: string;
    errorMessage?: string;
    status?: AssessmentStatus;
    violationDetails?: Array<{ objectName?: string; value?: string; recommended?: string }>;
    totalObjectsInViolation?: number;
};

const findEntry = (drift: unknown[], name: string): DriftEntry | undefined =>
    (drift as DriftEntry[]).find(entry => entry?.name === name);

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
            const dbFilesEntries = (drift as DriftEntry[]).filter(e => e?.name === 'nfs-mount-options-databasefiles');
            expect(dbFilesEntries).toHaveLength(1);
            expect(dbFilesEntries[0].errorMessage).toContain('No mapped DB-instance volumes');
            expect(dbFilesEntries[0].status).toBeUndefined();
        });

        it('propagates an nfs-mount-options script error as errorMessage with no duplicate assessment', () => {
            const data = buildAssessmentData({
                hostMountError: 'mount: command failed'
            });

            const drift = getNfsOSConfigDrift(ec2InstanceId, databaseInstanceName, 'Standalone', data);
            const dbFilesEntries = (drift as DriftEntry[]).filter(e => e?.name === 'nfs-mount-options-databasefiles');
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
            const cachingEntries = (drift as DriftEntry[]).filter(e => e?.name === 'nfs-caching-options');
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
