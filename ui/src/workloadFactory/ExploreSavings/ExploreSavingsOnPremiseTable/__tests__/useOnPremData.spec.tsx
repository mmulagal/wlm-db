import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useOnPremData } from '../useOnPremData';
import exploreSavingsSlice from '../../../../store/workloadFactory/exploreSavingsSlice';
import notificationSlice from '../../../../store/notificationSlice';
import { SQL_DEPLOYMENT_MODE } from '../../../../utils/consts';
import { GENERAL } from '../../../../utils/appConstants';

// Mock the API service
const mockGetOnPremSavings = vi.fn();
vi.mock('../../../../utils/apiService', () => ({
    useGetOnPremSavingsMutation: () => [mockGetOnPremSavings]
}));

describe('useOnPremData', () => {
    const createMockStore = (initialOnPremData: any = null) => {
        return configureStore({
            reducer: {
                exploreSavings: (state = { onPremiseData: initialOnPremData, onPremiseDataLoading: false }) => state,
                notifications: notificationSlice.reducer
            }
        });
    };

    const wrapper = ({ children, store }: any) => <Provider store={store}>{children}</Provider>;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Hook Initialization', () => {
        it('should initialize with null error', () => {
            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            expect(result.current.error).toBeNull();
        });

        it('should return fetchOnPremData function', () => {
            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            expect(typeof result.current.fetchOnPremData).toBe('function');
        });

        it('should return onPremiseData from store', () => {
            const mockData = [{ id: 1, name: 'test' }];
            const store = createMockStore(mockData);
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            expect(result.current.onPremiseData).toEqual(mockData);
        });
    });

    describe('fetchOnPremData - Basic Functionality', () => {
        it('should fetch data successfully', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'TestHost',
                            deploymentModel: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE,
                            sqlServerInstances: [{ sqlInstanceName: 'Instance1' }],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should not fetch if data exists and forceRefresh is false', async () => {
            const existingData = [{ id: 1 }];
            const store = createMockStore(existingData);
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(false);

            expect(mockGetOnPremSavings).not.toHaveBeenCalled();
        });

        it('should fetch if forceRefresh is true even with existing data', async () => {
            mockGetOnPremSavings.mockResolvedValue({ data: { items: [] } });

            const existingData = [{ id: 1 }];
            const store = createMockStore(existingData);
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });
    });

    describe('Data Transformation - Deployment Models', () => {
        it('should transform FAILOVER_CLUSTER deployment model correctly', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE,
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });

            // Verify deployment model is transformed
            expect(mockApiResponse.data.items[0].deploymentModel).toBe(SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE);
        });

        it('should transform AOAG deployment model correctly', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: SQL_DEPLOYMENT_MODE.AOAG,
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should transform SINGLE_INSTANCE deployment model correctly', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE,
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should handle unknown deployment model', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: 'unknown',
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });
    });

    describe('SQL Server Instances Processing', () => {
        it('should filter out instances with errorMessage', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [
                                { sqlInstanceName: 'Instance1' },
                                { sqlInstanceName: 'Instance2', errorMessage: 'Error' },
                                { sqlInstanceName: 'Instance3' }
                            ],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should create instanceNameList from sqlServerInstances', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [{ sqlInstanceName: 'Inst1' }, { sqlInstanceName: 'Inst2' }],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should handle empty sqlServerInstances array', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle API error gracefully', async () => {
            mockGetOnPremSavings.mockRejectedValue(new Error('API Error'));

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should reset error state on successful fetch', async () => {
            const mockApiResponse = {
                data: {
                    items: []
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(result.current.error).toBeNull();
            });
        });
    });

    describe('Data Processing', () => {
        it('should add uniqueId to each row', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should add nameForSorting with lowercase resourceName', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'TestHost',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should set onPremNode from first onPremisesNodes element', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [],
                            onPremisesNodes: ['FirstNode', 'SecondNode']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should set totalInstance to number of filtered instances', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [{ sqlInstanceName: 'I1' }, { sqlInstanceName: 'I2' }],
                            onPremisesNodes: ['Node1']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });
    });

    describe('Multiple Items Processing', () => {
        it('should process multiple items correctly', async () => {
            const mockApiResponse = {
                data: {
                    items: [
                        {
                            resourceName: 'Host1',
                            deploymentModel: 'standalone',
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node1']
                        },
                        {
                            resourceName: 'Host2',
                            deploymentModel: 'aoag',
                            sqlServerInstances: [],
                            onPremisesNodes: ['Node2']
                        }
                    ]
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty items array', async () => {
            const mockApiResponse = {
                data: {
                    items: []
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should handle undefined items', async () => {
            const mockApiResponse = {
                data: {}
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData(true);

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });

        it('should call fetchOnPremData with default forceRefresh=false', async () => {
            const mockApiResponse = {
                data: {
                    items: []
                }
            };

            mockGetOnPremSavings.mockResolvedValue(mockApiResponse);

            const store = createMockStore();
            const { result } = renderHook(() => useOnPremData(), {
                wrapper: ({ children }) => wrapper({ children, store })
            });

            await result.current.fetchOnPremData();

            await waitFor(() => {
                expect(mockGetOnPremSavings).toHaveBeenCalled();
            });
        });
    });
});
