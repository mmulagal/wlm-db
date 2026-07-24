import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleTriggerAssessment } from './resourceUtils';

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
    setTriggerAssessmentInProgress: vi.fn(),
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

        expect(args.setTriggerAssessmentInProgress).toHaveBeenCalledWith(true);
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
});
