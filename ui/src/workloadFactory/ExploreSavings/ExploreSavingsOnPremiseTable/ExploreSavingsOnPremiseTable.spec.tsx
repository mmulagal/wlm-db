import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import exploreSavingsSlice from '../../../store/workloadFactory/exploreSavingsSlice';
import exploreSavingsBulkSlice from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import notificationSlice from '../../../store/notificationSlice';
import authSlice from '../../../store/authSlice';

// Mock fflate
vi.mock('fflate', () => ({
    compressSync: vi.fn(data => new Uint8Array([1, 2, 3, 4, 5])) // Simple mock compressed data
}));

// Mock the script import
vi.mock('../../../script/SQLServerDataCollector.ps1?raw', () => ({
    default: 'mock script content'
}));

// Mock FileUpload component
vi.mock('./FileUpload', () => ({
    default: ({ handleFileChange }: any) => (
        <div>
            <input type="file" id="file-input" accept=".json" onChange={handleFileChange} data-testid="file-upload" />
        </div>
    )
}));

// Mock @netapp/design-system
vi.mock('@netapp/design-system', () => ({
    Table: ({ children, ...props }: any) => (
        <div data-testid="table" {...props}>
            {children}
        </div>
    ),
    useTable: () => ({
        selectedRows: [],
        setSelectedRows: vi.fn(),
        clearSelection: vi.fn(),
        selectAll: vi.fn(),
        isSelectAllChecked: false,
        isIndeterminate: false,
        handleSelectAllChange: vi.fn(),
        handleRowSelect: vi.fn()
    }),
    useDialog: () => ({
        setDialog: vi.fn(),
        clearDialog: vi.fn()
    }),
    DsButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    SearchInput: ({ ...props }: any) => <input type="search" {...props} />,
    Typography: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    TableTopBar: ({ children, actionsRight, ...props }: any) => (
        <div data-testid="table-topbar" {...props}>
            {children}
            {actionsRight}
        </div>
    ),
    DsTypography: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    Popover: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DsSpinner: (props: any) => (
        <div data-testid="spinner" {...props}>
            Loading...
        </div>
    ),
    TooltipInfo: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

// Mock SVG imports
vi.mock('../../../assets/download.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="download-icon" {...props} />
}));

// Mock API services
const mockGetUploadScript = vi.fn();
const mockDeleteOnPremTco = vi.fn();
const mockGetJobDetailApi = vi.fn();
const mockFetchOnPremData = vi.fn();

// Create a mock API slice without retry logic
const mockApiSlice = {
    reducer: (state = {}, action: any) => state,
    reducerPath: 'exploreSavingsApi',
    middleware: (store: any) => (next: any) => (action: any) => next(action)
};

vi.mock('../../../utils/apiService', () => ({
    useGetUploadScriptMutation: () => [mockGetUploadScript, { isLoading: false }],
    useDeleteOnPremTcoMutation: () => [mockDeleteOnPremTco, { isLoading: false }],
    useLazyGetSubTaskListQuery: () => [mockGetJobDetailApi, { isLoading: false }],
    exploreSavingsApi: {
        reducer: (state = {}, action: any) => state,
        reducerPath: 'exploreSavingsApi',
        middleware: (store: any) => (next: any) => (action: any) => next(action)
    }
}));

// Mock custom hooks
vi.mock('./useOnPremData', () => ({
    useOnPremData: () => ({
        fetchOnPremData: mockFetchOnPremData,
        error: null,
        onPremiseData: null
    })
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: () => ({ width: 1024, height: 768 })
}));

vi.mock('../ExploreSavingsUtils', () => ({
    onClickESHostOnPrem: vi.fn()
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatDateWithTime: vi.fn(date => (date ? '2024-01-01 12:00:00' : '')),
    getFilterOptions: vi.fn(() => []),
    getTruncatedItems: vi.fn(items => items)
}));

describe('ExploreSavingsOnPremiseTable', () => {
    let store: any;

    const createMockStore = (overrides = {}) =>
        configureStore({
            reducer: {
                exploreSavings: exploreSavingsSlice.reducer,
                exploreSavingsBulk: exploreSavingsBulkSlice.reducer,
                notifications: notificationSlice.reducer,
                auth: authSlice.reducer,
                exploreSavingsApi: (state = {}) => state
            } as any,
            preloadedState: {
                exploreSavings: {
                    onPremiseData: null,
                    onPremiseDataLoading: false,
                    ...overrides
                },
                exploreSavingsBulk: {
                    selectedRowsForExploreSavingsOnPremBulk: [],
                    selectedRowsForExploreSavingsEBSBulk: [],
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
            middleware: getDefaultMiddleware =>
                getDefaultMiddleware({
                    serializableCheck: false,
                    immutableCheck: false
                })
        });

    beforeEach(() => {
        vi.clearAllMocks();
        store = createMockStore();

        // Mock FileReader with immediate callback
        global.FileReader = class MockFileReader {
            onload: any = null;

            onerror: any = null;

            result: any = null;

            readAsText() {
                // Use queueMicrotask for immediate async execution
                queueMicrotask(() => {
                    this.result = JSON.stringify({ test: 'data' });
                    if (this.onload) {
                        this.onload({ target: { result: this.result } });
                    }
                });
            }
        } as any;
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it('should have a placeholder test', () => {
        expect(true).toBe(true);
    });
});
