import { DATABASE_TYPE } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { collectOntapAssessmentData } from '../../../src/operations/continuous-optimization/ontap-proxy-collector';
import { Ec2FsxRelationship } from '../../../src/operations/cloud-manager/tagging-service-operations';
import { StorageAssessment as OracleStorageAssessment } from '../../../src/operations/continuous-optimization/oracle/common-types';
import { StorageAssessment as MssqlStorageAssessment } from '../../../src/utils/common-types';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../simulator/scopes/cloud-manager/proxy-forwarder-scope';

function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

function buildRelationship(ec2s: Ec2FsxRelationship['ec2s']): Ec2FsxRelationship {
    return { ec2s };
}

beforeEach(() => {
    resetProxyOverrides();
});

describe('collectOntapAssessmentData', () => {
    it('builds an MSSQL storage assessment from ONTAP volume and LUN records', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([
                {
                    name: 'sqldata',
                    uuid: 'vol-uuid-1',
                    svm: { name: 'svm1', uuid: 'svm-uuid-1' },
                    autosize: { mode: 'grow' },
                    guarantee: { honored: true, type: 'volume' },
                    space: {
                        fractional_reserve: 0,
                        snapshot: { reserve_percent: 5, autodelete: { enabled: true, delete_order: 'oldest_first' } }
                    },
                    snapshot_policy: { name: 'default' },
                    tiering: { policy: 'auto', min_cooling_days: 30 }
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/luns',
            body: ontapPage([
                {
                    name: 'sqldata-lun',
                    uuid: 'lun-uuid-1',
                    os_type: 'windows',
                    space: { guarantee: { requested: false }, scsi_thin_provisioning_support_enabled: true }
                }
            ])
        });

        const relationship = buildRelationship([
            {
                instanceId: 'i-1',
                workloadTypes: [DATABASE_TYPE.mssql],
                workloads: [],
                fsxs: [
                    {
                        id: 'fs-1',
                        fileSystemId: 'fs-1',
                        fsxName: 'SQL storage',
                        region: 'us-east-1',
                        volumes: [
                            {
                                id: 'vol-1',
                                fsxVolumeId: 'fsvol-1',
                                volumeUuid: 'vol-uuid-1',
                                volumeName: 'sqldata',
                                luns: [{ id: 'lun-1', lunUuid: 'lun-uuid-1', lunName: 'sqldata-lun' }]
                            }
                        ]
                    }
                ]
            }
        ]);

        const results = await collectOntapAssessmentData('acct-1', 'cred-1', relationship);

        expect(results).toHaveLength(1);
        const [{ instanceId, fileSystemId, workloadType, storageAssessment }] = results;
        expect(instanceId).toBe('i-1');
        expect(fileSystemId).toBe('fs-1');
        expect(workloadType).toBe('mssql');

        const assessment = storageAssessment as MssqlStorageAssessment;
        expect(assessment.filesystemId).toBe('fs-1');
        expect(assessment.volumes).toEqual([
            {
                name: 'sqldata',
                uuid: 'vol-uuid-1',
                svmName: 'svm1',
                svmUuid: 'svm-uuid-1',
                'thin-provision': true,
                'space-guarantee': 'volume',
                'autosize-mode': 'grow',
                autosize: 'on',
                'fractional-reserve': 0,
                'snapshot-copy-reserve': 5,
                'snapshot-autodelete': true,
                'snapshot-policy': 'default',
                'tiering-policy': 'auto',
                'tiering-min-cooling-days': 30
            }
        ]);
        expect(assessment.luns).toEqual([
            {
                name: 'sqldata-lun',
                'os-type': 'windows',
                'space-reservation-enabled': false,
                'space-allocation-allocated': true
            }
        ]);
        expect(assessment.errors.volumes).toBe('');
        expect(assessment.errors.luns).toBe('');
        expect(assessment.errors.layout).toBe('Not collected via proxy forwarder');
    });

    it('builds an Oracle storage assessment, including space-mgmt-try-first from the private CLI lookup', async () => {
        registerProxyGetResponse({
            targetId: 'fs-2',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([
                {
                    name: 'oradata',
                    uuid: 'vol-uuid-2',
                    nas: { path: '/oradata' },
                    autosize: { mode: 'off' },
                    guarantee: { honored: false, type: 'none' },
                    space: { fractional_reserve: 10, snapshot: { reserve_percent: 0, autodelete: { enabled: false } } },
                    svm: { name: 'svm2', uuid: 'svm-uuid-2' },
                    efficiency: {
                        compression: 'inline',
                        compression_type: 'secondary',
                        compaction: 'inline',
                        dedupe: 'background',
                        storage_efficiency_mode: 'default'
                    }
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-2',
            ontapPath: 'api/private/cli/volume',
            body: ontapPage([{ volume: 'oradata', space_mgmt_try_first: 'volume_grow' }])
        });

        const relationship = buildRelationship([
            {
                instanceId: 'i-2',
                workloadTypes: [DATABASE_TYPE.oracle],
                workloads: [],
                fsxs: [
                    {
                        id: 'fs-2',
                        fileSystemId: 'fs-2',
                        region: 'us-east-1',
                        volumes: [
                            {
                                id: 'vol-2',
                                fsxVolumeId: 'fsvol-2',
                                volumeUuid: 'vol-uuid-2',
                                volumeName: 'oradata',
                                luns: []
                            }
                        ]
                    }
                ]
            }
        ]);

        const results = await collectOntapAssessmentData('acct-1', 'cred-1', relationship);

        expect(results).toHaveLength(1);
        const assessment = results[0].storageAssessment as OracleStorageAssessment;
        expect(assessment.volumes.filesystemId).toBe('fs-2');
        expect(assessment.volumes.error).toBe('');
        expect(assessment.volumes.data).toEqual([
            expect.objectContaining({
                name: 'oradata',
                uuid: 'vol-uuid-2',
                junctionPath: '/oradata',
                spaceMgmtTryFirst: 'volume_grow',
                autosize: 'off'
            })
        ]);
        // No LUNs attached and no fetch error -> "not applicable" rather than a blank error.
        expect(assessment.luns?.error).toBe('LUNs not applicable');
        expect(assessment.luns?.data).toEqual([]);
    });

    it('scopes volumes/LUNs per EC2 when multiple EC2s share the same FSx file system', async () => {
        registerProxyGetResponse({
            targetId: 'fs-shared',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([
                { name: 'vol-a', uuid: 'uuid-a' },
                { name: 'vol-b', uuid: 'uuid-b' }
            ])
        });

        const relationship = buildRelationship([
            {
                instanceId: 'i-a',
                workloadTypes: [DATABASE_TYPE.mssql],
                workloads: [],
                fsxs: [
                    {
                        id: 'fs-shared',
                        fileSystemId: 'fs-shared',
                        region: 'us-east-1',
                        volumes: [
                            { id: 'v-a', fsxVolumeId: 'fsvol-a', volumeUuid: 'uuid-a', volumeName: 'vol-a', luns: [] }
                        ]
                    }
                ]
            },
            {
                instanceId: 'i-b',
                workloadTypes: [DATABASE_TYPE.mssql],
                workloads: [],
                fsxs: [
                    {
                        id: 'fs-shared',
                        fileSystemId: 'fs-shared',
                        region: 'us-east-1',
                        volumes: [
                            { id: 'v-b', fsxVolumeId: 'fsvol-b', volumeUuid: 'uuid-b', volumeName: 'vol-b', luns: [] }
                        ]
                    }
                ]
            }
        ]);

        const results = await collectOntapAssessmentData('acct-1', 'cred-1', relationship);

        expect(results).toHaveLength(2);
        const resultA = results.find(r => r.instanceId === 'i-a')!;
        const resultB = results.find(r => r.instanceId === 'i-b')!;

        const volumeNames = (assessment: MssqlStorageAssessment) =>
            (assessment.volumes as unknown as { name: string }[]).map(v => v.name);
        // Each EC2 only sees the volume it is attached to, even though the shared FSx
        // inventory fetch returns records for both.
        expect(volumeNames(resultA.storageAssessment as MssqlStorageAssessment)).toEqual(['vol-a']);
        expect(volumeNames(resultB.storageAssessment as MssqlStorageAssessment)).toEqual(['vol-b']);
    });

    it('produces one result per workload type when an EC2 runs multiple database workloads', async () => {
        registerProxyGetResponse({
            targetId: 'fs-multi',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ name: 'vol', uuid: 'uuid-multi' }])
        });

        const relationship = buildRelationship([
            {
                instanceId: 'i-multi',
                workloadTypes: [DATABASE_TYPE.mssql, DATABASE_TYPE.oracle],
                workloads: [],
                fsxs: [
                    {
                        id: 'fs-multi',
                        fileSystemId: 'fs-multi',
                        region: 'us-east-1',
                        volumes: [
                            {
                                id: 'v-multi',
                                fsxVolumeId: 'fsvol-multi',
                                volumeUuid: 'uuid-multi',
                                volumeName: 'vol',
                                luns: []
                            }
                        ]
                    }
                ]
            }
        ]);

        const results = await collectOntapAssessmentData('acct-1', 'cred-1', relationship);

        expect(results).toHaveLength(2);
        expect(results.map(r => r.workloadType).sort()).toEqual(['mssql', 'oracle']);
    });

    it('records a fetch error without failing the whole collection when volumes fail to load', async () => {
        registerProxyGetResponse({
            targetId: 'fs-err',
            ontapPath: 'api/storage/volumes',
            status: 404,
            body: { errorMessage: 'target not found' }
        });

        const relationship = buildRelationship([
            {
                instanceId: 'i-err',
                workloadTypes: [DATABASE_TYPE.mssql],
                workloads: [],
                fsxs: [
                    {
                        id: 'fs-err',
                        fileSystemId: 'fs-err',
                        region: 'us-east-1',
                        volumes: [
                            {
                                id: 'v-err',
                                fsxVolumeId: 'fsvol-err',
                                volumeUuid: 'uuid-err',
                                volumeName: 'vol-err',
                                luns: []
                            }
                        ]
                    }
                ]
            }
        ]);

        const results = await collectOntapAssessmentData('acct-1', 'cred-1', relationship);

        expect(results).toHaveLength(1);
        const assessment = results[0].storageAssessment as MssqlStorageAssessment;
        expect(assessment.volumes).toEqual([]);
        expect(assessment.errors.volumes).toContain('fs-err');
        expect(assessment.errors.luns).toBe('');
    });
});
