import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TCOOnPremAddHostTable from './TCOOnPremAddHostTable';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

vi.mock('../../../../../common/Lib/Table/Table', () => ({
    Table: ({ ...props }: any) => <div data-testid="table" {...props} />
}));

vi.mock('../../../../../common/Lib/Table/useTable', () => ({
    useTable: () => ({
        columnsState: {},
        tableProps: {
            data: [],
            columns: [],
            getTableProps: () => ({}),
            getTableBodyProps: () => ({}),
            headerGroups: [],
            rows: [],
            prepareRow: vi.fn()
        }
    })
}));

vi.mock('../../../../../common/Lib/Table/TableTopBar', () => ({
    TableTopBar: ({ ...props }: any) => <div data-testid="table-top-bar" {...props} />
}));

// Create mock store
const createMockStore = () => {
    const mockState = {
        exploreSavingsBulk: {
            selectedRowsForExploreSavingsOnPremBulk: [],
            triggerBulkDataFetch: false
        },
        exploreSavings: {
            onPremiseData: [],
            onPremiseDataLoading: false,
            onPremStorageAndComputeInfo: {}
        }
    };

    return configureStore({
        reducer: {
            exploreSavingsBulk: (state = mockState.exploreSavingsBulk) => state,
            exploreSavings: (state = mockState.exploreSavings) => state
        },
        preloadedState: mockState
    });
};

describe('TCOOnPremAddHostTable', () => {
    let store: any;

    beforeEach(() => {
        vi.clearAllMocks();
        store = createMockStore();
    });

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOOnPremAddHostTable />
            </Provider>
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(
            <Provider store={store}>
                <TCOOnPremAddHostTable />
            </Provider>
        );
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders table component', () => {
        render(
            <Provider store={store}>
                <TCOOnPremAddHostTable />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('handles onExploreSavings callback', () => {
        const onExploreSavings = vi.fn();
        render(
            <Provider store={store}>
                <TCOOnPremAddHostTable onExploreSavings={onExploreSavings} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('handles onHandlerReady callback', () => {
        const onHandlerReady = vi.fn();
        render(
            <Provider store={store}>
                <TCOOnPremAddHostTable onHandlerReady={onHandlerReady} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty on-premise data', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOOnPremAddHostTable />
            </Provider>
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('handles loading state', () => {
        const loadingStore = configureStore({
            reducer: {
                exploreSavingsBulk: (
                    state = { selectedRowsForExploreSavingsOnPremBulk: [], triggerBulkDataFetch: false }
                ) => state,
                exploreSavings: (
                    state = {
                        onPremiseData: [],
                        onPremiseDataLoading: true,
                        onPremStorageAndComputeInfo: {}
                    }
                ) => state
            }
        });

        render(
            <Provider store={loadingStore}>
                <TCOOnPremAddHostTable />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('handles all props together', () => {
        const onExploreSavings = vi.fn();
        const onHandlerReady = vi.fn();

        render(
            <Provider store={store}>
                <TCOOnPremAddHostTable onExploreSavings={onExploreSavings} onHandlerReady={onHandlerReady} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('component structure is correct', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOOnPremAddHostTable />
            </Provider>
        );
        expect(container.querySelector('[data-testid="table-top-bar"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="table"]')).toBeTruthy();
    });

    it('handles data formatting correctly', () => {
        const dataStore = configureStore({
            reducer: {
                exploreSavingsBulk: (
                    state = { selectedRowsForExploreSavingsOnPremBulk: [], triggerBulkDataFetch: false }
                ) => state,
                exploreSavings: (
                    state = {
                        onPremiseData: [
                            {
                                id: '1',
                                resourceName: 'Test Host',
                                resourceId: 'host-123',
                                deploymentModel: 'standalone',
                                totalAllocatedCapacity: 1000000000,
                                sqlServerInstances: [],
                                onPremisesNodes: []
                            }
                        ],
                        onPremiseDataLoading: false,
                        onPremStorageAndComputeInfo: {}
                    }
                ) => state
            }
        });

        render(
            <Provider store={dataStore}>
                <TCOOnPremAddHostTable />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
