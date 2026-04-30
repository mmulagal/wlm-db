import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DashboardInnerPage from '../DashboardInnerPage';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style, ...rest }: any) => (
        <span data-testid={rest['data-testid'] || `typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    ),
    DsButton: ({ children, onClick, isDisabled }: any) => (
        <button data-testid="ds-button" disabled={isDisabled} onClick={onClick}>
            {children}
        </button>
    ),
    Button: ({ children, onClick }: any) => (
        <button data-testid="button" onClick={onClick}>
            {children}
        </button>
    ),
    Popover: ({ children, container }: any) => (
        <div data-testid="popover">
            {container}
            {children}
        </div>
    ),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    useDialog: () => ({ setDialog: vi.fn(), closeDialog: vi.fn() })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsFlashingDotsLoader: () => <div data-testid="loader" />,
    DsTypography: ({ children, variant, className, style, ...rest }: any) => (
        <span data-testid={rest['data-testid'] || `typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('@tlveng/wlm-ds/src/hooks/useBlueXP', () => ({
    BlueXPListeners: { navigate: 'navigate' },
    postBlueXPMessage: vi.fn()
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => vi.fn() };
});

// Mock child components
vi.mock('../../../../common/BreadCrumbs/BreadCrumbs', () => ({
    default: ({ items }: any) => (
        <div data-testid="breadcrumbs">
            {items?.map((item: any, i: number) => (
                <span key={i} onClick={item.onClick}>
                    {item.title}
                </span>
            ))}
        </div>
    )
}));

vi.mock('../../DashboardInnerPage/ValueCard/ValueCard', () => ({
    default: ({ valueCardData }: any) => <div data-testid="value-card">{valueCardData?.severity}</div>
}));

vi.mock('../TagComponent/TagComponent', () => ({
    default: ({ tagHeight, engineType, severity }: any) => <div data-testid="tag-component">{engineType}</div>
}));

vi.mock('../../../GetWell/RecommendationText/RecommendationText', () => ({
    default: ({ data, from }: any) => <div data-testid="recommendation-text" />
}));

vi.mock('../RenderTables/DashboardConfigsTable', () => ({
    default: ({ configType }: any) => <div data-testid="dashboard-configs-table">{configType}</div>
}));

vi.mock('../RenderTables/DashboardConfigsMultiTable', () => ({
    default: ({ configType }: any) => <div data-testid="dashboard-multi-table">{configType}</div>
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: (props: any) => <div data-testid="dialog-component">{props.header}</div>
}));

vi.mock('../../../GetWell/StorageCardComponent/DialogContent/DialogContent', () => ({
    default: () => <div data-testid="dialog-content" />
}));

vi.mock('../../../../common/LinkedConfigBanner/LinkedConfigBanner', () => ({
    default: ({ linkedConfigNames, configName }: any) => <div data-testid="linked-config-banner">{configName}</div>
}));

vi.mock('../../../../store/store', () => ({
    default: {
        getState: vi.fn(() => ({
            getWellOptimize: {
                selectedDatabaseInstance: 'inst1',
                selectedResourceId: 'res1',
                landingFrom: 'inventory',
                recommendedInstanceInBulk: {},
                selectedGwInstanceCredId: 'cred1',
                selectedGwInstanceRegionId: 'region1',
                selectedRecommendedInstance: { value: 'r5.large' },
                selectedSnapshot: { data: { uuid: 'u1', name: 'snap1' } },
                selectedAWSBackup: { numberOfDays: 30 },
                jobToInstanceMap: {},
                inProgressHostData: {}
            },
            inventoryV2: { inventoryTableData: {} }
        })),
        dispatch: vi.fn()
    }
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: vi.fn(v => ({ type: 'a', payload: v }))
}));

vi.mock('../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setCloneDashboardData: vi.fn(v => ({ type: 'a', payload: v })),
    setGwPageLoadInstanceData: vi.fn(v => ({ type: 'b', payload: v })),
    setInProgressHostData: vi.fn(v => ({ type: 'c', payload: v })),
    setInProgressOptimizationData: vi.fn(v => ({ type: 'd', payload: v })),
    setJobToInstanceMap: vi.fn(v => ({ type: 'e', payload: v })),
    setJobToInstanceMapForBulk: vi.fn(v => ({ type: 'f', payload: v })),
    setLandingFrom: vi.fn(v => ({ type: 'g', payload: v })),
    setOptimizingData: vi.fn(v => ({ type: 'h', payload: v })),
    setOptimizingInstanceData: vi.fn(v => ({ type: 'i', payload: v }))
}));

vi.mock('../../../../store/notificationSlice', () => ({
    addNotification: vi.fn(v => ({ type: 'a', payload: v })),
    clearNotifications: vi.fn(() => ({ type: 'b' })),
    NOTIFICATION_TYPES: { INFO: 'info', SUCCESS: 'success', ERROR: 'error' }
}));

vi.mock('../../../DatabaseHomePage/DatabaseHomeUtils', () => ({
    getAssessmentGroupedByConfigurations: vi.fn(() => [])
}));

vi.mock('../../../GetWell/GetWellUtils', () => ({
    cardDataDefault: {},
    checkIfDisableForOptimize: vi.fn(() => ({ isDisabled: false, errorMessage: '' })),
    formatGetWellData: vi.fn(),
    handleOptimizeStorageJob: vi.fn(),
    nameToIdConfigMapping: vi.fn((type: string) => type),
    setOptimizeInnerpageSummary: vi.fn()
}));

vi.mock('../../../InventoryV2/InventoryUtilsV2', () => ({
    uniqueHostRow: vi.fn((...args: any[]) => args.join('_'))
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    backupStartTime: vi.fn()
}));

vi.mock('../DashboardInnerPageHelper', () => ({
    calculatePostponeInfo: vi.fn(() => ({ postponeDate: '01 Jan 2026', daysLeft: 15 })),
    callDashboardDismissApi: vi.fn(),
    filterNotOptimizedRows: vi.fn((data: any) => data),
    getAssessmentStatusConsistency: vi.fn(() => false)
}));

vi.mock('../../../../utils/apiService', () => ({
    useLazyGetSubTaskListQuery: () => [vi.fn()],
    useOptimizeComputeConfigMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeStorageConfigMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeStorageSizingMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeStorageTierMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeStorageSizingForBulkMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeStorageTierForBulkMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeComputeConfigForBulkMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeMTUConfigForBulkMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeMaxdopConfigForBulkMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeResiliencyMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeAwsBackupMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useDismissMssqlAssessmentMutation: () => [vi.fn(() => Promise.resolve({ data: {} }))],
    useDismissOracleAssessmentMutation: () => [vi.fn(() => Promise.resolve({ data: {} }))],
    useOptimizeOracleStorageLayoutAsmMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))],
    useOptimizeOracleOperatingSystemMutation: () => [vi.fn(() => Promise.resolve({ data: { jobId: 'j1' } }))]
}));

const mockIsLayoutConfig = vi.fn(() => false);
const mockGetLinkedConfigNames = vi.fn(() => []);

vi.mock('../../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies', () => ({
    isLayoutConfig: (...args: any[]) => mockIsLayoutConfig(...args),
    getLinkedConfigNames: (...args: any[]) => mockGetLinkedConfigNames(...args)
}));

vi.mock('../../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils', () => ({
    formatOracleWellArchitectedData: vi.fn(),
    oracleCardData: {}
}));

vi.mock('../../../WellArchitectedTab/WellArchitectedTabUtils', () => ({
    engineTypeBasedResourceStr: vi.fn((_type: any, mssql: string) => mssql)
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
        dismissDialog: 'dd',
        notification: 'n',
        reactiveButtonContainer: 'rbc',
        postpone: 'p',
        postponeContainer: 'pc',
        buttonContainer: 'btc',
        'optimize-in-progress': 'oip'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { popover: 'popover' }
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            databaseHome: (
                s: any = {
                    selectedConfig: 'Storage tier',
                    selectedConfigSummary: { configState: 'ACTIVE' },
                    selectedRowsForOptimize: [],
                    ...overrides.databaseHome
                }
            ) => s,
            auth: (
                s: any = {
                    isWorkloadFactory: false,
                    ...overrides.auth
                }
            ) => s,
            getWellOptimize: (
                s: any = {
                    inProgressOptimizationData: {},
                    inProgressHostData: {},
                    cloneIsOptimizedRows: {},
                    configEngineType: 'MSSQL',
                    credIdFromJM: 'cred1',
                    regionFromJM: 'us-east-1',
                    optimizingData: {},
                    ...overrides.getWellOptimize
                }
            ) => s,
            inventoryV2: (
                s: any = {
                    allmssqlHostAssessmentData: [],
                    allOracleHostAssessmentData: [],
                    ...overrides.inventoryV2
                }
            ) => s
        }
    });

describe('DashboardInnerPage', () => {
    it('renders breadcrumbs', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('breadcrumbs')).toBeTruthy();
    });

    it('renders heading with selected config', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getAllByText('Storage tier').length).toBeGreaterThan(0);
    });

    it('renders ValueCard component', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });

    it('renders TagComponent', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('tag-component')).toBeTruthy();
    });

    it('renders RecommendationText', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('recommendation-text')).toBeTruthy();
    });

    it('renders DashboardConfigsTable for Storage Tier', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('dashboard-configs-table')).toBeTruthy();
    });

    it('renders DashboardMultiTableConfig for ONTAP Caps', () => {
        render(
            <Provider
                store={makeStore({
                    databaseHome: {
                        selectedConfig: 'ONTAP',
                        selectedConfigSummary: { configState: 'ACTIVE' },
                        selectedRowsForOptimize: []
                    }
                })}
            >
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('dashboard-multi-table')).toBeTruthy();
    });

    it('renders CRR config name correctly', () => {
        render(
            <Provider
                store={makeStore({
                    databaseHome: {
                        selectedConfig: 'Cross-Region Replication (CRR)',
                        selectedConfigSummary: { configState: 'ACTIVE' },
                        selectedRowsForOptimize: []
                    }
                })}
            >
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getAllByText('Cross-Region Replication (CRR)').length).toBeGreaterThan(0);
    });

    // ── renderTable switch cases for DashboardConfigsTable ──
    const singleTableConfigs = [
        'File system headroom',
        'Log drive size',
        'TempDB drive size',
        'Data files (.mdf) placement',
        'Log files (.ldf) placement',
        'TempDB placement',
        'Compute rightsizing',
        'MAXDOP',
        'Microsoft SQL Server patch',
        'License',
        'Network adapter settings',
        'MTU alignment',
        'Operating system patch',
        'Scheduled local snapshot',
        'Backup Configuration',
        'Clone cleanup'
    ];

    singleTableConfigs.forEach(config => {
        it(`renders DashboardConfigsTable for ${config}`, () => {
            render(
                <Provider
                    store={makeStore({
                        databaseHome: {
                            selectedConfig: config,
                            selectedConfigSummary: { configState: 'ACTIVE' },
                            selectedRowsForOptimize: []
                        }
                    })}
                >
                    <DashboardInnerPage />
                </Provider>
            );
            expect(screen.getByTestId('dashboard-configs-table')).toBeTruthy();
            expect(screen.getAllByText(config).length).toBeGreaterThan(0);
        });
    });

    // ── renderTable switch cases for DashboardMultiTableConfig ──
    const multiTableConfigs = ['Operating system', 'Microsoft SQL Server High Availability'];

    multiTableConfigs.forEach(config => {
        it(`renders DashboardMultiTableConfig for ${config}`, () => {
            render(
                <Provider
                    store={makeStore({
                        databaseHome: {
                            selectedConfig: config,
                            selectedConfigSummary: { configState: 'ACTIVE' },
                            selectedRowsForOptimize: []
                        }
                    })}
                >
                    <DashboardInnerPage />
                </Provider>
            );
            expect(screen.getByTestId('dashboard-multi-table')).toBeTruthy();
        });
    });

    // ── Oracle config renderTable cases ──
    const oracleConfigs = [
        'Oracle binary placement',
        'Data files placement',
        'Control files placement',
        'Redo logs placement',
        'Temp placement',
        'Archive placement',
        'ASM data disk group LUNs',
        'ASM logs disk group LUNs',
        'ASM FRA disk group LUNs',
        'ASM archive log disk group LUNs',
        'Swap space'
    ];

    oracleConfigs.forEach(config => {
        it(`renders DashboardConfigsTable for Oracle config: ${config}`, () => {
            render(
                <Provider
                    store={makeStore({
                        databaseHome: {
                            selectedConfig: config,
                            selectedConfigSummary: { configState: 'ACTIVE' },
                            selectedRowsForOptimize: []
                        },
                        getWellOptimize: {
                            configEngineType: 'ORACLE',
                            inProgressOptimizationData: {},
                            inProgressHostData: {},
                            cloneIsOptimizedRows: {},
                            optimizingData: {}
                        }
                    })}
                >
                    <DashboardInnerPage />
                </Provider>
            );
            expect(screen.getByTestId('dashboard-configs-table')).toBeTruthy();
        });
    });

    // ── Oracle engine type shows LinkedConfigBanner when isLayoutConfig ──
    it('shows LinkedConfigBanner for Oracle layout config', () => {
        mockIsLayoutConfig.mockReturnValueOnce(true);
        mockGetLinkedConfigNames.mockReturnValueOnce(['Data files placement', 'Control files placement']);
        render(
            <Provider
                store={makeStore({
                    databaseHome: {
                        selectedConfig: 'Oracle binary placement',
                        selectedConfigSummary: { configState: 'ACTIVE' },
                        selectedRowsForOptimize: []
                    },
                    getWellOptimize: {
                        configEngineType: 'Oracle',
                        inProgressOptimizationData: {},
                        inProgressHostData: {},
                        cloneIsOptimizedRows: {},
                        optimizingData: {}
                    }
                })}
            >
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('linked-config-banner')).toBeTruthy();
    });

    // ── Does not show LinkedConfigBanner for MSSQL ──
    it('does not show LinkedConfigBanner for MSSQL engine', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.queryByTestId('linked-config-banner')).toBeNull();
    });

    // ── selectedConfigName shows CRR display name ──
    it('renders CRR as Cross-Region Replication (CRR)', () => {
        render(
            <Provider
                store={makeStore({
                    databaseHome: {
                        selectedConfig: 'Cross-Region Replication (CRR)',
                        selectedConfigSummary: { configState: 'ACTIVE' },
                        selectedRowsForOptimize: []
                    }
                })}
            >
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getAllByText('Cross-Region Replication (CRR)').length).toBeGreaterThan(0);
    });

    it('renders non-CRR config name as-is', () => {
        render(
            <Provider
                store={makeStore({
                    databaseHome: {
                        selectedConfig: 'MAXDOP',
                        selectedConfigSummary: { configState: 'ACTIVE' },
                        selectedRowsForOptimize: []
                    }
                })}
            >
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getAllByText('MAXDOP').length).toBeGreaterThan(0);
    });

    // ── Breadcrumb items ──
    it('renders breadcrumb with Well-Architected and Fix Configuration', () => {
        render(
            <Provider store={makeStore()}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByText('databases.general.well-architected')).toBeTruthy();
    });

    // ── Test with isWorkloadFactory = true ──
    it('renders with isWorkloadFactory true', () => {
        render(
            <Provider store={makeStore({ auth: { isWorkloadFactory: true } })}>
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('breadcrumbs')).toBeTruthy();
    });

    // ── Test with inProgressOptimizationData ──
    it('renders with inProgressOptimizationData', () => {
        render(
            <Provider
                store={makeStore({
                    getWellOptimize: {
                        inProgressOptimizationData: { 'Storage tier': ['host1_inst1'] },
                        inProgressHostData: {},
                        cloneIsOptimizedRows: {},
                        configEngineType: 'MSSQL',
                        optimizingData: {}
                    }
                })}
            >
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('dashboard-configs-table')).toBeTruthy();
    });

    // ── Test with assessment data ──
    it('renders with assessment data present', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allmssqlHostAssessmentData: [
                            { credentialId: 'c1', regionId: 'r1', databaseHostId: 'h1', instancesAssessment: [] }
                        ],
                        allOracleHostAssessmentData: []
                    }
                })}
            >
                <DashboardInnerPage />
            </Provider>
        );
        expect(screen.getByTestId('value-card')).toBeTruthy();
    });
});
