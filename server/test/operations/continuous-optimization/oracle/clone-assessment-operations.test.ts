import { beforeEach, describe, expect, it } from 'vitest';

import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';
import { CloneAssessment } from '../../../../src/utils/common-types';
import {
    calculateOracleCloneDrift,
    fetchOracleFlexCloneVolumes
} from '../../../../src/operations/continuous-optimization/oracle/clone-assessment-operations';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';

function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

const ACCOUNT_ID = 'test-account-id';
const CREDENTIALS_ID = 'test-credentials-id';
const REGION = 'us-east-1';
const DATABASE_HOST_ID = 'test-host-id';
const DATABASE_INSTANCE_ID = 'test-instance-id';

function buildCloneAssessment(overrides: Partial<CloneAssessment> = {}): CloneAssessment {
    return {
        status: AssessmentStatus.OPTIMIZED,
        cloneDetails: [],
        oldClones: 0,
        oldCloneDetails: [],
        oldCloneDatabaseNames: [],
        ...overrides
    };
}

describe('calculateOracleCloneDrift', () => {
    it('returns error message when clone assessment data is empty', () => {
        const result = calculateOracleCloneDrift(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            DATABASE_HOST_ID,
            DATABASE_INSTANCE_ID,
            {} as CloneAssessment
        );

        expect(result).toHaveProperty('errorMessage');
        expect((result as { errorMessage: string }).errorMessage).toContain('clone');
    });

    it('returns optimized drift when there are no old clones', () => {
        const assessment = buildCloneAssessment({
            status: AssessmentStatus.OPTIMIZED,
            cloneDetails: [
                {
                    cloneDatabaseName: 'clone_vol_1',
                    databaseHostName: 'test-host',
                    databaseHostId: DATABASE_HOST_ID,
                    databaseInstanceName: 'ORCL',
                    clonedBy: 'other',
                    cloneAge: 10,
                    cloneSize: 1024
                }
            ],
            oldClones: 0,
            oldCloneDetails: [],
            oldCloneDatabaseNames: []
        });

        const result = calculateOracleCloneDrift(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            DATABASE_HOST_ID,
            DATABASE_INSTANCE_ID,
            assessment
        );

        expect(result).not.toHaveProperty('errorMessage');
        const drift = result as Record<string, unknown>;
        expect(drift.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(drift.recommended).toBe(AssessmentStatus.OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(1);
        expect(drift.totalObjectsInViolation).toBe(0);
        expect(drift.objectsInViolation).toEqual([]);
    });

    it('returns not-optimized drift when old clones exist', () => {
        const oldCloneDetail = {
            cloneDatabaseName: 'old_clone_vol',
            databaseHostName: 'test-host',
            databaseHostId: DATABASE_HOST_ID,
            databaseInstanceName: 'ORCL',
            clonedBy: 'other',
            cloneAge: 90,
            cloneSize: 2048
        };

        const assessment = buildCloneAssessment({
            status: AssessmentStatus.NOT_OPTIMIZED,
            cloneDetails: [
                {
                    cloneDatabaseName: 'recent_clone_vol',
                    databaseHostName: 'test-host',
                    databaseHostId: DATABASE_HOST_ID,
                    databaseInstanceName: 'ORCL',
                    clonedBy: 'other',
                    cloneAge: 5,
                    cloneSize: 512
                },
                oldCloneDetail
            ],
            oldClones: 1,
            oldCloneDetails: [oldCloneDetail],
            oldCloneDatabaseNames: ['old_clone_vol']
        });

        const result = calculateOracleCloneDrift(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            DATABASE_HOST_ID,
            DATABASE_INSTANCE_ID,
            assessment
        );

        expect(result).not.toHaveProperty('errorMessage');
        const drift = result as Record<string, unknown>;
        expect(drift.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(drift.recommended).toBe(AssessmentStatus.OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(2);
        expect(drift.totalObjectsInViolation).toBe(1);
        expect(drift.objectsInViolation).toEqual(['old_clone_vol']);
        expect(drift.oldCloneDetails).toHaveLength(1);
        expect(drift.cloneDriftMessage).toBe('1 out of 2 clones are old and divergent');
        expect(drift.id).toBe('clone-management');
        expect(drift.severity).toBeDefined();
        expect(drift.categories).toBeDefined();
    });

    it('returns correct drift message for multiple old clones', () => {
        const oldClone1 = {
            cloneDatabaseName: 'old_clone_1',
            databaseHostName: 'test-host',
            databaseHostId: DATABASE_HOST_ID,
            databaseInstanceName: 'ORCL',
            clonedBy: 'other',
            cloneAge: 120,
            cloneSize: 4096
        };
        const oldClone2 = {
            cloneDatabaseName: 'old_clone_2',
            databaseHostName: 'test-host',
            databaseHostId: DATABASE_HOST_ID,
            databaseInstanceName: 'ORCL',
            clonedBy: 'other',
            cloneAge: 200,
            cloneSize: 8192
        };

        const assessment = buildCloneAssessment({
            status: AssessmentStatus.NOT_OPTIMIZED,
            cloneDetails: [oldClone1, oldClone2],
            oldClones: 2,
            oldCloneDetails: [oldClone1, oldClone2],
            oldCloneDatabaseNames: ['old_clone_1', 'old_clone_2']
        });

        const result = calculateOracleCloneDrift(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            DATABASE_HOST_ID,
            DATABASE_INSTANCE_ID,
            assessment
        );

        const drift = result as Record<string, unknown>;
        expect(drift.totalObjectsAssessed).toBe(2);
        expect(drift.totalObjectsInViolation).toBe(2);
        expect(drift.objectsInViolation).toEqual(['old_clone_1', 'old_clone_2']);
        expect(drift.cloneDriftMessage).toBe('2 out of 2 clones are old and divergent');
    });

    it('returns optimized drift when no clones exist at all', () => {
        const assessment = buildCloneAssessment();

        const result = calculateOracleCloneDrift(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            DATABASE_HOST_ID,
            DATABASE_INSTANCE_ID,
            assessment
        );

        const drift = result as Record<string, unknown>;
        expect(drift.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(0);
        expect(drift.totalObjectsInViolation).toBe(0);
        expect(drift.cloneDriftMessage).toBe('0 out of 0 clones are old and divergent');
    });

    it('populates golden config metadata fields in drift response', () => {
        const assessment = buildCloneAssessment({
            cloneDetails: [
                {
                    cloneDatabaseName: 'vol_clone',
                    databaseHostName: 'host',
                    databaseHostId: DATABASE_HOST_ID,
                    databaseInstanceName: 'ORCL',
                    clonedBy: 'other',
                    cloneAge: 5,
                    cloneSize: 100
                }
            ]
        });

        const result = calculateOracleCloneDrift(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            DATABASE_HOST_ID,
            DATABASE_INSTANCE_ID,
            assessment
        );

        const drift = result as Record<string, unknown>;
        expect(drift.id).toBe('clone-management');
        expect(drift.resourceType).toBe('Database');
        expect(drift.severity).toBe('warning');
        expect(Array.isArray(drift.categories)).toBe(true);
    });

    it('includes cloneDetails and oldCloneDetails in drift response', () => {
        const cloneWithVolDetails = {
            cloneDatabaseName: 'old_vol_clone',
            databaseHostName: 'test-host',
            databaseHostId: DATABASE_HOST_ID,
            databaseInstanceName: 'ORCL',
            clonedBy: 'other',
            cloneAge: 100,
            cloneSize: 9999,
            clonedVolumeDetails: [
                {
                    sourceVolumeName: 'parent_vol',
                    cloneVolumeName: 'old_vol_clone',
                    cloneVolumeUuid: 'uuid-1234',
                    cloneVolumeCreateTime: '2025-01-01T00:00:00+00:00',
                    cloneDatabaseName: 'old_vol_clone'
                }
            ]
        };

        const assessment = buildCloneAssessment({
            status: AssessmentStatus.NOT_OPTIMIZED,
            cloneDetails: [cloneWithVolDetails],
            oldClones: 1,
            oldCloneDetails: [cloneWithVolDetails],
            oldCloneDatabaseNames: ['old_vol_clone']
        });

        const result = calculateOracleCloneDrift(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            REGION,
            DATABASE_HOST_ID,
            DATABASE_INSTANCE_ID,
            assessment
        );

        const drift = result as Record<string, unknown>;
        const cloneDetails = drift.cloneDetails as Record<string, unknown>[];
        expect(cloneDetails).toHaveLength(1);
        expect(cloneDetails[0].cloneDatabaseName).toBe('old_vol_clone');
        expect(cloneDetails[0].clonedVolumeDetails).toHaveLength(1);

        const oldDetails = drift.oldCloneDetails as Record<string, unknown>[];
        expect(oldDetails).toHaveLength(1);
        expect(oldDetails[0].cloneAge).toBe(100);
    });
});

describe('fetchOracleFlexCloneVolumes', () => {
    beforeEach(() => {
        resetProxyOverrides();
    });

    it('fetches FlexClone volumes for the FSx filesystem via the proxy-forwarder', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([
                {
                    uuid: 'clone-uuid-1',
                    name: 'clone_vol_1',
                    create_time: '2025-01-01T00:00:00+00:00',
                    clone: { is_flexclone: true, parent_volume: { name: 'data_vol' } },
                    space: { physical_used: 1024 }
                }
            ])
        });

        const records = await fetchOracleFlexCloneVolumes('acct-1', 'cred-1', 'fs-1', 'us-east-1');

        expect(records).toEqual([
            {
                uuid: 'clone-uuid-1',
                name: 'clone_vol_1',
                create_time: '2025-01-01T00:00:00+00:00',
                clone: { is_flexclone: true, parent_volume: { name: 'data_vol' } },
                space: { physical_used: 1024 }
            }
        ]);
    });

    it('returns an empty array when no FlexClone volumes exist', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes',
            body: ontapPage([])
        });

        const records = await fetchOracleFlexCloneVolumes('acct-1', 'cred-1', 'fs-1', 'us-east-1');

        expect(records).toEqual([]);
    });
});
