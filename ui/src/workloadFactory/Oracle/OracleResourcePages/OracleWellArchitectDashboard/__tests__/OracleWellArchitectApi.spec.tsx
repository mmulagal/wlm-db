import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

import useOracleWellArchitectApi from '../OracleWellArchitectApi';

const {
    mockDispatch,
    mockGetUnregisteredOracleAssessmentData,
    mockGetOfflineOracleAssessmentData,
    mockGetOracleAssessmentDataApi,
    mockFormatOracleWellArchitectedData,
    mockUpdateAccountLevelAssessmentData,
    mockResetGwValuesOnRefresh
} = vi.hoisted(() => ({
    mockDispatch: vi.fn(),
    mockGetUnregisteredOracleAssessmentData: vi.fn(),
    mockGetOfflineOracleAssessmentData: vi.fn(),
    mockGetOracleAssessmentDataApi: vi.fn(),
    mockFormatOracleWellArchitectedData: vi.fn(),
    mockUpdateAccountLevelAssessmentData: vi.fn(),
    mockResetGwValuesOnRefresh: vi.fn()
}));

let getWellState: Record<string, unknown> = {};
let workloadFactoryResourceState: Record<string, unknown> = {};
let oracleSliceState: Record<string, unknown> = {};

vi.mock('../../../../../store/storeHooks', () => ({
    useAppSelector: (selector: (state: unknown) => unknown) =>
        selector({
            auth: { accountId: 'account-1' },
            getWellOptimize: getWellState,
            workloadFactoryResource: workloadFactoryResourceState,
            oracleSlice: oracleSliceState
        })
}));

vi.mock('react-redux', () => ({
    useDispatch: () => mockDispatch
}));

vi.mock('../../../../../utils/apiService', () => ({
    useGetOracleAssessmentDataMutation: () => [mockGetOracleAssessmentDataApi],
    useLazyGetOfflineOracleAssessmentDataQuery: () => [mockGetOfflineOracleAssessmentData],
    useLazyGetUnregisteredOracleAssessmentQuery: () => [mockGetUnregisteredOracleAssessmentData]
}));

vi.mock('../OracleWellArchitectedUtils', () => ({
    formatOracleWellArchitectedData: (...args: unknown[]) => mockFormatOracleWellArchitectedData(...args)
}));

vi.mock('../../../../GetWell/GetWellUtils', () => ({
    updateAccountLevelAssessmentData: (...args: unknown[]) => mockUpdateAccountLevelAssessmentData(...args),
    resetGwValuesOnRefresh: (...args: unknown[]) => mockResetGwValuesOnRefresh(...args)
}));

vi.mock('../../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setCardData: vi.fn((payload: unknown) => ({ type: 'setCardData', payload })),
    setDriftAssessmentData: vi.fn((payload: unknown) => ({ type: 'setDriftAssessmentData', payload })),
    setGwSelectedRowFsxId: vi.fn((payload: unknown) => ({ type: 'setGwSelectedRowFsxId', payload })),
    setGwRefreshTimestamp: vi.fn((payload: unknown) => ({ type: 'setGwRefreshTimestamp', payload })),
    setGwTimestamp: vi.fn((payload: unknown) => ({ type: 'setGwTimestamp', payload })),
    setIsAssessmentAvailable: vi.fn((payload: unknown) => ({ type: 'setIsAssessmentAvailable', payload })),
    setLandingFromInnerPage: vi.fn((payload: unknown) => ({ type: 'setLandingFromInnerPage', payload })),
    setOptimizePageLoading: vi.fn((payload: unknown) => ({ type: 'setOptimizePageLoading', payload }))
}));

vi.mock('../../../../../store/workloadFactory/oracleSlice', () => ({
    setRefreshOracleWellArchitect: vi.fn((payload: unknown) => ({ type: 'setRefreshOracleWellArchitect', payload }))
}));

const OracleApiHarness = () => {
    useOracleWellArchitectApi();
    return null;
};

const baseGetWellState = {
    credIdFromJM: '',
    regionFromJM: '',
    selectedResourceId: 'i-oracle-ec2',
    selectedDatabaseInstance: 'ORCL1',
    landingFromInnerPage: false,
    isWad: false,
    isUnregistered: false
};

const baseWorkloadResourceState = {
    selectedResourceId: '',
    selectedDatabaseInstance: '',
    selectedResourceCredId: 'cred-1',
    selectedResourceRegionId: 'ap-southeast-1'
};

const baseOracleSliceState = {
    visitedTabs: {},
    refreshWellArchitect: false
};

describe('OracleWellArchitectApi page-load routing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getWellState = { ...baseGetWellState };
        workloadFactoryResourceState = { ...baseWorkloadResourceState };
        oracleSliceState = { ...baseOracleSliceState };
        mockGetUnregisteredOracleAssessmentData.mockResolvedValue({ data: { metadata: {} } });
        mockGetOfflineOracleAssessmentData.mockResolvedValue({ data: { metadata: {} } });
        mockGetOracleAssessmentDataApi.mockResolvedValue({ data: { metadata: {} } });
    });

    it('calls unregistered offline-assessment GET on page load when isUnregistered is true', async () => {
        getWellState = { ...baseGetWellState, isUnregistered: true };

        await act(async () => {
            render(<OracleApiHarness />);
        });

        expect(mockGetUnregisteredOracleAssessmentData).toHaveBeenCalledWith({
            accountId: 'account-1',
            ec2InstanceId: 'i-oracle-ec2',
            instanceName: 'ORCL1',
            region: 'ap-southeast-1',
            credentialId: 'cred-1'
        });
        expect(mockGetOfflineOracleAssessmentData).not.toHaveBeenCalled();
        expect(mockGetOracleAssessmentDataApi).not.toHaveBeenCalled();
    });

    it('calls offline-assessment GET on page load when isWad is true', async () => {
        getWellState = {
            ...baseGetWellState,
            isWad: true,
            selectedResourceId: 'host-wad',
            selectedDatabaseInstance: 'ORCL-WAD'
        };

        await act(async () => {
            render(<OracleApiHarness />);
        });

        expect(mockGetOfflineOracleAssessmentData).toHaveBeenCalledWith({
            databaseHostId: 'host-wad',
            instanceId: 'ORCL-WAD',
            credentialId: 'cred-1',
            regionId: 'ap-southeast-1'
        });
        expect(mockGetUnregisteredOracleAssessmentData).not.toHaveBeenCalled();
        expect(mockGetOracleAssessmentDataApi).not.toHaveBeenCalled();
    });

    it('calls registered assessment GET on page load for managed instances', async () => {
        getWellState = {
            ...baseGetWellState,
            selectedResourceId: 'host-managed',
            selectedDatabaseInstance: 'ORCL-MGD'
        };

        await act(async () => {
            render(<OracleApiHarness />);
        });

        expect(mockGetOracleAssessmentDataApi).toHaveBeenCalledWith({
            credentialId: 'cred-1',
            regionId: 'ap-southeast-1',
            databaseHostId: 'host-managed',
            instanceId: 'ORCL-MGD'
        });
        expect(mockGetUnregisteredOracleAssessmentData).not.toHaveBeenCalled();
        expect(mockGetOfflineOracleAssessmentData).not.toHaveBeenCalled();
    });

    it('refetches unregistered assessment when instance changes even if tab was visited', async () => {
        getWellState = {
            ...baseGetWellState,
            isUnregistered: true,
            selectedResourceId: 'i-other',
            selectedDatabaseInstance: 'OTHER'
        };
        oracleSliceState = {
            ...baseOracleSliceState,
            visitedTabs: { 'Well-architected status': true }
        };

        await act(async () => {
            render(<OracleApiHarness />);
        });

        expect(mockResetGwValuesOnRefresh).toHaveBeenCalledWith(mockDispatch);
        expect(mockGetUnregisteredOracleAssessmentData).toHaveBeenCalled();
    });

    it('clears assessment timestamps when unregistered offline-assessment GET fails', async () => {
        getWellState = { ...baseGetWellState, isUnregistered: true };
        mockGetUnregisteredOracleAssessmentData.mockResolvedValue({ error: { message: 'WAD assessment not found' } });

        await act(async () => {
            render(<OracleApiHarness />);
        });

        expect(mockDispatch).toHaveBeenCalledWith({ type: 'setIsAssessmentAvailable', payload: false });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'setGwRefreshTimestamp', payload: '' });
        expect(mockDispatch).toHaveBeenCalledWith({ type: 'setGwTimestamp', payload: '0' });
        expect(mockFormatOracleWellArchitectedData).not.toHaveBeenCalled();
    });

    it('calls unregistered GET on Oracle refresh when refreshWellArchitect is true', async () => {
        getWellState = { ...baseGetWellState, isUnregistered: true };
        oracleSliceState = { ...baseOracleSliceState, refreshWellArchitect: true };

        await act(async () => {
            render(<OracleApiHarness />);
        });

        expect(mockGetUnregisteredOracleAssessmentData).toHaveBeenCalled();
    });
});
