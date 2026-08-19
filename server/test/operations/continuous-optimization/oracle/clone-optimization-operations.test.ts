import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ClonedVolumeDetail } from '../../../../src/utils/common-types';
import {
    OracleMappedOntapVolumesResponse,
    OracleVolumeRecord
} from '../../../../src/operations/workloads/oracle/common-types';
import {
    validateAndExtractClonedVolumeUuids,
    buildVolumeMaps,
    extractInstancesToOptimize,
    deleteClone
} from '../../../../src/operations/continuous-optimization/oracle/clone-optimization-operations';
import { buildCloneCleanupScript } from '../../../../src/operations/continuous-optimization/oracle/ssm-scripts/clone-cleanup-scripts';
import { createResource, deleteResource } from '../../../../src/lib/database/db';
import { createDatabaseInstanceConfigData } from '../../../../src/lib/database/database-instance-config';
import { AssessmentCategoriesOracle } from '../../../../src/utils/continous-optimization-consts';
import * as ssmOperations from '../../../../src/operations/aws/ssm-operations';
import {
    registerProxyGetResponse,
    registerProxyDeleteResponse,
    resetProxyOverrides,
    getCapturedProxyGetUris,
    getCapturedProxyPatchUris,
    getCapturedProxyDeleteUris
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import { ACCOUNT_ID } from '../../../utils/consts';

vi.mock('../../../../src/utils/utils', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../../src/utils/utils')>();
    return { ...actual, IS_DEMO_FLOW: false };
});

const CREDENTIALS_ID = 'test-credentials-id';
const REGION = 'us-east-1';
const FSX_ID = 'fs-0123456789abcdef0';

function buildVolumeRecord(overrides: Partial<OracleVolumeRecord> = {}): OracleVolumeRecord {
    return {
        volumeId: 'uuid-default',
        volumeName: 'vol-default',
        ...overrides
    };
}

describe('buildCloneCleanupScript', () => {
    const baseParams = {
        junctionPaths: ['/clone_vol_1'],
        protocol: 'NFS',
        cloneDatabaseName: 'CLONE_DB'
    };

    it('should generate a bash script with correct structure', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('#!/bin/bash');
        expect(script).toContain('set -euo pipefail');
        expect(script).toContain('/clone_vol_1');
        expect(script).toContain('CLONE_DB');
        expect(script).toContain('Clone Cleanup started');
    });

    it('should take junction paths as an input instead of fetching them from ONTAP', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('clone_junction_paths = ["/clone_vol_1"]');
        expect(script).not.toContain('ontapRestApiScript');
        expect(script).not.toContain('ontapRestApiRequest');
        expect(script).not.toContain('getFsxCredentials');
        expect(script).not.toContain('fields=nas.path,name');
    });

    it('should use clone database name for Oracle shutdown instead of parent SID', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('clone_database_name = "CLONE_DB"');
        expect(script).toContain('Shutting down Oracle clone database');
        expect(script).toContain('parts[0] == clone_database_name');
    });

    it('should include NFS unmount steps for clone junction paths when protocol is NFS', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('protocol = "NFS"');
        expect(script).toContain('Unmounting clone NFS mount points');
        expect(script).toContain('for jp in clone_junction_paths');
    });

    it('should skip NFS unmount for iSCSI protocol', () => {
        const script = buildCloneCleanupScript({
            ...baseParams,
            protocol: 'iSCSI'
        });

        expect(script).toContain('protocol = "iSCSI"');
    });

    it('should embed all junction paths in the script', () => {
        const junctionPaths = ['/vol/aaa', '/vol/bbb', '/vol/ccc'];
        const script = buildCloneCleanupScript({ ...baseParams, junctionPaths });

        for (const junctionPath of junctionPaths) {
            expect(script).toContain(junctionPath);
        }
    });

    it('should not contain parent oracleSid references', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).not.toContain('oracle_sid');
    });

    it('should include cleanedPaths and unmountedPaths in final output, but not deletedVolumes', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('cleanedPaths');
        expect(script).toContain('cleaned_paths');
        expect(script).toContain('unmountedPaths');
        expect(script).not.toContain('deletedVolumes');
    });

    it('should resolve mount points from /proc/mounts instead of using junction paths directly', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('resolve_nfs_mount_point');
        expect(script).toContain('/proc/mounts');
    });
});

describe('validateAndExtractClonedVolumeUuids', () => {
    it('should return valid result when parent volume maps exclusively to one database', () => {
        const volumeMap = new Map<string, string[]>([['parent-uuid-1', ['ORCL']]]);
        const nameToUUIDMap = new Map<string, string>([['parent_vol', 'parent-uuid-1']]);
        const clonedVolumeDetails: ClonedVolumeDetail[] = [
            {
                cloneVolumeUuid: 'clone-uuid-1',
                cloneVolumeName: 'clone_vol',
                sourceVolumeName: 'parent_vol',
                cloneDatabaseName: 'clone_db_name'
            }
        ];

        const result = validateAndExtractClonedVolumeUuids(
            'clone_db_name',
            clonedVolumeDetails,
            volumeMap,
            nameToUUIDMap
        );

        expect(result.isValid).toBe(true);
        if (result.isValid) {
            expect(result.volumeUuids).toEqual(['clone-uuid-1']);
            expect(result.volumeNames).toBe('clone_vol');
        }
    });

    it('should return isValid false with reason when parent volume is shared with multiple databases', () => {
        const volumeMap = new Map<string, string[]>([['parent-uuid-1', ['cloneDb', 'otherDb']]]);
        const nameToUUIDMap = new Map<string, string>([['parent_vol', 'parent-uuid-1']]);
        const clonedVolumeDetails: ClonedVolumeDetail[] = [
            {
                cloneVolumeUuid: 'clone-uuid-1',
                cloneVolumeName: 'clone_vol',
                sourceVolumeName: 'parent_vol',
                cloneDatabaseName: 'cloneDb'
            }
        ];

        const result = validateAndExtractClonedVolumeUuids('cloneDb', clonedVolumeDetails, volumeMap, nameToUUIDMap);

        expect(result.isValid).toBe(false);
        if (!result.isValid) {
            expect(result.reason).toContain('associated with 2 databases');
        }
    });

    it('should return isValid false with reason when parent volume name is not in the name-to-UUID map', () => {
        const volumeMap = new Map<string, string[]>();
        const nameToUUIDMap = new Map<string, string>();
        const clonedVolumeDetails: ClonedVolumeDetail[] = [
            {
                cloneVolumeUuid: 'clone-uuid-1',
                cloneVolumeName: 'clone_vol',
                sourceVolumeName: 'unknown_parent',
                cloneDatabaseName: 'cloneDb'
            }
        ];

        const result = validateAndExtractClonedVolumeUuids('cloneDb', clonedVolumeDetails, volumeMap, nameToUUIDMap);

        expect(result.isValid).toBe(false);
        if (!result.isValid) {
            expect(result.reason).toContain('Parent volume mapping not found');
        }
    });

    it('should throw NOT_FOUND when cloneDatabaseName is undefined', () => {
        const volumeMap = new Map<string, string[]>();
        const nameToUUIDMap = new Map<string, string>();

        expect(() =>
            validateAndExtractClonedVolumeUuids(undefined as unknown as string, [], volumeMap, nameToUUIDMap)
        ).toThrow();
    });

    it('should throw NOT_FOUND when clonedVolumeDetails is undefined', () => {
        const volumeMap = new Map<string, string[]>();
        const nameToUUIDMap = new Map<string, string>();

        expect(() =>
            validateAndExtractClonedVolumeUuids(
                'cloneDb',
                undefined as unknown as ClonedVolumeDetail[],
                volumeMap,
                nameToUUIDMap
            )
        ).toThrow();
    });

    it('should throw NOT_FOUND when cloneVolumeUuid is missing', () => {
        const volumeMap = new Map<string, string[]>();
        const nameToUUIDMap = new Map<string, string>();
        const clonedVolumeDetails: ClonedVolumeDetail[] = [
            { cloneVolumeName: 'clone_vol', sourceVolumeName: 'parent_vol', cloneDatabaseName: 'cloneDb' }
        ];

        expect(() =>
            validateAndExtractClonedVolumeUuids('cloneDb', clonedVolumeDetails, volumeMap, nameToUUIDMap)
        ).toThrow();
    });

    it('should throw NOT_FOUND when sourceVolumeName is missing', () => {
        const volumeMap = new Map<string, string[]>();
        const nameToUUIDMap = new Map<string, string>();
        const clonedVolumeDetails: ClonedVolumeDetail[] = [
            { cloneVolumeUuid: 'clone-uuid-1', cloneVolumeName: 'clone_vol', cloneDatabaseName: 'cloneDb' }
        ];

        expect(() =>
            validateAndExtractClonedVolumeUuids('cloneDb', clonedVolumeDetails, volumeMap, nameToUUIDMap)
        ).toThrow();
    });
});

describe('buildVolumeMaps', () => {
    it('should build maps from flat (non-CDB) volume mappings', () => {
        const config: Record<string, OracleMappedOntapVolumesResponse> = {
            [FSX_ID]: {
                protocol: 'NFS',
                volumeMappings: [
                    {
                        ORCL: {
                            isCDB: false,
                            ontapVolumes: {
                                DATA_FILES: [buildVolumeRecord({ volumeId: 'uuid-1', volumeName: 'vol1' })],
                                LOG_FILES: [buildVolumeRecord({ volumeId: 'uuid-2', volumeName: 'vol2' })]
                            }
                        }
                    }
                ]
            }
        };

        const { volumeUUIDToDatabaseNameMap, volumeNameToUUIDMap } = buildVolumeMaps(config, FSX_ID);

        expect(volumeUUIDToDatabaseNameMap.get('uuid-1')).toEqual(['ORCL']);
        expect(volumeUUIDToDatabaseNameMap.get('uuid-2')).toEqual(['ORCL']);
        expect(volumeNameToUUIDMap.get('vol1')).toBe('uuid-1');
        expect(volumeNameToUUIDMap.get('vol2')).toBe('uuid-2');
    });

    it('should handle CDB with PDB-grouped volumes', () => {
        const config: Record<string, OracleMappedOntapVolumesResponse> = {
            [FSX_ID]: {
                protocol: 'NFS',
                volumeMappings: [
                    {
                        CDB1: {
                            isCDB: true,
                            ontapVolumes: {
                                PDB1: {
                                    DATA_FILES: [buildVolumeRecord({ volumeId: 'uuid-pdb1', volumeName: 'vol-pdb1' })]
                                },
                                PDB2: {
                                    DATA_FILES: [buildVolumeRecord({ volumeId: 'uuid-pdb2', volumeName: 'vol-pdb2' })]
                                }
                            } as unknown as Record<string, OracleVolumeRecord[]>
                        }
                    }
                ]
            }
        };

        const { volumeUUIDToDatabaseNameMap, volumeNameToUUIDMap } = buildVolumeMaps(config, FSX_ID);

        expect(volumeUUIDToDatabaseNameMap.get('uuid-pdb1')).toEqual(['CDB1']);
        expect(volumeUUIDToDatabaseNameMap.get('uuid-pdb2')).toEqual(['CDB1']);
        expect(volumeNameToUUIDMap.get('vol-pdb1')).toBe('uuid-pdb1');
        expect(volumeNameToUUIDMap.get('vol-pdb2')).toBe('uuid-pdb2');
    });

    it('should return empty maps when config data is empty', () => {
        const config: Record<string, OracleMappedOntapVolumesResponse> = {
            [FSX_ID]: {
                protocol: 'NFS'
            }
        };

        const { volumeUUIDToDatabaseNameMap, volumeNameToUUIDMap } = buildVolumeMaps(config, FSX_ID);

        expect(volumeUUIDToDatabaseNameMap.size).toBe(0);
        expect(volumeNameToUUIDMap.size).toBe(0);
    });

    it('should deduplicate SID names for same volume UUID', () => {
        const config: Record<string, OracleMappedOntapVolumesResponse> = {
            [FSX_ID]: {
                protocol: 'NFS',
                volumeMappings: [
                    {
                        ORCL: {
                            isCDB: false,
                            ontapVolumes: {
                                DATA_FILES: [buildVolumeRecord({ volumeId: 'uuid-shared', volumeName: 'shared-vol' })],
                                LOG_FILES: [buildVolumeRecord({ volumeId: 'uuid-shared', volumeName: 'shared-vol' })]
                            }
                        }
                    }
                ]
            }
        };

        const { volumeUUIDToDatabaseNameMap } = buildVolumeMaps(config, FSX_ID);

        expect(volumeUUIDToDatabaseNameMap.get('uuid-shared')).toEqual(['ORCL']);
    });
});

describe('extractInstancesToOptimize', () => {
    it('should flatten hosts into per-instance tasks', () => {
        const hosts = [
            {
                configurationName: 'config-1',
                databaseHosts: [
                    {
                        id: 'host-1',
                        region: REGION,
                        credentialsId: CREDENTIALS_ID,
                        oracleInstances: [
                            {
                                instanceId: 'inst-1',
                                clones: [{ cloneDatabaseName: 'clone_a', clonedBy: 'other', action: 'DELETE' }]
                            }
                        ]
                    }
                ]
            }
        ];

        const result = extractInstancesToOptimize(hosts);

        expect(result).toHaveLength(1);
        expect(result[0].instanceId).toBe('inst-1');
        expect(result[0].region).toBe(REGION);
        expect(result[0].credentialsId).toBe(CREDENTIALS_ID);
        expect(result[0].databaseHostId).toBe('host-1');
        expect(result[0].clones).toHaveLength(1);
    });

    it('should handle multiple instances across multiple hosts', () => {
        const hosts = [
            {
                configurationName: 'config-1',
                databaseHosts: [
                    {
                        id: 'host-1',
                        region: REGION,
                        credentialsId: CREDENTIALS_ID,
                        oracleInstances: [
                            {
                                instanceId: 'inst-1',
                                clones: [{ cloneDatabaseName: 'c1', clonedBy: 'other', action: 'DELETE' }]
                            },
                            {
                                instanceId: 'inst-2',
                                clones: [{ cloneDatabaseName: 'c2', clonedBy: 'other', action: 'DELETE' }]
                            }
                        ]
                    },
                    {
                        id: 'host-2',
                        region: REGION,
                        credentialsId: CREDENTIALS_ID,
                        oracleInstances: [
                            {
                                instanceId: 'inst-3',
                                clones: [{ cloneDatabaseName: 'c3', clonedBy: 'other', action: 'DELETE' }]
                            },
                            {
                                instanceId: 'inst-4',
                                clones: [{ cloneDatabaseName: 'c4', clonedBy: 'other', action: 'DELETE' }]
                            }
                        ]
                    }
                ]
            }
        ];

        const result = extractInstancesToOptimize(hosts);

        expect(result).toHaveLength(4);
        const instanceIds = result.map(r => r.instanceId);
        expect(instanceIds).toEqual(['inst-1', 'inst-2', 'inst-3', 'inst-4']);
    });
});

describe('deleteClone (Node-side ONTAP cleanup)', () => {
    const NFS_HOST_ID = 'host-clone-nfs';
    const NFS_INSTANCE_ID = 'inst-clone-nfs';
    const NFS_FSX_ID = 'fs-clonecleanup0001';
    const NFS_NODE_INSTANCE_ID = 'i-clonecleanupnfs01';

    const ISCSI_HOST_ID = 'host-clone-iscsi';
    const ISCSI_INSTANCE_ID = 'inst-clone-iscsi';
    const ISCSI_FSX_ID = 'fs-clonecleanup0002';
    const ISCSI_NODE_INSTANCE_ID = 'i-clonecleanupiscsi1';

    const MULTI_HOST_ID = 'host-clone-multi';
    const MULTI_INSTANCE_ID = 'inst-clone-multi';
    const MULTI_FSX_ID = 'fs-clonecleanup0003';
    const MULTI_NODE_INSTANCE_ID = 'i-clonecleanupmulti1';

    const SUCCESSFUL_SSM_RESPONSE = JSON.stringify({
        status: 'success',
        unmountedPaths: ['/mnt/clone_vol'],
        cleanedPaths: ['/mnt/clone_vol']
    });

    async function seedCloneHost(
        hostId: string,
        instanceId: string,
        fsxId: string,
        nodeInstanceId: string,
        protocol: string
    ) {
        await createResource(ACCOUNT_ID, {
            resourceId: hostId,
            resourceName: hostId,
            resourceType: 'ORACLE',
            coRelationId: fsxId,
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: REGION,
            credentialsId: CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: { node1InstanceId: nodeInstanceId }
        });
        await createDatabaseInstanceConfigData([
            {
                account_id: ACCOUNT_ID,
                credentials_id: CREDENTIALS_ID,
                region: REGION,
                resource_id: hostId,
                database_instance_id: instanceId,
                creation_time: new Date(),
                last_updated: new Date(),
                config_data: { [fsxId]: { protocol } },
                config_data_type: AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
            }
        ]);
    }

    beforeAll(async () => {
        await Promise.all([
            seedCloneHost(NFS_HOST_ID, NFS_INSTANCE_ID, NFS_FSX_ID, NFS_NODE_INSTANCE_ID, 'NFS'),
            seedCloneHost(ISCSI_HOST_ID, ISCSI_INSTANCE_ID, ISCSI_FSX_ID, ISCSI_NODE_INSTANCE_ID, 'iSCSI'),
            seedCloneHost(MULTI_HOST_ID, MULTI_INSTANCE_ID, MULTI_FSX_ID, MULTI_NODE_INSTANCE_ID, 'NFS')
        ]);
    });

    afterAll(async () => {
        await Promise.all([
            deleteResource(ACCOUNT_ID, NFS_HOST_ID),
            deleteResource(ACCOUNT_ID, ISCSI_HOST_ID),
            deleteResource(ACCOUNT_ID, MULTI_HOST_ID)
        ]);
    });

    afterEach(() => {
        resetProxyOverrides();
        vi.restoreAllMocks();
    });

    it('happy path (NFS): resolves the junction path, clears nas.path, then deletes the volume', async () => {
        vi.spyOn(ssmOperations, 'callSsmExecution').mockResolvedValueOnce(SUCCESSFUL_SSM_RESPONSE);
        registerProxyGetResponse({
            targetId: NFS_FSX_ID,
            ontapPath: 'api/storage/volumes',
            body: { records: [{ uuid: 'vol-nfs-1', name: 'clone_vol', nas: { path: '/clone_vol' } }], num_records: 1 }
        });

        await deleteClone(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            NFS_HOST_ID,
            NFS_INSTANCE_ID,
            'CLONE_DB',
            undefined,
            'parent-job-1',
            ['vol-nfs-1']
        );

        expect(
            getCapturedProxyGetUris().some(uri => uri.includes('api/storage/volumes') && uri.includes('uuid=vol-nfs-1'))
        ).toBe(true);
        expect(getCapturedProxyPatchUris().some(uri => uri.includes('api/storage/volumes/vol-nfs-1'))).toBe(true);
        expect(getCapturedProxyDeleteUris().some(uri => uri.includes('api/storage/volumes/vol-nfs-1'))).toBe(true);
    });

    it('iSCSI path: skips the junction-path GET and the nas.path PATCH, deletes the volume directly', async () => {
        vi.spyOn(ssmOperations, 'callSsmExecution').mockResolvedValueOnce(SUCCESSFUL_SSM_RESPONSE);

        await deleteClone(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            ISCSI_HOST_ID,
            ISCSI_INSTANCE_ID,
            'CLONE_DB',
            undefined,
            'parent-job-2',
            ['vol-iscsi-1']
        );

        expect(getCapturedProxyGetUris().some(uri => uri.includes('api/storage/volumes'))).toBe(false);
        expect(getCapturedProxyPatchUris().some(uri => uri.includes('api/storage/volumes/vol-iscsi-1'))).toBe(false);
        expect(getCapturedProxyDeleteUris().some(uri => uri.includes('api/storage/volumes/vol-iscsi-1'))).toBe(true);
    });

    it('does not call ONTAP delete when the SSM host-side cleanup fails', async () => {
        vi.spyOn(ssmOperations, 'callSsmExecution').mockRejectedValueOnce(new Error('SSM execution failed'));
        registerProxyGetResponse({
            targetId: NFS_FSX_ID,
            ontapPath: 'api/storage/volumes',
            body: {
                records: [{ uuid: 'vol-nfs-2', name: 'clone_vol_2', nas: { path: '/clone_vol_2' } }],
                num_records: 1
            }
        });

        await expect(
            deleteClone(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                REGION,
                NFS_HOST_ID,
                NFS_INSTANCE_ID,
                'CLONE_DB',
                undefined,
                'parent-job-3',
                ['vol-nfs-2']
            )
        ).rejects.toThrow(/Failed to delete Oracle clone/);

        expect(getCapturedProxyDeleteUris()).toEqual([]);
        expect(getCapturedProxyPatchUris().some(uri => uri.includes('api/storage/volumes/vol-nfs-2'))).toBe(false);
    });

    it('isolates per-volume ONTAP delete failures: a sibling volume in the same clone still gets deleted', async () => {
        vi.spyOn(ssmOperations, 'callSsmExecution').mockResolvedValueOnce(SUCCESSFUL_SSM_RESPONSE);
        registerProxyGetResponse({
            targetId: MULTI_FSX_ID,
            ontapPath: 'api/storage/volumes',
            body: {
                records: [
                    { uuid: 'vol-multi-a', name: 'clone_vol_a', nas: { path: '/clone_vol_a' } },
                    { uuid: 'vol-multi-b', name: 'clone_vol_b', nas: { path: '/clone_vol_b' } }
                ],
                num_records: 2
            }
        });
        registerProxyDeleteResponse({
            targetId: MULTI_FSX_ID,
            ontapPath: 'api/storage/volumes/vol-multi-a',
            status: 500,
            body: { error: { message: 'internal error' } }
        });

        await expect(
            deleteClone(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                REGION,
                MULTI_HOST_ID,
                MULTI_INSTANCE_ID,
                'CLONE_DB',
                undefined,
                'parent-job-4',
                ['vol-multi-a', 'vol-multi-b']
            )
        ).rejects.toThrow(/Failed to delete Oracle clone/);

        const deleteUris = getCapturedProxyDeleteUris();
        expect(deleteUris.some(uri => uri.includes('api/storage/volumes/vol-multi-a'))).toBe(true);
        expect(deleteUris.some(uri => uri.includes('api/storage/volumes/vol-multi-b'))).toBe(true);
    });

    describe('junction path resolution (fetchCloneJunctionPaths, inlined)', () => {
        it('does not call the ONTAP volumes GET when there are no clone volume UUIDs', async () => {
            const ssmSpy = vi.spyOn(ssmOperations, 'callSsmExecution').mockResolvedValueOnce(SUCCESSFUL_SSM_RESPONSE);

            await deleteClone(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                REGION,
                NFS_HOST_ID,
                NFS_INSTANCE_ID,
                'CLONE_DB',
                undefined,
                'parent-job-5',
                []
            );

            expect(getCapturedProxyGetUris().some(uri => uri.includes('api/storage/volumes'))).toBe(false);
            const [{ commands }] = ssmSpy.mock.calls[0];
            expect(commands[0]).toContain('clone_junction_paths = []');
        });

        it('resolves the junction path for each cloned volume from the ONTAP response', async () => {
            const ssmSpy = vi.spyOn(ssmOperations, 'callSsmExecution').mockResolvedValueOnce(SUCCESSFUL_SSM_RESPONSE);
            registerProxyGetResponse({
                targetId: NFS_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: {
                    records: [
                        { uuid: 'vol-nfs-3', name: 'clone_vol_3', nas: { path: '/clone_vol_3' } },
                        { uuid: 'vol-nfs-4', name: 'clone_vol_4', nas: { path: '/clone_vol_4' } }
                    ],
                    num_records: 2
                }
            });

            await deleteClone(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                REGION,
                NFS_HOST_ID,
                NFS_INSTANCE_ID,
                'CLONE_DB',
                undefined,
                'parent-job-6',
                ['vol-nfs-3', 'vol-nfs-4']
            );

            const [{ commands }] = ssmSpy.mock.calls[0];
            expect(commands[0]).toContain('clone_junction_paths = ["/clone_vol_3","/clone_vol_4"]');
        });

        it('omits a volume with no junction path from the cleanup script without blocking its deletion', async () => {
            const ssmSpy = vi.spyOn(ssmOperations, 'callSsmExecution').mockResolvedValueOnce(SUCCESSFUL_SSM_RESPONSE);
            registerProxyGetResponse({
                targetId: NFS_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: {
                    records: [
                        { uuid: 'vol-nfs-5', name: 'clone_vol_5', nas: { path: '/clone_vol_5' } },
                        { uuid: 'vol-nfs-6', name: 'clone_vol_6' }
                    ],
                    num_records: 2
                }
            });

            await deleteClone(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                REGION,
                NFS_HOST_ID,
                NFS_INSTANCE_ID,
                'CLONE_DB',
                undefined,
                'parent-job-7',
                ['vol-nfs-5', 'vol-nfs-6']
            );

            const [{ commands }] = ssmSpy.mock.calls[0];
            expect(commands[0]).toContain('clone_junction_paths = ["/clone_vol_5"]');
            const deleteUris = getCapturedProxyDeleteUris();
            expect(deleteUris.some(uri => uri.includes('api/storage/volumes/vol-nfs-5'))).toBe(true);
            expect(deleteUris.some(uri => uri.includes('api/storage/volumes/vol-nfs-6'))).toBe(true);
        });

        it('omits a volume missing from the ONTAP response (e.g. a bad/unknown UUID) without blocking its deletion', async () => {
            const ssmSpy = vi.spyOn(ssmOperations, 'callSsmExecution').mockResolvedValueOnce(SUCCESSFUL_SSM_RESPONSE);
            registerProxyGetResponse({
                targetId: NFS_FSX_ID,
                ontapPath: 'api/storage/volumes',
                body: {
                    records: [{ uuid: 'vol-nfs-7', name: 'clone_vol_7', nas: { path: '/clone_vol_7' } }],
                    num_records: 1
                }
            });

            await deleteClone(
                ACCOUNT_ID,
                CREDENTIALS_ID,
                REGION,
                NFS_HOST_ID,
                NFS_INSTANCE_ID,
                'CLONE_DB',
                undefined,
                'parent-job-8',
                ['vol-nfs-7', 'vol-nfs-missing']
            );

            const [{ commands }] = ssmSpy.mock.calls[0];
            expect(commands[0]).toContain('clone_junction_paths = ["/clone_vol_7"]');
            const deleteUris = getCapturedProxyDeleteUris();
            expect(deleteUris.some(uri => uri.includes('api/storage/volumes/vol-nfs-7'))).toBe(true);
            expect(deleteUris.some(uri => uri.includes('api/storage/volumes/vol-nfs-missing'))).toBe(true);
        });

        it('aborts clone deletion (no SSM command, no ONTAP delete) when the ONTAP volumes GET fails', async () => {
            const ssmSpy = vi.spyOn(ssmOperations, 'callSsmExecution').mockResolvedValueOnce(SUCCESSFUL_SSM_RESPONSE);
            registerProxyGetResponse({
                targetId: NFS_FSX_ID,
                ontapPath: 'api/storage/volumes',
                status: 500,
                body: { errorMessage: 'Internal server error' }
            });

            await expect(
                deleteClone(
                    ACCOUNT_ID,
                    CREDENTIALS_ID,
                    REGION,
                    NFS_HOST_ID,
                    NFS_INSTANCE_ID,
                    'CLONE_DB',
                    undefined,
                    'parent-job-9',
                    ['vol-nfs-8']
                )
            ).rejects.toThrow(/Failed to delete Oracle clone/);

            expect(ssmSpy).not.toHaveBeenCalled();
            expect(getCapturedProxyDeleteUris().some(uri => uri.includes('api/storage/volumes/vol-nfs-8'))).toBe(false);
            expect(getCapturedProxyPatchUris().some(uri => uri.includes('api/storage/volumes/vol-nfs-8'))).toBe(false);
        });
    });
});
