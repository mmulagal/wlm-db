import { beforeEach, describe, expect, it } from 'vitest';
import {
    fetchDirectOntapAssessmentData,
    fetchLunsBySerialNumbers,
    enrichRawDriveDetailsWithOntapIdentity,
    buildLayoutAndSizing
} from '../../../../src/operations/continuous-optimization/mssql/storage-ontap-merge';
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
        name: 'MSSQLSERVER',
        type: 'mssql',
        region: 'us-east-1',
        sqlAuthEnabled: false,
        fsxFileSystem: 'fs-1',
        activeNodeInstanceid: 'i-1',
        resourceName: 'test-resource',
        mappedVolumeNames: ['sqldata'],
        mappedVolumesUuids: ['vol-uuid-1'],
        mappedLunNames: ['sqldata-lun'],
        svmOntapUuid: 'svm-uuid-1',
        ...overrides
    };
}

beforeEach(() => {
    resetProxyOverrides();
});

describe('fetchDirectOntapAssessmentData', () => {
    it('fetches volumes, footprint and luns and shapes them like the old PowerShell code did', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([
                {
                    name: 'sqldata',
                    uuid: 'vol-uuid-1',
                    guarantee: { honored: true, type: 'volume' },
                    autosize: { mode: 'grow' },
                    space: {
                        fractional_reserve: 0,
                        snapshot: { reserve_percent: 5, autodelete: { enabled: false } }
                    },
                    snapshot_policy: { name: 'default' },
                    tiering: { policy: 'auto', min_cooling_days: 30 },
                    efficiency: {
                        compression: 'inline',
                        compression_type: 'secondary',
                        dedupe: 'inline',
                        compaction: 'inline'
                    }
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/private/cli/volume/show-footprint',
            body: ontapPage([{ volume: 'sqldata', volume_blocks_footprint_bin0_percent: 95 }])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/luns',
            body: ontapPage([
                {
                    name: 'sqldata-lun',
                    os_type: 'windows',
                    space: { guarantee: { requested: false }, scsi_thin_provisioning_support_enabled: true }
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/private/cli/volume',
            body: ontapPage([{ volume: 'sqldata', space_mgmt_try_first: 'volume_grow' }])
        });

        const result = await fetchDirectOntapAssessmentData('acct-1', buildInstanceRecord());

        expect(JSON.parse(result.volumesJson)).toEqual([
            {
                name: 'sqldata',
                uuid: 'vol-uuid-1',
                'thin-provision': true,
                'space-guarantee': 'volume',
                'autosize-mode': 'grow',
                autosize: 'on',
                'fractional-reserve': 0,
                'snapshot-copy-reserve': 5,
                'snapshot-autodelete': false,
                'snapshot-policy': 'default',
                'tiering-policy': 'auto',
                'tiering-min-cooling-days': 30,
                compression: 'inline',
                compressionType: 'secondary',
                deduplication: 'inline',
                compaction: 'inline',
                'space-mgmt-try-first': 'volume_grow'
            }
        ]);
        expect(JSON.parse(result.performanceTierJson)).toEqual([{ volumeName: 'sqldata', performanceTierPercent: 95 }]);
        expect(JSON.parse(result.lunsJson)).toEqual([
            {
                name: 'sqldata-lun',
                'os-type': 'windows',
                'space-reservation-enabled': false,
                'space-allocation-allocated': true
            }
        ]);
        expect(result.errors).toEqual({});
    });

    it('records a spaceMgmtTryFirst error (alongside the sizing error sharing the same volume names) without failing volumes/luns', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ name: 'sqldata', uuid: 'vol-uuid-1' }])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/luns',
            body: ontapPage([{ name: 'sqldata-lun', os_type: 'windows', space: {} }])
        });

        const result = await fetchDirectOntapAssessmentData('acct-1', buildInstanceRecord({ mappedVolumeNames: [] }));

        expect(result.errors.spaceMgmtTryFirst).toContain('mapped volume names');
        expect(result.errors.sizing).toContain('mapped volume names');
        expect(result.errors.volumes).toBeUndefined();
        expect(result.errors.luns).toBeUndefined();
        expect(JSON.parse(result.volumesJson)[0]).not.toHaveProperty('space-mgmt-try-first');
    });

    it('records a per-lookup error without failing the others when mapped identifiers are missing', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/luns',
            body: ontapPage([{ name: 'sqldata-lun', os_type: 'windows', space: {} }])
        });

        const result = await fetchDirectOntapAssessmentData(
            'acct-1',
            buildInstanceRecord({ mappedVolumesUuids: [], mappedVolumeNames: [] })
        );

        expect(result.volumesJson).toBe('[]');
        expect(result.performanceTierJson).toBe('[]');
        expect(result.errors.volumes).toContain('mapped volume UUIDs');
        expect(result.errors.sizing).toContain('mapped volume names');
        expect(JSON.parse(result.lunsJson)).toHaveLength(1);
        expect(result.errors.luns).toBeUndefined();
    });
});

describe('fetchLunsBySerialNumbers', () => {
    it('returns an empty result without calling the proxy when there are no serial numbers', async () => {
        const result = await fetchLunsBySerialNumbers('acct-1', buildInstanceRecord(), []);
        expect(result).toEqual({ luns: [] });
    });

    it('fetches luns filtered by serial number', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/luns',
            body: ontapPage([
                {
                    name: '/vol/sqldata/sqldata',
                    uuid: 'lun-uuid-1',
                    serial_number: 'serial-1',
                    svm: { name: 'svm1' },
                    location: { volume: { name: 'sqldata', uuid: 'vol-uuid-1' } }
                }
            ])
        });

        const result = await fetchLunsBySerialNumbers('acct-1', buildInstanceRecord(), ['serial-1']);

        expect(result.error).toBeUndefined();
        expect(result.luns).toEqual([
            {
                name: '/vol/sqldata/sqldata',
                uuid: 'lun-uuid-1',
                serial_number: 'serial-1',
                svm: { name: 'svm1' },
                location: { volume: { name: 'sqldata', uuid: 'vol-uuid-1' } }
            }
        ]);
    });

    it('reports an error instead of throwing when no luns match the requested serial numbers', async () => {
        registerProxyGetResponse({ targetId: 'fs-1', ontapPath: 'api/storage/luns', body: ontapPage([]) });

        const result = await fetchLunsBySerialNumbers('acct-1', buildInstanceRecord(), ['missing-serial']);

        expect(result.luns).toEqual([]);
        expect(result.error).toContain('Unable to fetch lun details');
    });
});

describe('enrichRawDriveDetailsWithOntapIdentity', () => {
    it('attaches lunPath/ontapVolume*/svmName by matching disk serial number', () => {
        const enriched = enrichRawDriveDetailsWithOntapIdentity(
            {
                data: [{ name: 'Nachos', lunSerialNumber: 'serial-1', sizeInMb: 100, diskNumber: 6 }],
                log: [{ name: 'Nachos', lunSerialNumber: 'serial-2', sizeInMb: 10, diskNumber: 8 }],
                tempDb: [{ name: 'tempdev', lunSerialNumber: 'serial-3', sizeInMb: 40, diskNumber: 6 }]
            },
            [
                {
                    name: '/vol/wlmdb_sqldata/sqldata',
                    uuid: 'lun-1',
                    serial_number: 'serial-1',
                    svm: { name: 'svm1' },
                    location: { volume: { name: 'wlmdb_sqldata', uuid: 'ontap-vol-1' } }
                },
                {
                    name: '/vol/wlmdb_sqllog/sqllog',
                    uuid: 'lun-2',
                    serial_number: 'serial-2',
                    svm: { name: 'svm1' },
                    location: { volume: { name: 'wlmdb_sqllog', uuid: 'ontap-vol-2' } }
                }
                // No lun for serial-3 (tempdb) - it should be left un-enriched, not dropped.
            ]
        );

        expect(enriched.data[0]).toMatchObject({
            lunPath: '/vol/wlmdb_sqldata/sqldata',
            ontapVolumeUuid: 'ontap-vol-1'
        });
        expect(enriched.log[0]).toMatchObject({ lunPath: '/vol/wlmdb_sqllog/sqllog', ontapVolumeUuid: 'ontap-vol-2' });
        expect(enriched.tempDb[0]).toEqual({
            name: 'tempdev',
            lunSerialNumber: 'serial-3',
            sizeInMb: 40,
            diskNumber: 6
        });
    });
});

describe('buildLayoutAndSizing', () => {
    it('mirrors the shape the PowerShell consolidation block used to produce', () => {
        const lunsBySerial = [
            {
                name: '/vol/wlmdb_sqldata/sqldata',
                uuid: 'lun-data',
                serial_number: 'serial-data',
                svm: { name: 'svm1' },
                location: { volume: { name: 'wlmdb_sqldata', uuid: 'ontap-vol-data' } }
            },
            {
                name: '/vol/wlmdb_sqllog/sqllog',
                uuid: 'lun-log',
                serial_number: 'serial-log',
                svm: { name: 'svm1' },
                location: { volume: { name: 'wlmdb_sqllog', uuid: 'ontap-vol-log' } }
            },
            {
                name: '/vol/wlmdb_sqltemp/tempdb',
                uuid: 'lun-tempdb',
                serial_number: 'serial-tempdb',
                svm: { name: 'svm1' },
                location: { volume: { name: 'wlmdb_sqltemp', uuid: 'ontap-vol-tempdb' } }
            }
        ];

        const result = buildLayoutAndSizing(
            {
                // msdb shares data+log drives but has no matching serialKeyed entry (not iSCSI in
                // this fixture), mirroring the real-world "raw passthrough, no ontap fields" case.
                allDriveDetails: [
                    {
                        databaseName: 'msdb',
                        dataDriveLetter: 'S:',
                        dataDriveTotalSizeMB: 3071820,
                        logDriveLetter: 'S:',
                        logDriveTotalSizeMB: 307
                    },
                    {
                        databaseName: 'Nachos',
                        dataDriveLetter: 'F:',
                        dataDriveTotalSizeMB: 429420,
                        logDriveLetter: 'G:',
                        logDriveTotalSizeMB: 97
                    }
                ],
                defaultTempDBDriveDetails: [
                    {
                        tempdbDriveLetter: 'T:',
                        tempdbDriveTotalSizeMB: 42,
                        dataDriveLetter: 'S:',
                        dataDriveTotalSizeMB: 9731000
                    }
                ],
                serialKeyedDriveDetails: {
                    data: [
                        {
                            name: 'Nachos',
                            lunSerialNumber: 'serial-data',
                            sizeInMb: 100,
                            diskNumber: 6,
                            accessPaths: ['F:\\'],
                            driveLetter: 'F:'
                        }
                    ],
                    log: [
                        {
                            name: 'Nachos',
                            lunSerialNumber: 'serial-log',
                            sizeInMb: 10,
                            diskNumber: 8,
                            accessPaths: ['G:\\'],
                            driveLetter: 'G:'
                        }
                    ],
                    tempDb: [
                        {
                            name: 'tempdev',
                            lunSerialNumber: 'serial-tempdb',
                            sizeInMb: 8,
                            diskNumber: 3,
                            accessPaths: ['T:\\'],
                            driveLetter: 'T:'
                        }
                    ]
                }
            },
            lunsBySerial
        );

        // msdb: no matching serialKeyed log entry -> passed through unenriched.
        expect(result.dataLogDriveDetails).toContainEqual({
            databaseName: 'msdb',
            dataDriveLetter: 'S:',
            dataDriveTotalSizeMB: 3071820,
            logDriveLetter: 'S:',
            logDriveTotalSizeMB: 307
        });
        // Nachos: enriched with ONTAP identity + access paths.
        expect(result.dataLogDriveDetails).toContainEqual(
            expect.objectContaining({
                databaseName: 'Nachos',
                ontapVolumeName: 'wlmdb_sqllog',
                ontapVolumeUuid: 'ontap-vol-log',
                lunUuid: 'lun-log',
                diskSerialNumber: 'serial-log',
                dataAccessPath: 'F:\\',
                logAccessPath: 'G:\\'
            })
        );

        expect(result.dataTempdbDriveDetails).toEqual(
            expect.objectContaining({
                tempdbDriveLetter: 'T:',
                tempdbDriveTotalSizeMB: 42,
                ontapVolumeName: 'wlmdb_sqltemp',
                ontapVolumeUuid: 'ontap-vol-tempdb',
                lunUuid: 'lun-tempdb'
            })
        );

        expect(result.userDatabaseLayout.data).toEqual([
            expect.objectContaining({
                diskNumber: 6,
                lunPath: '/vol/wlmdb_sqldata/sqldata',
                databaseDetails: [{ name: 'Nachos', sizeInMb: 100 }]
            })
        ]);
        expect(result.userDatabaseLayout.tempDb).toEqual([expect.objectContaining({ diskNumber: 3, name: 'tempdev' })]);
    });
});
