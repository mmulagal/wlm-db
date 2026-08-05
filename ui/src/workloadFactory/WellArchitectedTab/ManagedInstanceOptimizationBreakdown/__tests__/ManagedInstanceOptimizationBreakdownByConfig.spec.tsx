import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import ManagedInstanceOptimizationBreakdownByConfig from '../ManagedInstanceOptimizationBreakdownByConfig';
import { getAssessmentGroupedByConfigurations } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import {
    getConfigStateList,
    getConfigStatsBucket,
    mapAssessmentSeverityToFilterLabel
} from '../../assessmentFormatUtils';
import { setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { setSelectedConfig } from '../../../../store/workloadFactory/databaseHomeSlice';
import { setLandingFrom, setSelectedConfigEngineType } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { setOptimizeInnerpageSummary } from '../../../GetWell/GetWellUtils';
import {
    ASSESSMENT_CONFIG_CATALOG_KEYS,
    CONFIG_STATES,
    CONFIG_STATES_UI,
    DBType,
    WLF_TABS
} from '../../../../utils/consts';

const { mockDispatch, mockWindowWidth, barComponentProps, mockUseResize } = vi.hoisted(() => ({
    mockDispatch: vi.fn(),
    mockWindowWidth: { value: 1920 },
    barComponentProps: [] as any[],
    mockUseResize: vi.fn(() => ({ width: mockWindowWidth.value }))
}));

vi.mock('@netapp/design-system', () => ({
    DsButton: ({ children, isDisabled, onClick, className, variant, isThin, type, ...rest }: any) => (
        <button
            {...rest}
            type={type === 'text' ? 'button' : type}
            className={className}
            disabled={isDisabled}
            onClick={onClick}
        >
            {children}
        </button>
    ),
    DsTypography: ({ children, variant }: any) => <span data-testid={`typography-${variant}`}>{children}</span>,
    FlashingDotsLoader: () => <div data-testid="loader" />,
    RadioButton: ({ children, isDisabled, isChecked, onChange }: any) => (
        <input
            type="radio"
            data-testid="radio-button"
            disabled={isDisabled}
            checked={isChecked}
            onChange={onChange}
            aria-label={children}
        />
    )
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsCheckbox: ({ title, onSelect, isSelected }: any) => (
        <button type="button" data-testid={`checkbox-${title}`} aria-pressed={isSelected} onClick={onSelect}>
            {title}
        </button>
    )
}));

vi.mock('@netapp/icons/ic_file.svg', () => ({
    ReactComponent: () => <svg data-testid="no-data-icon" />
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => mockDispatch };
});

vi.mock('../../../../assets/filter-icon.svg', () => ({
    ReactComponent: () => <svg data-testid="filter-icon" />
}));

vi.mock('../../../../common/SeparatorComponent/SeparatorComponent', () => ({
    default: () => <div data-testid="separator" />
}));

vi.mock('../../../../common/hooks/useResize', () => ({
    default: mockUseResize
}));

vi.mock('../../../Dashboard/BarComponent/BarComponent', () => ({
    default: (props: any) => {
        barComponentProps.push(props);
        return <div data-testid="bar-component">{props.headingText}</div>;
    }
}));

vi.mock('../../../DatabaseHomePage/DatabaseHomeUtils', () => ({
    getAssessmentGroupedByConfigurations: vi.fn()
}));

vi.mock('../../assessmentFormatUtils', () => ({
    mapAssessmentSeverityToFilterLabel: vi.fn(() => 'Critical'),
    getConfigStateList: vi.fn(() => [CONFIG_STATES.ACTIVE]),
    getConfigStatsBucket: vi.fn(() => ({
        total: 10,
        optimized: 5,
        dismissed: 0,
        activating: 0,
        nonScoring: 0
    }))
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: vi.fn(v => ({ type: 'setSelectedHeaderTab', payload: v }))
}));

vi.mock('../../../../store/workloadFactory/databaseHomeSlice', () => ({
    setSelectedConfig: vi.fn(v => ({ type: 'setSelectedConfig', payload: v }))
}));

vi.mock('../../../../store/workloadFactory/getWellOptimizeSlice', () => ({
    setLandingFrom: vi.fn(v => ({ type: 'setLandingFrom', payload: v })),
    setSelectedConfigEngineType: vi.fn(v => ({ type: 'setSelectedConfigEngineType', payload: v }))
}));

vi.mock('../../../GetWell/GetWellUtils', () => ({
    setOptimizeInnerpageSummary: vi.fn()
}));

vi.mock('../ManagedInstanceOptimizationBreakdownByConfig.module.scss', () => ({
    default: {
        managedBreakdown: 'mb',
        headSection: 'hs',
        filterSection: 'fs',
        radioSection: 'rs',
        rightSide: 'rsd',
        imageFilter: 'imf',
        loading: 'loading',
        popup: 'popup',
        headerContainer: 'hc',
        title: 'title',
        filterGrid: 'fg',
        column: 'col',
        itemWrapper: 'iw',
        item: 'item',
        footer: 'footer',
        buttonItem: 'bi',
        buttonItem1: 'bi1',
        mainSection: 'ms',
        withScrollbar: 'wsb',
        withoutScrollbar: 'wosb',
        noDataSection: 'nds',
        tile: 'tile',
        firstTile: 'ft',
        buttonContainer: 'bc'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { notAvailable: 'notAvailable' }
}));

const catalogEntry = {
    type: 'storage',
    severity: 'critical',
    name: 'Test Config'
};

const makeConfigData = (overrides: Record<string, unknown> = {}) => ({
    total: 1,
    oracleTotal: 0,
    mssqlConfigIds: ['cfg-1'],
    oracleConfigIds: ['cfg-oracle-1'],
    [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: {
        'cfg-1': catalogEntry,
        'cfg-oracle-1': { ...catalogEntry, name: 'Oracle Config' }
    },
    [ASSESSMENT_CONFIG_CATALOG_KEYS.MSSQL]: {
        'cfg-1': catalogEntry
    },
    [ASSESSMENT_CONFIG_CATALOG_KEYS.ORACLE]: {
        'cfg-oracle-1': { ...catalogEntry, name: 'Oracle Config' }
    },
    ...overrides
});

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            inventoryV2: (
                s: any = {
                    allmssqlHostAssessmentData: {},
                    allmssqlHostAssessmentLoading: false,
                    allOracleHostAssessmentData: {},
                    allOracleHostAssessmentLoading: false,
                    ...overrides.inventoryV2
                }
            ) => s,
            getWellOptimize: (
                s: any = {
                    inProgressOptimizationData: {},
                    configEngineType: DBType.MSSQL,
                    ...overrides.getWellOptimize
                }
            ) => s,
            headers: (
                s: any = {
                    showNA: false,
                    ...overrides.headers
                }
            ) => s
        }
    });

const renderComponent = (storeOverrides: any = {}) =>
    render(
        <Provider store={makeStore(storeOverrides)}>
            <ManagedInstanceOptimizationBreakdownByConfig />
        </Provider>
    );

const openFilterPopup = () => {
    fireEvent.click(screen.getByText('databases.well-architected-tab.filter-configuration'));
};

describe('ManagedInstanceOptimizationBreakdownByConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        barComponentProps.length = 0;
        mockWindowWidth.value = 1920;
        mockUseResize.mockImplementation(() => ({ width: mockWindowWidth.value }));
        vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(makeConfigData() as any);
        vi.mocked(mapAssessmentSeverityToFilterLabel).mockReturnValue('Critical');
        vi.mocked(getConfigStateList).mockReturnValue([CONFIG_STATES.ACTIVE]);
        vi.mocked(getConfigStatsBucket).mockReturnValue({
            total: 10,
            optimized: 5,
            dismissed: 0,
            activating: 0,
            nonScoring: 0
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('no-data state', () => {
        beforeEach(() => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue({
                total: 0,
                oracleTotal: 0,
                mssqlConfigIds: [],
                oracleConfigIds: [],
                [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: {}
            } as any);
        });

        it('shows no-data icon and text', () => {
            renderComponent();
            expect(screen.getByTestId('no-data-icon')).toBeTruthy();
            expect(screen.getByText('databases.dashboard.score-breakdown-no-data')).toBeTruthy();
        });

        it('disables radio buttons, filter, and reset', () => {
            renderComponent();
            screen.getAllByTestId('radio-button').forEach(radio => expect(radio).toBeDisabled());
            expect(screen.getByText('databases.well-architected-tab.filter-configuration')).toBeDisabled();
            expect(screen.getByText('databases.well-architected-tab.reset-to-default')).toBeDisabled();
        });

        it('keeps mssql selected when both engines have no data', () => {
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            expect(mockDispatch).toHaveBeenCalledWith(setSelectedConfigEngineType(DBType.MSSQL));
        });

        it('shows mssql radio checked when both engines have no data', () => {
            renderComponent({ getWellOptimize: { configEngineType: DBType.MSSQL } });
            expect(screen.getByLabelText(`${DBType.MSSQL} (0)`)).toBeChecked();
        });

        it('returns naCheck true when showNA is set', () => {
            renderComponent({ headers: { showNA: true } });
            expect(screen.getByTestId('no-data-icon')).toBeTruthy();
        });

        it('auto-selects Oracle when only Oracle data exists', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1, mssqlConfigIds: [] }) as any
            );
            renderComponent();
            expect(mockDispatch).toHaveBeenCalledWith(setSelectedConfigEngineType(DBType.ORACLE));
        });
    });

    describe('selected engine with no configurations', () => {
        beforeEach(() => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 1, oracleTotal: 0, oracleConfigIds: [] }) as any
            );
        });

        it('disables oracle radio and selects mssql when oracle has no configurations', () => {
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            expect(mockDispatch).toHaveBeenCalledWith(setSelectedConfigEngineType(DBType.MSSQL));
            expect(screen.getByLabelText(`${DBType.ORACLE} (0)`)).toBeDisabled();
            expect(screen.getByLabelText(`${DBType.MSSQL} (1)`)).not.toBeDisabled();
        });

        it('shows mssql tiles when oracle is empty and mssql is selected', () => {
            renderComponent({ getWellOptimize: { configEngineType: DBType.MSSQL } });
            expect(screen.getByLabelText(`${DBType.MSSQL} (1)`)).toBeChecked();
            expect(screen.getByTestId('bar-component')).toBeTruthy();
        });

        it('disables mssql radio and selects oracle when mssql has no configurations', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1, mssqlConfigIds: [] }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.MSSQL } });
            expect(mockDispatch).toHaveBeenCalledWith(setSelectedConfigEngineType(DBType.ORACLE));
            expect(screen.getByLabelText(`${DBType.MSSQL} (0)`)).toBeDisabled();
            expect(screen.getByLabelText(`${DBType.ORACLE} (1)`)).not.toBeDisabled();
        });

        it('shows oracle tiles when mssql is empty and oracle is selected', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1, mssqlConfigIds: [] }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            expect(screen.getByLabelText(`${DBType.ORACLE} (1)`)).toBeChecked();
            expect(screen.getByTestId('bar-component')).toBeTruthy();
        });
    });

    describe('header and loading', () => {
        it('renders card title', () => {
            renderComponent();
            expect(screen.getByText('databases.dashboard.well-architected-breakdown-by-configurations')).toBeTruthy();
        });

        it('shows loader while assessment data is loading', () => {
            renderComponent({ inventoryV2: { allOracleHostAssessmentLoading: true } });
            expect(screen.getByTestId('loader')).toBeTruthy();
        });
    });

    describe('config tiles and optimize', () => {
        it('renders bar tiles for visible configurations', () => {
            renderComponent();
            expect(screen.getByTestId('bar-component')).toBeTruthy();
            expect(screen.getByText('Test Config')).toBeTruthy();
        });

        it('hides tiles that fail filter visibility checks', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({
                    mssqlConfigIds: ['cfg-1', 'cfg-missing'],
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: { 'cfg-1': catalogEntry }
                }) as any
            );
            renderComponent();
            expect(screen.getAllByTestId('bar-component')).toHaveLength(1);
        });

        it('dispatches optimize navigation when view-and-fix is clicked', () => {
            renderComponent();
            fireEvent.click(screen.getByTestId('wlm-db-optimize-cfg-1'));
            expect(mockDispatch).toHaveBeenCalledWith(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
            expect(mockDispatch).toHaveBeenCalledWith(setLandingFrom(WLF_TABS.INVENTORY));
            expect(mockDispatch).toHaveBeenCalledWith(setSelectedConfig('cfg-1'));
            expect(setOptimizeInnerpageSummary).toHaveBeenCalledWith(
                'cfg-1',
                expect.any(Object),
                mockDispatch,
                DBType.MSSQL
            );
        });

        it('disables optimize button when optimization is in progress', () => {
            renderComponent({
                getWellOptimize: {
                    inProgressOptimizationData: { 'cfg-1': ['resource-1_step'] }
                }
            });
            expect(screen.getByTestId('wlm-db-optimize-cfg-1')).toBeDisabled();
        });

        it('shows filtered counts on radio labels when filters are applied', () => {
            renderComponent();
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.getByLabelText(`${DBType.MSSQL} (0/1)`)).toBeTruthy();
        });
    });

    describe('filter popup interactions', () => {
        it('opens and closes the filter popup via cancel', () => {
            renderComponent();
            openFilterPopup();
            expect(screen.getByText('databases.well-architected-tab.filter-by-categories')).toBeTruthy();
            fireEvent.click(screen.getByText('databases.well-architected-tab.cancel'));
            expect(screen.queryByText('databases.well-architected-tab.filter-by-categories')).toBeNull();
        });

        it('closes popup on outside click', () => {
            renderComponent();
            openFilterPopup();
            act(() => {
                document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            });
            expect(screen.queryByText('databases.well-architected-tab.filter-by-categories')).toBeNull();
        });

        it('does not close popup when clicking inside it', () => {
            renderComponent();
            openFilterPopup();
            const popup = screen.getByText('databases.well-architected-tab.filter-by-categories').closest('.popup');
            fireEvent.mouseDown(popup!);
            expect(screen.getByText('databases.well-architected-tab.filter-by-categories')).toBeTruthy();
        });

        it('toggles MSSQL category and severity selections then applies', () => {
            renderComponent();
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByTestId('checkbox-Critical'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.queryByText('databases.well-architected-tab.filter-by-categories')).toBeNull();
            expect(screen.getByLabelText(`${DBType.MSSQL} (0/1)`)).toBeTruthy();
        });

        it('resets MSSQL filters to defaults', () => {
            renderComponent();
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            const resetBtn = screen.getByText('databases.well-architected-tab.reset-to-default');
            expect(resetBtn).not.toBeDisabled();
            fireEvent.click(resetBtn);
            expect(screen.getByLabelText(`${DBType.MSSQL} (1)`)).toBeTruthy();
        });

        it('hides all tiles when all category and severity filters are cleared', () => {
            renderComponent();
            openFilterPopup();
            ['Storage', 'Compute', 'Application', 'Resiliency', 'Cloning', 'Critical', 'Warning'].forEach(option => {
                fireEvent.click(screen.getByTestId(`checkbox-${option}`));
            });
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.queryAllByTestId('bar-component')).toHaveLength(0);
            expect(screen.getByLabelText(`${DBType.MSSQL} (0/1)`)).toBeTruthy();
        });

        it('re-selects a category after deselecting it before apply', () => {
            renderComponent();
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.getAllByTestId('bar-component')).toHaveLength(1);
        });

        it('toggles oracle severity selection when oracle engine is active', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1 }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Critical'));
            fireEvent.click(screen.getByTestId('checkbox-Critical'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.getAllByTestId('bar-component')).toHaveLength(1);
        });

        it('toggles oracle category selection when oracle engine is active', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1 }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.getAllByTestId('bar-component')).toHaveLength(1);
        });

        it('toggles mssql severity selection when mssql engine is active', () => {
            renderComponent();
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Critical'));
            fireEvent.click(screen.getByTestId('checkbox-Critical'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.getAllByTestId('bar-component')).toHaveLength(1);
        });
    });

    describe('Oracle engine', () => {
        beforeEach(() => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1 }) as any
            );
        });

        it('switches to Oracle via radio and renders Oracle tiles', () => {
            renderComponent();
            fireEvent.click(screen.getByLabelText(`${DBType.ORACLE} (1)`));
            expect(mockDispatch).toHaveBeenCalledWith(setSelectedConfigEngineType(DBType.ORACLE));
        });

        it('toggles Oracle filters and resets Oracle defaults', () => {
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByTestId('checkbox-Critical'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.reset-to-default'));
            expect(screen.getByLabelText(`${DBType.ORACLE} (1)`)).toBeTruthy();
        });

        it('optimizes Oracle configuration from Oracle tile', () => {
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            fireEvent.click(screen.getByTestId('wlm-db-optimize-cfg-oracle-1'));
            expect(setOptimizeInnerpageSummary).toHaveBeenCalledWith(
                'cfg-oracle-1',
                expect.any(Object),
                mockDispatch,
                DBType.ORACLE
            );
        });
    });

    describe('bar rendering branches', () => {
        it('renders percentage for optimized configuration', () => {
            renderComponent();
            expect(barComponentProps[0].percentage).toBe(50);
            expect(barComponentProps[0].beforeOutOf).toBe(5);
            expect(barComponentProps[0].afterOutOf).toBe(10);
        });

        it('renders postponed message when config is postponed', () => {
            vi.mocked(getConfigStateList).mockReturnValue([CONFIG_STATES.POSTPONED]);
            renderComponent();
            expect(barComponentProps[0].textMessage).toBe(CONFIG_STATES_UI.POSTPONED);
            expect(barComponentProps[0].percentage).toBe(0);
        });

        it('renders dismissed message when config is dismissed', () => {
            vi.mocked(getConfigStateList).mockReturnValue([CONFIG_STATES.DISMISSED]);
            renderComponent();
            expect(barComponentProps[0].textMessage).toBe(CONFIG_STATES_UI.DISMISSED);
        });

        it('renders mixed-state tooltip when active and postponed', () => {
            vi.mocked(getConfigStateList).mockReturnValue([CONFIG_STATES.ACTIVE, CONFIG_STATES.POSTPONED]);
            renderComponent();
            expect(barComponentProps[0].tooltipMessage).toBe('databases.well-architect.mixed-state-config-tooltip');
        });

        it('renders mixed-state tooltip when active and dismissed', () => {
            vi.mocked(getConfigStateList).mockReturnValue([CONFIG_STATES.ACTIVE, CONFIG_STATES.DISMISSED]);
            renderComponent();
            expect(barComponentProps[0].tooltipMessage).toBe('databases.well-architect.mixed-state-config-tooltip');
        });

        it('returns empty helper text for unknown config states', () => {
            vi.mocked(getConfigStateList).mockReturnValue(['UNKNOWN']);
            renderComponent();
            expect(barComponentProps[0].textMessage).toBeUndefined();
            expect(barComponentProps[0].tooltipMessage).toBe('');
        });

        it('hides tiles when severity mapping is unavailable', () => {
            vi.mocked(mapAssessmentSeverityToFilterLabel).mockReturnValue(null as any);
            renderComponent();
            expect(screen.queryAllByTestId('bar-component')).toHaveLength(0);
        });

        it('applies loading class to filter icon while loading', () => {
            const { container } = renderComponent({
                inventoryV2: { allmssqlHostAssessmentLoading: true }
            });
            expect(container.querySelector('.imf.loading')).toBeTruthy();
        });

        it('ignores in-progress optimization when host id does not match', () => {
            renderComponent({
                inventoryV2: {
                    allmssqlHostAssessmentData: { hostKey: { databaseHostId: 'other-host' } }
                },
                getWellOptimize: {
                    inProgressOptimizationData: { 'cfg-1': ['host-1_step'] }
                }
            });
            expect(barComponentProps[0].optimizePercentage).toBe(0);
            expect(barComponentProps[0].loading).toBe(false);
        });

        it('uses dismissed loading state when config is postponed', () => {
            vi.mocked(getConfigStateList).mockReturnValue([CONFIG_STATES.POSTPONED]);
            renderComponent({ inventoryV2: { allmssqlHostAssessmentLoading: true } });
            expect(barComponentProps[0].loading).toBe(true);
        });

        it('renders not-available when scorable total is zero', () => {
            vi.mocked(getConfigStatsBucket).mockReturnValue({
                total: 0,
                optimized: 0,
                dismissed: 0,
                activating: 0,
                nonScoring: 0
            });
            renderComponent();
            expect(barComponentProps[0].percentage).toBe('databases.general.not-available');
            expect(barComponentProps[0].isDisabled).toBe(true);
        });

        it('renders not-available for Oracle tile when oracle total is zero', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 1, oracleTotal: 0 }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            expect(barComponentProps[0].percentage).toBe('databases.general.not-available');
        });

        it('renders not-available for MSSQL tile when mssql total is zero', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1, mssqlConfigIds: ['cfg-1'] }) as any
            );
            renderComponent();
            expect(barComponentProps[0].percentage).toBe('databases.general.not-available');
        });

        it('uses narrow bar width when viewport is <= 1700', () => {
            mockWindowWidth.value = 1500;
            renderComponent();
            expect(barComponentProps[0].width).toBe('248px');
        });

        it('shows in-progress optimization for matching MSSQL host', () => {
            renderComponent({
                inventoryV2: {
                    allmssqlHostAssessmentData: { hostKey: { databaseHostId: 'host-1' } }
                },
                getWellOptimize: {
                    inProgressOptimizationData: { 'cfg-1': ['host-1_step'] }
                }
            });
            expect(barComponentProps[0].optimizePercentage).toBe(10);
            expect(barComponentProps[0].loading).toBe(true);
        });

        it('shows in-progress optimization for matching Oracle host', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1 }) as any
            );
            renderComponent({
                inventoryV2: {
                    allOracleHostAssessmentData: { hostKey: { databaseHostId: 'host-2' } }
                },
                getWellOptimize: {
                    configEngineType: DBType.ORACLE,
                    inProgressOptimizationData: { 'cfg-oracle-1': ['host-2_step'] }
                }
            });
            expect(barComponentProps[0].optimizePercentage).toBe(10);
        });

        it('uses combined catalog entry when engine-specific catalog is missing', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.MSSQL]: {},
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: { 'cfg-1': catalogEntry }
                }) as any
            );
            renderComponent();
            expect(barComponentProps[0].headingText).toBe('Test Config');
        });

        it('falls back to config id when catalog name is missing', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: {
                        'cfg-1': { type: 'storage', severity: 'critical' }
                    },
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.MSSQL]: {
                        'cfg-1': { type: 'storage', severity: 'critical' }
                    }
                }) as any
            );
            renderComponent();
            expect(barComponentProps[0].headingText).toBe('cfg-1');
        });

        it('handles host assessment entries without databaseHostId during in-progress checks', () => {
            renderComponent({
                inventoryV2: {
                    allmssqlHostAssessmentData: { hostKey: null }
                },
                getWellOptimize: {
                    inProgressOptimizationData: { 'cfg-1': ['host-1_step'] }
                }
            });
            expect(barComponentProps[0].optimizePercentage).toBe(0);
        });

        it('handles missing in-progress config entries safely', () => {
            renderComponent({
                getWellOptimize: {
                    inProgressOptimizationData: { 'other-config': ['host-1_step'] }
                }
            });
            expect(barComponentProps[0].optimizePercentage).toBe(0);
        });

        it('handles oracle host assessment entries without databaseHostId', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1 }) as any
            );
            renderComponent({
                inventoryV2: {
                    allOracleHostAssessmentData: { hostKey: null }
                },
                getWellOptimize: {
                    configEngineType: DBType.ORACLE,
                    inProgressOptimizationData: { 'cfg-oracle-1': ['host-2_step'] }
                }
            });
            expect(barComponentProps[0].optimizePercentage).toBe(0);
        });
    });

    describe('scrollbar detection', () => {
        it('applies withScrollbar class when content overflows', async () => {
            vi.useFakeTimers();
            const { container } = renderComponent();
            const mainSection = container.querySelector('.ms') as HTMLElement;
            Object.defineProperty(mainSection, 'scrollHeight', { configurable: true, value: 500 });
            Object.defineProperty(mainSection, 'clientHeight', { configurable: true, value: 100 });
            await act(async () => {
                vi.advanceTimersByTime(100);
            });
            expect(mainSection.className).toContain('wsb');
        });
    });

    describe('engine radio switching', () => {
        it('switches back to MSSQL from Oracle', () => {
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            fireEvent.click(screen.getByLabelText(`${DBType.MSSQL} (1)`));
            expect(mockDispatch).toHaveBeenCalledWith(setSelectedConfigEngineType(DBType.MSSQL));
        });

        it('shows oracle filtered count label when oracle filters are applied', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1 }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.getByLabelText(`${DBType.ORACLE} (0/1)`)).toBeTruthy();
        });

        it('disables optimize button when oracle instance total is zero', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 1, oracleTotal: 0 }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            expect(screen.getByText('databases.well-architect.view-and-fix')).toBeDisabled();
        });

        it('counts oracle configs without catalog entries as filtered out', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({
                    total: 0,
                    oracleTotal: 2,
                    oracleConfigIds: ['cfg-oracle-1', 'cfg-oracle-missing'],
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: {
                        'cfg-oracle-1': { ...catalogEntry, name: 'Oracle Config' }
                    }
                }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.getByLabelText(`${DBType.ORACLE} (0/2)`)).toBeTruthy();
        });

        it('counts mssql configs without catalog entries as filtered out', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({
                    mssqlConfigIds: ['cfg-1', 'cfg-missing'],
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: { 'cfg-1': catalogEntry }
                }) as any
            );
            renderComponent();
            openFilterPopup();
            fireEvent.click(screen.getByTestId('checkbox-Storage'));
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.getByLabelText(`${DBType.MSSQL} (0/2)`)).toBeTruthy();
        });

        it('renders only the first tile with first-tile styling when multiple configs exist', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({
                    total: 2,
                    mssqlConfigIds: ['cfg-1', 'cfg-2'],
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.COMBINED]: {
                        'cfg-1': catalogEntry,
                        'cfg-2': { ...catalogEntry, name: 'Second Config' }
                    },
                    [ASSESSMENT_CONFIG_CATALOG_KEYS.MSSQL]: {
                        'cfg-1': catalogEntry,
                        'cfg-2': { ...catalogEntry, name: 'Second Config' }
                    }
                }) as any
            );
            const { container } = renderComponent();
            const tiles = container.querySelectorAll('.tile');
            expect(tiles).toHaveLength(2);
            expect(tiles[0].className).toContain('ft');
            expect(tiles[1].className).not.toContain('ft');
        });

        it('uses empty config id lists when engine config ids are missing', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({
                    mssqlConfigIds: undefined,
                    oracleConfigIds: undefined
                }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            expect(screen.queryAllByTestId('bar-component')).toHaveLength(0);
        });

        it('uses empty mssql config id list when ids are missing', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({
                    mssqlConfigIds: undefined,
                    oracleConfigIds: undefined,
                    total: 0,
                    oracleTotal: 0
                }) as any
            );
            renderComponent();
            expect(screen.queryAllByTestId('bar-component')).toHaveLength(0);
        });

        it('filters by severity only when categories are cleared', () => {
            renderComponent();
            openFilterPopup();
            ['Storage', 'Compute', 'Application', 'Resiliency', 'Cloning'].forEach(option => {
                fireEvent.click(screen.getByTestId(`checkbox-${option}`));
            });
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.queryAllByTestId('bar-component')).toHaveLength(0);
        });

        it('filters oracle configs by severity only when categories are cleared', () => {
            vi.mocked(getAssessmentGroupedByConfigurations).mockReturnValue(
                makeConfigData({ total: 0, oracleTotal: 1 }) as any
            );
            renderComponent({ getWellOptimize: { configEngineType: DBType.ORACLE } });
            openFilterPopup();
            ['Storage', 'Compute', 'Application', 'Resiliency', 'Cloning'].forEach(option => {
                fireEvent.click(screen.getByTestId(`checkbox-${option}`));
            });
            fireEvent.click(screen.getByText('databases.well-architected-tab.apply'));
            expect(screen.queryAllByTestId('bar-component')).toHaveLength(0);
            expect(screen.getByLabelText(`${DBType.ORACLE} (0/1)`)).toBeTruthy();
        });
    });
});
