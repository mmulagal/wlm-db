import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import DynamicOptimizeInnerPage from './DynamicOptimizeInnerPage';

// ─── Store ────────────────────────────────────────────────────────────────────
const mockDispatch = vi.fn();
const mockUseAppSelector = vi.fn();

vi.mock('react-redux', () => ({ useDispatch: () => mockDispatch }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../../../store/storeHooks', () => ({
    useAppSelector: (selector: any) => mockUseAppSelector(selector)
}));

// ─── Slice actions ────────────────────────────────────────────────────────────
vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: (v: any) => ({ type: 'setSelectedHeaderTab', payload: v })
}));
vi.mock('../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setLandingFromInnerPage: (v: any) => ({ type: 'setLandingFromInnerPage', payload: v }),
    setOptimizingData: (v: any) => ({ type: 'setOptimizingData', payload: v }),
    setInProgressOptimizationData: (v: any) => ({ type: 'setInProgressOptimizationData', payload: v }),
    setInProgressHostData: (v: any) => ({ type: 'setInProgressHostData', payload: v }),
    setJobToInstanceMap: (v: any) => ({ type: 'setJobToInstanceMap', payload: v }),
    setIsInnerPageOptimize: (v: any) => ({ type: 'setIsInnerPageOptimize', payload: v }),
    setCloneDashboardData: (v: any) => ({ type: 'setCloneDashboardData', payload: v }),
    setCardData: (v: any) => ({ type: 'setCardData', payload: v })
}));

// ─── Registry ─────────────────────────────────────────────────────────────────
const mockGetColumnConfig: Mock = vi.fn();
const mockIsViewOnlyConfig: Mock = vi.fn(() => false);
const mockGetOptimizeApiConfig: Mock = vi.fn(() => null);
const mockGetConfigEntry: Mock = vi.fn(() => undefined);

vi.mock('../../../utils/configRegistry', () => ({
    getColumnConfig: mockGetColumnConfig,
    isViewOnlyConfig: mockIsViewOnlyConfig,
    getOptimizeApiConfig: mockGetOptimizeApiConfig,
    getConfigEntry: mockGetConfigEntry,
    OptimizeApiConfig: {}
}));

// ─── Consts ───────────────────────────────────────────────────────────────────
vi.mock('../../../utils/consts', () => ({
    DBType: { MSSQL: 'mssql', ORACLE: 'oracle' },
    WLF_TABS: {
        OPTIMIZE: 'Optimize',
        ORACLE_WELL_ARCHITECTED: 'Oracle Well Architected',
        DASHBOARD: 'Dashboard'
    },
    ACTION_TYPE: { BULK: 'bulk', SINGLE: 'single' },
    ASSESSMENT_CONFIG_IDS: {
        CLONE_MANAGEMENT: 'clone-management',
        RSS_CONFIGURATION: 'rss-configuration',
        CRR: 'crr'
    },
    GETWELL_STATUS: { OPTIMIZING: 'Optimizing' },
    WELL_ARCHITECTED_STATUS: { OPTIMIZING: 'Optimizing' }
}));

// ─── GetWell utils ────────────────────────────────────────────────────────────
vi.mock('../GetWellUtils', () => ({
    instanceBreadCrumbSelectedFrom: vi.fn(() => 'Home'),
    selectHeaderTabFromBreadCrumb: vi.fn(),
    handleOptimizeStorageJob: vi.fn()
}));

// ─── Optimize API utils ───────────────────────────────────────────────────────
vi.mock('../optimizeApiUtils', () => ({
    useOptimizeMutations: () => ({}),
    buildOptimizeApiInput: vi.fn(() => ({})),
    buildOptimizeInfoNotification: vi.fn(() => ({ type: 'notification' })),
    buildOptimizeFailedMessage: vi.fn(() => ({ type: 'failed' }))
}));

// ─── API service ──────────────────────────────────────────────────────────────
vi.mock('../../../utils/apiService', () => ({
    useLazyGetSubTaskListQuery: () => [vi.fn()]
}));

// ─── Redux store ──────────────────────────────────────────────────────────────
vi.mock('../../../store/store', () => ({
    default: { getState: () => ({ getWellOptimize: { jobToInstanceMap: {}, cardData: {} } }) }
}));

// ─── Oracle config dependencies ───────────────────────────────────────────────
const mockIsLinkedConfig: Mock = vi.fn(() => false);
const mockGetLinkedConfigNames: Mock = vi.fn((): string[] => []);

vi.mock('../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies', () => ({
    isLinkedConfig: mockIsLinkedConfig,
    getLinkedConfigNames: mockGetLinkedConfigNames
}));

// ─── Optimize utils ───────────────────────────────────────────────────────────
const mockHandleConfigDialog = vi.fn();
vi.mock('../StorageCardComponent/optimizeUtils', () => ({
    handleConfigDialog: mockHandleConfigDialog
}));

// ─── CRR prefetch ─────────────────────────────────────────────────────────────
vi.mock('./CRRRedirectionContent/associateCrrLinkPrefetch', () => ({
    useAssociateCrrLinkPrefetch: () => ({ runAssociateLinkPrefetch: vi.fn() })
}));

// ─── Design system ────────────────────────────────────────────────────────────
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children }: any) => <span>{children}</span>,
    useDialog: () => ({ setDialog: vi.fn(), closeDialog: vi.fn() })
}));

// ─── Child components ─────────────────────────────────────────────────────────
vi.mock('./OptimizeCard/OptimizeCard', () => ({ default: () => <div data-testid="optimize-card" /> }));
vi.mock('../../../common/BreadCrumbs/BreadCrumbs', () => ({
    default: ({ items }: any) => (
        <div>
            {items?.map((item: any, i: number) => (
                <button type="button" key={item?.title ?? i} data-testid={`breadcrumb-${i}`} onClick={item?.onClick}>
                    {item?.title}
                </button>
            ))}
        </div>
    )
}));
vi.mock('./DynamicInnerTable/DynamicInnerTable', () => ({
    default: (props: any) => (
        <div
            data-testid="dynamic-inner-table"
            data-can-optimize={String(props.canOptimize)}
            data-is-view-only={String(props.isViewOnly)}
        />
    )
}));
vi.mock('./DynamicInnerTable/NestedDynamicInnerTable', () => ({
    default: () => <div data-testid="nested-inner-table" />
}));
vi.mock('./CloneTabs', () => ({ default: () => <div data-testid="clone-tabs" /> }));
vi.mock('../../Dashboard/DashboardInnerPage/TagComponent/TagComponent', () => ({
    default: () => <div data-testid="tag-component" />
}));
vi.mock('../../../common/LinkedConfigBanner/LinkedConfigBanner', () => ({
    default: ({ linkedConfigNames }: any) => (
        <div data-testid="linked-config-banner">{linkedConfigNames?.join(',')}</div>
    )
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const baseState = (
    overrides: {
        selectedOptimizeConfig?: any;
        getWellOptimize?: any;
    } = {}
) => {
    const selectedOptimizeConfig =
        'selectedOptimizeConfig' in overrides
            ? overrides.selectedOptimizeConfig
            : { type: 'some-config', engineType: 'mssql', data: { name: 'Some Config', categories: [] } };
    const gwBase = {
        selectedDatabaseInstance: 'inst1',
        selectedHostname: 'host1',
        selectedDatabaseInstanceName: 'inst-name1',
        selectedResourceId: 'r1',
        selectedGwInstanceCredId: 'cred1',
        selectedGwInstanceRegionId: 'reg1',
        optimizingData: {},
        inProgressOptimizationData: {},
        inProgressHostData: {},
        isInnerPageOptimize: false,
        optimizingInstanceData: {},
        isWad: false,
        selectedRowFsxId: null,
        driftAssessmentData: null,
        ...overrides.getWellOptimize
    };

    mockUseAppSelector.mockImplementation((selector: any) =>
        selector({
            inventoryV2: { selectedOptimizeConfig, breadCrumbSelectedFrom: 'Optimize' },
            databaseHome: { selectedRowsForOptimizeInnerPage: [] },
            getWellOptimize: gwBase,
            crrRedirection: { crrPrefetchLoading: false },
            auth: { isWorkloadFactory: false }
        })
    );
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('DynamicOptimizeInnerPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetColumnConfig.mockReturnValue(undefined);
        mockGetConfigEntry.mockReturnValue(undefined);
        mockGetOptimizeApiConfig.mockReturnValue(null);
        mockIsViewOnlyConfig.mockReturnValue(false);
        mockIsLinkedConfig.mockReturnValue(false);
        mockGetLinkedConfigNames.mockReturnValue([]);
    });

    // ── No-config guard ───────────────────────────────────────────────────────
    describe('no config guard', () => {
        it('shows no-configuration-selected message when selectedOptimizeConfig is null', () => {
            baseState({ selectedOptimizeConfig: null });
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByText('databases.well-architect.no-configuration-selected')).toBeTruthy();
            expect(screen.queryByTestId('dynamic-inner-table')).toBeNull();
        });

        it('shows no-configuration-selected message when type is absent (configId falsy)', () => {
            baseState({
                selectedOptimizeConfig: { type: '', engineType: 'mssql', data: { name: 'X', categories: [] } }
            });
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByText('databases.well-architect.no-configuration-selected')).toBeTruthy();
        });
    });

    // ── isPatchConfig ─────────────────────────────────────────────────────────
    describe('isPatchConfig', () => {
        it('is false when getConfigEntry returns undefined → table not rendered', () => {
            baseState();
            mockGetConfigEntry.mockReturnValue(undefined);
            mockGetColumnConfig.mockReturnValue(undefined);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.queryByTestId('dynamic-inner-table')).toBeNull();
        });

        it('is false when showPatchTable is absent in entry → table not rendered', () => {
            baseState();
            mockGetConfigEntry.mockReturnValue({ dialogContent: { features: {} } });
            mockGetColumnConfig.mockReturnValue(undefined);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.queryByTestId('dynamic-inner-table')).toBeNull();
        });

        it('is true when showPatchTable=true → renders DynamicInnerTable without columnConfig', () => {
            baseState();
            mockGetConfigEntry.mockReturnValue({
                dialogContent: { features: { showPatchTable: true } }
            });
            mockGetColumnConfig.mockReturnValue(undefined);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('dynamic-inner-table')).toBeTruthy();
        });

        it('is false when showPatchTable=false → table not rendered', () => {
            baseState();
            mockGetConfigEntry.mockReturnValue({
                dialogContent: { features: { showPatchTable: false } }
            });
            mockGetColumnConfig.mockReturnValue(undefined);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.queryByTestId('dynamic-inner-table')).toBeNull();
        });
    });

    // ── columnConfig / table routing ──────────────────────────────────────────
    describe('table routing', () => {
        it('renders DynamicInnerTable when columnConfig is defined (useNestedExpandable absent)', () => {
            baseState();
            mockGetColumnConfig.mockReturnValue({ resourceTypeLabel: 'Volume' });
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('dynamic-inner-table')).toBeTruthy();
            expect(screen.queryByTestId('nested-inner-table')).toBeNull();
        });

        it('renders NestedDynamicInnerTable when useNestedExpandable=true', () => {
            baseState();
            mockGetColumnConfig.mockReturnValue({ useNestedExpandable: true });
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('nested-inner-table')).toBeTruthy();
            expect(screen.queryByTestId('dynamic-inner-table')).toBeNull();
        });

        it('renders CloneTabs and no table when configId is clone-management', () => {
            baseState({
                selectedOptimizeConfig: {
                    type: 'clone-management',
                    engineType: 'mssql',
                    data: { name: 'Clone cleanup', categories: [] }
                }
            });
            mockGetColumnConfig.mockReturnValue({ resourceTypeLabel: 'Clone' });
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('clone-tabs')).toBeTruthy();
            expect(screen.queryByTestId('dynamic-inner-table')).toBeNull();
        });
    });

    // ── canOptimize ───────────────────────────────────────────────────────────
    describe('canOptimize', () => {
        it('passes canOptimize=true to DynamicInnerTable when getOptimizeApiConfig returns truthy', () => {
            baseState();
            mockGetColumnConfig.mockReturnValue({ resourceTypeLabel: 'Volume' });
            mockGetOptimizeApiConfig.mockReturnValue({ mutation: 'someApi', statusType: 'some' });
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('dynamic-inner-table').getAttribute('data-can-optimize')).toBe('true');
        });

        it('passes canOptimize=false when getOptimizeApiConfig returns null', () => {
            baseState();
            mockGetColumnConfig.mockReturnValue({ resourceTypeLabel: 'Volume' });
            mockGetOptimizeApiConfig.mockReturnValue(null);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('dynamic-inner-table').getAttribute('data-can-optimize')).toBe('false');
        });
    });

    // ── isViewOnly ────────────────────────────────────────────────────────────
    describe('isViewOnly', () => {
        it('passes isViewOnly=true to DynamicInnerTable when isViewOnlyConfig returns true', () => {
            baseState();
            mockGetColumnConfig.mockReturnValue({ resourceTypeLabel: 'Volume' });
            mockIsViewOnlyConfig.mockReturnValue(true);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('dynamic-inner-table').getAttribute('data-is-view-only')).toBe('true');
        });

        it('passes isViewOnly=false when isViewOnlyConfig returns false', () => {
            baseState();
            mockGetColumnConfig.mockReturnValue({ resourceTypeLabel: 'Volume' });
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('dynamic-inner-table').getAttribute('data-is-view-only')).toBe('false');
        });
    });

    // ── linkedConfigNames / banner ────────────────────────────────────────────
    describe('linkedConfigBanner', () => {
        it('shows banner for Oracle config with showLinkedConfigBanner=true and isLinkedConfig=true', () => {
            baseState({
                selectedOptimizeConfig: {
                    type: 'oracle-placement',
                    engineType: 'oracle',
                    data: { name: 'Oracle Placement', categories: [] }
                }
            });
            mockGetConfigEntry.mockReturnValue({
                dialogContent: { features: { showLinkedConfigBanner: true } }
            });
            mockIsLinkedConfig.mockReturnValue(true);
            mockGetLinkedConfigNames.mockReturnValue(['oracle-binary-placement']);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('linked-config-banner')).toBeTruthy();
        });

        it('does not show banner for MSSQL (non-Oracle) config', () => {
            baseState();
            mockGetConfigEntry.mockReturnValue({
                dialogContent: { features: { showLinkedConfigBanner: true } }
            });
            mockIsLinkedConfig.mockReturnValue(true);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.queryByTestId('linked-config-banner')).toBeNull();
        });

        it('does not show banner when isLinkedConfig=false', () => {
            baseState({
                selectedOptimizeConfig: {
                    type: 'oracle-placement',
                    engineType: 'oracle',
                    data: { name: 'Oracle Placement', categories: [] }
                }
            });
            mockGetConfigEntry.mockReturnValue({
                dialogContent: { features: { showLinkedConfigBanner: true } }
            });
            mockIsLinkedConfig.mockReturnValue(false);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.queryByTestId('linked-config-banner')).toBeNull();
        });

        it('does not show banner when showLinkedConfigBanner is absent', () => {
            baseState({
                selectedOptimizeConfig: {
                    type: 'oracle-placement',
                    engineType: 'oracle',
                    data: { name: 'Oracle Placement', categories: [] }
                }
            });
            mockGetConfigEntry.mockReturnValue({ dialogContent: { features: {} } });
            mockIsLinkedConfig.mockReturnValue(true);
            render(<DynamicOptimizeInnerPage />);
            expect(screen.queryByTestId('linked-config-banner')).toBeNull();
        });
    });

    // ── handleBackToWellArchitected ───────────────────────────────────────────
    describe('handleBackToWellArchitected', () => {
        it('dispatches OPTIMIZE tab for MSSQL when breadcrumb[1] is clicked', () => {
            baseState();
            render(<DynamicOptimizeInnerPage />);
            fireEvent.click(screen.getByTestId('breadcrumb-1'));
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setSelectedHeaderTab', payload: 'Optimize' })
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setLandingFromInnerPage', payload: true })
            );
        });

        it('dispatches ORACLE_WELL_ARCHITECTED tab for Oracle when breadcrumb[1] is clicked', () => {
            baseState({
                selectedOptimizeConfig: {
                    type: 'oracle-config',
                    engineType: 'oracle',
                    data: { name: 'Oracle Config', categories: [] }
                }
            });
            render(<DynamicOptimizeInnerPage />);
            fireEvent.click(screen.getByTestId('breadcrumb-1'));
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedHeaderTab',
                    payload: 'Oracle Well Architected'
                })
            );
        });
    });

    // ── isInnerPageOptimize effect ────────────────────────────────────────────
    describe('isInnerPageOptimize effect', () => {
        it('dispatches navigation actions when isInnerPageOptimize=true (MSSQL)', () => {
            baseState({ getWellOptimize: { isInnerPageOptimize: true } });
            render(<DynamicOptimizeInnerPage />);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setIsInnerPageOptimize', payload: false })
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setLandingFromInnerPage', payload: true })
            );
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'setSelectedHeaderTab', payload: 'Optimize' })
            );
        });

        it('dispatches ORACLE_WELL_ARCHITECTED when isInnerPageOptimize=true for Oracle', () => {
            baseState({
                selectedOptimizeConfig: {
                    type: 'oracle-config',
                    engineType: 'oracle',
                    data: { name: 'Oracle Config', categories: [] }
                },
                getWellOptimize: { isInnerPageOptimize: true }
            });
            render(<DynamicOptimizeInnerPage />);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'setSelectedHeaderTab',
                    payload: 'Oracle Well Architected'
                })
            );
        });

        it('does not dispatch navigation when isInnerPageOptimize=false', () => {
            baseState({ getWellOptimize: { isInnerPageOptimize: false } });
            render(<DynamicOptimizeInnerPage />);
            expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'setIsInnerPageOptimize' }));
        });
    });

    // ── cloneDashboardData effect ─────────────────────────────────────────────
    describe('cloneDashboardData effect', () => {
        it('dispatches setCloneDashboardData when configId is clone-management with cloneDetails', () => {
            baseState({
                selectedOptimizeConfig: {
                    type: 'clone-management',
                    engineType: 'mssql',
                    data: {
                        name: 'Clone cleanup',
                        categories: [],
                        cloneDetails: [
                            {
                                databaseHostId: 'h1',
                                databaseInstanceName: 'inst1',
                                regionId: 'us-east-1',
                                credentialId: 'cred1'
                            }
                        ]
                    }
                }
            });
            render(<DynamicOptimizeInnerPage />);
            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setCloneDashboardData' }));
        });

        it('does not dispatch setCloneDashboardData when configId is not clone-management', () => {
            baseState();
            render(<DynamicOptimizeInnerPage />);
            expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'setCloneDashboardData' }));
        });

        it('does not dispatch setCloneDashboardData when cloneDetails is absent', () => {
            baseState({
                selectedOptimizeConfig: {
                    type: 'clone-management',
                    engineType: 'mssql',
                    data: { name: 'Clone cleanup', categories: [] }
                }
            });
            render(<DynamicOptimizeInnerPage />);
            expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'setCloneDashboardData' }));
        });
    });

    // ── basic render ──────────────────────────────────────────────────────────
    describe('basic render', () => {
        it('renders OptimizeCard and displayName', () => {
            baseState();
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('optimize-card')).toBeTruthy();
            expect(screen.getAllByText('Some Config').length).toBeGreaterThan(0);
        });

        it('renders TagComponent', () => {
            baseState();
            render(<DynamicOptimizeInnerPage />);
            expect(screen.getByTestId('tag-component')).toBeTruthy();
        });
    });
});
