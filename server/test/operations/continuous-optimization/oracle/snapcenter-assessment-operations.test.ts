import { beforeEach, describe, expect, it } from 'vitest';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';
import {
    calculateSnapCenterDrift,
    fetchSnapCenterVolumeOntapData,
    SnapcenterAssessmentData
} from '../../../../src/operations/continuous-optimization/oracle/snapcenter-assessment-operations';
import { AssessmentItemType } from '../../../../src/routes/types/continuous-optimization.types';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';

function ontapPage<T>(records: T[]) {
    return { records, num_records: records.length };
}

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
    drift: AssessmentItemType | { errorMessage: string } | undefined
): asserts drift is AssessmentItemType & {
    status: AssessmentStatus;
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
    objectsInViolation?: unknown[];
} {
    expect(drift).toBeDefined();
    expect(drift && 'errorMessage' in drift).toBe(false);
    expect(drift && 'status' in drift).toBe(true);
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

describe('fetchSnapCenterVolumeOntapData (Oracle)', () => {
    beforeEach(() => {
        resetProxyOverrides();
    });

    it('merges SVM identity and SnapCenter snapshot presence per volume', async () => {
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes/vol-uuid-1',
            body: { svm: { uuid: 'svm-uuid-1', name: 'svm-a' } }
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes/vol-uuid-1/snapshots',
            body: ontapPage([{ comment: 'creator=snapcenter' }])
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes/vol-uuid-2',
            body: { svm: { uuid: 'svm-uuid-1', name: 'svm-a' } }
        });
        registerProxyGetResponse({
            targetId: 'fs-1',
            ontapPath: 'api/storage/volumes/vol-uuid-2/snapshots',
            body: ontapPage([])
        });

        const result = await fetchSnapCenterVolumeOntapData('acct-1', 'cred-1', 'fs-1', 'us-east-1', [
            'vol-uuid-1',
            'vol-uuid-2'
        ]);

        expect(result.response).toEqual({
            'vol-uuid-1': { svmId: 'svm-uuid-1', svmName: 'svm-a', hasSnapcenterSnapshot: true },
            'vol-uuid-2': { svmId: 'svm-uuid-1', svmName: 'svm-a', hasSnapcenterSnapshot: false }
        });
        expect(result.errors).toEqual({});
    });

    it('records a per-volume error without failing the others', async () => {
        // The 'error-target' fsxId makes the scope's fallback reply with a 500 for every path.
        const result = await fetchSnapCenterVolumeOntapData('acct-1', 'cred-1', 'error-target', 'us-east-1', [
            'vol-uuid-1'
        ]);

        expect(result.response).toEqual({});
        expect(result.errors['vol-uuid-1']).toBeDefined();
    });

    it('returns an empty result without calling the proxy when there are no volume UUIDs', async () => {
        const result = await fetchSnapCenterVolumeOntapData('acct-1', 'cred-1', 'fs-1', 'us-east-1', []);

        expect(result.response).toEqual({});
        expect(result.errors).toEqual({});
    });
});
