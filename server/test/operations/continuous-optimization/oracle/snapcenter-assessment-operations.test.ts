import { describe, expect, it } from 'vitest';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';
import type { OracleGenericParameterDriftResponseType } from '../../../../src/routes/types/oracle-continuous-optimization.types';
import {
    calculateSnapCenterDrift,
    SnapcenterAssessmentData
} from '../../../../src/operations/continuous-optimization/oracle/snapcenter-assessment-operations';

const BASE_ASSESSMENT_DATA: SnapcenterAssessmentData = {
    isDataguardPrimary: false,
    volumes: [],
    standaloneCheck: {
        pluginServiceRunning: false,
        sidFoundInLogs: false
    },
    errorMessage: ''
};

const BASE_VOLUME_IDS = {
    dataFileVolumeIds: ['data-1', 'data-2'],
    controlFileVolumeIds: ['control-1'],
    archiveLogVolumeIds: ['archive-1']
};

function assertSuccessfulDrift(
    drift: OracleGenericParameterDriftResponseType | { errorMessage: string } | undefined
): asserts drift is OracleGenericParameterDriftResponseType {
    expect(drift).toBeDefined();
    expect(drift && 'errorMessage' in drift).toBe(false);
}

describe('calculateSnapCenterDrift', () => {
    it('returns optimized and does not assess fallback file types when all data file volumes are protected', () => {
        const drift = calculateSnapCenterDrift(
            {
                ...BASE_ASSESSMENT_DATA,
                volumes: [
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'data-1',
                        volumeName: 'data-vol-1',
                        hasSnapcenterSnapshot: true,
                        foundInSnapcenterLogs: false
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'data-2',
                        volumeName: 'data-vol-2',
                        hasSnapcenterSnapshot: true,
                        foundInSnapcenterLogs: false
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'control-1',
                        volumeName: 'control-vol-1',
                        hasSnapcenterSnapshot: false,
                        foundInSnapcenterLogs: false
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'archive-1',
                        volumeName: 'archive-vol-1',
                        hasSnapcenterSnapshot: false,
                        foundInSnapcenterLogs: false
                    }
                ]
            },
            BASE_VOLUME_IDS
        );

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(2);
        expect(drift.totalObjectsInViolation).toBe(0);
        expect(drift.objectsInViolation).toEqual([]);
    });

    it('assesses data+control+archive when any data file volume is unprotected', () => {
        const drift = calculateSnapCenterDrift(
            {
                ...BASE_ASSESSMENT_DATA,
                volumes: [
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'data-1',
                        volumeName: 'data-vol-1',
                        hasSnapcenterSnapshot: false,
                        foundInSnapcenterLogs: false
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'data-2',
                        volumeName: 'data-vol-2',
                        hasSnapcenterSnapshot: true,
                        foundInSnapcenterLogs: false
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'control-1',
                        volumeName: 'control-vol-1',
                        hasSnapcenterSnapshot: false,
                        foundInSnapcenterLogs: false
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'archive-1',
                        volumeName: 'archive-vol-1',
                        hasSnapcenterSnapshot: true,
                        foundInSnapcenterLogs: false
                    }
                ]
            },
            BASE_VOLUME_IDS
        );

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(4);
        expect(drift.totalObjectsInViolation).toBe(2);
        expect(drift.objectsInViolation).toEqual([
            { ontapVolumeName: 'data-vol-1', ontapVolumeUuid: 'data-1' },
            { ontapVolumeName: 'control-vol-1', ontapVolumeUuid: 'control-1' }
        ]);
    });

    it('uses standalone plugin logs as protection evidence in fallback evaluation', () => {
        const drift = calculateSnapCenterDrift(
            {
                ...BASE_ASSESSMENT_DATA,
                standaloneCheck: {
                    pluginServiceRunning: true,
                    sidFoundInLogs: true
                },
                volumes: [
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'data-1',
                        volumeName: 'data-vol-1',
                        hasSnapcenterSnapshot: false,
                        foundInSnapcenterLogs: false
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'data-2',
                        volumeName: 'data-vol-2',
                        hasSnapcenterSnapshot: true,
                        foundInSnapcenterLogs: false
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'control-1',
                        volumeName: 'control-vol-1',
                        hasSnapcenterSnapshot: false,
                        foundInSnapcenterLogs: true
                    },
                    {
                        svmId: 'svm-1',
                        svmName: 'svm-a',
                        volumeId: 'archive-1',
                        volumeName: 'archive-vol-1',
                        hasSnapcenterSnapshot: true,
                        foundInSnapcenterLogs: false
                    }
                ]
            },
            BASE_VOLUME_IDS
        );

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(4);
        expect(drift.totalObjectsInViolation).toBe(1);
        expect(drift.objectsInViolation).toEqual([{ ontapVolumeName: 'data-vol-1', ontapVolumeUuid: 'data-1' }]);
    });

    it('returns NOT_OPTIMIZED when volumes array is empty and volume IDs are provided', () => {
        const drift = calculateSnapCenterDrift({ ...BASE_ASSESSMENT_DATA, volumes: [] }, BASE_VOLUME_IDS);

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(0);
        expect(drift.totalObjectsInViolation).toBe(0);
    });
});
