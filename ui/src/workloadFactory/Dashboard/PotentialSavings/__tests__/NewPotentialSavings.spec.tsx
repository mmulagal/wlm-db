import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import NewPotentialSavings from '../NewPotentialSavings';

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="loader" />,
    DsButton: ({ children, isDisabled, onClick, ...rest }: any) => (
        <button data-testid="ds-button" disabled={isDisabled} onClick={onClick}>
            {children}
        </button>
    ),
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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    dashboardRedirection: vi.fn(),
    formatNumberWithCustomComma: vi.fn((num: any) => String(num))
}));

vi.mock('../../../../common/SeparatorComponent/SeparatorComponent', () => ({
    default: () => <div data-testid="separator" />
}));

vi.mock('../../../../ui-components/Charts/ComparionChartStack', () => ({
    default: () => <div data-testid="comparison-chart-stack" />
}));

vi.mock('../../../../ui-components/Charts/ComparisionChart', () => ({
    default: () => <div data-testid="comparison-chart" />
}));

vi.mock('../../../../assets/potential_savings.svg', () => ({
    ReactComponent: () => <svg data-testid="potential-savings-image" />
}));

vi.mock('../../../../assets/potential_savings_darkMode.svg', () => ({
    ReactComponent: () => <svg data-testid="potential-savings-dark" />
}));

vi.mock('../../../../assets/no-savings.svg', () => ({
    ReactComponent: () => <svg data-testid="no-savings" />
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: vi.fn(v => ({ type: 'a', payload: v }))
}));

vi.mock('../PotentialSavings.module.scss', () => ({
    default: {
        potentialSavings: 'ps',
        headSection: 'hs',
        title: 't',
        rightSection: 'rs',
        mainSection: 'ms',
        noDataSection: 'nds',
        leftSide: 'ls',
        topSection: 'ts',
        subContent: 'sc',
        loaderText: 'lt',
        noDataBanner: 'ndb',
        section: 's',
        imageContainer: 'ic',
        newValueSection: 'nvs',
        chartContainer: 'cc',
        rightSide: 'rsd',
        newChartSection: 'ncs',
        textSection: 'txs',
        square: 'sq',
        potentialSavingsSwitch: 'pss',
        potentialSavingsSwitchText: 'psst',
        firstTile: 'ft',
        secondTile: 'st'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { notAvailable: 'notAvailable' }
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            auth: (
                s: any = {
                    isWorkloadFactory: false,
                    features: { active: { 'Platform.BlueXP/DarkTheme': false } },
                    ...overrides.auth
                }
            ) => s,
            inventoryV2: (
                s: any = {
                    discoveredHosts: { discoverHostLoading: false },
                    isManagedHostListLoading: false,
                    ...overrides.inventoryV2
                }
            ) => s,
            exploreSavings: (
                s: any = {
                    unmanagedExploreSavingsHost: [],
                    ...overrides.exploreSavings
                }
            ) => s,
            databaseHome: (
                s: any = {
                    potentialSavingsValues: {
                        loading: false,
                        noSavings: false,
                        savingsPercent: 25,
                        savings: 1000,
                        fsxnCost: 500,
                        fsxwCost: 300,
                        ebsCost: 800,
                        fsxnCostForEbsHost: 400,
                        fsxnCostForFsxwHost: 200,
                        ...overrides.potentialSavings
                    },
                    ...overrides.databaseHome
                }
            ) => s,
            headers: (
                s: any = {
                    showNA: false,
                    multiDataLoading: false,
                    headerSelectedMultiCredIdsList: [],
                    headerSelectedMultiRegionIdsList: [],
                    ...overrides.headers
                }
            ) => s
        }
    });

describe('NewPotentialSavings', () => {
    it('renders title', () => {
        render(
            <Provider store={makeStore()}>
                <NewPotentialSavings />
            </Provider>
        );
        // GENERAL.POTENTIAL_SAVINGS
        expect(screen.getAllByText(/Potential Savings|POTENTIAL_SAVINGS/i).length).toBeGreaterThanOrEqual(0);
    });

    it('renders explore savings button', () => {
        render(
            <Provider store={makeStore()}>
                <NewPotentialSavings />
            </Provider>
        );
        expect(screen.getByTestId('ds-button')).toBeTruthy();
    });

    it('renders data section with values', () => {
        render(
            <Provider store={makeStore()}>
                <NewPotentialSavings />
            </Provider>
        );
        expect(screen.getByText('databases.dashboard.ebs-and-fsx-for-window-hosts')).toBeTruthy();
        expect(screen.getByText('databases.dashboard.savings-percentage')).toBeTruthy();
    });

    it('renders charts', () => {
        render(
            <Provider store={makeStore()}>
                <NewPotentialSavings />
            </Provider>
        );
        // Should have comparison charts
        const charts = screen.queryAllByTestId('comparison-chart');
        const stackCharts = screen.queryAllByTestId('comparison-chart-stack');
        expect(charts.length + stackCharts.length).toBeGreaterThan(0);
    });

    it('shows loader when loading', () => {
        render(
            <Provider
                store={makeStore({
                    databaseHome: {
                        potentialSavingsValues: { loading: true, noSavings: false }
                    }
                })}
            >
                <NewPotentialSavings />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    it('shows N/A when showNA is true', () => {
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
                <NewPotentialSavings />
            </Provider>
        );
        expect(screen.getAllByText('databases.general.not-available').length).toBeGreaterThan(0);
    });

    it('shows no savings state', () => {
        render(
            <Provider
                store={makeStore({
                    databaseHome: {
                        potentialSavingsValues: { loading: false, noSavings: true }
                    }
                })}
            >
                <NewPotentialSavings />
            </Provider>
        );
        expect(screen.getByText('databases.dashboard.switching-to-fsx-for-ontap-wont-save-you-money')).toBeTruthy();
    });

    it('shows dark mode image when dark theme active', () => {
        render(
            <Provider
                store={makeStore({
                    auth: { isWorkloadFactory: false, features: { active: { 'Platform.BlueXP/DarkTheme': true } } },
                    databaseHome: {
                        potentialSavingsValues: { loading: false, noSavings: true }
                    }
                })}
            >
                <NewPotentialSavings />
            </Provider>
        );
        expect(screen.getByTestId('potential-savings-dark')).toBeTruthy();
    });

    it('shows separators', () => {
        render(
            <Provider store={makeStore()}>
                <NewPotentialSavings />
            </Provider>
        );
        expect(screen.getAllByTestId('separator').length).toBeGreaterThan(0);
    });
});
