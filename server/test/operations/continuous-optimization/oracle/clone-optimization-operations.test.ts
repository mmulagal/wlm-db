import { describe, expect, it } from 'vitest';

import { ClonedVolumeDetail } from '../../../../src/utils/common-types';
import {
    OracleMappedOntapVolumesResponse,
    OracleVolumeRecord
} from '../../../../src/operations/workloads/oracle/common-types';
import {
    validateAndExtractClonedVolumeUuids,
    buildVolumeMaps,
    extractInstancesToOptimize
} from '../../../../src/operations/continuous-optimization/oracle/clone-optimization-operations';
import { buildCloneCleanupScript } from '../../../../src/operations/continuous-optimization/oracle/ssm-scripts/clone-cleanup-scripts';

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
        fsxId: FSX_ID,
        region: REGION,
        volumeUuids: ['vol-uuid-1'],
        protocol: 'NFS',
        cloneDatabaseName: 'CLONE_DB'
    };

    it('should generate a bash script with correct structure', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('#!/bin/bash');
        expect(script).toContain('set -euo pipefail');
        expect(script).toContain(FSX_ID);
        expect(script).toContain(REGION);
        expect(script).toContain('vol-uuid-1');
        expect(script).toContain('CLONE_DB');
        expect(script).toContain('Clone Cleanup started');
    });

    it('should include ONTAP REST call to fetch clone junction paths', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('Fetching junction paths for clone volumes from ONTAP');
        expect(script).toContain('fields=nas.path,name');
        expect(script).toContain('clone_junction_paths');
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

    it('should embed all volume UUIDs in the script', () => {
        const volumeUuids = ['uuid-aaa', 'uuid-bbb', 'uuid-ccc'];
        const script = buildCloneCleanupScript({ ...baseParams, volumeUuids });

        for (const uuid of volumeUuids) {
            expect(script).toContain(uuid);
        }
    });

    it('should not contain parent oracleSid references', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).not.toContain('oracle_sid');
    });

    it('should include cleanedPaths in final output', () => {
        const script = buildCloneCleanupScript(baseParams);

        expect(script).toContain('cleanedPaths');
        expect(script).toContain('cleaned_paths');
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
