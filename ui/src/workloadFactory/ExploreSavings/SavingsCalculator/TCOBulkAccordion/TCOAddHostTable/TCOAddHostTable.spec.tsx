import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TCOAddHostTable from './TCOAddHostTable';
import exploreSavingsBulkSlice from '../../../../../store/workloadFactory/exploreSavingsBulkSlice';

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

// selectionState marks every row passed to useTable as selected, so tests can simulate a bulk "select all" + add-hosts.
// The real hook keeps selectionState referentially stable across renders unless rows actually change; this mock must
// do the same (memoized by row-id key), otherwise the component's `useEffect([...,tableProps.selectionState])`
// re-fires every render and loops forever.
let lastSelectionStateKey: string | null = null;
let lastSelectionState: any = null;

vi.mock('../../../../../common/Lib/Table/useTable', () => ({
    useTable: (config: any) => {
        const rowIds = (config?.rows || []).map((row: any) => row.id);
        const key = JSON.stringify(rowIds);
        if (key !== lastSelectionStateKey) {
            lastSelectionStateKey = key;
            lastSelectionState = {
                rows: Object.fromEntries(rowIds.map((id: string) => [id, true])),
                count: rowIds.length
            };
        }
        return {
            columnsState: {},
            selectionState: lastSelectionState,
            data: [],
            columns: [],
            getTableProps: () => ({}),
            getTableBodyProps: () => ({}),
            headerGroups: [],
            rows: [],
            prepareRow: vi.fn()
        };
    }
}));

vi.mock('../../../../../common/Lib/Table/TableTopBar', () => ({
    TableTopBar: ({ ...props }: any) => <div data-testid="table-top-bar" {...props} />
}));

// Create mock store
const createMockStore = () => {
    const mockState = {
        exploreSavingsBulk: {
            selectedRowsForExploreSavingsEBSBulk: [],
            rowsRequiringAuthBulk: [],
            triggerBulkDataFetch: false
        },
        headers: {
            headerSelectedMultiCredIdsList: [],
            headerSelectedMultiRegionIdsList: []
        },
        exploreSavings: {
            unmanagedExploreSavingsHost: []
        }
    };

    return configureStore({
        reducer: {
            exploreSavingsBulk: (state = mockState.exploreSavingsBulk) => state,
            headers: (state = mockState.headers) => state,
            exploreSavings: (state = mockState.exploreSavings) => state
        },
        preloadedState: mockState
    });
};

describe('TCOAddHostTable', () => {
    let store: any;

    beforeEach(() => {
        vi.clearAllMocks();
        store = createMockStore();
    });

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders table component', () => {
        render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('handles onExploreSavings callback', () => {
        const onExploreSavings = vi.fn();
        render(
            <Provider store={store}>
                <TCOAddHostTable onExploreSavings={onExploreSavings} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('handles onHandlerReady callback', () => {
        const onHandlerReady = vi.fn();
        render(
            <Provider store={store}>
                <TCOAddHostTable onHandlerReady={onHandlerReady} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty unmanaged host list', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('handles all props together', () => {
        const onExploreSavings = vi.fn();
        const onHandlerReady = vi.fn();

        render(
            <Provider store={store}>
                <TCOAddHostTable onExploreSavings={onExploreSavings} onHandlerReady={onHandlerReady} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('component structure is correct', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(container.querySelector('[data-testid="table-top-bar"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="table"]')).toBeTruthy();
    });

    // GH-11989: bulk "add hosts" must add hosts directly (even ones requiring auth) instead of
    // opening the old auth dialog; the top partial-data banner authenticates only the hosts that need it.
    it('adds a selected host directly without opening an auth dialog, even if it needs authentication', () => {
        const hostNeedingAuth = {
            id: 'h1',
            name: 'Host 1',
            credentialId: 'c1',
            regionId: 'r1',
            hostType: 'Microsoft SQL Server',
            storageType: 'EBS',
            isDetected: false, // would have opened the old AuthBulkDialog pre-fix
            ec2Details: []
        };

        const authStore = configureStore({
            reducer: {
                exploreSavingsBulk: exploreSavingsBulkSlice.reducer,
                headers: (
                    state = {
                        headerSelectedMultiCredIdsList: ['c1'],
                        headerSelectedMultiRegionIdsList: ['r1']
                    }
                ) => state,
                exploreSavings: (state = { unmanagedExploreSavingsHost: [hostNeedingAuth] }) => state
            }
        });

        let exploreSavingsHandler: (() => void) | undefined;
        const onExploreSavings = vi.fn();

        render(
            <Provider store={authStore}>
                <TCOAddHostTable
                    onExploreSavings={onExploreSavings}
                    onHandlerReady={(handler: () => void) => {
                        exploreSavingsHandler = handler;
                    }}
                />
            </Provider>
        );

        act(() => {
            exploreSavingsHandler?.();
        });

        const state = authStore.getState().exploreSavingsBulk;
        expect(state.selectedRowsForExploreSavingsEBSBulk.map((row: any) => row.id)).toEqual(['h1_c1_r1']);
        expect(state.triggerBulkDataFetch).toBe(true);
        expect(onExploreSavings).toHaveBeenCalled();
    });
});
