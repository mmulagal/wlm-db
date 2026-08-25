import { describe, expect, it } from 'vitest';

import { buildCloneAssessmentFromOntapVolumes } from '../../../src/operations/continuous-optimization/clone-assessment-utils';
import { AssessmentStatus } from '../../../src/utils/continous-optimization-consts';
import { VolumeRecord } from '../../../src/utils/common-types';

const context = {
    databaseHostName: 'sql-host',
    databaseHostId: 'i-123',
    databaseInstanceName: 'MSSQLSERVER'
};

describe('buildCloneAssessmentFromOntapVolumes', () => {
    const records: VolumeRecord[] = [
        {
            uuid: 'old-clone-uuid',
            name: 'old-clone',
            create_time: '2020-01-01T00:00:00Z',
            clone: { is_flexclone: true, parent_volume: { name: 'data-volume' } },
            space: { used: 200, physical_used: 100 }
        },
        {
            uuid: 'young-clone-uuid',
            name: 'young-clone',
            create_time: new Date().toISOString(),
            clone: { is_flexclone: true, parent_volume: { name: 'other-volume' } },
            space: { used: 50 }
        },
        {
            uuid: 'regular-volume-uuid',
            name: 'regular-volume',
            clone: { is_flexclone: false }
        }
    ];

    it('should build MSSQL WAD-compatible details for supplied FlexClone volumes', () => {
        const result = buildCloneAssessmentFromOntapVolumes(records, context);

        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.cloneDetails).toHaveLength(2);
        expect(result.oldClones).toBe(1);
        expect(result.oldCloneDatabaseNames).toEqual(['old-clone']);
        expect(result.cloneDetails?.[0]).toEqual(
            expect.objectContaining({
                ...context,
                cloneDatabaseName: 'old-clone',
                clonedBy: 'other',
                cloneSize: 100
            })
        );
    });

    it('should preserve Oracle parent-volume filtering and return optimized when no clone matches', () => {
        const result = buildCloneAssessmentFromOntapVolumes(records, context, ['data-volume']);

        expect(result.cloneDetails?.map(({ cloneDatabaseName }) => cloneDatabaseName)).toEqual(['old-clone']);
        expect(result.oldClones).toBe(1);

        expect(buildCloneAssessmentFromOntapVolumes(records, context, ['missing-parent'])).toEqual({
            cloneDetails: [],
            status: AssessmentStatus.OPTIMIZED,
            oldClones: 0,
            oldCloneDetails: [],
            oldCloneDatabaseNames: []
        });
    });
});
