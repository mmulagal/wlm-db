import { describe, expect, it } from 'vitest';
import { AssessmentStatus, AssessmentCategories } from '../../../../src/utils/continous-optimization-consts';
import {
    calculateSnapCenterDrift,
    type MssqlSnapcenterAssessmentData
} from '../../../../src/operations/continuous-optimization/mssql/snapcenter-assessment-operations';
import { AssessmentItemType } from '../../../../src/routes/types/continuous-optimization.types';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../../src/utils/consts';
import { callSsmExecution } from '../../../../src/operations/aws/ssm-operations';
import { DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import getCommandInvocationResponse from '../../../simulator/responses/aws/ssm-getCommand-invocation.json';

const BASE_ASSESSMENT_DATA: MssqlSnapcenterAssessmentData = {
    volumes: [],
    standaloneCheck: {
        pluginServiceRunning: false
    },
    errorMessage: ''
};

/** Demo-aligned volume IDs/names with protected snapshots — for drift tests only, not demo seed data. */
const OPTIMIZED_SNAPCENTER_ASSESSMENT_STUB: MssqlSnapcenterAssessmentData = {
    volumes: [
        {
            svmId: '',
            svmName: '',
            volumeId: '73c4863d-dc72-11ef-b430-bb0ad6a3b8df',
            volumeName: 'wlmdb_sqllog_1737955806953',
            hasSnapcenterSnapshot: true,
            foundInSnapcenterLogs: false
        },
        {
            svmId: '',
            svmName: '',
            volumeId: '73df15ec-dc72-11ef-b430-bb0ad6a3b8df',
            volumeName: 'wlmdb_sqldata_1737955806953',
            hasSnapcenterSnapshot: true,
            foundInSnapcenterLogs: false
        }
    ],
    standaloneCheck: {
        pluginServiceRunning: false
    },
    errorMessage: ''
};

const UNOPTIMIZED_SNAPCENTER_ASSESSMENT_STUB: MssqlSnapcenterAssessmentData = {
    ...OPTIMIZED_SNAPCENTER_ASSESSMENT_STUB,
    volumes: OPTIMIZED_SNAPCENTER_ASSESSMENT_STUB.volumes.map(volume => ({
        ...volume,
        hasSnapcenterSnapshot: false
    }))
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

describe('calculateSnapCenterDrift (MSSQL)', () => {
    it('should return optimized when all mapped volumes have SnapCenter snapshots', () => {
        const drift = calculateSnapCenterDrift({
            ...BASE_ASSESSMENT_DATA,
            volumes: [
                {
                    svmId: 'svm-1',
                    svmName: 'svm-a',
                    volumeId: 'vol-1',
                    volumeName: 'data-vol-1',
                    hasSnapcenterSnapshot: true,
                    foundInSnapcenterLogs: false
                },
                {
                    svmId: 'svm-1',
                    svmName: 'svm-a',
                    volumeId: 'vol-2',
                    volumeName: 'log-vol-1',
                    hasSnapcenterSnapshot: true,
                    foundInSnapcenterLogs: false
                }
            ]
        });

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(drift.id).toBe('snapcenter-snapshot');
        expect(drift.totalObjectsAssessed).toBe(2);
        expect(drift.totalObjectsInViolation).toBe(0);
        expect(drift.objectsInViolation).toEqual([]);
    });

    it('should return not-optimized with volume violations when snapshots are missing', () => {
        const drift = calculateSnapCenterDrift({
            ...BASE_ASSESSMENT_DATA,
            volumes: [
                {
                    svmId: 'svm-1',
                    svmName: 'svm-a',
                    volumeId: 'vol-1',
                    volumeName: 'data-vol-1',
                    hasSnapcenterSnapshot: false,
                    foundInSnapcenterLogs: false
                },
                {
                    svmId: 'svm-1',
                    svmName: 'svm-a',
                    volumeId: 'vol-2',
                    volumeName: 'log-vol-1',
                    hasSnapcenterSnapshot: true,
                    foundInSnapcenterLogs: false
                }
            ]
        });

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(2);
        expect(drift.totalObjectsInViolation).toBe(1);
        expect(drift.objectsInViolation).toEqual([{ ontapVolumeName: 'data-vol-1', ontapVolumeUuid: 'vol-1' }]);
    });

    it('should use plugin and log evidence as protection fallback', () => {
        const drift = calculateSnapCenterDrift({
            ...BASE_ASSESSMENT_DATA,
            standaloneCheck: {
                pluginServiceRunning: true
            },
            volumes: [
                {
                    svmId: 'svm-1',
                    svmName: 'svm-a',
                    volumeId: 'vol-1',
                    volumeName: 'data-vol-1',
                    hasSnapcenterSnapshot: false,
                    foundInSnapcenterLogs: false
                },
                {
                    svmId: 'svm-1',
                    svmName: 'svm-a',
                    volumeId: 'vol-2',
                    volumeName: 'log-vol-1',
                    hasSnapcenterSnapshot: false,
                    foundInSnapcenterLogs: true
                }
            ]
        });

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(2);
        expect(drift.totalObjectsInViolation).toBe(1);
        expect(drift.objectsInViolation).toEqual([{ ontapVolumeName: 'data-vol-1', ontapVolumeUuid: 'vol-1' }]);
    });

    it('should return generic error when assessment data is missing', () => {
        const expectedErrorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.SNAPCENTER_SNAPSHOT);

        const undefinedDrift = calculateSnapCenterDrift(undefined);
        expect(undefinedDrift).toBeDefined();
        expect(undefinedDrift && 'errorMessage' in undefinedDrift).toBe(true);
        expect(undefinedDrift && 'errorMessage' in undefinedDrift && undefinedDrift.errorMessage).toBe(
            expectedErrorMessage
        );

        const emptyDrift = calculateSnapCenterDrift({} as MssqlSnapcenterAssessmentData);
        expect(emptyDrift).toBeDefined();
        expect(emptyDrift && 'errorMessage' in emptyDrift).toBe(true);
        expect(emptyDrift && 'errorMessage' in emptyDrift && emptyDrift.errorMessage).toBe(expectedErrorMessage);
    });

    it('should return error item when assessment data contains errorMessage', () => {
        const drift = calculateSnapCenterDrift({
            ...BASE_ASSESSMENT_DATA,
            errorMessage: 'SSM execution failed'
        });

        expect(drift).toBeDefined();
        expect(drift && 'errorMessage' in drift).toBe(true);
        expect(drift && 'errorMessage' in drift && drift.errorMessage).toBe('SSM execution failed');
    });

    it('should return not-optimized when volumes array is empty', () => {
        const drift = calculateSnapCenterDrift({ ...BASE_ASSESSMENT_DATA, volumes: [] });

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(0);
        expect(drift.totalObjectsInViolation).toBe(0);
    });

    it('should return optimized when all volumes in assessment payload are protected', () => {
        const drift = calculateSnapCenterDrift(OPTIMIZED_SNAPCENTER_ASSESSMENT_STUB);

        assertSuccessfulDrift(drift);
        expect(drift.id).toBe('snapcenter-snapshot');
        expect(drift.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(OPTIMIZED_SNAPCENTER_ASSESSMENT_STUB.volumes.length);
        expect(drift.totalObjectsInViolation).toBe(0);
    });

    it('should return not-optimized for demo-shaped unprotected volume payload', () => {
        const drift = calculateSnapCenterDrift(UNOPTIMIZED_SNAPCENTER_ASSESSMENT_STUB);

        assertSuccessfulDrift(drift);
        expect(drift.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(drift.totalObjectsAssessed).toBe(UNOPTIMIZED_SNAPCENTER_ASSESSMENT_STUB.volumes.length);
        expect(drift.totalObjectsInViolation).toBe(2);
    });
});

describe('MSSQL SnapCenter SSM mock', () => {
    it('should resolve SnapCenter assessment JSON from the SSM invocation mock', async () => {
        const output = await callSsmExecution({
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            commands: ['Write-Output "mock"'],
            ec2InstanceId: 'i-0880a21327284f67c',
            comment: 'SnapCenter snapshot assessment for MSSQL instance'
        });

        expect(output).toBe(JSON.stringify(getCommandInvocationResponse.mssqlSnapcenterAssessmentOutput));
    });
});
