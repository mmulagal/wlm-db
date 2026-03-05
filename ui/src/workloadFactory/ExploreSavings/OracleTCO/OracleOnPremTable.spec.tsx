import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import OracleOnPremTable from './OracleOnPremTable';
import exploreSavingsSlice from '../../../store/workloadFactory/exploreSavingsSlice';
import exploreSavingsBulkSlice from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import notificationSlice from '../../../store/notificationSlice';
import authSlice from '../../../store/authSlice';

// ---- Hoisted stable refs (accessible inside vi.mock) ----
const { mockSelectionState, mockToggleRowSelection } = vi.hoisted(() => ({
    mockSelectionState: { rows: {} as Record<string, boolean>, count: 0 },
    mockToggleRowSelection: vi.fn().mockReturnValue(vi.fn())
}));

// ---- Mocks ----

vi.mock('fflate', () => ({
    compressSync: vi.fn(() => new Uint8Array([1, 2, 3])),
    zipSync: vi.fn(() => new Uint8Array([1, 2, 3])),
    strToU8: vi.fn((s: string) => new TextEncoder().encode(s))
}));

// Mock raw file imports
vi.mock('./DownloadContent/README 4.MD?raw', () => ({ default: '' }));
vi.mock('./DownloadContent/OracleDataCollectorStatspack 3.sql?raw', () => ({ default: '' }));
vi.mock('./DownloadContent/OracleDataCollectorPermissions 1.json?raw', () => ({ default: '' }));
vi.mock('./DownloadContent/OracleDataCollectorController 3.sql?raw', () => ({ default: '' }));
vi.mock('./DownloadContent/_no_action 3.sql?raw', () => ({ default: '' }));
vi.mock('./DownloadContent/OracleDataCollector 4.py?raw', () => ({ default: '' }));
vi.mock('./DownloadContent/OracleDataCollectorAWR 3.sql?raw', () => ({ default: '' }));

// Mock design system
vi.mock('@netapp/design-system/dist/components/Dialog', () => ({
    useDialog: () => ({ setDialog: vi.fn(), clearDialog: vi.fn() })
}));

vi.mock('@netapp/design-system/dist/components/Popover', () => ({
    Popover: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>
            {children}
        </button>
    ),
    DsTypography: ({ children, ...props }: any) => <span {...props}>{children}</span>
}));

// Mock Table components — render rows so we can inspect disabled / tooltip state
vi.mock('../../../common/Lib/Table/Table', () => ({
    Table: ({ tableProps }: any) => (
        <div data-testid="oracle-table">
            {tableProps?.rows?.map((row: any, idx: number) => (
                <div
                    key={row.id ?? idx}
                    data-testid={`table-row-${row.id}`}
                    data-disabled={row.cellProps?.isDisabled ?? false}
                    data-tooltip={row.cellProps?.selectionProps?.title ?? ''}
                />
            ))}
        </div>
    )
}));

// Return a STABLE selectionState reference so the selection-sync useEffect
// does not re-trigger on every render (which would cause an infinite loop).
vi.mock('../../../common/Lib/Table/useTable', () => ({
    useTable: (config: any) => ({
        rows: config.rows,
        columns: config.columns,
        selectionState: mockSelectionState,
        toggleRowSelection: mockToggleRowSelection,
        isLoading: config.isLoading
    })
}));

vi.mock('../../../common/Lib/Table/TableTopBar', () => ({
    TableTopBar: ({ children, actionsRight }: any) => (
        <div data-testid="table-topbar">
            {children}
            {actionsRight}
        </div>
    )
}));

vi.mock('../../../common/Dialog/DialogComponent', () => ({
    default: () => <div data-testid="dialog" />
}));

vi.mock('../../../common/BulkAction/BulkActionContainer', () => ({
    default: ({ action, onClick }: any) => (
        <div data-testid="bulk-action-container">
            <button data-testid={`wlm-db-${action}`} onClick={onClick}>
                {action}
            </button>
        </div>
    )
}));

vi.mock('./AssessmentDialog/AssessmentDialog', () => ({ default: () => <div /> }));
vi.mock('./TableTooltip/TableTooltip', () => ({ default: () => <div /> }));

const mockFetchOracleOnPremData = vi.fn();
vi.mock('../ExploreSavingsOnPremiseTable/useOnPremData', () => ({
    useOnPremData: () => ({
        fetchOracleOnPremData: mockFetchOracleOnPremData
    })
}));

const mockOnClickSingle = vi.fn();
const mockOnClickBulk = vi.fn();
vi.mock('../ExploreSavingsUtils', () => ({
    onClickESHostOracleOnPrem: (...args: any[]) => mockOnClickSingle(...args),
    onClickESHostOracleOnPremBulk: (...args: any[]) => mockOnClickBulk(...args)
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatDateWithTime: vi.fn((d: string) => d || ''),
    getTruncatedItems: vi.fn((items: any) => ({ maxItemsToShow: items || [], remaining: [] }))
}));

const mockGetUploadScript = vi.fn();
const mockGetJobDetailApi = vi.fn();
const mockGetDownloadScript = vi.fn();
vi.mock('../../../utils/apiService', () => ({
    useGetUploadScriptMutation: () => [mockGetUploadScript, { isLoading: false }],
    useLazyGetSubTaskListQuery: () => [mockGetJobDetailApi, { isLoading: false }],
    useGetOracleOnPremTCODownloadScriptMutation: () => [mockGetDownloadScript, { isLoading: false }]
}));

// ---- Helpers ----

const makeHost = (id: number, name = `host-${id}`) => ({
    id,
    resourceId: `res-${id}`,
    resourceName: name,
    databaseNameList: ['db1'],
    deploymentModel: 'Single',
    onPremisesNodes: ['node1'],
    creationTime: '2025-01-01',
    oracleDatabases: []
});

/**
 * Set the mock useTable selectionState to match a list of selected host ids.
 * Must be called BEFORE render so the selection-sync useEffect sees matching data.
 */
const setMockSelection = (selectedIds: number[]) => {
    // Mutate the stable ref so the same object identity is kept across renders
    Object.keys(mockSelectionState.rows).forEach(k => delete mockSelectionState.rows[k]);
    selectedIds.forEach(id => {
        mockSelectionState.rows[String(id)] = true;
    });
    mockSelectionState.count = selectedIds.length;
};

const createStore = ({ oracleData = null as any, oracleDataLoading = false, selectedOracleRows = [] as any[] } = {}) =>
    configureStore({
        reducer: {
            exploreSavings: exploreSavingsSlice.reducer,
            exploreSavingsBulk: exploreSavingsBulkSlice.reducer,
            notifications: notificationSlice.reducer,
            auth: authSlice.reducer
        } as any,
        preloadedState: {
            exploreSavings: {
                onPremiseOracleData: oracleData,
                onPremiseOracleDataLoading: oracleDataLoading
            },
            exploreSavingsBulk: {
                selectedRowsForExploreSavingsEBSBulk: [],
                selectedRowsForExploreSavingsOnPremBulk: [],
                selectedRowsForExploreSavingsOracleOnPremBulk: selectedOracleRows,
                ebsTCOAction: '',
                bulkAuthCredentials: {},
                rowsRequiringAuthBulk: [],
                bulkAuthStatus: {},
                triggerBulkDataFetch: false
            },
            auth: {
                isDemoMode: false,
                isWorkloadFactory: true
            },
            notifications: {
                messages: [],
                showDetailedView: false
            }
        } as any,
        middleware: getDefaultMiddleware => getDefaultMiddleware({ serializableCheck: false, immutableCheck: false })
    });

const renderComponent = (storeOverrides = {}) => {
    const store = createStore(storeOverrides);
    const utils = render(
        <Provider store={store}>
            <BrowserRouter>
                <OracleOnPremTable />
            </BrowserRouter>
        </Provider>
    );
    return { store, ...utils };
};

// ---- Tests ----

describe('OracleOnPremTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setMockSelection([]);
    });

    describe('rendering', () => {
        it('should render the table and top bar', () => {
            renderComponent();
            expect(screen.getByTestId('table-topbar')).toBeTruthy();
            expect(screen.getByTestId('oracle-table')).toBeTruthy();
        });

        it('should fetch oracle on-prem data on mount', () => {
            renderComponent();
            expect(mockFetchOracleOnPremData).toHaveBeenCalledTimes(1);
        });

        it('should render rows when data is present', () => {
            const hosts = [makeHost(1), makeHost(2), makeHost(3)];
            renderComponent({ oracleData: hosts });
            expect(screen.getByTestId('table-row-1')).toBeTruthy();
            expect(screen.getByTestId('table-row-2')).toBeTruthy();
            expect(screen.getByTestId('table-row-3')).toBeTruthy();
        });

        it('should render no rows when data is empty', () => {
            renderComponent({ oracleData: [] });
            expect(screen.queryByTestId('table-row-1')).toBeNull();
        });
    });

    describe('5-host selection limit', () => {
        it('should not disable any rows when fewer than 5 are selected', () => {
            const hosts = Array.from({ length: 6 }, (_, i) => makeHost(i + 1));
            const selected = hosts.slice(0, 3);
            setMockSelection(selected.map(h => h.id));
            renderComponent({ oracleData: hosts, selectedOracleRows: selected });

            hosts.forEach(host => {
                const row = screen.getByTestId(`table-row-${host.id}`);
                expect(row.getAttribute('data-disabled')).toBe('false');
            });
        });

        it('should disable unselected rows when 5 hosts are selected', () => {
            const hosts = Array.from({ length: 7 }, (_, i) => makeHost(i + 1));
            const selected = hosts.slice(0, 5);
            setMockSelection(selected.map(h => h.id));
            renderComponent({ oracleData: hosts, selectedOracleRows: selected });

            // Selected rows are not disabled
            selected.forEach(host => {
                const row = screen.getByTestId(`table-row-${host.id}`);
                expect(row.getAttribute('data-disabled')).toBe('false');
            });

            // Unselected rows are disabled
            [6, 7].forEach(id => {
                const row = screen.getByTestId(`table-row-${id}`);
                expect(row.getAttribute('data-disabled')).toBe('true');
            });
        });

        it('should set limit-exceeded tooltip on disabled rows', () => {
            const hosts = Array.from({ length: 6 }, (_, i) => makeHost(i + 1));
            const selected = hosts.slice(0, 5);
            setMockSelection(selected.map(h => h.id));
            renderComponent({ oracleData: hosts, selectedOracleRows: selected });

            const disabledRow = screen.getByTestId('table-row-6');
            expect(disabledRow.getAttribute('data-tooltip')).toBe(
                'databases.explore-savings.disabled-tooltip-limit-exceed'
            );

            const selectedRow = screen.getByTestId('table-row-1');
            expect(selectedRow.getAttribute('data-tooltip')).toBe('');
        });
    });

    describe('bulk action CTA', () => {
        it('should not show bulk action container when no rows are selected', () => {
            const hosts = [makeHost(1), makeHost(2)];
            renderComponent({ oracleData: hosts, selectedOracleRows: [] });
            expect(screen.queryByTestId('bulk-action-container')).toBeNull();
        });

        it('should show bulk action container when rows are selected', () => {
            const hosts = [makeHost(1), makeHost(2)];
            const selected = [hosts[0]];
            setMockSelection(selected.map(h => h.id));
            renderComponent({ oracleData: hosts, selectedOracleRows: selected });
            expect(screen.getByTestId('bulk-action-container')).toBeTruthy();
        });

        it('should call onClickESHostOracleOnPremBulk when bulk action is clicked', () => {
            const hosts = [makeHost(1), makeHost(2)];
            const selected = [hosts[0], hosts[1]];
            setMockSelection(selected.map(h => h.id));
            renderComponent({ oracleData: hosts, selectedOracleRows: selected });

            const bulkButton = screen.getByTestId('wlm-db-databases.explore-savings.explore-savings-title');
            fireEvent.click(bulkButton);

            expect(mockOnClickBulk).toHaveBeenCalledTimes(1);
            expect(mockOnClickBulk).toHaveBeenCalledWith(
                expect.any(Function), // dispatch
                expect.arrayContaining([expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })]),
                true, // isWorkloadFactory
                expect.any(Function) // navigate
            );
        });

        it('should not call bulk action when no rows are selected', () => {
            const hosts = [makeHost(1)];
            renderComponent({ oracleData: hosts, selectedOracleRows: [] });
            expect(screen.queryByTestId('bulk-action-container')).toBeNull();
            expect(mockOnClickBulk).not.toHaveBeenCalled();
        });
    });

    describe('selection sync', () => {
        it('should dispatch selected rows to Redux when table selection changes', () => {
            const hosts = [makeHost(1), makeHost(2)];
            setMockSelection([1]);
            const { store } = renderComponent({ oracleData: hosts, selectedOracleRows: [] });

            // The selection-sync useEffect should have dispatched the matching row
            const state = store.getState();
            const oracleSelected = state.exploreSavingsBulk.selectedRowsForExploreSavingsOracleOnPremBulk;
            expect(oracleSelected).toHaveLength(1);
            expect(oracleSelected[0].id).toBe(1);
        });

        it('should clear Redux selection when table selection is empty', () => {
            const hosts = [makeHost(1), makeHost(2)];
            setMockSelection([]);
            const { store } = renderComponent({ oracleData: hosts, selectedOracleRows: [hosts[0]] });

            const state = store.getState();
            expect(state.exploreSavingsBulk.selectedRowsForExploreSavingsOracleOnPremBulk).toHaveLength(0);
        });
    });
});
