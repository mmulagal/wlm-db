import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handleTriggerAssessment, buildAssessmentInstanceKey } from './resourceUtils';
import store from '../store/store';

vi.mock('../store/store', () => ({
    default: { getState: vi.fn(() => ({ getWellOptimize: {}, workloadFactoryResource: {} })) }
}));

vi.mock('../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { INFO: 'info', SUCCESS: 'success', ERROR: 'error', WARNING: 'warning' },
    addNotification: vi.fn((payload: unknown) => ({ type: 'addNotification', payload })),
    clearNotifications: vi.fn(() => ({ type: 'clearNotifications' }))
}));

vi.mock('../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: vi.fn((payload: unknown) => ({ type: 'setSelectedHeaderTab', payload }))
}));

vi.mock('@tlveng/wlm-ds/src/hooks/useBlueXP', () => ({
    BlueXPListeners: { navigate: 'navigate' },
    postBlueXPMessage: vi.fn()
}));

const buildArgs = (overrides: Record<string, unknown> = {}) => ({
    setAssessmentInProgressForKey: vi.fn(),
    triggerAssessmentApi: vi.fn().mockResolvedValue({ data: {} }),
    triggerUnregisteredAssessmentApi: vi.fn().mockResolvedValue({ data: {} }),
    credentialId: 'cred-1',
    regionId: 'ap-southeast-1',
    selectedResourceId: 'i-case2',
    selectedDatabaseInstance: 'CASE2SQL',
    instanceName: 'CASE2SQL',
    accountId: 'account-1',
    isUnregistered: false,
    dispatch: vi.fn(),
    isWorkloadFactory: true,
    getJobDetailApi: vi.fn(),
    refreshGetWellPage: vi.fn(),
    setGwAdhocError: vi.fn(),
    t: (key: string) => key,
    createNotificationMessage: vi.fn(),
    ...overrides
});

describe('handleTriggerAssessment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses unregistered ec2-instances POST when isUnregistered is true', () => {
        const args = buildArgs({ isUnregistered: true });

        handleTriggerAssessment(args);

        const key = buildAssessmentInstanceKey('i-case2', 'CASE2SQL', 'cred-1', 'ap-southeast-1');
        expect(args.setAssessmentInProgressForKey).toHaveBeenCalledWith(key, true);
        expect(args.triggerUnregisteredAssessmentApi).toHaveBeenCalledWith({
            accountId: 'account-1',
            credentialId: 'cred-1',
            region: 'ap-southeast-1',
            ec2InstanceId: 'i-case2',
            instanceName: 'CASE2SQL'
        });
        expect(args.triggerAssessmentApi).not.toHaveBeenCalled();
    });

    it('uses registered database-hosts POST when isUnregistered is false', () => {
        const args = buildArgs({ isUnregistered: false, selectedResourceId: 'host-123' });

        handleTriggerAssessment(args);

        expect(args.triggerAssessmentApi).toHaveBeenCalledWith({
            credentialId: 'cred-1',
            regionId: 'ap-southeast-1',
            databaseHostId: 'host-123',
            instanceId: 'CASE2SQL'
        });
        expect(args.triggerUnregisteredAssessmentApi).not.toHaveBeenCalled();
    });

    describe('loader race across assessments (per-instance keys)', () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        const instanceA = {
            selectedResourceId: 'host-A',
            selectedDatabaseInstance: 'ASQL',
            credentialId: 'cred-1',
            regionId: 'ap-southeast-1'
        };
        const instanceB = {
            selectedResourceId: 'host-B',
            selectedDatabaseInstance: 'BSQL',
            credentialId: 'cred-1',
            regionId: 'ap-southeast-1'
        };
        const keyA = buildAssessmentInstanceKey(
            instanceA.selectedResourceId,
            instanceA.selectedDatabaseInstance,
            instanceA.credentialId,
            instanceA.regionId
        );
        const keyB = buildAssessmentInstanceKey(
            instanceB.selectedResourceId,
            instanceB.selectedDatabaseInstance,
            instanceB.credentialId,
            instanceB.regionId
        );

        const mockCurrentlyViewing = (instance: typeof instanceA) => {
            vi.mocked(store.getState).mockReturnValue({
                getWellOptimize: {
                    selectedResourceId: instance.selectedResourceId,
                    selectedDatabaseInstance: instance.selectedDatabaseInstance,
                    selectedGwInstanceCredId: instance.credentialId,
                    selectedGwInstanceRegionId: instance.regionId
                },
                workloadFactoryResource: {}
            } as any);
        };

        it('case A->B: B completes while viewing B clears B key and refreshes B page', async () => {
            vi.useFakeTimers();
            const args = buildArgs({
                ...instanceB,
                triggerAssessmentApi: vi.fn().mockResolvedValue({ data: { jobId: 'job-B' } }),
                getJobDetailApi: vi.fn().mockResolvedValue({ data: { status: 'COMPLETED' } })
            });
            mockCurrentlyViewing(instanceB);

            handleTriggerAssessment(args);
            await vi.advanceTimersByTimeAsync(5000);

            expect(args.setAssessmentInProgressForKey).toHaveBeenCalledWith(keyB, true);
            expect(args.setAssessmentInProgressForKey).toHaveBeenCalledWith(keyB, false);
            expect(args.refreshGetWellPage).toHaveBeenCalled();
        });

        it('case A completes in background while viewing B: clears only A key, does not refresh B page', async () => {
            vi.useFakeTimers();
            const args = buildArgs({
                ...instanceA,
                triggerAssessmentApi: vi.fn().mockResolvedValue({ data: { jobId: 'job-A' } }),
                getJobDetailApi: vi.fn().mockResolvedValue({ data: { status: 'COMPLETED' } })
            });
            // User has since navigated away to B.
            mockCurrentlyViewing(instanceB);

            handleTriggerAssessment(args);
            await vi.advanceTimersByTimeAsync(5000);

            // A's own key is cleared once its job finishes, regardless of what's on screen -
            // so returning to A later correctly reflects that it already finished.
            expect(args.setAssessmentInProgressForKey).toHaveBeenCalledWith(keyA, false);
            // But the currently rendered page (B) must not be refreshed/repainted for A's job.
            expect(args.refreshGetWellPage).not.toHaveBeenCalled();
        });

        it('case still on A while its job is in progress: A key stays set (no premature clear)', async () => {
            vi.useFakeTimers();
            const args = buildArgs({
                ...instanceA,
                triggerAssessmentApi: vi.fn().mockResolvedValue({ data: { jobId: 'job-A' } }),
                getJobDetailApi: vi.fn().mockResolvedValue({ data: { status: 'RUNNING' } })
            });
            mockCurrentlyViewing(instanceA);

            handleTriggerAssessment(args);
            await vi.advanceTimersByTimeAsync(5000);

            expect(args.setAssessmentInProgressForKey).toHaveBeenCalledWith(keyA, true);
            expect(args.setAssessmentInProgressForKey).not.toHaveBeenCalledWith(keyA, false);
        });
    });
});
