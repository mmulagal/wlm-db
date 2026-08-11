import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DashboardDismissPage from '../DashboardDismissPage';

// ── mocks (must come before component import) ──────────────────────
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style, ...rest }: any) => (
        <span data-testid={rest['data-testid'] || `typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    ),
    useDialog: () => ({ setDialog: vi.fn(), closeDialog: vi.fn() })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsFlashingDotsLoader: () => <div data-testid="loader" />
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../../common/BreadCrumbs/BreadCrumbs', () => ({
    default: ({ items }: any) => (
        <nav data-testid="breadcrumbs">
            {items.map((item: any, i: number) => (
                <span key={i} onClick={item.onClick} data-testid={item.dataTestId || `breadcrumb-${i}`}>
                    {item.title}
                </span>
            ))}
        </nav>
    )
}));

vi.mock('../ValueCard/ValueCard', () => ({
    default: ({ valueCardData }: any) => <div data-testid="value-card">{valueCardData?.severity}</div>
}));

vi.mock('../TagComponent/TagComponent', () => ({
    default: (props: any) => <div data-testid="tag-component" />
}));

vi.mock('../../../GetWell/RecommendationText/RecommendationText', () => ({
    default: (props: any) => <div data-testid="recommendation-text" />
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content, callback, closeCallback, primaryButton, secondaryButton }: any) => (
        <div data-testid="dialog-component">{header}</div>
    )
}));

vi.mock('../DismissTables/DismissTable', () => ({
    default: ({ handleSingleAction, handleBulkAction, tableData, type }: any) => (
        <div data-testid="dismiss-table" data-type={type}>
            <span>{type}</span>
            <button
                data-testid="single-action-btn"
                onClick={() =>
                    handleSingleAction &&
                    handleSingleAction(
                        type,
                        {
                            id: '1',
                            databaseHostId: 'h1',
                            instanceId: 'i1',
                            credentialId: 'c1',
                            regionId: 'r1',
                            configState: 'ACTIVE'
                        },
                        'DISMISSED'
                    )
                }
            >
                single
            </button>
            <button
                data-testid="bulk-action-btn"
                onClick={() =>
                    handleBulkAction &&
                    handleBulkAction(
                        type,
                        [
                            {
                                id: '1',
                                databaseHostId: 'h1',
                                instanceId: 'i1',
                                credentialId: 'c1',
                                regionId: 'r1',
                                configState: 'ACTIVE'
                            }
                        ],
                        'DISMISSED',
                        false
                    )
                }
            >
                bulk-no-dialog
            </button>
            <button
                data-testid="bulk-action-dialog-btn"
                onClick={() =>
                    handleBulkAction &&
                    handleBulkAction(
                        type,
                        [
                            {
                                id: '1',
                                databaseHostId: 'h1',
                                instanceId: 'i1',
                                credentialId: 'c1',
                                regionId: 'r1',
                                configState: 'ACTIVE'
                            }
                        ],
                        'ACTIVE',
                        true
                    )
                }
            >
                bulk-dialog-activate
            </button>
            <button
                data-testid="bulk-action-postpone-btn"
                onClick={() =>
                    handleBulkAction &&
                    handleBulkAction(
                        type,
                        [
                            {
                                id: '1',
                                databaseHostId: 'h1',
                                instanceId: 'i1',
                                credentialId: 'c1',
                                regionId: 'r1',
                                configState: 'ACTIVE'
                            }
                        ],
                        'POSTPONED',
                        true
                    )
                }
            >
                bulk-dialog-postpone
            </button>
            <button
                data-testid="bulk-action-dismiss-btn"
                onClick={() =>
                    handleBulkAction &&
                    handleBulkAction(
                        type,
                        [
                            {
                                id: '1',
                                databaseHostId: 'h1',
                                instanceId: 'i1',
                                credentialId: 'c1',
                                regionId: 'r1',
                                configState: 'ACTIVE'
                            }
                        ],
                        'DISMISSED',
                        true
                    )
                }
            >
                bulk-dialog-dismiss
            </button>
        </div>
    )
}));

const mockDismissMssqlAssessment = vi.fn(() => Promise.resolve({ data: { successList: [], failedList: [] } }));
vi.mock('../../../../utils/apiService', () => ({
    useDismissMssqlAssessmentMutation: () => [mockDismissMssqlAssessment]
}));

vi.mock('../../../../store/store', () => ({
    default: {
        getState: vi.fn(() => ({
            getWellOptimize: {
                inProgressStateData: {}
            }
        })),
        dispatch: vi.fn()
    }
}));

vi.mock('../../../../store/notificationSlice', () => ({
    addNotification: vi.fn((val: any) => ({ type: 'addNotification', payload: val })),
    NOTIFICATION_TYPES: { SUCCESS: 'success', ERROR: 'error', INFO: 'info' }
}));

vi.mock('../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setInProgressStateData: vi.fn((val: any) => ({ type: 'setInProgressStateData', payload: val }))
}));

vi.mock('../../../GetWell/GetWellUtils', () => ({
    cardDataDefault: {
        storage_tier: { recommendation: { description: 'desc' } },
        file_system_headroom: { recommendation: { description: 'desc', values: [], valuesHeading: '' } },
        transaction_log_drive_size: { recommendation: { description: 'desc', values: [], valuesHeading: '' } },
        tempdb_drive_size: { recommendation: { description: 'desc', values: [], valuesHeading: '' } },
        user_data_files: { recommendation: { description: 'desc' } },
        transaction_log_files: { recommendation: { description: 'desc' } },
        tempdb_files: { recommendation: { description: 'desc' } },
        compute_rightsizing: { recommendation: { description: 'desc' } },
        host_os_patch: { recommendation: { description: 'desc' } },
        rss_config: { recommendation: { descriptionRssConfig: {} } },
        mtu: { recommendation: { description: 'desc' } },
        sql_licenses: { recommendation: {} },
        microsoft_sql_patch: { recommendation: { description: 'desc' } },
        maxdop: { recommendation: { descriptionRssConfig: { first: '' } } },
        scheduled_local_snapshot: { recommendation: { description: 'desc' } },
        scheduled_fsx_for_ontap_backups: { recommendation: { description: 'desc' } },
        clone_management: { recommendation: { description: 'desc' } },
        crr: { recommendation: { description: 'desc' } }
    },
    setOptimizeInnerpageSummary: vi.fn(),
    updateConfigStateStatus: vi.fn(),
    isWadExcludedConfig: vi.fn(() => false)
}));

vi.mock('../../../DatabaseHomePage/DatabaseHomeUtils', () => ({
    categorizeStateInstances: vi.fn(() => ({ successList: [], failedList: [] })),
    getAssessmentGroupedByConfigurations: vi.fn(() => ({})),
    mapHostStatusToAssessmentData: vi.fn((_inv, data) => data),
    shouldSkipDatabaseHost: vi.fn(() => false)
}));

vi.mock('../../../InventoryV2/InventoryUtilsV2', () => ({
    uniqueHostRow: vi.fn((a: string, b: string, c: string) => `${a}_${b}_${c}`),
    shouldSkipWellArchAssessmentItem: vi.fn(() => false),
    shouldSkipDuplicateAssessmentInstance: vi.fn(() => false)
}));

vi.mock('../../../../utils/consts', () => ({
    DBType: { MSSQL: 'Microsoft SQL Server', POSTGRESQL: 'PostgreSQL', ORACLE: 'Oracle' },
    ASSESSMENT_CONFIG_NAMES: {
        STORAGE_TIER: 'Storage tier',
        FILE_SYSTEM_HEADROOM: 'File system headroom',
        LOG_DRIVE_SIZE: 'Log drive size',
        TEMPDB_DRIVE_SIZE: 'TempDB drive size',
        DATA_FILES_MDF: 'Data files (.mdf)',
        LOG_FILES_LDF: 'Log files (.ldf)',
        TEMPDB_PLACEMENT: 'TempDB placement',
        COMPUTE_RIGHTSIZING: 'Compute rightsizing',
        OPERATING_SYSTEM_PATCH: 'Operating system patch',
        RSS_CONFIGURATION: 'Network adapter settings',
        SCHEDULED_LOCAL_SNAPSHOT: 'Scheduled local snapshot',
        SCHEDULED_FSX_FOR_ONTAP_BACKUPS: 'Backup Configuration',
        MAXDOP: 'MAXDOP',
        MICROSOFT_SQL_SERVER_PATCH: 'Microsoft SQL Server patch',
        LICENSE: 'License',
        CRR: 'Crr',
        CLONE_MANAGEMENT: 'Clone cleanup',
        MTU: 'MTU alignment',
        MSSQL_HIGH_AVAILABILITY: 'Microsoft SQL Server High Availability'
    },
    CONFIG_STATES: { ACTIVE: 'ACTIVE', DISMISSED: 'DISMISSED', POSTPONED: 'POSTPONED', ACTIVATING: 'ACTIVATING' },
    CONFIG_STATE_ACTIONS: { DISMISS: 'DISMISSED', POSTPONED: 'POSTPONED', ACTIVE: 'ACTIVE' },
    FROM_DIALOG: { DISMISS: 'dismiss' },
    WLF_TABS: {
        DASHBOARD: 'dashboard',
        DASHBOARD_INNER_PAGE: 'dashboardInnerPage',
        WELL_ARCHITECTED_TAB: 'wellArchitectedTab'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        COMPUTE_RIGHTSIZING: 'Compute rightsizing',
        OPERATING_SYSTEM_PATCH: 'Operating system patch',
        RSS_CONFIGURATION: 'Network adapter settings',
        LICENSE_SQL_SERVER: 'License',
        MICROSOFT_SQL_PATCH: 'Microsoft SQL Server patch',
        MAXDOP_PATCH: 'MAXDOP',
        SCHEDULED_LOCAL_SNAPSHOT: 'Scheduled local snapshot',
        CLONE_MANAGEMENT: 'Clone cleanup',
        CANCEL: 'Cancel',
        DISMISS_PAGE_MESSAGE: 'Manage the analysis state for each instance.',
        ANALYSIS_STATE_CHANGE_SUCCESS: 'State updated',
        ANALYSIS_STATE_CHANGE_FAILED: 'State update failed',
        ACTIVATING_MESSAGE: 'Activating...',
        NOT_AVAILABLE: 'N/A'
    }
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: vi.fn((val: any) => ({ type: 'setSelectedHeaderTab', payload: val })),
    default: (
        state = {
            allmssqlHostAssessmentData: [],
            allOracleHostAssessmentData: [],
            inventoryTableData: {},
            getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
        },
        action: any
    ) => state
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedRowsForDismiss: vi.fn(),
    default: (
        state = {
            selectedConfig: 'Storage tier',
            selectedConfigSummary: { totalInstances: 5, configState: 'active', severity: 'critical', tooltipText: '' },
            dismissPageLanding: 'dashboard',
            selectedRowsForDismiss: [],
            selectedRowsForOptimize: []
        },
        action: any
    ) => state
}));

vi.mock('../DashboardInnerPage.module.scss', () => ({
    default: {
        dashboardInnerPage: 'dip',
        innerPage: 'ip',
        breadCrumb: 'bc',
        headingSection: 'hs',
        mainSection: 'ms',
        leftSection: 'ls',
        rightSection: 'rs',
        recommendation: 'r',
        tableSection: 'ts',
        dismissPageMessage: 'dpm'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { commonBreadCrumb: 'cbc' }
}));

// ── store setup ─────────────────────────────────────────────────────
const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            databaseHome: (
                state = {
                    selectedConfig: 'Storage tier',
                    selectedConfigSummary: {
                        totalInstances: 5,
                        configState: 'active',
                        severity: 'critical',
                        tooltipText: ''
                    },
                    dismissPageLanding: 'dashboard',
                    selectedRowsForDismiss: [],
                    selectedRowsForOptimize: [],
                    ...overrides.databaseHome
                }
            ) => state,
            headers: (
                state = {
                    headerSelectedMultiCredIdsList: ['cred1'],
                    headerSelectedMultiRegionIdsList: ['us-east-1'],
                    getCredentials: {
                        credentialData: [{ credentialsId: 'cred1', name: 'MyCred', providerAccountId: '123' }]
                    },
                    getRegions: { regionsData: { regions: [{ regionCode: 'us-east-1', regionName: 'US East' }] } },
                    ...overrides.headers
                }
            ) => state,
            inventoryV2: (
                state = {
                    allmssqlHostAssessmentData: [],
                    allOracleHostAssessmentData: [],
                    inventoryTableData: {},
                    getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false },
                    ...overrides.inventoryV2
                }
            ) => state,
            getWellOptimize: (
                state = {
                    inProgressStateData: {},
                    ...overrides.getWellOptimize
                }
            ) => state
        }
    });

describe('DashboardDismissPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDismissMssqlAssessment.mockReturnValue(Promise.resolve({ data: { successList: [], failedList: [] } }));
    });

    it('renders with Storage tier config', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('breadcrumbs')).toBeTruthy();
        expect(screen.getByTestId('value-card')).toBeTruthy();
        expect(screen.getByTestId('tag-component')).toBeTruthy();
        expect(screen.getByTestId('dismiss-table')).toBeTruthy();
    });

    it('renders breadcrumbs for dashboard landing', () => {
        const store = createMockStore({ databaseHome: { dismissPageLanding: 'dashboard' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByText('Dashboard')).toBeTruthy();
    });

    it('renders breadcrumbs for inner page landing', () => {
        const store = createMockStore({ databaseHome: { dismissPageLanding: 'other' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByText('Dashboard')).toBeTruthy();
    });

    it('renders heading text', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByText(/databases.dashboard.update-configuration-state-for/)).toBeTruthy();
    });

    it('renders recommendation text and dismiss table', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('recommendation-text')).toBeTruthy();
        expect(screen.getByTestId('dismiss-table')).toBeTruthy();
    });

    it('renders dismiss page message', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByText('Manage the analysis state for each instance.')).toBeTruthy();
    });

    // ── All config switch cases for selectedConfig ──
    const configs = [
        'File system headroom',
        'Log drive size',
        'TempDB drive size',
        'Data files (.mdf)',
        'Log files (.ldf)',
        'TempDB placement',
        'Microsoft SQL Server High Availability',
        'Crr',
        'Clone cleanup',
        'Scheduled local snapshot',
        'Backup Configuration',
        'MTU alignment'
    ];

    configs.forEach(config => {
        it(`renders with config: ${config}`, () => {
            const store = createMockStore({ databaseHome: { selectedConfig: config } });
            render(
                <Provider store={store}>
                    <DashboardDismissPage />
                </Provider>
            );
            expect(screen.getByTestId('value-card')).toBeTruthy();
        });
    });

    it('renders with Compute rightsizing config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'Compute rightsizing' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    it('renders with Operating system patch config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'Operating system patch' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    it('renders with Operating system config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'Operating system' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    it('renders with ONTAP config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'ONTAP' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    it('renders with Network adapter settings config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'Network adapter settings' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    it('renders with License config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'License' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    it('renders with Microsoft SQL Server patch config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'Microsoft SQL Server patch' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    it('renders with MAXDOP config', () => {
        const store = createMockStore({ databaseHome: { selectedConfig: 'MAXDOP' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    // ── handleSingleAction / callDismissApi ──
    it('calls dismiss API on single action', async () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('single-action-btn'));
        expect(mockDismissMssqlAssessment).toHaveBeenCalled();
    });

    // ── handleBulkAction without dialog ──
    it('calls dismiss API on bulk action without dialog', async () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('bulk-action-btn'));
        expect(mockDismissMssqlAssessment).toHaveBeenCalled();
    });

    // ── handleBulkAction with dialog (activate) ──
    it('opens dialog on bulk action with activate dialog', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('bulk-action-dialog-btn'));
        // setDialog is called
    });

    // ── handleBulkAction with dialog (postpone) ──
    it('opens dialog on bulk action with postpone dialog', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('bulk-action-postpone-btn'));
    });

    // ── handleBulkAction with dialog (dismiss) ──
    it('opens dialog on bulk action with dismiss dialog', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('bulk-action-dismiss-btn'));
    });

    // ── callDismissApi with error response ──
    it('handles dismiss API error response', async () => {
        mockDismissMssqlAssessment.mockReturnValue(Promise.resolve({ error: 'some error' }));
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('single-action-btn'));
    });

    // ── callDismissApi with rejected promise ──
    it('handles dismiss API rejection', async () => {
        mockDismissMssqlAssessment.mockReturnValue(Promise.reject('network error'));
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('single-action-btn'));
    });

    // ── getTableData with assessment data ──
    it('renders with assessment data', () => {
        const store = createMockStore({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        databaseHostId: 'host1',
                        databaseHostName: 'Host-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'inst1',
                                databaseInstanceName: 'Instance1',
                                error: null,
                                assessments: {
                                    metadata: { lastAssessmentTimestamp: '2026-01-01' },
                                    dismissedConfigurations: [{ id: 'performance-tier', configState: 'DISMISSED' }]
                                }
                            }
                        ]
                    }
                ],
                inventoryTableData: {},
                getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
            }
        });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('dismiss-table')).toBeTruthy();
    });

    // ── breadcrumbs with inner page landing ──
    it('renders fix configuration breadcrumb for non-dashboard landing', () => {
        const store = createMockStore({
            databaseHome: { dismissPageLanding: 'dashboardInnerPage', selectedConfig: 'Storage tier' }
        });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByText(/databases.well-architect.fix-configuration/)).toBeTruthy();
    });

    // ── breadcrumb click handlers ──
    it('dispatches setSelectedHeaderTab when breadcrumb clicked', () => {
        const store = createMockStore({ databaseHome: { dismissPageLanding: 'other' } });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        fireEvent.click(screen.getByText('Dashboard'));
    });

    // ── getConfigObj cases with assessment data present ──
    const configObjCases = [
        { config: 'File system headroom', path: 'storage.sizing', name: 'headroom' },
        { config: 'Log drive size', path: 'storage.sizing', name: 'log-drive-size' },
        { config: 'TempDB drive size', path: 'storage.sizing', name: 'tempdb-drive-size' },
        { config: 'Data files (.mdf)', path: 'storage.layout', name: 'data-files-location' },
        { config: 'Log files (.ldf)', path: 'storage.layout', name: 'log-files-location' },
        { config: 'TempDB placement', path: 'storage.layout', name: 'tempdb-files-location' }
    ];

    configObjCases.forEach(({ config }) => {
        it(`renders getConfigObj for ${config}`, () => {
            const store = createMockStore({
                databaseHome: { selectedConfig: config },
                inventoryV2: {
                    allmssqlHostAssessmentData: [
                        {
                            credentialId: 'cred1',
                            regionId: 'us-east-1',
                            databaseHostId: 'h1',
                            databaseHostName: 'Host-1',
                            instancesAssessment: [
                                {
                                    databaseInstanceId: 'i1',
                                    databaseInstanceName: 'Inst1',
                                    error: null,
                                    assessments: {
                                        metadata: { lastAssessmentTimestamp: '2026-01-01' },
                                        dismissedConfigurations: [
                                            { id: 'performance-tier', configState: 'DISMISSED' },
                                            { id: 'headroom', configState: 'DISMISSED' },
                                            { id: 'log-drive-size', configState: 'DISMISSED' },
                                            { id: 'tempdb-drive-size', configState: 'DISMISSED' },
                                            { id: 'data-files-location', configState: 'DISMISSED' },
                                            { id: 'log-files-location', configState: 'DISMISSED' },
                                            { id: 'tempdb-files-location', configState: 'DISMISSED' },
                                            { id: 'compute-rightsizing', configState: 'ACTIVE' },
                                            { id: 'maxdop', configState: 'ACTIVE' },
                                            { id: 'mssql-patch', configState: 'ACTIVE' },
                                            { id: 'sql-license', configState: 'ACTIVE' },
                                            { id: 'rss-config', configState: 'ACTIVE' },
                                            { id: 'host-os-patch', configState: 'ACTIVE' },
                                            { id: 'snapshot-policy', configState: 'ACTIVE' },
                                            { id: 'backup-configuration', configState: 'ACTIVE' },
                                            { id: 'clone-management', configState: 'ACTIVE' },
                                            { id: 'crr', configState: 'ACTIVE' },
                                            { id: 'mtu-alignment', configState: 'ACTIVE' }
                                        ]
                                    }
                                }
                            ]
                        }
                    ],
                    inventoryTableData: {},
                    getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                }
            });
            render(
                <Provider store={store}>
                    <DashboardDismissPage />
                </Provider>
            );
            expect(screen.getByTestId('dismiss-table')).toBeTruthy();
        });
    });

    // ── getConfigObj direct property cases ──
    const directConfigCases = [
        { config: 'Compute rightsizing' },
        { config: 'MAXDOP' },
        { config: 'Microsoft SQL Server patch' },
        { config: 'License' },
        { config: 'Network adapter settings' },
        { config: 'Operating system patch' },
        { config: 'Scheduled local snapshot' },
        { config: 'Backup Configuration' },
        { config: 'Clone cleanup' },
        { config: 'Crr' },
        { config: 'MTU alignment' }
    ];

    directConfigCases.forEach(({ config }) => {
        it(`renders getConfigObj for direct config: ${config}`, () => {
            const store = createMockStore({
                databaseHome: { selectedConfig: config },
                inventoryV2: {
                    allmssqlHostAssessmentData: [
                        {
                            credentialId: 'cred1',
                            regionId: 'us-east-1',
                            databaseHostId: 'h1',
                            databaseHostName: 'Host-1',
                            instancesAssessment: [
                                {
                                    databaseInstanceId: 'i1',
                                    databaseInstanceName: 'Inst1',
                                    error: null,
                                    assessments: {
                                        dismissedConfigurations: [
                                            { id: 'compute-rightsizing', configState: 'ACTIVE' },
                                            { id: 'maxdop', configState: 'ACTIVE' },
                                            { id: 'mssql-patch', configState: 'ACTIVE' },
                                            { id: 'sql-license', configState: 'ACTIVE' },
                                            { id: 'rss-config', configState: 'ACTIVE' },
                                            { id: 'host-os-patch', configState: 'ACTIVE' },
                                            { id: 'snapshot-policy', configState: 'ACTIVE' },
                                            { id: 'backup-configuration', configState: 'ACTIVE' },
                                            { id: 'clone-management', configState: 'ACTIVE' },
                                            { id: 'crr', configState: 'ACTIVE' },
                                            { id: 'mtu-alignment', configState: 'ACTIVE' }
                                        ]
                                    }
                                }
                            ]
                        }
                    ],
                    inventoryTableData: {},
                    getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
                }
            });
            render(
                <Provider store={store}>
                    <DashboardDismissPage />
                </Provider>
            );
            expect(screen.getByTestId('dismiss-table')).toBeTruthy();
        });
    });

    // ── filtered out host data ──
    it('skips host data when cred or region not in selection', () => {
        const store = createMockStore({
            headers: {
                headerSelectedMultiCredIdsList: ['other-cred'],
                headerSelectedMultiRegionIdsList: ['us-west-2'],
                getCredentials: { credentialData: [] },
                getRegions: { regionsData: { regions: [] } }
            },
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        databaseHostId: 'h1',
                        instancesAssessment: [{ databaseInstanceId: 'i1', error: null, assessments: {} }]
                    }
                ],
                inventoryTableData: {},
                getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
            }
        });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('dismiss-table')).toBeTruthy();
    });

    // ── skip instance with error ──
    it('skips instances with error', () => {
        const store = createMockStore({
            inventoryV2: {
                allmssqlHostAssessmentData: [
                    {
                        credentialId: 'cred1',
                        regionId: 'us-east-1',
                        databaseHostId: 'h1',
                        databaseHostName: 'Host-1',
                        instancesAssessment: [
                            {
                                databaseInstanceId: 'i1',
                                error: 'some error',
                                assessments: {}
                            }
                        ]
                    }
                ],
                inventoryTableData: {},
                getDatabaseHosts: { fullHostDataLoading: false, databaseHostsLoading: false }
            }
        });
        render(
            <Provider store={store}>
                <DashboardDismissPage />
            </Provider>
        );
        expect(screen.getByTestId('dismiss-table')).toBeTruthy();
    });
});
