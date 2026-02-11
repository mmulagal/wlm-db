import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useOnPremData } from './useOnPremData';
import { SQL_DEPLOYMENT_MODE } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import { NOTIFICATION_TYPES } from '../../../store/notificationSlice';

// ========================
//  Mocks
// ========================

const mockDispatch = vi.fn();
vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => mockDispatch };
});

const mockGetOnPremSavings = vi.fn();
vi.mock('../../../utils/apiService', () => ({
    useGetOnPremSavingsMutation: () => [mockGetOnPremSavings]
}));

vi.mock('../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setOnPremiseData: (val: any) => ({ type: 'es/setOnPremiseData', payload: val }),
    setOnPremiseDataLoading: (val: any) => ({ type: 'es/setOnPremiseDataLoading', payload: val }),
    setOnPremiseOracleData: (val: any) => ({ type: 'es/setOnPremiseOracleData', payload: val }),
    setOnPremiseOracleDataLoading: (val: any) => ({ type: 'es/setOnPremiseOracleDataLoading', payload: val })
}));

vi.mock('../../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { ERROR: 'ERROR' },
    addNotification: (val: any) => ({ type: 'notification/add', payload: val })
}));

// ========================
//  Helpers
// ========================

const createMockStore = (overrides: Record<string, any> = {}) => {
    const defaults = {
        onPremiseData: null,
        onPremiseOracleData: null,
        ...overrides
    };
    return configureStore({
        reducer: {
            exploreSavings: () => ({
                onPremiseData: defaults.onPremiseData,
                onPremiseOracleData: defaults.onPremiseOracleData
            })
        }
    });
};

const renderHookWithStore = (overrides: Record<string, any> = {}) => {
    const store = createMockStore(overrides);
    const wrapper = ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider>;
    return renderHook(() => useOnPremData(), { wrapper });
};

// ========================
//  Tests
// ========================

describe('useOnPremData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ---- Return values ----

    it('should return expected shape', () => {
        const { result } = renderHookWithStore();
        expect(result.current.onPremiseData).toBeNull();
        expect(result.current.onPremiseOracleData).toBeNull();
        expect(result.current.error).toBeNull();
        expect(typeof result.current.fetchOnPremData).toBe('function');
        expect(typeof result.current.fetchOracleOnPremData).toBe('function');
    });

    it('should return existing data from Redux', () => {
        const { result } = renderHookWithStore({ onPremiseData: [{ id: '1' }] });
        expect(result.current.onPremiseData).toEqual([{ id: '1' }]);
    });

    // =====================
    //  fetchOnPremData
    // =====================

    describe('fetchOnPremData', () => {
        it('should early return when data exists, not forced, and not uploading', async () => {
            const { result } = renderHookWithStore({ onPremiseData: [{ id: '1' }] });
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            expect(mockGetOnPremSavings).not.toHaveBeenCalled();
        });

        it('should fetch when forceRefresh is true even if data exists', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });
            const { result } = renderHookWithStore({ onPremiseData: [{ id: '1' }] });
            await act(async () => {
                await result.current.fetchOnPremData(true);
            });
            expect(mockGetOnPremSavings).toHaveBeenCalledWith({ type: 'mssql' });
        });

        it('should fetch when onPremiseData is null', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });
            const { result } = renderHookWithStore({ onPremiseData: null });
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            expect(mockGetOnPremSavings).toHaveBeenCalledWith({ type: 'mssql' });
        });

        it('should dispatch loading state and reset data before fetch', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseData', payload: null });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseDataLoading', payload: true });
        });

        it('should process items with failover_cluster deployment model', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE,
                            sqlServerInstances: [{ sqlInstanceName: 'inst1' }],
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) => c[0]?.type === 'es/setOnPremiseData' && c[0]?.payload !== null
            );
            expect(setDataCall).toBeTruthy();
            expect(setDataCall![0].payload[0].deploymentModel).toBe(GENERAL.FAILOVER_CLUSTER_INSTANCES);
        });

        it('should process items with aoag deployment model', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'Host2',
                            deploymentModel: SQL_DEPLOYMENT_MODE.AOAG,
                            sqlServerInstances: [{ sqlInstanceName: 'inst1' }],
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) => c[0]?.type === 'es/setOnPremiseData' && c[0]?.payload !== null
            );
            expect(setDataCall![0].payload[0].deploymentModel).toBe(GENERAL.AOAG);
        });

        it('should process items with standalone deployment model', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'Host3',
                            deploymentModel: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE,
                            sqlServerInstances: [{ sqlInstanceName: 'inst1' }],
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) => c[0]?.type === 'es/setOnPremiseData' && c[0]?.payload !== null
            );
            expect(setDataCall![0].payload[0].deploymentModel).toBe(GENERAL.STANDALONE);
        });

        it('should set empty deployment model for unknown values', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'Host4',
                            deploymentModel: 'unknown',
                            sqlServerInstances: [{ sqlInstanceName: 'inst1' }],
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) => c[0]?.type === 'es/setOnPremiseData' && c[0]?.payload !== null
            );
            expect(setDataCall![0].payload[0].deploymentModel).toBe('');
        });

        it('should filter out instances with errorMessage', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'Host5',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [
                                { sqlInstanceName: 'good' },
                                { sqlInstanceName: 'bad', errorMessage: 'error' }
                            ],
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) => c[0]?.type === 'es/setOnPremiseData' && c[0]?.payload !== null
            );
            expect(setDataCall![0].payload[0].sqlServerInstances).toHaveLength(1);
            expect(setDataCall![0].payload[0].totalInstance).toBe(1);
        });

        it('should build instanceNameList from filtered instances', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'Host6',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [{ sqlInstanceName: 'inst1' }, { sqlInstanceName: 'inst2' }],
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) => c[0]?.type === 'es/setOnPremiseData' && c[0]?.payload !== null
            );
            expect(setDataCall![0].payload[0].instanceNameList).toEqual(['inst1', 'inst2']);
            expect(setDataCall![0].payload[0].nameForSorting).toBe('host6');
        });

        it('should fallback to empty instanceNameList when sqlServerInstances is null', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'HostNull',
                            deploymentModel: 'standalone',
                            sqlServerInstances: null,
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) => c[0]?.type === 'es/setOnPremiseData' && c[0]?.payload !== null && c[0]?.payload.length > 0
            );
            expect(setDataCall![0].payload[0].instanceNameList).toEqual([]);
        });

        it('should dispatch loading false after success', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseDataLoading', payload: false });
        });

        it('should handle API error and dispatch notification', async () => {
            mockGetOnPremSavings.mockRejectedValue(new Error('API error'));
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseData', payload: [] });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseDataLoading', payload: false });
            expect(mockDispatch).toHaveBeenCalledWith({
                type: 'notification/add',
                payload: { notificationType: 'ERROR', message: 'Error fetching data' }
            });
        });

        it('should handle null apiResult data gracefully', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: null });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOnPremData();
            });
            // Should still dispatch the empty result array
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) =>
                    c[0]?.type === 'es/setOnPremiseData' && Array.isArray(c[0]?.payload) && c[0]?.payload.length === 0
            );
            expect(setDataCall).toBeTruthy();
        });
    });

    // =====================
    //  fetchOracleOnPremData
    // =====================

    describe('fetchOracleOnPremData', () => {
        it('should early return when oracle data exists, not forced, and not uploading', async () => {
            const { result } = renderHookWithStore({ onPremiseOracleData: [{ id: '1' }] });
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            expect(mockGetOnPremSavings).not.toHaveBeenCalled();
        });

        it('should fetch when forceRefresh is true even if oracle data exists', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });
            const { result } = renderHookWithStore({ onPremiseOracleData: [{ id: '1' }] });
            await act(async () => {
                await result.current.fetchOracleOnPremData(true);
            });
            expect(mockGetOnPremSavings).toHaveBeenCalledWith({ type: 'oracle' });
        });

        it('should fetch when onPremiseOracleData is null', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });
            const { result } = renderHookWithStore({ onPremiseOracleData: null });
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            expect(mockGetOnPremSavings).toHaveBeenCalledWith({ type: 'oracle' });
        });

        it('should dispatch loading state and reset data before fetch', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseOracleData', payload: null });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseOracleDataLoading', payload: true });
        });

        it('should process oracle items with databases', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'OraHost1',
                            oracleDatabases: [
                                { databaseName: 'db1', deploymentModel: 'RAC' },
                                { databaseName: 'db2', deploymentModel: 'RAC' }
                            ],
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) =>
                    c[0]?.type === 'es/setOnPremiseOracleData' && c[0]?.payload !== null && c[0]?.payload.length > 0
            );
            expect(setDataCall).toBeTruthy();
            const row = setDataCall![0].payload[0];
            expect(row.databaseNameList).toEqual(['db1', 'db2']);
            expect(row.deploymentModel).toBe('RAC');
            expect(row.onPremNode).toBe('node1');
            expect(row.nameForSorting).toBe('orahost1');
        });

        it('should set empty deploymentModel when oracleDatabases is empty', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'OraHost2',
                            oracleDatabases: [],
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) =>
                    c[0]?.type === 'es/setOnPremiseOracleData' && c[0]?.payload !== null && c[0]?.payload.length > 0
            );
            expect(setDataCall![0].payload[0].deploymentModel).toBe('');
            expect(setDataCall![0].payload[0].databaseNameList).toEqual([]);
        });

        it('should fallback to empty databaseNameList when oracleDatabases is null', async () => {
            mockGetOnPremSavings.mockResolvedValue({
                data: {
                    items: [
                        {
                            resourceName: 'OraHost3',
                            oracleDatabases: null,
                            onPremisesNodes: ['node1']
                        }
                    ]
                }
            });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) =>
                    c[0]?.type === 'es/setOnPremiseOracleData' && c[0]?.payload !== null && c[0]?.payload.length > 0
            );
            expect(setDataCall![0].payload[0].databaseNameList).toEqual([]);
        });

        it('should dispatch loading false after success', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseOracleDataLoading', payload: false });
        });

        it('should handle API error and dispatch notification', async () => {
            mockGetOnPremSavings.mockRejectedValue(new Error('Oracle API error'));
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseOracleData', payload: [] });
            expect(mockDispatch).toHaveBeenCalledWith({ type: 'es/setOnPremiseOracleDataLoading', payload: false });
            expect(mockDispatch).toHaveBeenCalledWith({
                type: 'notification/add',
                payload: { notificationType: 'ERROR', message: 'Error fetching data' }
            });
        });

        it('should handle null apiResult data gracefully', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: null });
            const { result } = renderHookWithStore();
            await act(async () => {
                await result.current.fetchOracleOnPremData();
            });
            const setDataCall = mockDispatch.mock.calls.find(
                (c: any) =>
                    c[0]?.type === 'es/setOnPremiseOracleData' &&
                    Array.isArray(c[0]?.payload) &&
                    c[0]?.payload.length === 0
            );
            expect(setDataCall).toBeTruthy();
        });
    });
});
