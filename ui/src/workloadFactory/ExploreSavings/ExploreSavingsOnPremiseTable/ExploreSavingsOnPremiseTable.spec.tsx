import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import ExploreSavingsOnPremiseTable from './ExploreSavingsOnPremiseTable';
import exploreSavingsSlice from '../../../store/workloadFactory/exploreSavingsSlice';
import exploreSavingsBulkSlice, {
    setSelectedRowsForExploreSavingsOnPremBulk
} from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import notificationSlice from '../../../store/notificationSlice';
import authSlice from '../../../store/authSlice';

// ---- Hoisted stable refs (accessible inside vi.mock) ----
const { mockSelectionState, mockToggleRowSelection } = vi.hoisted(() => ({
    mockSelectionState: { rows: {} as Record<string, boolean>, count: 0 },
    mockToggleRowSelection: vi.fn().mockReturnValue(vi.fn())
}));

// ---- Mocks ----

vi.mock('fflate', () => ({
    compressSync: vi.fn(() => new Uint8Array([1, 2, 3]))
}));

vi.mock('../../../script/SQLServerDataCollector.ps1?raw', () => ({
    default: 'mock script content'
}));

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    DsTypography: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    Popover: ({ children }: any) => <div>{children}</div>,
    DsSpinner: (props: any) => (
        <div data-testid="spinner" {...props}>
            Loading...
        </div>
    ),
    DsButton: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>
            {children}
        </button>
    ),
    useDialog: () => ({ setDialog: vi.fn(), clearDialog: vi.fn() })
}));

vi.mock('@netapp/design-system/dist/components/Table', () => ({
    ColumnProps: {}
}));

vi.mock('../../../common/Lib/Table/Table', () => ({
    Table: ({ tableProps }: any) => (
        <div data-testid="onprem-table">
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

vi.mock('../../../common/Lib/Table/useTable', () => ({
    useTable: (config: any) => ({
        rows: config.rows,
        columns: config.columns,
        selectionState: mockSelectionState,
        toggleRowSelection: mockToggleRowSelection,
        isLoading: config.isLazyLoading
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

vi.mock('../../../common/BulkAction/BulkActionContainer', () => ({
    default: ({ action, onClick }: any) => (
        <div data-testid="bulk-action-container">
            <button data-testid={`wlm-db-${action}`} onClick={onClick}>
                {action}
            </button>
        </div>
    )
}));

vi.mock('../../../common/Dialog/DialogComponent', () => ({
    default: () => <div data-testid="dialog" />
}));

vi.mock('../OracleTCO/AssessmentDialog/AssessmentDialog', () => ({ default: () => <div /> }));
vi.mock('../OracleTCO/TableTooltip/TableTooltip', () => ({ default: () => <div /> }));
vi.mock('../DeleteMenuCell/DeleteMenuCell', () => ({
    default: () => <div data-testid="delete-menu-cell" />
}));

vi.mock('../../../assets/download.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="download-icon" {...props} />
}));

const mockFetchOnPremData = vi.fn();
vi.mock('./useOnPremData', () => ({
    useOnPremData: () => ({
        fetchOnPremData: mockFetchOnPremData,
        error: null
    })
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: () => ({ width: 1024, height: 768 })
}));

vi.mock('../ExploreSavingsUtils', () => ({
    onClickESHostOnPrem: vi.fn(),
    onClickESHostOnPremBulk: vi.fn(),
    handleDeleteOnPremTco: vi.fn()
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatDateWithTime: vi.fn((d: string) => d || ''),
    getFilterOptions: vi.fn(() => []),
    getTruncatedItems: vi.fn((items: any) => ({ maxItemsToShow: items || [], remaining: [] }))
}));

const mockGetUploadScript = vi.fn();
const mockDeleteOnPremTco = vi.fn();
const mockGetJobDetailApi = vi.fn();
vi.mock('../../../utils/apiService', () => ({
    useGetUploadScriptMutation: () => [mockGetUploadScript, { isLoading: false }],
    useDeleteOnPremTcoMutation: () => [mockDeleteOnPremTco, { isLoading: false }],
    useLazyGetSubTaskListQuery: () => [mockGetJobDetailApi, { isLoading: false }]
}));

// ---- Helpers ----

const makeHost = (id: number, name = `host-${id}`) => ({
    id,
    resourceId: `res-${id}`,
    resourceName: name,
    sqlServerInstance: ['instance1'],
    deploymentModel: 'Single',
    creationTime: '2025-01-01',
    onPremNode: 'node1'
});

const setMockSelection = (selectedIds: number[]) => {
    Object.keys(mockSelectionState.rows).forEach(k => delete mockSelectionState.rows[k]);
    selectedIds.forEach(id => {
        mockSelectionState.rows[String(id)] = true;
    });
    mockSelectionState.count = selectedIds.length;
};

const createStore = ({ onPremData = null as any, onPremDataLoading = false, selectedOnPremRows = [] as any[] } = {}) =>
    configureStore({
        reducer: {
            exploreSavings: exploreSavingsSlice.reducer,
            exploreSavingsBulk: exploreSavingsBulkSlice.reducer,
            notifications: notificationSlice.reducer,
            auth: authSlice.reducer
        } as any,
        preloadedState: {
            exploreSavings: {
                onPremiseData: onPremData,
                onPremiseDataLoading: onPremDataLoading
            },
            exploreSavingsBulk: {
                selectedRowsForExploreSavingsEBSBulk: [],
                selectedRowsForExploreSavingsOnPremBulk: selectedOnPremRows,
                selectedRowsForExploreSavingsOracleOnPremBulk: [],
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
                <ExploreSavingsOnPremiseTable />
            </BrowserRouter>
        </Provider>
    );
    return { store, ...utils };
};

// ---- Tests ----

describe('ExploreSavingsOnPremiseTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setMockSelection([]);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('rendering', () => {
        it('should render the table and top bar', () => {
            renderComponent();
            expect(screen.getByTestId('table-topbar')).toBeTruthy();
            expect(screen.getByTestId('onprem-table')).toBeTruthy();
        });

        it('should fetch on-prem data on mount', () => {
            renderComponent();
            expect(mockFetchOnPremData).toHaveBeenCalledTimes(1);
        });

        it('should render rows when data is present', () => {
            const hosts = [makeHost(1), makeHost(2)];
            renderComponent({ onPremData: hosts });
            expect(screen.getByTestId('table-row-1')).toBeTruthy();
            expect(screen.getByTestId('table-row-2')).toBeTruthy();
        });
    });

    describe('selection sync', () => {
        it('should dispatch selected rows to Redux when table selection changes', () => {
            const hosts = [makeHost(1), makeHost(2)];
            setMockSelection([1]);
            const { store } = renderComponent({ onPremData: hosts, selectedOnPremRows: [] });

            const state = store.getState();
            const selected = state.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk;
            expect(selected).toHaveLength(1);
            expect(selected[0].id).toBe(1);
        });

        it('should clear Redux selection when table selection is empty', () => {
            const hosts = [makeHost(1), makeHost(2)];
            setMockSelection([]);
            const { store } = renderComponent({ onPremData: hosts, selectedOnPremRows: [hosts[0]] });

            const state = store.getState();
            expect(state.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk).toHaveLength(0);
        });

        it('should clear stale Redux selection on mount', () => {
            const hosts = [makeHost(1), makeHost(2)];
            setMockSelection([]);
            const { store } = renderComponent({
                onPremData: hosts,
                selectedOnPremRows: [hosts[0], hosts[1]]
            });

            const state = store.getState();
            expect(state.exploreSavingsBulk.selectedRowsForExploreSavingsOnPremBulk).toHaveLength(0);
        });

        it('should not call toggleRowSelection on initial mount even with stale Redux selections', () => {
            const hosts = [makeHost(1), makeHost(2)];
            setMockSelection([]);
            renderComponent({ onPremData: hosts, selectedOnPremRows: [hosts[0]] });

            expect(mockToggleRowSelection).not.toHaveBeenCalled();
        });

        it('should call toggleRowSelection when Redux diverges from table after initial mount', () => {
            const hosts = [makeHost(1), makeHost(2)];
            setMockSelection([]);
            const { store } = renderComponent({ onPremData: hosts });

            mockToggleRowSelection.mockClear();

            act(() => {
                store.dispatch(setSelectedRowsForExploreSavingsOnPremBulk([hosts[0]]));
            });

            expect(mockToggleRowSelection).toHaveBeenCalledWith('1');
        });

        it('should not call toggleRowSelection when Redux and table are already in sync', () => {
            const hosts = [makeHost(1), makeHost(2)];
            setMockSelection([1]);
            const { store } = renderComponent({ onPremData: hosts, selectedOnPremRows: [hosts[0]] });

            mockToggleRowSelection.mockClear();

            act(() => {
                store.dispatch(setSelectedRowsForExploreSavingsOnPremBulk([hosts[0]]));
            });

            expect(mockToggleRowSelection).not.toHaveBeenCalled();
        });
    });
});
