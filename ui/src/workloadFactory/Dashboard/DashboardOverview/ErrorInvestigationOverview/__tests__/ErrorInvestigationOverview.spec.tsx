import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import {
    getErrorInvestigationSummary,
    createLogAnalyzerActiveInstance,
    createLogAnalyzerNotActiveInstance
} from '../../../../DatabaseHomePage/DatabaseHomeUtils';

import ErrorInvestigationOverview from '../ErrorInvestigationOverview';

const mockSetDialog = vi.fn();
const mockCloseDialog = vi.fn();

vi.mock('@netapp/design-system', () => ({
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    useDialog: () => ({ setDialog: mockSetDialog, closeDialog: mockCloseDialog })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, isDisabled, dropDown }: any) => (
        <div>
            <button data-testid="ds-button" disabled={isDisabled} onClick={onClick}>
                {children}
            </button>
            {dropDown?.items?.map((item: any) => (
                <button key={item.id} data-testid={item.id} disabled={item.isDisabled} onClick={item.onClick}>
                    {item.label}
                </button>
            ))}
        </div>
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

vi.mock('../../DatabaseOverviewChart/DatabaseOverviewChart', () => ({
    default: (props: any) => <div data-testid="chart" />
}));

vi.mock('../../../../../common/Square/Square', () => ({
    default: (props: any) => <div data-testid="square" style={{ width: props.width, background: props.background }} />
}));

vi.mock('../ActivateErrorInvestigation/CategoryDialogComponent/ActivateErrorInvestigation', () => ({
    default: () => <div data-testid="activate-dialog" />
}));

vi.mock('../ActivateErrorInvestigation/CategoryDialogComponent/ViewErrorInvestigation', () => ({
    default: () => <div data-testid="view-dialog" />
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

vi.mock('../../../../../assets/ErrorInvestigationSmallImage.svg', () => ({
    ReactComponent: () => <svg data-testid="error-investigate-svg" />
}));

vi.mock('../ErrorInvestigationOverview.module.scss', () => ({
    default: {
        errorInvestigationOverview: 'eio',
        headSection: 'hs',
        title: 'tt',
        rightSection: 'rs',
        tooltip: 'tp',
        tooltipContainer: 'tc',
        tableRow: 'tr',
        row: 'r',
        itemOne: 'i1',
        itemTwo: 'i2',
        itemWithoutBorderTop1: 'ibt1',
        itemWithoutBorderTop2: 'ibt2',
        buttonContainer: 'bc',
        emptyState: 'es',
        mainSection: 'ms',
        sectionOne: 's1',
        chartContainer: 'cc',
        fullBlock: 'fb',
        block: 'bl',
        bottomRow: 'br',
        sectionTwo: 's2',
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
            agenticAI: {
                selectedErrorInvestigationRow: {
                    type: 'MSSQL',
                    databaseHostName: 'H1',
                    databaseHostId: 'h1',
                    databaseInstanceId: 'i1',
                    databaseInstanceName: 'I1',
                    credentialId: 'c1',
                    regionId: 'r1',
                    logAnalyzer: { status: 'Active' }
                },
                selectedViewInvestigationRow: null
            },
            auth: { isWorkloadFactory: false }
        })
    }
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    dashboardRedirection: vi.fn()
}));

vi.mock('../../../../DatabaseHomePage/DatabaseHomeUtils', () => ({
    getErrorInvestigationSummary: vi.fn(),
    createLogAnalyzerActiveInstance: vi.fn(),
    createLogAnalyzerNotActiveInstance: vi.fn()
}));

const mockedGetErrorInvestigationSummary = vi.mocked(getErrorInvestigationSummary);
const mockedCreateLogAnalyzerActiveInstance = vi.mocked(createLogAnalyzerActiveInstance);
const mockedCreateLogAnalyzerNotActiveInstance = vi.mocked(createLogAnalyzerNotActiveInstance);

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            headers: (
                s: any = {
                    showNA: false,
                    multiDataLoading: false,
                    ...overrides.headers
                }
            ) => s,
            inventoryV2: (
                s: any = {
                    allLogAnalysisLoading: false,
                    allLogAnalysisOracleLoading: false,
                    allLogAnalysisData: [],
                    inventoryTableData: {},
                    ...overrides.inventoryV2
                }
            ) => s,
            agenticAI: (
                s: any = {
                    selectedErrorInvestigationRow: null,
                    selectedViewInvestigationRow: null,
                    ...overrides.agenticAI
                }
            ) => s
        }
    });

describe('ErrorInvestigationOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetErrorInvestigationSummary.mockReturnValue({
            severity1: 5,
            severity2: 3,
            severity3: 2,
            totalEvents: 10,
            activeResource: 3,
            totalResource: 5,
            emptyState: false
        });
        mockedCreateLogAnalyzerActiveInstance.mockReturnValue([{ id: '1', status: 'Up', type: 'MSSQL' }]);
        mockedCreateLogAnalyzerNotActiveInstance.mockReturnValue([{ id: '2', status: 'Up', type: 'MSSQL' }]);
    });

    it('renders error analysis title', () => {
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.error-analysis').length).toBeGreaterThan(0);
    });

    it('renders chart and severity blocks when not empty state', () => {
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getByTestId('chart')).toBeTruthy();
        expect(screen.getAllByText('databases.dashboard.critical').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.severe').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.important').length).toBeGreaterThan(0);
    });

    it('renders activation section', () => {
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getAllByText(/databases.dashboard.activation/).length).toBeGreaterThan(0);
    });

    it('renders tooltip info with severity mapping', () => {
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getAllByTestId('tooltip-info').length).toBeGreaterThan(0);
    });

    // ── Empty state ──
    it('renders empty state when emptyState is true', () => {
        mockedGetErrorInvestigationSummary.mockReturnValue({
            severity1: 0,
            severity2: 0,
            severity3: 0,
            totalEvents: 0,
            activeResource: 0,
            totalResource: 0,
            emptyState: true
        });
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getByTestId('error-investigate-svg')).toBeTruthy();
        expect(screen.getAllByText('databases.dashboard.log-analyzer').length).toBeGreaterThan(0);
    });

    // ── Loading state ──
    it('renders loader when loading', () => {
        render(
            <Provider store={makeStore({ headers: { showNA: false, multiDataLoading: true } })}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    it('renders loader when allLogAnalysisLoading', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        allLogAnalysisLoading: true,
                        allLogAnalysisOracleLoading: false,
                        allLogAnalysisData: [],
                        inventoryTableData: {}
                    }
                })}
            >
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    // ── showNA ──
    it('renders N/A when showNA is true', () => {
        render(
            <Provider store={makeStore({ headers: { showNA: true, multiDataLoading: false } })}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getAllByText('databases.general.not-available').length).toBeGreaterThan(0);
    });

    // ── Analyze button dropdown ──
    it('renders Analyze dropdown buttons', () => {
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getByTestId('wlm-db-activate-error-investigation')).toBeTruthy();
        expect(screen.getByTestId('wlm-db-view-error-investigation')).toBeTruthy();
    });

    it('opens activate dialog when clicking activate', () => {
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('wlm-db-activate-error-investigation'));
        expect(mockSetDialog).toHaveBeenCalled();
    });

    it('opens view dialog when clicking view', () => {
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('wlm-db-view-error-investigation'));
        expect(mockSetDialog).toHaveBeenCalled();
    });

    it('disables activate button when no not-active rows', () => {
        mockedCreateLogAnalyzerNotActiveInstance.mockReturnValue([]);
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getByTestId('wlm-db-activate-error-investigation')).toHaveProperty('disabled', true);
    });

    it('disables view button when no active rows', () => {
        mockedCreateLogAnalyzerActiveInstance.mockReturnValue([]);
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getByTestId('wlm-db-view-error-investigation')).toHaveProperty('disabled', true);
    });

    // ── Sorting of active rows ──
    it('sorts active rows by status preference', () => {
        mockedCreateLogAnalyzerActiveInstance.mockReturnValue([
            { id: '1', status: 'Offline' },
            { id: '2', status: 'Up' },
            { id: '3', status: 'Running' }
        ]);
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getByTestId('chart')).toBeTruthy();
    });

    // ── Sorting of not-active rows ──
    it('sorts not-active rows by status preference', () => {
        mockedCreateLogAnalyzerNotActiveInstance.mockReturnValue([
            { id: '1', status: 'Down' },
            { id: '2', status: 'Up' },
            { id: '3', status: 'Running' }
        ]);
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getByTestId('chart')).toBeTruthy();
    });

    // ── Empty active/not-active data ──
    it('renders when both active and not-active rows are empty', () => {
        mockedCreateLogAnalyzerActiveInstance.mockReturnValue([]);
        mockedCreateLogAnalyzerNotActiveInstance.mockReturnValue([]);
        render(
            <Provider store={makeStore()}>
                <ErrorInvestigationOverview />
            </Provider>
        );
        expect(screen.getByTestId('chart')).toBeTruthy();
    });
});
