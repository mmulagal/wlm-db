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
                        totalEbsCost: 800,
                        totalFsxnCostForEbsHost: 400,
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
        expect(screen.getAllByText('databases.dashboard.potential-savings').length).toBeGreaterThan(0);
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

    describe('MSSQL-only host filtering for esCount', () => {
        const CRED_ID = 'cred-1';
        const REGION_ID = 'us-east-1';

        const baseHeaders = {
            showNA: false,
            multiDataLoading: false,
            headerSelectedMultiCredIdsList: [CRED_ID],
            headerSelectedMultiRegionIdsList: [REGION_ID]
        };

        const makeMssqlHost = (ec2InstanceId: string, storageType: string) => ({
            hostType: 'Microsoft SQL Server',
            credentialId: CRED_ID,
            regionId: REGION_ID,
            ec2InstanceId,
            storageType
        });

        const makeNonMssqlHost = (ec2InstanceId: string, storageType: string) => ({
            hostType: 'Oracle',
            credentialId: CRED_ID,
            regionId: REGION_ID,
            ec2InstanceId,
            storageType
        });

        it('counts only MSSQL hosts with EBS storage', () => {
            render(
                <Provider
                    store={makeStore({
                        exploreSavings: {
                            unmanagedExploreSavingsHost: [makeMssqlHost('i-001', 'EBS'), makeMssqlHost('i-002', 'EBS')]
                        },
                        headers: baseHeaders
                    })}
                >
                    <NewPotentialSavings />
                </Provider>
            );
            // esCount.ebs = 2, esCount.fsxw = 0 → total shown = 2
            const semiboldTypography = screen.getAllByTestId('typography-Semibold_20');
            const values = semiboldTypography.map(el => el.textContent);
            expect(values).toContain('2'); // ebs count
            expect(values).toContain('0'); // fsxw count
        });

        it('counts only MSSQL hosts with FSx for Windows storage', () => {
            render(
                <Provider
                    store={makeStore({
                        exploreSavings: {
                            unmanagedExploreSavingsHost: [
                                makeMssqlHost('i-003', 'FSx for Windows'),
                                makeMssqlHost('i-004', 'FSx for Windows')
                            ]
                        },
                        headers: baseHeaders
                    })}
                >
                    <NewPotentialSavings />
                </Provider>
            );
            // esCount.ebs = 0, esCount.fsxw = 2
            const semiboldTypography = screen.getAllByTestId('typography-Semibold_20');
            const values = semiboldTypography.map(el => el.textContent);
            expect(values).toContain('0'); // ebs count
            expect(values).toContain('2'); // fsxw count
        });

        it('counts Oracle hosts separately for EBS and alongside MSSQL for FSxW', () => {
            render(
                <Provider
                    store={makeStore({
                        exploreSavings: {
                            unmanagedExploreSavingsHost: [
                                makeNonMssqlHost('i-005', 'EBS'),
                                makeNonMssqlHost('i-006', 'FSx for Windows')
                            ]
                        },
                        headers: baseHeaders
                    })}
                >
                    <NewPotentialSavings />
                </Provider>
            );
            // Oracle EBS host → oracleEbs = 1; Oracle FSxW host → fsxw = 1 (rolled into sql-server-hosts card)
            const semiboldTypography = screen.getAllByTestId('typography-Semibold_20');
            const values = semiboldTypography.map(el => el.textContent);
            expect(values).toContain('1'); // oracle-hosts card (oracleEbs)
            expect(values).toContain('1'); // sql-server-hosts card (mssqlEbs + fsxw)
        });

        it('counts only MSSQL hosts when mixed with non-MSSQL hosts', () => {
            render(
                <Provider
                    store={makeStore({
                        exploreSavings: {
                            unmanagedExploreSavingsHost: [
                                makeMssqlHost('i-010', 'EBS'),
                                makeNonMssqlHost('i-011', 'EBS'),
                                makeMssqlHost('i-012', 'FSx for Windows'),
                                makeNonMssqlHost('i-013', 'FSx for Windows')
                            ]
                        },
                        headers: baseHeaders
                    })}
                >
                    <NewPotentialSavings />
                </Provider>
            );
            // Only MSSQL rows count: ebs = 1 (i-010), fsxw = 1 (i-012)
            const semiboldTypography = screen.getAllByTestId('typography-Semibold_20');
            const values = semiboldTypography.map(el => el.textContent);
            expect(values).toContain('1'); // both ebs and fsxw are 1
            expect(values).not.toContain('2');
        });

        it('deduplicates MSSQL hosts by ec2InstanceId', () => {
            render(
                <Provider
                    store={makeStore({
                        exploreSavings: {
                            unmanagedExploreSavingsHost: [
                                makeMssqlHost('i-020', 'EBS'),
                                makeMssqlHost('i-020', 'EBS') // duplicate ec2InstanceId
                            ]
                        },
                        headers: baseHeaders
                    })}
                >
                    <NewPotentialSavings />
                </Provider>
            );
            // Duplicate ec2InstanceId → only counted once → ebs = 1
            const semiboldTypography = screen.getAllByTestId('typography-Semibold_20');
            const values = semiboldTypography.map(el => el.textContent);
            expect(values).toContain('1');
        });
    });
});
