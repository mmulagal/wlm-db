import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import {
    getManagedOptimizationSummary,
    getAssessmentHostListGroupedByCategory
} from '../../../../DatabaseHomePage/DatabaseHomeUtils';
import { dashboardRedirectionToWellArchitected } from '../../../../../utils/utilityFunctions';

import WellArchitectedScore from '../WellArchitectedScore';

const mockSetDialog = vi.fn();
const mockCloseDialog = vi.fn();

vi.mock('@netapp/design-system', () => ({
    Popover: ({ children, container }: any) => (
        <div data-testid="popover">
            {container}
            {children}
        </div>
    ),
    useDialog: () => ({ setDialog: mockSetDialog, closeDialog: mockCloseDialog })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, isDisabled, isThin, variant, ...rest }: any) => (
        <button data-testid={rest['data-testid'] || 'ds-button'} disabled={isDisabled} onClick={onClick}>
            {children}
        </button>
    ),
    DsFlashingDotsLoader: () => <div data-testid="loader" />,
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    )
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return { ...actual, useDispatch: () => vi.fn() };
});

vi.mock('../WellArchitectChart/WellArchitectChart', () => ({
    default: (props: any) => <div data-testid="well-architect-chart" />
}));

vi.mock('../../../../../common/SeparatorComponent/SeparatorComponent', () => ({
    default: (props: any) => <hr data-testid="separator" />
}));

vi.mock('../../../../../common/Dialog/DialogComponent', () => ({
    default: (props: any) => (
        <div data-testid={props.testId}>
            <div>{props.header}</div>
            <div>{props.content}</div>
            <button data-testid="primary-btn" onClick={props.callback}>
                {props.primaryButton}
            </button>
            <button data-testid="secondary-btn" onClick={props.closeCallback}>
                {props.secondaryButton}
            </button>
        </div>
    )
}));

vi.mock(
    '../../../ManagedInstanceOptimizationBreakdownByCategory/CategoryDialogComponent/CategoryDialogComponent',
    () => ({
        default: (props: any) => <div data-testid="category-dialog" />
    })
);

vi.mock('../WellArchitectedScore.module.scss', () => ({
    default: {
        wellArchitectedScore: 'was',
        headSection: 'hs',
        title: 'tt',
        rightSection: 'rs',
        buttonContainer: 'bc',
        mainSection: 'ms',
        chartContainer: 'cc',
        textSection: 'ts',
        row: 'r',
        disabled: 'd',
        dialog: 'dlg'
    }
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: { notAvailable: 'na' }
}));

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: { CONTINUE: 'Continue', CANCEL: 'Cancel' }
}));

vi.mock('../../../../../store/store', () => ({
    default: {
        getState: () => ({
            databaseHome: {
                selectedAssessmentRow: {
                    type: 'MSSQL',
                    hostName: 'H1',
                    databaseHostId: 'h1',
                    instanceId: 'i1',
                    databaseInstanceName: 'I1',
                    credentialId: 'c1',
                    regionId: 'r1'
                }
            }
        })
    }
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    dashboardRedirection: vi.fn(),
    dashboardRedirectionToWellArchitected: vi.fn(),
    sortListOfDict: vi.fn((data: any) => data)
}));

vi.mock('../../../../DatabaseHomePage/DatabaseHomeUtils', () => ({
    getManagedOptimizationSummary: vi.fn(),
    getAssessmentHostListGroupedByCategory: vi.fn()
}));

const mockedGetManagedOptimizationSummary = vi.mocked(getManagedOptimizationSummary);
const mockedGetAssessmentHostListGroupedByCategory = vi.mocked(getAssessmentHostListGroupedByCategory);

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            inventoryV2: (
                s: any = {
                    allmssqlHostAssessmentLoading: false,
                    allmssqlHostAssessmentData: [],
                    allOracleHostAssessmentData: [],
                    allOracleHostAssessmentLoading: false,
                    ...overrides.inventoryV2
                }
            ) => s,
            headers: (
                s: any = {
                    headerSelectedMultiCredIdsList: ['cred1'],
                    headerSelectedMultiRegionIdsList: ['us-east-1'],
                    multiDataLoading: false,
                    showNA: false,
                    ...overrides.headers
                }
            ) => s,
            databaseHome: (
                s: any = {
                    selectedAssessmentRow: null,
                    ...overrides.databaseHome
                }
            ) => s
        }
    });

describe('WellArchitectedScore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetManagedOptimizationSummary.mockReturnValue({
            optimizedPercent: 75,
            optimizedConfigurations: 15,
            criticalConfigurations: 3,
            warningConfigurations: 2,
            totalConfigurations: 20,
            totalInstances: 20,
            hasDismissedOrPostponed: false
        });
        mockedGetAssessmentHostListGroupedByCategory.mockReturnValue([{ id: '1', status: 'Up', type: 'MSSQL' }]);
    });

    it('renders well-architected score title', () => {
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.well-architected-score').length).toBeGreaterThan(0);
    });

    it('renders chart component', () => {
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getByTestId('well-architect-chart')).toBeTruthy();
    });

    it('renders configuration summary rows', () => {
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.well-architected-configurations').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.non-optimal-config-critical').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.non-optimal-config-warning').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.total').length).toBeGreaterThan(0);
    });

    it('renders separator components', () => {
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByTestId('separator').length).toBeGreaterThan(0);
    });

    it('renders Investigate button', () => {
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.investigate').length).toBeGreaterThan(0);
    });

    // ── Loading state ──
    it('renders loaders when loading', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allmssqlHostAssessmentLoading: true,
                        allmssqlHostAssessmentData: [],
                        allOracleHostAssessmentData: [],
                        allOracleHostAssessmentLoading: false
                    }
                })}
            >
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    it('renders loaders when multiDataLoading', () => {
        render(
            <Provider
                store={makeStore({
                    headers: {
                        multiDataLoading: true,
                        showNA: false,
                        headerSelectedMultiCredIdsList: [],
                        headerSelectedMultiRegionIdsList: []
                    }
                })}
            >
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    // ── showNA ──
    it('renders N/A when showNA is true', () => {
        mockedGetManagedOptimizationSummary.mockReturnValue({
            optimizedPercent: 0,
            optimizedConfigurations: 0,
            criticalConfigurations: 0,
            warningConfigurations: 0,
            totalConfigurations: 0,
            totalInstances: 0,
            hasDismissedOrPostponed: false
        });
        render(
            <Provider
                store={makeStore({
                    headers: {
                        showNA: true,
                        multiDataLoading: false,
                        headerSelectedMultiCredIdsList: [],
                        headerSelectedMultiRegionIdsList: []
                    }
                })}
            >
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByText('databases.general.not-available').length).toBeGreaterThan(0);
    });

    // ── Popover hover ──
    it('renders popover with hover message', () => {
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getByTestId('popover')).toBeTruthy();
    });

    // ── Investigate button click ──
    it('calls dashboardRedirectionToWellArchitected when investigate clicked', () => {
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        const investigateBtn = screen.getByTestId('wlm-db-optimize-instances-by-category');
        fireEvent.click(investigateBtn);
        expect(vi.mocked(dashboardRedirectionToWellArchitected)).toHaveBeenCalled();
    });

    // ── Summary values rendered ──
    it('renders optimization summary values', () => {
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByText('15').length).toBeGreaterThan(0);
        expect(screen.getAllByText('3').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
        expect(screen.getAllByText('20').length).toBeGreaterThan(0);
    });

    // ── Oracle assessment loading ──
    it('renders loaders when oracle assessment loading', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allmssqlHostAssessmentLoading: false,
                        allOracleHostAssessmentLoading: true,
                        allmssqlHostAssessmentData: [],
                        allOracleHostAssessmentData: []
                    }
                })}
            >
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    // ── Zero summary values ──
    it('renders with zero summary values', () => {
        mockedGetManagedOptimizationSummary.mockReturnValue({
            optimizedPercent: 0,
            optimizedInstances: 0,
            criticalNotOptimizedInstances: 0,
            warningNotOptimizedInstances: 0,
            totalInstances: 0
        });
        render(
            <Provider store={makeStore()}>
                <WellArchitectedScore />
            </Provider>
        );
        expect(screen.getByTestId('well-architect-chart')).toBeTruthy();
    });
});
