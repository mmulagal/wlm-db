import { render, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import OracleEbsSavingsCalculatorApi from './OracleEbsSavingsCalculatorApi';

// ---- Mock API functions ----
const mockGetOracleBulkStorageSavings = vi.fn();
const mockGetOracleBulkViewCalculations = vi.fn();
const mockGetOracleInstanceData = vi.fn();

vi.mock('../../../../utils/apiService', () => ({
    useGetOracleBulkStorageSavingsMutation: () => [mockGetOracleBulkStorageSavings],
    useGetOracleBulkViewCalculationsMutation: () => [mockGetOracleBulkViewCalculations],
    useGetOracleInstanceDataMutation: () => [mockGetOracleInstanceData]
}));

const mockPrepareStorageSavingsData = vi.fn();
const mockPrepareViewCalcData = vi.fn();
vi.mock('../../SavingsCalculator/savingsUtil', () => ({
    prepareStorageSavingsData: (...args: any[]) => mockPrepareStorageSavingsData(...args),
    prepareViewCalcData: (...args: any[]) => mockPrepareViewCalcData(...args)
}));

// ---- Store mock reducer ----
const makeExploreSavingsState = (overrides: any = {}) => ({
    selectedSnapshotFrequency: { value: 'daily', label: 'Daily' },
    numberOfClonedCopies: 2,
    selectedCloneRefresh: { value: 'weekly', label: 'Weekly' },
    monthlyChangeRate: 5,
    selectedInstanceId: 'i-123',
    savingsCalculatorFrom: 'Oracle_Auto_EBS',
    selectedExCredId: 'cred-1',
    selectedExRegionId: 'us-east-1',
    showOptimizeMode: { showCalcMode: false },
    selectedDeploymentModel: 'Standalone',
    selectedHostDetails: null,
    hasFetched: false,
    storageSavingsLoading: false,
    viewCalculationsLoading: false,
    disableState: false,
    storageSavingsResponse: null,
    viewCalculationsResponse: null,
    viewCalculationsApiResponse: null,
    showFirstTimeOptimize: null,
    ...overrides
});

const makeBulkState = (overrides: any = {}) => ({
    selectedRowsForExploreSavingsOracleEbsBulk: [],
    selectedRowsForExploreSavingsEBSBulk: [],
    selectedRowsForExploreSavingsOnPremBulk: [],
    selectedRowsForExploreSavingsOracleOnPremBulk: [],
    ebsTCOAction: '',
    bulkAuthCredentials: {},
    rowsRequiringAuthBulk: [],
    bulkAuthStatus: {},
    triggerBulkDataFetch: true,
    ...overrides
});

const makeOracleEbsHost = (id: number) => ({
    id: `host-${id}`,
    ec2InstanceId: `i-${id}`,
    ec2Details: [{ id: `i-${id}`, name: `ec2-${id}` }],
    credentialId: 'cred-1',
    regionId: 'us-east-1',
    name: `oracle-host-${id}`
});

const createStore = (esOverrides: any = {}, bulkOverrides: any = {}) => {
    const esState = makeExploreSavingsState(esOverrides);
    const bulkState = makeBulkState(bulkOverrides);

    return configureStore({
        reducer: {
            exploreSavings: (state = esState, action: any) => {
                switch (action.type) {
                    case 'exploreSavings/setStorageSavingsLoading':
                        return { ...state, storageSavingsLoading: action.payload };
                    case 'exploreSavings/setViewCalculationsLoading':
                        return { ...state, viewCalculationsLoading: action.payload };
                    case 'exploreSavings/setDisableState':
                        return { ...state, disableState: action.payload };
                    case 'exploreSavings/setStorageSavingsResponse':
                        return { ...state, storageSavingsResponse: action.payload };
                    case 'exploreSavings/setViewCalculationsResponse':
                        return { ...state, viewCalculationsResponse: action.payload };
                    case 'exploreSavings/setViewCalculationsApiResponse':
                        return { ...state, viewCalculationsApiResponse: action.payload };
                    case 'exploreSavings/setShowFirstTimeOptimize':
                        return { ...state, showFirstTimeOptimize: action.payload };
                    case 'exploreSavings/resetOptimizedStorage':
                        return { ...state };
                    case 'exploreSavings/setSelectedHostDetails':
                        return { ...state, selectedHostDetails: action.payload };
                    default:
                        return state;
                }
            },
            exploreSavingsBulk: (state = bulkState, action: any) => {
                switch (action.type) {
                    case 'exploreSavingsBulk/setTriggerBulkDataFetch':
                        return { ...state, triggerBulkDataFetch: action.payload };
                    case 'exploreSavingsBulk/setSelectedRowsForExploreSavingsOracleEbsBulk':
                        return { ...state, selectedRowsForExploreSavingsOracleEbsBulk: action.payload };
                    default:
                        return state;
                }
            }
        },
        middleware: getDefaultMiddleware => getDefaultMiddleware({ serializableCheck: false, immutableCheck: false })
    });
};

const renderComponent = (esOverrides: any = {}, bulkOverrides: any = {}) => {
    const store = createStore(esOverrides, bulkOverrides);
    const utils = render(
        <Provider store={store}>
            <OracleEbsSavingsCalculatorApi />
        </Provider>
    );
    return { store, ...utils };
};

// ---- Tests ----

describe('OracleEbsSavingsCalculatorApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOracleBulkStorageSavings.mockResolvedValue({ data: { compute: [], license: [] } });
        mockGetOracleBulkViewCalculations.mockResolvedValue({ data: {} });
        mockGetOracleInstanceData.mockResolvedValue({ data: { items: [] } });
    });

    describe('rendering', () => {
        it('should render nothing (returns null)', () => {
            const { container } = renderComponent();
            expect(container.innerHTML).toBe('');
        });
    });

    describe('API trigger on parameter changes (useEffect #1)', () => {
        it('should call storage savings & view calculations API when hosts exist', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });

            await waitFor(() => {
                expect(mockGetOracleBulkStorageSavings).toHaveBeenCalled();
                expect(mockGetOracleBulkViewCalculations).toHaveBeenCalled();
            });
        });

        it('should NOT call APIs when savingsCalculatorFrom is not ORACLE_AUTO_EBS', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent(
                { savingsCalculatorFrom: 'Auto_EBS' },
                { selectedRowsForExploreSavingsOracleEbsBulk: hosts }
            );

            // Wait a tick to ensure no calls
            await new Promise(r => setTimeout(r, 50));
            expect(mockGetOracleBulkStorageSavings).not.toHaveBeenCalled();
        });

        it('should NOT call APIs when no hosts are selected', async () => {
            renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: [] });

            await new Promise(r => setTimeout(r, 50));
            expect(mockGetOracleBulkStorageSavings).not.toHaveBeenCalled();
        });

        it('should NOT call APIs when numberOfClonedCopies exceeds MAX_CLONED_COPIES', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent({ numberOfClonedCopies: 999 }, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });

            await new Promise(r => setTimeout(r, 50));
            expect(mockGetOracleBulkStorageSavings).not.toHaveBeenCalled();
        });

        it('should NOT call APIs when monthlyChangeRate exceeds MAX_MONTHLY_CHANGE_RATE', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent({ monthlyChangeRate: 999 }, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });

            await new Promise(r => setTimeout(r, 50));
            expect(mockGetOracleBulkStorageSavings).not.toHaveBeenCalled();
        });
    });

    describe('API payload construction', () => {
        it('should build payload with hosts array from bulk selection', async () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2)];
            renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });

            await waitFor(() => {
                expect(mockGetOracleBulkStorageSavings).toHaveBeenCalledWith({
                    credentialId: 'cred-1',
                    regionId: 'us-east-1',
                    payload: expect.objectContaining({
                        snapshotFrequency: 'daily',
                        clonedCopiesCount: 2,
                        monthlyChangeRatePercentage: 5,
                        cloneRefreshFrequency: 'weekly',
                        hosts: [{ ec2InstanceId: 'i-1' }, { ec2InstanceId: 'i-2' }]
                    })
                });
            });
        });

        it('should NOT include license cost in the payload (Oracle-specific)', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });

            await waitFor(() => {
                const callArgs = mockGetOracleBulkStorageSavings.mock.calls[0][0];
                expect(callArgs.payload).not.toHaveProperty('monthlySqlByolCost');
                expect(callArgs.payload).not.toHaveProperty('monthlyOracleCost');
            });
        });

        it('should use selectedExCredId and selectedExRegionId over host values', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent(
                { selectedExCredId: 'override-cred', selectedExRegionId: 'override-region' },
                { selectedRowsForExploreSavingsOracleEbsBulk: hosts }
            );

            await waitFor(() => {
                expect(mockGetOracleBulkStorageSavings).toHaveBeenCalledWith(
                    expect.objectContaining({
                        credentialId: 'override-cred',
                        regionId: 'override-region'
                    })
                );
            });
        });

        it('should fall back to first host credentialId/regionId if selectedEx fields are empty', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent(
                { selectedExCredId: '', selectedExRegionId: '' },
                { selectedRowsForExploreSavingsOracleEbsBulk: hosts }
            );

            await waitFor(() => {
                expect(mockGetOracleBulkStorageSavings).toHaveBeenCalledWith(
                    expect.objectContaining({
                        credentialId: 'cred-1',
                        regionId: 'us-east-1'
                    })
                );
            });
        });
    });

    describe('API response handling', () => {
        it('should call prepareStorageSavingsData on successful storage savings response', async () => {
            const hosts = [makeOracleEbsHost(1)];
            const apiData = { compute: [{ hostname: 'oracle-host-1' }], license: [] };
            mockGetOracleBulkStorageSavings.mockResolvedValue({ data: apiData });

            renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });

            await waitFor(() => {
                expect(mockPrepareStorageSavingsData).toHaveBeenCalledWith(apiData, expect.any(Function), undefined);
            });
        });

        it('should call prepareViewCalcData on successful view calculations response', async () => {
            const hosts = [makeOracleEbsHost(1)];
            const apiData = { fsxInstanceCalculation: [] };
            mockGetOracleBulkViewCalculations.mockResolvedValue({ data: apiData });

            renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });

            await waitFor(() => {
                expect(mockPrepareViewCalcData).toHaveBeenCalledWith(
                    apiData,
                    expect.any(Function),
                    'Standalone',
                    5,
                    undefined
                );
            });
        });

        it('should handle API error for storage savings gracefully', async () => {
            const hosts = [makeOracleEbsHost(1)];
            mockGetOracleBulkStorageSavings.mockRejectedValue(new Error('Network error'));

            // Should not throw
            const { container } = renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });
            await waitFor(() => {
                expect(container.innerHTML).toBe('');
            });
        });

        it('should handle API error response (result.error) for storage savings', async () => {
            const hosts = [makeOracleEbsHost(1)];
            mockGetOracleBulkStorageSavings.mockResolvedValue({ error: 'Something failed' });

            renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });

            await waitFor(() => {
                expect(mockPrepareStorageSavingsData).not.toHaveBeenCalled();
            });
        });

        it('should handle API error for view calculations gracefully', async () => {
            const hosts = [makeOracleEbsHost(1)];
            mockGetOracleBulkViewCalculations.mockRejectedValue(new Error('Network error'));

            const { container } = renderComponent({}, { selectedRowsForExploreSavingsOracleEbsBulk: hosts });
            await waitFor(() => {
                expect(container.innerHTML).toBe('');
            });
        });
    });

    describe('host selection watcher (useEffect #2)', () => {
        it('should trigger APIs when triggerBulkDataFetch is true and hosts exist', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent(
                {},
                {
                    selectedRowsForExploreSavingsOracleEbsBulk: hosts,
                    triggerBulkDataFetch: true
                }
            );

            await waitFor(() => {
                expect(mockGetOracleBulkStorageSavings).toHaveBeenCalled();
                expect(mockGetOracleInstanceData).toHaveBeenCalled();
            });
        });

        it('should NOT trigger resource details when triggerBulkDataFetch is false', async () => {
            const hosts = [makeOracleEbsHost(1)];
            renderComponent(
                {},
                {
                    selectedRowsForExploreSavingsOracleEbsBulk: hosts,
                    triggerBulkDataFetch: false
                }
            );

            await new Promise(r => setTimeout(r, 50));
            expect(mockGetOracleBulkStorageSavings).not.toHaveBeenCalled();
            expect(mockGetOracleInstanceData).not.toHaveBeenCalled();
        });
    });

    describe('fetchOracleResourceDetails', () => {
        it('should call getOracleInstanceData with ec2 instance IDs', async () => {
            const hosts = [makeOracleEbsHost(1), makeOracleEbsHost(2)];
            renderComponent(
                {},
                {
                    selectedRowsForExploreSavingsOracleEbsBulk: hosts,
                    triggerBulkDataFetch: true
                }
            );

            await waitFor(() => {
                expect(mockGetOracleInstanceData).toHaveBeenCalledWith(
                    expect.objectContaining({
                        credentialId: 'cred-1',
                        regionId: 'us-east-1',
                        instances: 'i-1,i-2'
                    })
                );
            });
        });

        it('should enrich bulk rows with oracleEdition from resource details', async () => {
            const hosts = [makeOracleEbsHost(1)];
            mockGetOracleInstanceData.mockResolvedValue({
                data: {
                    items: [
                        {
                            id: 'i-1',
                            oracleEdition: 'Enterprise',
                            ebsResourceInfo: { volumeCount: 3 },
                            estimatedUsageCost: { monthly: 500 }
                        }
                    ]
                }
            });

            const { store } = renderComponent(
                {},
                {
                    selectedRowsForExploreSavingsOracleEbsBulk: hosts,
                    triggerBulkDataFetch: true
                }
            );

            await waitFor(() => {
                const state = store.getState();
                const bulkRows = state.exploreSavingsBulk.selectedRowsForExploreSavingsOracleEbsBulk;
                expect(bulkRows[0].oracleEdition).toBe('Enterprise');
                expect(bulkRows[0].ebsResourceInfo).toEqual({ volumeCount: 3 });
                expect(bulkRows[0].loading).toBe(false);
            });
        });

        it('should handle resource details API failure gracefully', async () => {
            const hosts = [makeOracleEbsHost(1)];
            mockGetOracleInstanceData.mockRejectedValue(new Error('Failed'));

            const { store } = renderComponent(
                {},
                {
                    selectedRowsForExploreSavingsOracleEbsBulk: hosts,
                    triggerBulkDataFetch: true
                }
            );

            await waitFor(() => {
                const state = store.getState();
                const bulkRows = state.exploreSavingsBulk.selectedRowsForExploreSavingsOracleEbsBulk;
                // Should set loading to false even on error
                expect(bulkRows[0].loading).toBe(false);
            });
        });
    });
});
