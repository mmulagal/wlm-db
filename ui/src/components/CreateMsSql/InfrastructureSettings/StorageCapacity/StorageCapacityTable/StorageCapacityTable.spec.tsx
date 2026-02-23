import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import StorageCapacityTable from './StorageCapacityTable';

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual('@netapp/design-system');
    return {
        ...actual,
        useTable: vi.fn(() => ({
            selectionState: {},
            rows: []
        })),
        Table: ({ tableProps }: any) => <div data-testid="storage-table">Table</div>,
        FlashingDotsLoader: () => <div data-testid="loading">Loading...</div>
    };
});

vi.mock('../../../../../utils/utilityFunctions', () => ({
    formatFractionalNumber: vi.fn((val: number, decimals: number) => val?.toFixed(decimals) ?? '0'),
    isFsxnNew: vi.fn((type: string) => type === 'new')
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssql: () => ({
                getEstimatedCostData: overrides.getEstimatedCostData ?? null,
                getEstimatedCostLoading: overrides.loading ?? false
            }),
            mssqlForm: () => ({
                storageCapacity: {
                    unit: overrides.unit ?? { value: 'GiB', label: 'GiB' }
                },
                fsxN: {
                    fsxNType: overrides.fsxNType ?? 'new'
                },
                dbDeploymentModel: overrides.dbDeploymentModel ?? {
                    value: 'failover',
                    label: 'Failover cluster instance'
                }
            })
        }
    });

describe('StorageCapacityTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <StorageCapacityTable />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders table when not loading', () => {
        const store = makeStore({ loading: false });
        render(
            <Provider store={store}>
                <StorageCapacityTable />
            </Provider>
        );
        expect(screen.getByTestId('storage-table')).toBeTruthy();
    });

    it('renders loading indicator when loading', () => {
        const store = makeStore({ loading: true });
        render(
            <Provider store={store}>
                <StorageCapacityTable />
            </Provider>
        );
        expect(screen.getByTestId('loading')).toBeTruthy();
    });

    it('renders with estimated cost data', () => {
        const store = makeStore({
            getEstimatedCostData: {
                data: {
                    fsxnStorage: {
                        fsxnCostBreakdownById: [
                            {
                                size: {
                                    data: 500,
                                    log: 125,
                                    tempdb: 50,
                                    quorum: 10,
                                    buffer: 237,
                                    total: 922
                                }
                            }
                        ]
                    }
                }
            }
        });
        render(
            <Provider store={store}>
                <StorageCapacityTable />
            </Provider>
        );
        expect(screen.getByTestId('storage-table')).toBeTruthy();
    });

    it('renders with TiB unit', () => {
        const store = makeStore({ unit: { value: 'TiB', label: 'TiB' } });
        render(
            <Provider store={store}>
                <StorageCapacityTable />
            </Provider>
        );
        expect(screen.getByTestId('storage-table')).toBeTruthy();
    });

    it('renders for pgsql wizard type', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <StorageCapacityTable wizardType="pgsql" />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders for mssql wizard type explicitly', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <StorageCapacityTable wizardType="mssql" />
            </Provider>
        );
        expect(container).toBeDefined();
    });
});
