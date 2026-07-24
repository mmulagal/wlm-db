import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../utils/consts';

import GetWellApi from '../GetWellApi';

const {
    mockDispatch,
    mockGetUnregisteredMssqlAssessmentData,
    mockGetOfflineMssqlAssessmentData,
    mockAssessmentDetailsApi,
    mockResetGwValuesOnRefresh,
    mockFormatGetWellDataFlat,
    mockUpdateAccountLevelAssessmentData
} = vi.hoisted(() => ({
    mockDispatch: vi.fn(),
    mockGetUnregisteredMssqlAssessmentData: vi.fn(),
    mockGetOfflineMssqlAssessmentData: vi.fn(),
    mockAssessmentDetailsApi: vi.fn(),
    mockResetGwValuesOnRefresh: vi.fn(),
    mockFormatGetWellDataFlat: vi.fn(),
    mockUpdateAccountLevelAssessmentData: vi.fn()
}));

let getWellState: Record<string, unknown> = {};

vi.mock('react-redux', () => ({
    useDispatch: () => mockDispatch
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../store/storeHooks', () => ({
    useAppSelector: (selector: (state: unknown) => unknown) =>
        selector({
            auth: { accountId: 'account-1' },
            getWellOptimize: getWellState
        })
}));

vi.mock('../../../utils/apiService', () => ({
    useGetMssqlAssessmentDataMutation: () => [mockAssessmentDetailsApi],
    useLazyGetOfflineMssqlAssessmentDataQuery: () => [mockGetOfflineMssqlAssessmentData],
    useLazyGetUnregisteredMssqlAssessmentQuery: () => [mockGetUnregisteredMssqlAssessmentData]
}));

vi.mock('../GetWellUtils', () => ({
    formatGetWellDataFlat: (...args: unknown[]) => mockFormatGetWellDataFlat(...args),
    resetGwValuesOnRefresh: (...args: unknown[]) => mockResetGwValuesOnRefresh(...args),
    updateAccountLevelAssessmentData: (...args: unknown[]) => mockUpdateAccountLevelAssessmentData(...args)
}));

vi.mock('../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setDriftAssessmentData: vi.fn((payload: unknown) => ({ type: 'setDriftAssessmentData', payload })),
    setOptimizePageLoading: vi.fn((payload: unknown) => ({ type: 'setOptimizePageLoading', payload })),
    setGwRefreshPage: vi.fn((payload: unknown) => ({ type: 'setGwRefreshPage', payload })),
    setIsAssessmentAvailable: vi.fn((payload: unknown) => ({ type: 'setIsAssessmentAvailable', payload })),
    setLandingFromInnerPage: vi.fn((payload: unknown) => ({ type: 'setLandingFromInnerPage', payload })),
    setGwSelectedRowFsxId: vi.fn((payload: unknown) => ({ type: 'setGwSelectedRowFsxId', payload }))
}));

const baseGetWellState = {
    credIdFromJM: '',
    regionFromJM: '',
    landingFrom: WLF_TABS.INVENTORY,
    landingFromInnerPage: false,
    isWad: false,
    isUnregistered: false,
    selectedResourceId: 'host-123',
    selectedDatabaseInstance: 'MSSQLSERVER',
    gwRefreshPage: false,
    selectedGwInstanceCredId: 'cred-1',
    selectedGwInstanceRegionId: 'us-east-1',
    visitedTabs: {}
};

const renderGetWellApi = async () => {
    render(<GetWellApi />);
    await act(async () => {
        vi.advanceTimersByTime(20);
    });
};

describe('GetWellApi page-load routing', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        getWellState = { ...baseGetWellState };
        mockGetUnregisteredMssqlAssessmentData.mockResolvedValue({ data: { metadata: {} } });
        mockGetOfflineMssqlAssessmentData.mockResolvedValue({ data: { metadata: {} } });
        mockAssessmentDetailsApi.mockResolvedValue({ data: { metadata: {} } });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('calls unregistered offline-assessment GET on page load when isUnregistered is true', async () => {
        getWellState = {
            ...baseGetWellState,
            isUnregistered: true,
            selectedResourceId: 'i-case2',
            selectedDatabaseInstance: 'CASE2SQL',
            selectedGwInstanceCredId: 'cred-1',
            selectedGwInstanceRegionId: 'ap-southeast-1'
        };

        await renderGetWellApi();

        expect(mockResetGwValuesOnRefresh).toHaveBeenCalledWith(mockDispatch);
        expect(mockGetUnregisteredMssqlAssessmentData).toHaveBeenCalledWith({
            accountId: 'account-1',
            ec2InstanceId: 'i-case2',
            instanceName: 'CASE2SQL',
            region: 'ap-southeast-1',
            credentialId: 'cred-1'
        });
        expect(mockGetOfflineMssqlAssessmentData).not.toHaveBeenCalled();
        expect(mockAssessmentDetailsApi).not.toHaveBeenCalled();
    });

    it('calls offline-assessment GET on page load when isWad is true', async () => {
        getWellState = {
            ...baseGetWellState,
            isWad: true,
            selectedResourceId: 'host-wad',
            selectedDatabaseInstance: 'inst-wad'
        };

        await renderGetWellApi();

        expect(mockGetOfflineMssqlAssessmentData).toHaveBeenCalledWith({
            databaseHostId: 'host-wad',
            instanceId: 'inst-wad',
            credentialId: 'cred-1',
            regionId: 'us-east-1'
        });
        expect(mockGetUnregisteredMssqlAssessmentData).not.toHaveBeenCalled();
        expect(mockAssessmentDetailsApi).not.toHaveBeenCalled();
    });

    it('calls registered assessment GET on page load for managed instances', async () => {
        await renderGetWellApi();

        expect(mockAssessmentDetailsApi).toHaveBeenCalledWith({
            credentialId: 'cred-1',
            regionId: 'us-east-1',
            databaseHostId: 'host-123',
            instanceId: 'MSSQLSERVER'
        });
        expect(mockGetUnregisteredMssqlAssessmentData).not.toHaveBeenCalled();
        expect(mockGetOfflineMssqlAssessmentData).not.toHaveBeenCalled();
    });

    it('skips page-load fetch when well-architected status tab was already visited', async () => {
        getWellState = {
            ...baseGetWellState,
            isUnregistered: true,
            visitedTabs: { [WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS]: true }
        };

        await renderGetWellApi();

        expect(mockGetUnregisteredMssqlAssessmentData).not.toHaveBeenCalled();
        expect(mockGetOfflineMssqlAssessmentData).not.toHaveBeenCalled();
        expect(mockAssessmentDetailsApi).not.toHaveBeenCalled();
    });
});
