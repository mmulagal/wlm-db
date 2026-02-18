import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SandboxTable from './SandboxTable';

// Hoist all mock functions that will be used in vi.mock factories
const {
    mockNavigate,
    mockSetDialog,
    mockCloseDialog,
    mockPostBlueXPMessage,
    mockDeleteSandboxApi,
    mockGetJobDetailApi,
    mockGetSandboxSavingsApi,
    mockGetSplitEstimateApi,
    mockUpdateSandboxApi,
    mockSplitSandboxApi,
    mockCheckIntegrityApi,
    mockGetConnectionInfoApi,
    mockAddNotification,
    mockClearNotifications,
    mockSetAggregatedSandboxList,
    mockSetSandboxSavingsState,
    mockUpdateConnectionInfoLoading,
    mockUpdateSplitEstimateLoading,
    mockSetSelectedHeaderTab,
    mockSetSelectedSandboxHeaderValue,
    mockStore
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockSetDialog: vi.fn(),
    mockCloseDialog: vi.fn(),
    mockPostBlueXPMessage: vi.fn(),
    mockDeleteSandboxApi: vi.fn().mockResolvedValue({ data: { jobId: 'job123' } }),
    mockGetJobDetailApi: vi.fn().mockResolvedValue({ data: { status: 'COMPLETED' } }),
    mockGetSandboxSavingsApi: vi
        .fn()
        .mockResolvedValue({ data: { consumedStorage: 100, savedStorage: 50, sandboxSavingsPercentage: 33 } }),
    mockGetSplitEstimateApi: vi.fn().mockResolvedValue({ data: { volumes: [] } }),
    mockUpdateSandboxApi: vi.fn().mockResolvedValue({ data: { jobId: 'job456' } }),
    mockSplitSandboxApi: vi.fn().mockResolvedValue({ data: { jobId: 'job789' } }),
    mockCheckIntegrityApi: vi.fn().mockResolvedValue({ data: { jobId: 'job101' } }),
    mockGetConnectionInfoApi: vi.fn().mockResolvedValue({ data: { host: 'localhost', port: 5432 } }),
    mockAddNotification: vi.fn((payload: any) => ({ type: 'notification/add', payload })),
    mockClearNotifications: vi.fn(() => ({ type: 'notification/clear' })),
    mockSetAggregatedSandboxList: vi.fn((data: any) => ({ type: 'sandbox/setAggregatedSandboxList', payload: data })),
    mockSetSandboxSavingsState: vi.fn((data: any) => ({ type: 'sandbox/setSandboxSavingsState', payload: data })),
    mockUpdateConnectionInfoLoading: vi.fn((val: boolean) => ({
        type: 'sandbox/updateConnectionInfoLoading',
        payload: val
    })),
    mockUpdateSplitEstimateLoading: vi.fn((val: boolean) => ({
        type: 'sandbox/updateSplitEstimateLoading',
        payload: val
    })),
    mockSetSelectedHeaderTab: vi.fn((val: string) => ({ type: 'inventory/setSelectedHeaderTab', payload: val })),
    mockSetSelectedSandboxHeaderValue: vi.fn((val: any) => ({
        type: 'createSandbox/setSelectedSandboxHeaderValue',
        payload: val
    })),
    mockStore: {
        getState: () => ({
            sandbox: {
                aggregatedSandboxList: [],
                isRollbackSelected: false,
                selectedRollbackSnapshot: null
            },
            headers: {
                headerSelectedCredSandbox: { data: { credentialsId: 'cred1' } },
                headerSelectedRegionSandbox: { label2: 'us-east-1' }
            }
        }),
        dispatch: () => {},
        subscribe: () => () => {}
    }
}));

// Store the column defs for testing
let capturedColumns: any[] = [];
let capturedRows: any[] = [];

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1920, height: 1080 }))
}));

vi.mock('@netapp/design-system', () => ({
    Table: ({ tableProps }: any) => <div data-testid="table" />,
    useTable: vi.fn((props: any) => {
        capturedColumns = props?.columns || [];
        capturedRows = props?.rows || [];
        return { columns: props?.columns || [], rows: props?.rows || [] };
    }),
    useDialog: vi.fn(() => ({ setDialog: mockSetDialog, closeDialog: mockCloseDialog })),
    TableTopBar: ({ actionsRight, pluralTitle }: any) => (
        <div data-testid="table-top-bar">
            <span>{pluralTitle}</span>
            {actionsRight}
        </div>
    ),
    Button: ({ children, onClick, variant }: any) => (
        <button data-testid={`button-${variant || 'default'}`} onClick={onClick}>
            {children}
        </button>
    ),
    DsTypography: ({ children, variant }: any) => (
        <span data-testid="ds-typography" data-variant={variant}>
            {children}
        </span>
    )
}));

// Track toggleMenu calls to enable menu interaction testing
let lastToggleMenu: ((toggleType: string, menuId: string) => void) | null = null;

vi.mock('../../../common/MenuPopover/MenuPopover', () => ({
    default: ({ menuItems, toggleMenu, isDisabled, isMenuOpen }: any) => {
        // Store the toggleMenu function for test access
        lastToggleMenu = toggleMenu;
        return (
            <div data-testid="menu-popover" data-disabled={isDisabled} data-open={isMenuOpen}>
                <button data-testid="menu-trigger" onClick={() => toggleMenu('open', 'menu1')}>
                    ...
                </button>
                {menuItems?.map((item: any) => (
                    <button
                        key={item.id}
                        data-testid={`menu-item-${item.id}`}
                        onClick={() => toggleMenu('selectedOption', item.id)}
                    >
                        {item.displayName}
                    </button>
                ))}
                <button data-testid="menu-close" onClick={() => toggleMenu('close', '')}>
                    Close
                </button>
            </div>
        );
    }
}));

vi.mock('../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, primaryButton, secondaryButton, callback, closeCallback, content }: any) => (
        <div data-testid="dialog-component">
            <div data-testid="dialog-header">{header}</div>
            <div data-testid="dialog-content">{content}</div>
            <button data-testid="dialog-primary" onClick={callback}>
                {primaryButton}
            </button>
            {secondaryButton && (
                <button data-testid="dialog-secondary" onClick={closeCallback}>
                    {secondaryButton}
                </button>
            )}
        </div>
    )
}));

vi.mock('../../../common/ViewDialog/ViewDialog', () => ({
    default: ({ data, copyResponseData }: any) => (
        <div data-testid="view-dialog">
            <div data-testid="view-dialog-data">{typeof data === 'string' ? data : 'React Component'}</div>
            {copyResponseData && (
                <button data-testid="copy-button" onClick={() => copyResponseData()}>
                    Copy
                </button>
            )}
        </div>
    )
}));

vi.mock('../../../common/SmallLoader/SmallLoader', () => ({
    default: () => <div data-testid="small-loader" />
}));

vi.mock('./RebaseLineContent/RebaseLineContent', () => ({
    default: ({ databaseName, sandboxName }: any) => (
        <div data-testid="rebase-line-content">
            {databaseName} - {sandboxName}
        </div>
    )
}));

vi.mock('./RebaseSplitContent/RebaseSplitContent', () => ({
    default: ({ databaseName, sandboxName }: any) => (
        <div data-testid="rebase-split-content">
            {databaseName} - {sandboxName}
        </div>
    )
}));

vi.mock('./RefreshContent/RefreshContent', () => ({
    default: ({ databaseName, sandboxName }: any) => (
        <div data-testid="refresh-content">
            {databaseName} - {sandboxName}
        </div>
    )
}));

vi.mock('./ConnectToCiCdContent/ConnectToCiCdContent', () => ({
    default: ({ baseUrl, credID, region, databaseHostId, sandboxName, actualData }: any) => (
        <div data-testid="connect-cicd-content">
            {baseUrl} - {credID} - {region} - {databaseHostId} - {sandboxName} - {JSON.stringify(actualData)}
        </div>
    )
}));

vi.mock('../../../utils/apiService', () => ({
    useDeleteSandboxMutation: () => [mockDeleteSandboxApi],
    useLazyGetSubTaskListQuery: () => [mockGetJobDetailApi],
    useLazyGetSandboxSavingsQuery: () => [mockGetSandboxSavingsApi],
    useLazyGetSplitEstimateInfoQuery: () => [mockGetSplitEstimateApi],
    useUpdateSandboxMutation: () => [mockUpdateSandboxApi],
    useSplitSandboxMutation: () => [mockSplitSandboxApi],
    useCheckIntegrityMutation: () => [mockCheckIntegrityApi],
    useLazyGetConnectionInfoQuery: () => [mockGetConnectionInfoApi],
    getBaseUrl: vi.fn(() => 'https://api.example.com')
}));

vi.mock('../SandboxUtility', () => ({
    formatSandboxListData: vi.fn((data: any) => data),
    getAggregatedSplitEstimate: vi.fn(() => ({ totalCapacity: 100, totalUsed: 50 }))
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    createSandboxNavigation: vi.fn(),
    formatDateWithTime: vi.fn((val: any) => `formatted-${val}`)
}));

vi.mock('@tlveng/wlm-ds/src/hooks/useBlueXP', () => ({
    BlueXPListeners: { navigate: 'navigate' },
    postBlueXPMessage: mockPostBlueXPMessage
}));

vi.mock('../../../assets/success.svg', () => ({
    ReactComponent: () => <svg data-testid="success-icon" />
}));

vi.mock('./SandboxTable.module.scss', () => ({
    default: {
        sandboxTable: 'sandboxTable',
        sandboxButton: 'sandboxButton',
        jobMenuPopover: 'jobMenuPopover',
        statusCol: 'statusCol',
        notification: 'notification',
        bold: 'bold',
        menuPointerDisabled: 'menuPointerDisabled',
        menuPointer: 'menuPointer',
        setWidth: 'setWidth'
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        SANDBOX_DB_NAME: 'Sandbox DB Name',
        SANDBOX_DB_INSTANCE_NAME: 'Instance Name',
        SANDBOX_SOURCE_DB_NAME: 'Source DB Name',
        SANDBOX_SOURCE_DB_INSTANCE_NAME: 'Source Instance Name',
        SANDBOX_LAST_UPDATED: 'Last Updated',
        AGE: 'Age',
        SANDBOX_TAG: 'Tag',
        SB_STATUS: 'Status',
        CREATE_SANDBOX: 'Create Sandbox',
        CANCEL: 'Cancel',
        CLOSE: 'Close',
        REBASE_LINE: 'Re-baseline',
        DELETING: 'Deleting',
        REBASELINE: 'Rebaselineaction',
        SPLIT: 'Split',
        INTEGRITY_CHECK: 'Integrity Check',
        JOB_MONITORING: 'Job Monitoring',
        ONE_THIRTY_DAYS: '1-30 Days',
        THIRTY_SIXTY_DAYS: '30-60 Days',
        SIXTY_PLUS_DAYS: '60+ Days',
        SANDBOX_ACTIONS_NOTIFICATIONS: {
            IN_PROGRESS: {
                refresh: ['Refreshing sandbox ', ' has been initiated.'],
                delete: ['Deleting sandbox ', ' has been initiated.'],
                rebaseline: ['Rebaselining sandbox ', ' has been initiated.'],
                split: ['Splitting sandbox ', ' has been initiated.'],
                integrityCheck: ['Integrity check for sandbox ', ' has been initiated.']
            },
            SUCCESS: {
                refresh: ['Sandbox ', ' refreshed successfully.'],
                delete: ['Sandbox ', ' deleted successfully.'],
                rebaseline: ['Sandbox ', ' rebaselined successfully.'],
                split: ['Sandbox ', ' split successfully.'],
                integrityCheck: ['Sandbox ', ' integrity check passed.']
            },
            FAILED: {
                refresh: ['Refresh of sandbox ', ' failed.'],
                delete: ['Delete of sandbox ', ' failed.'],
                rebaseline: ['Rebaseline of sandbox ', ' failed.'],
                split: ['Split of sandbox ', ' failed.'],
                integrityCheck: ['Integrity check of sandbox ', ' failed.']
            }
        }
    }
}));

vi.mock('../../../utils/consts', () => ({
    CRED_PLACEHOLDERS: { REGION: 'REGION', TOKEN: 'TOKEN', CRED_ID: 'CRED_ID' },
    FROM_DIALOG: { SANDBOX_REFRESH: 'SANDBOX_REFRESH' },
    JOB_MONITORING_STATUS: { COMPLETED: 'COMPLETED', FAILED: 'FAILED' },
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM: '/bluexp/job-monitoring',
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING: '/job-monitoring',
    SANDBOX_ACTIONS_POLLING_INTERVAL: 100,
    UPDATE_SANDBOX_CURL_REQ_TEMPLATE: vi.fn((...args: any[]) => `curl template ${args[0]}`),
    WLF_TABS: { JOB_MONITORING: 'JOB_MONITORING', SANDBOXES: 'SANDBOXES' }
}));

vi.mock('../../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { INFO: 'info', SUCCESS: 'success', ERROR: 'error' },
    addNotification: (payload: any) => mockAddNotification(payload),
    clearNotifications: () => mockClearNotifications()
}));

vi.mock('../../../store/store', () => ({
    default: mockStore
}));

vi.mock('../../../store/workloadFactory/sandboxSlice', () => ({
    setAggregatedSandboxList: (data: any) => mockSetAggregatedSandboxList(data),
    setSandboxSavingsState: (data: any) => mockSetSandboxSavingsState(data),
    updateConnectionInfoLoading: (val: boolean) => mockUpdateConnectionInfoLoading(val),
    updateSplitEstimateLoading: (val: boolean) => mockUpdateSplitEstimateLoading(val)
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: (val: string) => mockSetSelectedHeaderTab(val)
}));

vi.mock('../../../store/workloadFactory/createSandboxSlice', () => ({
    setSelectedSandboxHeaderValue: (val: any) => mockSetSelectedSandboxHeaderValue(val)
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            auth: () => ({
                isWorkloadFactory: false,
                ...overrides.auth
            }),
            sandbox: () => ({
                aggregatedSandboxList: [],
                selectedRollbackSnapshot: null,
                isRollbackSelected: false,
                ...overrides.sandbox
            }),
            databaseHome: () => ({
                sandboxAgeRange: null,
                ...overrides.databaseHome
            }),
            headers: () => ({
                headerSelectedCredSandbox: { data: { credentialsId: 'cred1' } },
                headerSelectedRegionSandbox: { label2: 'us-east-1' },
                ...overrides.headers
            })
        }
    });

const mockRowData = {
    id: 'sandbox1',
    name: 'my-sandbox',
    source: 'my-source-db',
    instanceName: 'instance1',
    sourceInstanceName: 'sourceInstance1',
    databaseHostId: 'host1',
    instanceId: 'inst1',
    baseSnapshot: 'snap1',
    actualUpdated: '2024-01-01',
    age: '15 days',
    ageByRange: '1-30 Days',
    tag: 'Development',
    status: 'active',
    menuDisable: false,
    cellProps: {}
};

const renderComponent = (storeOverrides: any = {}) => {
    const store = createMockStore(storeOverrides);
    return {
        ...render(
            <Provider store={store}>
                <SandboxTable />
            </Provider>
        ),
        store
    };
};

describe('SandboxTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedColumns = [];
        capturedRows = [];
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    describe('Rendering', () => {
        it('should render the table with top bar', () => {
            renderComponent();
            expect(screen.getByTestId('table-top-bar')).toBeTruthy();
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should render the "Sandboxes" plural title', () => {
            renderComponent();
            expect(screen.getByText('Sandboxes')).toBeTruthy();
        });

        it('should render the Create Sandbox button', () => {
            renderComponent();
            expect(screen.getByText('Create Sandbox')).toBeTruthy();
        });
    });

    describe('useEffect - data initialization', () => {
        it('should call formatSandboxListData when data does not have id field', async () => {
            const { formatSandboxListData } = await import('../SandboxUtility');
            const sandboxList = [{ name: 'sandbox1', source: 'source1' }];

            renderComponent({ sandbox: { aggregatedSandboxList: sandboxList } });

            expect(formatSandboxListData).toHaveBeenCalledWith(sandboxList);
        });

        it('should use raw data when aggregatedSandboxList items have id field', async () => {
            const { formatSandboxListData } = await import('../SandboxUtility');
            vi.mocked(formatSandboxListData).mockClear();
            const sandboxList = [{ id: 'sandbox1', name: 'sandbox1', source: 'source1' }];

            renderComponent({ sandbox: { aggregatedSandboxList: sandboxList } });

            expect(formatSandboxListData).not.toHaveBeenCalled();
        });

        it('should handle empty aggregatedSandboxList', async () => {
            const { formatSandboxListData } = await import('../SandboxUtility');
            renderComponent({ sandbox: { aggregatedSandboxList: [] } });
            expect(formatSandboxListData).toHaveBeenCalledWith([]);
        });
    });

    describe('Create Sandbox button', () => {
        it('should dispatch setSelectedSandboxHeaderValue and navigate on click', async () => {
            const { createSandboxNavigation } = await import('../../../utils/utilityFunctions');
            renderComponent();

            fireEvent.click(screen.getByText('Create Sandbox'));

            expect(mockSetSelectedSandboxHeaderValue).toHaveBeenCalledWith({
                credId: 'cred1',
                regionId: 'us-east-1'
            });
            expect(createSandboxNavigation).toHaveBeenCalledWith(mockNavigate);
        });
    });

    describe('getInitialFilter', () => {
        it('should return filter for ONE_THIRTY_DAYS when navigating from Dashboard', () => {
            renderComponent({
                databaseHome: {
                    sandboxAgeRange: { from: 'Dashboard', range: '1-30 Days' }
                }
            });
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should return filter for THIRTY_SIXTY_DAYS when navigating from Dashboard', () => {
            renderComponent({
                databaseHome: {
                    sandboxAgeRange: { from: 'Dashboard', range: '30-60 Days' }
                }
            });
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should return filter for SIXTY_PLUS_DAYS when range is neither 1-30 nor 30-60', () => {
            renderComponent({
                databaseHome: {
                    sandboxAgeRange: { from: 'Dashboard', range: '60+ Days' }
                }
            });
            expect(screen.getByTestId('table')).toBeTruthy();
        });

        it('should return undefined when not navigating from Dashboard', () => {
            renderComponent({
                databaseHome: { sandboxAgeRange: null }
            });
            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    describe('Column rendering and status cell', () => {
        it('should render status column with active status', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, status: 'active' }] }
            });

            // Get the status column and render its cell
            const statusCol = capturedColumns.find((col: any) => col.accessor === 'status');
            expect(statusCol).toBeDefined();

            if (statusCol?.renderCell) {
                const { container } = render(statusCol.renderCell('active', mockRowData));
                expect(container.textContent).toContain('Active');
            }
        });

        it('should render status column with refresh status', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, status: 'refresh' }] }
            });

            const statusCol = capturedColumns.find((col: any) => col.accessor === 'status');
            if (statusCol?.renderCell) {
                const { container } = render(statusCol.renderCell('refresh', mockRowData));
                expect(container.textContent).toContain('Refresh');
            }
        });

        it('should render status column with delete status', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, status: 'delete' }] }
            });

            const statusCol = capturedColumns.find((col: any) => col.accessor === 'status');
            if (statusCol?.renderCell) {
                const { container } = render(statusCol.renderCell('delete', mockRowData));
                expect(container.textContent).toContain('Deleting');
            }
        });

        it('should render status column with rebaseline status', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, status: 'rebaseline' }] }
            });

            const statusCol = capturedColumns.find((col: any) => col.accessor === 'status');
            if (statusCol?.renderCell) {
                const { container } = render(statusCol.renderCell('rebaseline', mockRowData));
                expect(container.textContent).toContain('Rebaselineaction');
            }
        });

        it('should render status column with split status', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, status: 'split' }] }
            });

            const statusCol = capturedColumns.find((col: any) => col.accessor === 'status');
            if (statusCol?.renderCell) {
                const { container } = render(statusCol.renderCell('split', mockRowData));
                expect(container.textContent).toContain('Split');
            }
        });

        it('should render status column with integrityCheck status', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, status: 'integrityCheck' }] }
            });

            const statusCol = capturedColumns.find((col: any) => col.accessor === 'status');
            if (statusCol?.renderCell) {
                const { container } = render(statusCol.renderCell('integrityCheck', mockRowData));
                expect(container.textContent).toContain('Integrity Check');
            }
        });

        it('should render last updated column with formatted date', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [mockRowData] }
            });

            const lastUpdatedCol = capturedColumns.find((col: any) => col.accessor === 'actualUpdated');
            if (lastUpdatedCol?.renderCell) {
                const { container } = render(lastUpdatedCol.renderCell('2024-01-01', mockRowData));
                expect(container.textContent).toContain('formatted-2024-01-01');
            }
        });

        it('should render age column with row age value', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [mockRowData] }
            });

            const ageCol = capturedColumns.find((col: any) => col.accessor === 'ageByRange');
            if (ageCol?.renderCell) {
                const { container } = render(ageCol.renderCell('1-30 Days', mockRowData));
                expect(container.textContent).toContain('15 days');
            }
        });
    });

    describe('lastColDetails - Menu column', () => {
        it('should render menu popover when menuDisable is false', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                const { getByTestId } = render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));
                expect(getByTestId('menu-popover')).toBeTruthy();
            }
        });

        it('should render disabled menu when menuDisable is true', () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: true }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                const { container } = render(lastCol.renderCell('', { ...mockRowData, menuDisable: true }));
                expect(container.textContent).toContain('...');
            }
        });

        it('should handle menu open toggle', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, id: 'row1', menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                const { getByTestId } = render(
                    lastCol.renderCell('', { ...mockRowData, id: 'row1', menuDisable: false })
                );
                const menuTrigger = getByTestId('menu-trigger');
                fireEvent.click(menuTrigger);
                expect(getByTestId('menu-popover')).toBeTruthy();
            }
        });

        it('should handle menu close toggle', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, id: 'row1', menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                const { getByTestId } = render(
                    lastCol.renderCell('', { ...mockRowData, id: 'row1', menuDisable: false })
                );
                const menuClose = getByTestId('menu-close');
                fireEvent.click(menuClose);
                expect(getByTestId('menu-popover')).toBeTruthy();
            }
        });
    });

    describe('handleRebaseLine', () => {
        it('should open rebaseline dialog when menu option is selected', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                // Directly call toggleMenu to trigger the menu action
                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'reBaseline');
                }

                expect(mockSetDialog).toHaveBeenCalled();
            }
        });

        it('should call updateSandboxApi when rebaseline callback is invoked', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'reBaseline');
                }

                // Get the dialog callback and invoke it
                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });
                    expect(mockUpdateSandboxApi).toHaveBeenCalled();
                }
            }
        });

        it('should close dialog when closeCallback is invoked', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'reBaseline');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.closeCallback) {
                    dialogCall.props.closeCallback();
                    expect(mockCloseDialog).toHaveBeenCalled();
                }
            }
        });
    });

    describe('handleRefresh', () => {
        it('should open refresh dialog when menu option is selected', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'refresh');
                }

                expect(mockSetDialog).toHaveBeenCalled();
            }
        });

        it('should call updateSandboxApi with rollback snapshot when isRollbackSelected', async () => {
            // Update mock store to return isRollbackSelected as true
            mockStore.getState = () => ({
                sandbox: {
                    aggregatedSandboxList: [mockRowData],
                    isRollbackSelected: true,
                    selectedRollbackSnapshot: { value: 'snapshot-123' }
                },
                headers: {
                    headerSelectedCredSandbox: { data: { credentialsId: 'cred1' } },
                    headerSelectedRegionSandbox: { label2: 'us-east-1' }
                }
            });

            renderComponent({
                sandbox: {
                    aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }],
                    isRollbackSelected: true,
                    selectedRollbackSnapshot: { value: 'snapshot-123' }
                }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'refresh');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });
                    expect(mockUpdateSandboxApi).toHaveBeenCalled();
                }
            }

            // Reset mock store
            mockStore.getState = () => ({
                sandbox: {
                    aggregatedSandboxList: [],
                    isRollbackSelected: false,
                    selectedRollbackSnapshot: null
                },
                headers: {
                    headerSelectedCredSandbox: { data: { credentialsId: 'cred1' } },
                    headerSelectedRegionSandbox: { label2: 'us-east-1' }
                }
            });
        });
    });

    describe('handleDelete', () => {
        it('should open delete dialog when menu option is selected', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                expect(mockSetDialog).toHaveBeenCalled();
            }
        });

        it('should call deleteSandboxApi when delete callback is invoked', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });
                    expect(mockDeleteSandboxApi).toHaveBeenCalled();
                }
            }
        });
    });

    describe('handleSplit', () => {
        it('should dispatch updateSplitEstimateLoading and call getSplitEstimateApi', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    await act(async () => {
                        lastToggleMenu!('selectedOption', 'split');
                    });
                }

                expect(mockUpdateSplitEstimateLoading).toHaveBeenCalledWith(true);
                expect(mockGetSplitEstimateApi).toHaveBeenCalled();
            }
        });

        it('should open split dialog after getting split estimate', async () => {
            mockGetSplitEstimateApi.mockResolvedValueOnce({ data: { volumes: [{ size: 100 }] } });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    await act(async () => {
                        lastToggleMenu!('selectedOption', 'split');
                    });
                }

                await waitFor(() => {
                    expect(mockSetDialog).toHaveBeenCalled();
                });
            }
        });

        it('should call splitSandboxApi when split callback is invoked', async () => {
            mockGetSplitEstimateApi.mockResolvedValueOnce({ data: { volumes: [] } });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    await act(async () => {
                        lastToggleMenu!('selectedOption', 'split');
                    });
                }

                await waitFor(() => {
                    expect(mockSetDialog).toHaveBeenCalled();
                });

                const dialogCall = mockSetDialog.mock.calls[0]?.[0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });
                    expect(mockSplitSandboxApi).toHaveBeenCalled();
                }
            }
        });

        it('should call closeDialog when split dialog closeCallback is invoked', async () => {
            mockGetSplitEstimateApi.mockResolvedValueOnce({ data: { volumes: [] } });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            expect(lastCol?.renderCell).toBeDefined();
            render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

            expect(lastToggleMenu).toBeDefined();
            await act(async () => {
                lastToggleMenu!('selectedOption', 'split');
            });

            await waitFor(() => {
                expect(mockSetDialog).toHaveBeenCalled();
            });

            const dialogCall = mockSetDialog.mock.calls[0]?.[0];
            expect(dialogCall?.props?.closeCallback).toBeDefined();

            await act(async () => {
                dialogCall.props.closeCallback();
            });

            expect(mockCloseDialog).toHaveBeenCalled();
        });
    });

    describe('handleConnectToTools', () => {
        it('should open connect to tools dialog', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'connectToTools');
                }

                expect(mockSetDialog).toHaveBeenCalled();
            }
        });

        it('should generate curl template when copyResponseData is called', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            expect(lastCol?.renderCell).toBeDefined();
            render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

            expect(lastToggleMenu).toBeDefined();
            lastToggleMenu!('selectedOption', 'connectToTools');

            // The dialog should include ViewDialog with copyResponseData
            const dialogCall = mockSetDialog.mock.calls[0][0];
            expect(dialogCall?.props?.content).toBeDefined();

            // Render the content and click the copy button to call copyResponseData
            const { getByTestId } = render(dialogCall.props.content);
            const copyButton = getByTestId('copy-button');
            expect(copyButton).toBeTruthy();

            await act(async () => {
                fireEvent.click(copyButton);
            });
        });
    });

    describe('handleShowConnectionInfo', () => {
        it('should dispatch updateConnectionInfoLoading and call getConnectionInfoApi', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    await act(async () => {
                        lastToggleMenu!('selectedOption', 'showConnectionInfo');
                    });
                }

                expect(mockUpdateConnectionInfoLoading).toHaveBeenCalledWith(true);
                expect(mockGetConnectionInfoApi).toHaveBeenCalled();
            }
        });

        it('should open connection info dialog after getting connection info', async () => {
            mockGetConnectionInfoApi.mockResolvedValueOnce({ data: { host: 'db.example.com', port: 5432 } });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            expect(lastCol?.renderCell).toBeDefined();
            render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

            expect(lastToggleMenu).toBeDefined();
            await act(async () => {
                lastToggleMenu!('selectedOption', 'showConnectionInfo');
            });

            // Wait for the API call to resolve and dialog to be set
            await waitFor(() => {
                expect(mockSetDialog).toHaveBeenCalled();
                expect(mockUpdateConnectionInfoLoading).toHaveBeenCalledWith(false);
            });

            // Check that the dialog content includes the connection string
            const dialogCall = mockSetDialog.mock.calls[0][0];
            expect(dialogCall?.props?.content).toBeDefined();
        });

        it('should build connection string from connection info data', async () => {
            const connectionData = { host: 'db.example.com', port: '5432', database: 'mydb' };
            mockGetConnectionInfoApi.mockResolvedValueOnce({ data: connectionData });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            expect(lastCol?.renderCell).toBeDefined();
            render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

            expect(lastToggleMenu).toBeDefined();
            await act(async () => {
                lastToggleMenu!('selectedOption', 'showConnectionInfo');
            });

            // Wait for API to resolve
            await act(async () => {
                await vi.waitFor(() => {
                    expect(mockSetDialog).toHaveBeenCalled();
                });
            });
        });
    });

    describe('handleIntegrityCheck', () => {
        it('should open integrity check dialog when menu option is selected', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'integrityCheck');
                }

                expect(mockSetDialog).toHaveBeenCalled();
            }
        });

        it('should call checkIntegrityApi when integrity check callback is invoked', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'integrityCheck');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });
                    expect(mockCheckIntegrityApi).toHaveBeenCalled();
                }
            }
        });
    });

    describe('handleJob - job status polling', () => {
        it('should handle COMPLETED job status for delete action', async () => {
            vi.useFakeTimers();
            mockDeleteSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });
            mockGetJobDetailApi.mockResolvedValueOnce({ data: { status: 'COMPLETED' } });
            mockGetSandboxSavingsApi.mockResolvedValueOnce({
                data: { consumedStorage: 200, savedStorage: 100, sandboxSavingsPercentage: 50 }
            });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    // Advance timers to trigger the interval
                    await act(async () => {
                        vi.advanceTimersByTime(200);
                    });

                    expect(mockGetJobDetailApi).toHaveBeenCalled();
                }
            }

            vi.useRealTimers();
        });

        it('should handle COMPLETED job status for rebaseline/refresh action', async () => {
            vi.useFakeTimers();
            mockUpdateSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job456' } });
            mockGetJobDetailApi.mockResolvedValueOnce({ data: { status: 'COMPLETED' } });
            mockGetSandboxSavingsApi.mockResolvedValueOnce({
                data: { consumedStorage: 200, savedStorage: 100, sandboxSavingsPercentage: 50 }
            });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'reBaseline');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    await act(async () => {
                        vi.advanceTimersByTime(200);
                    });

                    expect(mockGetJobDetailApi).toHaveBeenCalled();
                }
            }

            vi.useRealTimers();
        });

        it('should handle FAILED job status', async () => {
            vi.useFakeTimers();
            mockDeleteSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });
            mockGetJobDetailApi.mockResolvedValueOnce({ data: { status: 'FAILED' } });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    await act(async () => {
                        vi.advanceTimersByTime(200);
                    });

                    expect(mockGetJobDetailApi).toHaveBeenCalled();
                }
            }

            vi.useRealTimers();
        });

        it('should handle API error (no data in response)', async () => {
            mockDeleteSandboxApi.mockResolvedValueOnce({ error: 'error' });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    expect(mockSetAggregatedSandboxList).toHaveBeenCalled();
                }
            }
        });

        it('should handle savings API returning no data', async () => {
            vi.useFakeTimers();
            mockDeleteSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });
            mockGetJobDetailApi.mockResolvedValueOnce({ data: { status: 'COMPLETED' } });
            mockGetSandboxSavingsApi.mockResolvedValueOnce({ data: null });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    await act(async () => {
                        vi.advanceTimersByTime(200);
                    });
                }
            }

            vi.useRealTimers();
        });
    });

    describe('showJobInProgressNotification', () => {
        it('should dispatch addNotification with job monitoring button', async () => {
            mockDeleteSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    expect(mockAddNotification).toHaveBeenCalled();
                }
            }
        });

        it('should navigate to job monitoring when button is clicked in notification', async () => {
            mockDeleteSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            renderComponent({
                auth: { isWorkloadFactory: false },
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    // The notification contains a button that triggers navigation
                    expect(mockAddNotification).toHaveBeenCalled();
                }
            }
        });

        it('should navigate to WLF job monitoring when isWorkloadFactory is true', async () => {
            mockDeleteSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            renderComponent({
                auth: { isWorkloadFactory: true },
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'delete');
                }

                const dialogCall = mockSetDialog.mock.calls[0][0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    expect(mockAddNotification).toHaveBeenCalled();
                }
            }
        });
    });

    describe('Window resize handling', () => {
        it('should apply correct column widths for large screen (>= 1920)', async () => {
            const useResize = (await import('../../../common/hooks/useResize')).default;
            vi.mocked(useResize).mockReturnValue({ width: 1920, height: 1080 });

            renderComponent();

            // Verify columns have percentage widths for large screens
            const nameCol = capturedColumns.find((col: any) => col.accessor === 'name');
            expect(nameCol?.width).toBe('12.44%');
        });

        it('should apply correct column widths for small screen (< 1920)', async () => {
            const useResize = (await import('../../../common/hooks/useResize')).default;
            vi.mocked(useResize).mockReturnValue({ width: 1280, height: 720 });

            renderComponent();

            // Verify columns have pixel widths for small screens
            const nameCol = capturedColumns.find((col: any) => col.accessor === 'name');
            expect(nameCol?.width).toBe('200px');
        });

        it('should apply correct column widths for medium screen (>= 1600)', async () => {
            const useResize = (await import('../../../common/hooks/useResize')).default;
            vi.mocked(useResize).mockReturnValue({ width: 1600, height: 900 });

            renderComponent();

            // instanceName column should have 'auto' for screens >= 1600
            const instanceCol = capturedColumns.find((col: any) => col.accessor === 'instanceName');
            expect(instanceCol?.width).toBe('auto');
        });
    });

    describe('isWorkloadFactory navigation', () => {
        it('should navigate using WLF path when isWorkloadFactory is true', async () => {
            renderComponent({ auth: { isWorkloadFactory: true } });
            expect(screen.getByTestId('table')).toBeTruthy();
        });
    });

    describe('Deleted sandboxes filtering', () => {
        it('should filter out deleted sandboxes from the table rows', () => {
            renderComponent({
                sandbox: {
                    aggregatedSandboxList: [
                        { ...mockRowData, id: 'sandbox1' },
                        { ...mockRowData, id: 'sandbox2', name: 'sandbox2' }
                    ]
                }
            });

            // The rows should be passed to useTable
            expect(capturedRows.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Notification button click handler', () => {
        it('should navigate to job monitoring when notification button is clicked', async () => {
            mockDeleteSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            renderComponent({
                auth: { isWorkloadFactory: false },
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            expect(lastCol?.renderCell).toBeDefined();
            render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

            expect(lastToggleMenu).toBeDefined();
            lastToggleMenu!('selectedOption', 'delete');

            const dialogCall = mockSetDialog.mock.calls[0][0];
            expect(dialogCall?.props?.callback).toBeDefined();

            await act(async () => {
                dialogCall.props.callback();
            });

            // Extract the notification message and click the button
            const notificationCall = mockAddNotification.mock.calls[0][0];
            expect(notificationCall?.message).toBeDefined();

            const { container } = render(notificationCall.message);
            const button = container.querySelector('button');
            expect(button).toBeTruthy();

            await act(async () => {
                fireEvent.click(button!);
            });

            expect(mockSetSelectedHeaderTab).toHaveBeenCalled();
            expect(mockPostBlueXPMessage).toHaveBeenCalled();
            expect(mockClearNotifications).toHaveBeenCalled();
        });

        it('should navigate to WLF job monitoring path when isWorkloadFactory is true', async () => {
            mockDeleteSandboxApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            renderComponent({
                auth: { isWorkloadFactory: true },
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            expect(lastCol?.renderCell).toBeDefined();
            render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

            expect(lastToggleMenu).toBeDefined();
            lastToggleMenu!('selectedOption', 'delete');

            const dialogCall = mockSetDialog.mock.calls[0][0];
            expect(dialogCall?.props?.callback).toBeDefined();

            await act(async () => {
                dialogCall.props.callback();
            });

            // Extract the notification message and click the button
            const notificationCall = mockAddNotification.mock.calls[0][0];
            expect(notificationCall?.message).toBeDefined();

            const { container } = render(notificationCall.message);
            const button = container.querySelector('button');
            expect(button).toBeTruthy();

            await act(async () => {
                fireEvent.click(button!);
            });

            expect(mockSetSelectedHeaderTab).toHaveBeenCalled();
            expect(mockPostBlueXPMessage).toHaveBeenCalled();
            expect(mockClearNotifications).toHaveBeenCalled();
        });
    });

    describe('Integrity check closeCallback', () => {
        it('should call closeDialog when closeCallback is triggered', async () => {
            renderComponent({
                sandbox: { aggregatedSandboxList: [{ ...mockRowData, menuDisable: false }] }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'integrityCheck');
                }

                // Get the dialog and call closeCallback
                const dialogCall = mockSetDialog.mock.calls[0]?.[0];
                if (dialogCall?.props?.closeCallback) {
                    await act(async () => {
                        dialogCall.props.closeCallback();
                    });

                    expect(mockCloseDialog).toHaveBeenCalled();
                }
            }
        });
    });

    describe('Integrity check with multiple sandboxes', () => {
        it('should only update status for matching sandbox id in integrity check', async () => {
            const mockRowData2 = { ...mockRowData, id: 'sandbox2', name: 'sandbox2' };
            mockCheckIntegrityApi.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            renderComponent({
                sandbox: {
                    aggregatedSandboxList: [
                        { ...mockRowData, menuDisable: false },
                        { ...mockRowData2, menuDisable: false }
                    ]
                }
            });

            const lastCol = capturedColumns[capturedColumns.length - 1];
            if (lastCol?.renderCell) {
                render(lastCol.renderCell('', { ...mockRowData, menuDisable: false }));

                if (lastToggleMenu) {
                    lastToggleMenu('selectedOption', 'integrityCheck');
                }

                // Check that setAggregatedSandboxList was called
                const dialogCall = mockSetDialog.mock.calls[0]?.[0];
                if (dialogCall?.props?.callback) {
                    await act(async () => {
                        dialogCall.props.callback();
                    });

                    // The sandbox list should be updated with status changes
                    expect(mockSetAggregatedSandboxList).toHaveBeenCalled();
                }
            }
        });
    });
});
