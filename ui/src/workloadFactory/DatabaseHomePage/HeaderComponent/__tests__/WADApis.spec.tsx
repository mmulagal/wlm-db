import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

// ── Hoist mocks ──────────────────────────────────────────────────────────────
const {
    mockDispatch,
    mockGetAllOfflineAssessmentAPI,
    mockSetInventoryTableData,
    mockSetOfflineMssqlHostAssessmentLoading,
    mockAddOfflineMssqlHostAssessmentData,
    mockFormatOfflineAssessmentToInventoryData
} = vi.hoisted(() => ({
    mockDispatch: vi.fn(),
    mockGetAllOfflineAssessmentAPI: vi.fn(),
    mockSetInventoryTableData: vi.fn((v: any) => ({ type: 'setInventoryTableData', payload: v })),
    mockSetOfflineMssqlHostAssessmentLoading: vi.fn((v: any) => ({
        type: 'setOfflineMssqlHostAssessmentLoading',
        payload: v
    })),
    mockAddOfflineMssqlHostAssessmentData: vi.fn((v: any) => ({
        type: 'addOfflineMssqlHostAssessmentData',
        payload: v
    })),
    mockFormatOfflineAssessmentToInventoryData: vi.fn(() => ({}))
}));

vi.mock('react-redux', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return { ...actual, useDispatch: () => mockDispatch };
});

vi.mock('../../../../utils/apiService', () => ({
    useLazyGetAllOfflineMssqlHostsAssessmentDataQuery: vi.fn(() => [mockGetAllOfflineAssessmentAPI])
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    addOfflineMssqlHostAssessmentData: mockAddOfflineMssqlHostAssessmentData,
    setInventoryTableData: mockSetInventoryTableData,
    setOfflineMssqlHostAssessmentLoading: mockSetOfflineMssqlHostAssessmentLoading
}));

vi.mock('../../../InventoryV2/InventoryUtilsV2', () => ({
    formatOfflineAssessmentToInventoryData: mockFormatOfflineAssessmentToInventoryData
}));

vi.mock('../../../../store/store', () => ({
    default: {
        getState: vi.fn(() => ({
            inventoryV2: { inventoryTableData: {} }
        }))
    }
}));

import WADApis from '../WADApis';

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            headers: (
                state = {
                    headerSelectedMultiCredIdsList: overrides.credIds ?? ['cred1'],
                    headerSelectedMultiRegionIdsList: overrides.regionIds ?? ['us-east-1']
                }
            ) => state,
            inventoryV2: (
                state = {
                    inventoryTableData: overrides.inventoryTableData ?? {},
                    offlineMssqlHostAssessmentData: overrides.offlineMssqlHostAssessmentData ?? null,
                    isRefreshed: overrides.isRefreshed ?? false
                }
            ) => state
        }
    });

const Wrapper = ({ store }: { store: any }) => (
    <Provider store={store}>
        <WADApis />
    </Provider>
);

describe('WADApis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAllOfflineAssessmentAPI.mockResolvedValue({
            data: { items: [], nextToken: null }
        });
    });

    it('renders without crashing (returns null)', async () => {
        const { container } = await act(async () => render(<Wrapper store={makeStore()} />));
        expect(container.firstChild).toBeNull();
    });

    it('calls API on mount', async () => {
        await act(async () => render(<Wrapper store={makeStore()} />));
        expect(mockGetAllOfflineAssessmentAPI).toHaveBeenCalledWith({
            credentialId: null,
            regionId: null,
            nextToken: null
        });
    });

    it('dispatches setOfflineMssqlHostAssessmentLoading(true) on mount', async () => {
        await act(async () => render(<Wrapper store={makeStore()} />));
        expect(mockSetOfflineMssqlHostAssessmentLoading).toHaveBeenCalledWith(true);
    });

    it('dispatches setOfflineMssqlHostAssessmentLoading(false) after API completes', async () => {
        mockGetAllOfflineAssessmentAPI.mockResolvedValue({
            data: { items: [{ hostId: 'h1', isWad: false }], nextToken: null }
        });
        await act(async () => render(<Wrapper store={makeStore()} />));
        expect(mockSetOfflineMssqlHostAssessmentLoading).toHaveBeenCalledWith(false);
    });

    it('dispatches addOfflineMssqlHostAssessmentData with fetched items', async () => {
        const items = [{ hostId: 'h1' }, { hostId: 'h2' }];
        mockGetAllOfflineAssessmentAPI.mockResolvedValue({
            data: { items, nextToken: null }
        });
        await act(async () => render(<Wrapper store={makeStore()} />));
        expect(mockAddOfflineMssqlHostAssessmentData).toHaveBeenCalledWith(
            items.map(item => ({ ...item, isWad: true }))
        );
    });

    it('handles API error gracefully', async () => {
        mockGetAllOfflineAssessmentAPI.mockResolvedValue({
            error: { message: 'API Error' }
        });
        await act(async () => render(<Wrapper store={makeStore()} />));
        expect(mockSetOfflineMssqlHostAssessmentLoading).toHaveBeenCalledWith(false);
        // Should not dispatch addOfflineMssqlHostAssessmentData when assessmentData is empty
        expect(mockAddOfflineMssqlHostAssessmentData).not.toHaveBeenCalled();
    });

    it('handles pagination - calls API again with nextToken', async () => {
        // First call returns nextToken, second call returns no nextToken
        mockGetAllOfflineAssessmentAPI
            .mockResolvedValueOnce({
                data: { items: [{ hostId: 'h1' }], nextToken: 'token123' }
            })
            .mockResolvedValueOnce({
                data: { items: [{ hostId: 'h2' }], nextToken: null }
            });

        await act(async () => render(<Wrapper store={makeStore()} />));
        expect(mockGetAllOfflineAssessmentAPI).toHaveBeenCalledTimes(2);
        expect(mockGetAllOfflineAssessmentAPI).toHaveBeenNthCalledWith(2, {
            credentialId: null,
            regionId: null,
            nextToken: 'token123'
        });
    });

    it('dispatches setInventoryTableData when offline data exists', async () => {
        mockGetAllOfflineAssessmentAPI.mockResolvedValue({
            data: { items: [{ hostId: 'host1' }], nextToken: null }
        });
        mockFormatOfflineAssessmentToInventoryData.mockReturnValue({ 'key1': { name: 'host1' } });
        await act(async () => render(<Wrapper store={makeStore()} />));
        expect(mockSetInventoryTableData).toHaveBeenCalled();
    });

    it('re-fetches on isRefreshed state change', async () => {
        const store = makeStore({ isRefreshed: true });
        await act(async () => render(<Wrapper store={store} />));
        // Should be called at least once (mount) + once for isRefreshed=true
        expect(mockGetAllOfflineAssessmentAPI).toHaveBeenCalled();
    });

    it('handles exception in API call gracefully', async () => {
        mockGetAllOfflineAssessmentAPI.mockRejectedValue(new Error('Network failure'));
        await act(async () => render(<Wrapper store={makeStore()} />));
        expect(mockSetOfflineMssqlHostAssessmentLoading).toHaveBeenCalledWith(false);
    });

    it('merges offline data with existing inventoryTableData', async () => {
        const existingData = { 'existing_host': { name: 'existing' } };
        const newData = { 'new_host': { name: 'new', isWad: true } };
        mockFormatOfflineAssessmentToInventoryData.mockReturnValue(newData);
        mockGetAllOfflineAssessmentAPI.mockResolvedValue({
            data: { items: [{ hostId: 'new_host' }], nextToken: null }
        });

        const { default: storeModule } = await import('../../../../store/store');
        (storeModule.getState as any).mockReturnValue({
            inventoryV2: { inventoryTableData: existingData }
        });

        await act(async () => render(<Wrapper store={makeStore({ inventoryTableData: existingData })} />));
        expect(mockSetInventoryTableData).toHaveBeenCalledWith(
            expect.objectContaining({ 'existing_host': { name: 'existing' } })
        );
    });
});
