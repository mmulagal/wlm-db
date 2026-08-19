import { beforeEach, describe, expect, it } from 'vitest';

import { resolveOracleMappedOntapVolumes } from '../../../../src/operations/workloads/oracle/oracle-ontap-merge';
import { OracleInstanceMountpointResponse } from '../../../../src/operations/workloads/oracle/common-types';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';

function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

const target = { accountId: 'acct-1', credentialsId: 'creds-1', region: 'us-east-1', fsxId: 'fs-1' };

beforeEach(() => {
    resetProxyOverrides();
});

describe('resolveOracleMappedOntapVolumes', () => {
    it('resolves NFS-mounted single-tenant volumes via SVM-by-IP then volume-by-junction-path', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/svm/svms',
            body: ontapPage([
                {
                    uuid: 'svm-uuid-1',
                    name: 'svm1',
                    ip_interfaces: [{ name: 'nfs_smb_management_1', ip: { address: '10.0.1.10' } }]
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ uuid: 'vol-uuid-1', name: 'oracledata' }])
        });

        const mountPointData: Record<string, OracleInstanceMountpointResponse> = {
            oradbsan: {
                isCDB: false,
                mountDetails: {
                    REDO_LOGS: [],
                    ARCHIVE_LOGS: [],
                    CONTROL_FILES: [],
                    TEMP_FILES: [],
                    FRA: [],
                    DATA_FILES: [
                        {
                            isAsmManaged: false,
                            mountIP: '10.0.1.10',
                            mountPoint: '/oracledata',
                            protocol: 'NFS',
                            copiesCount: 1
                        }
                    ]
                }
            }
        };

        const result = await resolveOracleMappedOntapVolumes(target, mountPointData);

        expect(result.protocol).toBe('NFS');
        expect(result.isASMManaged).toBe(false);
        expect(result.lunRecords).toEqual([]);
        const oradbsan = (result.volumeMappings as unknown as Array<Record<string, any>>).find(
            m => m.oradbsan
        )?.oradbsan;
        expect(oradbsan.isCDB).toBe(false);
        expect(oradbsan.ontapVolumes.DATA_FILES).toEqual([
            {
                volumeName: 'oracledata',
                volumeId: 'vol-uuid-1',
                svmName: 'svm1',
                svmId: 'svm-uuid-1',
                junctionPath: '/oracledata',
                copiesCount: 1
            }
        ]);
    });

    it('resolves iSCSI ASM-managed volumes via LUN-by-serial-number and records unique LUNs', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/luns',
            body: ontapPage([
                {
                    uuid: 'lun-uuid-1',
                    name: '/vol/oracleredo/lun1',
                    serial_number: 'serial-1',
                    svm: { name: 'svm1', uuid: 'svm-uuid-1' },
                    location: { volume: { name: 'oracleredo', uuid: 'vol-uuid-1' } }
                }
            ])
        });

        const mountPointData: Record<string, OracleInstanceMountpointResponse> = {
            oradbsan: {
                isCDB: false,
                mountDetails: {
                    REDO_LOGS: [
                        {
                            isAsmManaged: true,
                            mountIP: '10.0.1.10',
                            mountPoint: 'serial-1',
                            protocol: 'iSCSI',
                            diskName: 'DISK1',
                            diskGroup: 'DGROUP1',
                            copiesCount: 2
                        }
                    ],
                    ARCHIVE_LOGS: [],
                    CONTROL_FILES: [],
                    TEMP_FILES: [],
                    DATA_FILES: [],
                    FRA: []
                }
            }
        };

        const result = await resolveOracleMappedOntapVolumes(target, mountPointData);

        expect(result.protocol).toBe('iSCSI');
        expect(result.isASMManaged).toBe(true);
        expect(result.lunRecords).toEqual([{ name: '/vol/oracleredo/lun1', serial: 'serial-1' }]);
        const oradbsan = (result.volumeMappings as unknown as Array<Record<string, any>>).find(
            m => m.oradbsan
        )?.oradbsan;
        expect(oradbsan.ontapVolumes.REDO_LOGS).toEqual([
            {
                volumeName: 'oracleredo',
                volumeId: 'vol-uuid-1',
                svmName: 'svm1',
                svmId: 'svm-uuid-1',
                lunName: '/vol/oracleredo/lun1',
                lunId: 'lun-uuid-1',
                lunPath: '/vol/oracleredo/lun1',
                copiesCount: 2,
                diskName: 'DISK1',
                diskGroup: 'DGROUP1'
            }
        ]);
    });

    it('should treat the quoted isAsmManaged flag emitted by discovery as a boolean', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/svm/svms',
            body: ontapPage([
                {
                    uuid: 'svm-uuid-1',
                    name: 'svm1',
                    ip_interfaces: [{ name: 'nfs_smb_management_1', ip: { address: '10.0.1.10' } }]
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ uuid: 'vol-uuid-1', name: 'oracledata' }])
        });

        const nonAsmMountPointData: Record<string, OracleInstanceMountpointResponse> = {
            oradbnfs: {
                isCDB: false,
                mountDetails: {
                    REDO_LOGS: [],
                    ARCHIVE_LOGS: [],
                    CONTROL_FILES: [],
                    TEMP_FILES: [],
                    FRA: [],
                    DATA_FILES: [
                        {
                            isAsmManaged: 'false',
                            mountIP: '10.0.1.10',
                            mountPoint: '/oracledata',
                            protocol: 'NFS',
                            copiesCount: 1
                        }
                    ]
                }
            }
        };

        const nonAsmResult = await resolveOracleMappedOntapVolumes(target, nonAsmMountPointData);

        expect(nonAsmResult.isASMManaged).toBe(false);
        const oradbnfs = (nonAsmResult.volumeMappings as unknown as Array<Record<string, any>>).find(
            m => m.oradbnfs
        )?.oradbnfs;
        expect(oradbnfs.ontapVolumes.DATA_FILES[0]).not.toHaveProperty('diskName');
        expect(oradbnfs.ontapVolumes.DATA_FILES[0]).not.toHaveProperty('diskGroup');

        const asmMountPointData: Record<string, OracleInstanceMountpointResponse> = {
            oradbasm: {
                isCDB: false,
                mountDetails: {
                    REDO_LOGS: [],
                    ARCHIVE_LOGS: [],
                    CONTROL_FILES: [],
                    TEMP_FILES: [],
                    FRA: [],
                    DATA_FILES: [
                        {
                            isAsmManaged: 'true',
                            mountIP: '10.0.1.10',
                            mountPoint: '/oracledata',
                            protocol: 'NFS',
                            diskName: 'DISK1',
                            diskGroup: 'DGROUP1',
                            copiesCount: 1
                        }
                    ]
                }
            }
        };

        const asmResult = await resolveOracleMappedOntapVolumes(target, asmMountPointData);

        expect(asmResult.isASMManaged).toBe(true);
        const oradbasm = (asmResult.volumeMappings as unknown as Array<Record<string, any>>).find(
            m => m.oradbasm
        )?.oradbasm;
        expect(oradbasm.ontapVolumes.DATA_FILES[0]).toEqual(
            expect.objectContaining({ diskName: 'DISK1', diskGroup: 'DGROUP1' })
        );
    });

    it('groups volumes per PDB for a CDB with pdbMountDetails', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/svm/svms',
            body: ontapPage([
                {
                    uuid: 'svm-uuid-1',
                    name: 'svm1',
                    ip_interfaces: [{ name: 'nfs_smb_management_1', ip: { address: '10.0.1.10' } }]
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ uuid: 'vol-uuid-pdb1', name: 'pdb1data' }])
        });

        const mountPointData: Record<string, OracleInstanceMountpointResponse> = {
            oracdb: {
                isCDB: true,
                pdbMountDetails: {
                    pdb1: {
                        REDO_LOGS: [],
                        ARCHIVE_LOGS: [],
                        CONTROL_FILES: [],
                        TEMP_FILES: [],
                        FRA: [],
                        DATA_FILES: [
                            {
                                isAsmManaged: false,
                                mountIP: '10.0.1.10',
                                mountPoint: '/pdb1data',
                                protocol: 'NFS',
                                copiesCount: 1
                            }
                        ]
                    }
                }
            }
        };

        const result = await resolveOracleMappedOntapVolumes(target, mountPointData);

        const oracdb = (result.volumeMappings as unknown as Array<Record<string, any>>).find(m => m.oracdb)?.oracdb;
        expect(oracdb.isCDB).toBe(true);
        expect(oracdb.ontapVolumes.pdb1.DATA_FILES).toEqual([
            expect.objectContaining({ volumeName: 'pdb1data', volumeId: 'vol-uuid-pdb1' })
        ]);
    });

    it('leaves iSCSI volumes unresolved (instead of throwing) when the LUN-by-serial lookup fails, without affecting NFS SIDs', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/luns',
            status: 500,
            body: { errorMessage: 'Internal server error' }
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/svm/svms',
            body: ontapPage([
                {
                    uuid: 'svm-uuid-1',
                    name: 'svm1',
                    ip_interfaces: [{ name: 'nfs_smb_management_1', ip: { address: '10.0.1.10' } }]
                }
            ])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([{ uuid: 'vol-uuid-1', name: 'oracledata' }])
        });

        const mountPointData: Record<string, OracleInstanceMountpointResponse> = {
            oradbnfs: {
                isCDB: false,
                mountDetails: {
                    REDO_LOGS: [],
                    ARCHIVE_LOGS: [],
                    CONTROL_FILES: [],
                    TEMP_FILES: [],
                    FRA: [],
                    DATA_FILES: [
                        {
                            isAsmManaged: false,
                            mountIP: '10.0.1.10',
                            mountPoint: '/oracledata',
                            protocol: 'NFS',
                            copiesCount: 1
                        }
                    ]
                }
            },
            oradbsan: {
                isCDB: false,
                mountDetails: {
                    REDO_LOGS: [{ isAsmManaged: true, mountPoint: 'serial-1', protocol: 'iSCSI', copiesCount: 2 }],
                    ARCHIVE_LOGS: [],
                    CONTROL_FILES: [],
                    TEMP_FILES: [],
                    DATA_FILES: [],
                    FRA: []
                }
            }
        };

        const result = await resolveOracleMappedOntapVolumes(target, mountPointData);
        const byName = result.volumeMappings as unknown as Array<Record<string, any>>;

        const oradbnfs = byName.find(m => m.oradbnfs)?.oradbnfs;
        expect(oradbnfs.ontapVolumes.DATA_FILES).toEqual([
            expect.objectContaining({ volumeName: 'oracledata', volumeId: 'vol-uuid-1' })
        ]);

        const oradbsan = byName.find(m => m.oradbsan)?.oradbsan;
        expect(oradbsan.error).toBeUndefined();
        expect(oradbsan.ontapVolumes.REDO_LOGS).toEqual([
            expect.objectContaining({ volumeName: '', volumeId: '', lunName: undefined, lunId: undefined })
        ]);
    });

    it('passes through a mount-discovery error without attempting ONTAP resolution', async () => {
        const mountPointData: Record<string, OracleInstanceMountpointResponse> = {
            oradbsan: { error: 'Mount detail retrieval failed for Oracle instance.' }
        };

        const result = await resolveOracleMappedOntapVolumes(target, mountPointData);

        expect(result.volumeMappings).toEqual([
            { oradbsan: { error: 'Mount detail retrieval failed for Oracle instance.' } }
        ]);
        expect(result.protocol).toBeUndefined();
        expect(result.isASMManaged).toBe(false);
    });
});
