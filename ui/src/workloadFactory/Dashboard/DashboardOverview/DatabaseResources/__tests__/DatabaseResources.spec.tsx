import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { postBlueXPMessage } from '@tlveng/wlm-ds/src/hooks/useBlueXP';
import DatabaseResources from '../DatabaseResources';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('@netapp/design-system', () => ({
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsButton: ({ children, onClick, isDisabled, dropDown, type }: any) => (
        <div>
            <button data-testid={`ds-button-${type || 'default'}`} disabled={isDisabled} onClick={onClick}>
                {children}
            </button>
            {dropDown?.items?.map((item: any) => (
                <button key={item.id} data-testid={item.id} onClick={item.onClick} className={item.className}>
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

// Mock paths relative to __tests__ subfolder (add ../ compared to source imports)
vi.mock('../../DatabaseOverviewChart/DatabaseOverviewChart', () => ({
    default: (props: any) => <div data-testid="chart" />
}));

vi.mock('../../../../../common/Square/Square', () => ({
    default: (props: any) => <div data-testid="square" style={{ width: props.width, background: props.background }} />
}));

vi.mock('../../../../../common/SeparatorComponent/SeparatorComponent', () => ({
    default: (props: any) => <hr data-testid="separator" />
}));

vi.mock('../ResourcesTooltipComponent/ResourcesTooltipComponent', () => ({
    default: (props: any) => <div data-testid={`resources-tooltip-${props.type}`} />
}));

vi.mock('../../../../../assets/tooltipDisabled.svg', () => ({
    ReactComponent: () => <svg data-testid="tooltip-disabled-svg" />
}));

vi.mock('../DatabaseResources.module.scss', () => ({
    default: {
        databaseResources: 'dr',
        headSection: 'hs',
        title: 'tt',
        buttonContainer: 'bc',
        mainSection: 'ms',
        chartContainer: 'cc',
        infoContainer: 'ic',
        item: 'it',
        row: 'r',
        leftSide: 'ls',
        textClass: 'tc',
        tooltipSide: 'ts',
        tooltipDisabled: 'td',
        disabled: 'd'
    }
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            auth: (s: any = { isWorkloadFactory: false, ...overrides.auth }) => s,
            databaseHome: (
                s: any = {
                    aggregatedHostsCount: { totalInstances: 10, managedInstances: 8 },
                    aggregatedPgSqlHostsCount: { totalInstances: 5, managedInstances: 3 },
                    aggregatedOracleHostsCount: { totalInstances: 7, managedInstances: 4 },
                    ...overrides.databaseHome
                }
            ) => s,
            inventoryV2: (
                s: any = {
                    getDatabaseHosts: { databaseHostsLoading: false },
                    getPgSqlDatabaseHosts: { databaseHostsLoading: false },
                    getOracleDatabaseHosts: { databaseHostsLoading: false },
                    ...overrides.inventoryV2
                }
            ) => s,
            headers: (
                s: any = {
                    multiDataLoading: false,
                    showNA: false,
                    ...overrides.headers
                }
            ) => s
        }
    });

describe('DatabaseResources', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders database resources title', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.database-resources').length).toBeGreaterThan(0);
    });

    it('renders chart component', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getByTestId('chart')).toBeTruthy();
    });

    it('renders MSSQL section', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.microsoft-sql-server-instances').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.registered-instances').length).toBeGreaterThan(0);
    });

    it('renders Oracle section', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.oracle-databases').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.registered-databases').length).toBeGreaterThan(0);
    });

    it('renders PostgreSQL section', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.postgre-instances').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.deployed-instances').length).toBeGreaterThan(0);
    });

    it('renders separators', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByTestId('separator').length).toBeGreaterThan(0);
    });

    it('renders instance counts', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByText('10').length).toBeGreaterThan(0);
        expect(screen.getAllByText('8').length).toBeGreaterThan(0);
        expect(screen.getAllByText('7').length).toBeGreaterThan(0);
        expect(screen.getAllByText('4').length).toBeGreaterThan(0);
        expect(screen.getAllByText('5').length).toBeGreaterThan(0);
        expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    });

    // ── Deploy dropdown ──
    it('renders deploy database host dropdown', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getByTestId('wlm-db-deploy-mssql-host')).toBeTruthy();
        expect(screen.getByTestId('wlm-db-deploy-pgsql-host')).toBeTruthy();
    });

    it('handles deploy MSSQL host click (non-workload factory)', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('wlm-db-deploy-mssql-host'));
        expect(mockNavigate).toHaveBeenCalledWith('../../fsxdb/mssql-deploy-wizard');
    });

    it('handles deploy PgSQL host click (non-workload factory)', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('wlm-db-deploy-pgsql-host'));
        expect(mockNavigate).toHaveBeenCalledWith('../../fsxdb/postgreSQL-deploy-wizard');
    });

    it('handles deploy MSSQL host click (workload factory)', () => {
        render(
            <Provider store={makeStore({ auth: { isWorkloadFactory: true } })}>
                <DatabaseResources />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('wlm-db-deploy-mssql-host'));
        expect(mockNavigate).toHaveBeenCalledWith('../mssql-deploy-wizard');
    });

    it('handles deploy PgSQL host click (workload factory)', () => {
        render(
            <Provider store={makeStore({ auth: { isWorkloadFactory: true } })}>
                <DatabaseResources />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('wlm-db-deploy-pgsql-host'));
        expect(mockNavigate).toHaveBeenCalledWith('../postgreSQL-deploy-wizard');
    });

    // ── View non-registered buttons ──
    it('renders view non-registered instance buttons', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.view-non-registered-instances').length).toBeGreaterThan(0);
        expect(screen.getAllByText('databases.dashboard.view-non-registered-databases').length).toBeGreaterThan(0);
    });

    it('handles view non-registered MSSQL instances click (non-workload factory)', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        const buttons = screen.getAllByText('databases.dashboard.view-non-registered-instances');
        fireEvent.click(buttons[0]);
        expect(vi.mocked(postBlueXPMessage)).toHaveBeenCalled();
    });

    it('handles view non-registered Oracle databases click (non-workload factory)', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        const buttons = screen.getAllByText('databases.dashboard.view-non-registered-databases');
        fireEvent.click(buttons[0]);
        expect(vi.mocked(postBlueXPMessage)).toHaveBeenCalled();
    });

    it('handles view non-registered MSSQL instances click (workload factory)', () => {
        render(
            <Provider store={makeStore({ auth: { isWorkloadFactory: true } })}>
                <DatabaseResources />
            </Provider>
        );
        const buttons = screen.getAllByText('databases.dashboard.view-non-registered-instances');
        fireEvent.click(buttons[0]);
        expect(vi.mocked(postBlueXPMessage)).toHaveBeenCalled();
    });

    it('handles view non-registered Oracle databases click (workload factory)', () => {
        render(
            <Provider store={makeStore({ auth: { isWorkloadFactory: true } })}>
                <DatabaseResources />
            </Provider>
        );
        const buttons = screen.getAllByText('databases.dashboard.view-non-registered-databases');
        fireEvent.click(buttons[0]);
        expect(vi.mocked(postBlueXPMessage)).toHaveBeenCalled();
    });

    // ── Loading state ──
    it('renders loaders when loading', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        getDatabaseHosts: { databaseHostsLoading: true },
                        getPgSqlDatabaseHosts: { databaseHostsLoading: false },
                        getOracleDatabaseHosts: { databaseHostsLoading: false }
                    }
                })}
            >
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    it('renders loaders when pgsql loading', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        getDatabaseHosts: { databaseHostsLoading: false },
                        getPgSqlDatabaseHosts: { databaseHostsLoading: true },
                        getOracleDatabaseHosts: { databaseHostsLoading: false }
                    }
                })}
            >
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    it('renders loaders when oracle loading', () => {
        render(
            <Provider
                store={makeStore({
                    inventoryV2: {
                        getDatabaseHosts: { databaseHostsLoading: false },
                        getPgSqlDatabaseHosts: { databaseHostsLoading: false },
                        getOracleDatabaseHosts: { databaseHostsLoading: true }
                    }
                })}
            >
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0);
    });

    // ── showNA ──
    it('renders N/A state when showNA is true', () => {
        render(
            <Provider store={makeStore({ headers: { showNA: true, multiDataLoading: false } })}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByText('databases.general.not-available-table-columns').length).toBeGreaterThan(0);
    });

    it('renders tooltip disabled icons when showNA is true', () => {
        render(
            <Provider store={makeStore({ headers: { showNA: true, multiDataLoading: false } })}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByTestId('tooltip-disabled-svg').length).toBeGreaterThan(0);
    });

    // ── Tooltip when not loading and not NA ──
    it('renders tooltip info when not loading and not NA', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByTestId('tooltip-info').length).toBeGreaterThan(0);
        expect(screen.getByTestId('resources-tooltip-Microsoft SQL Server')).toBeTruthy();
        expect(screen.getByTestId('resources-tooltip-Oracle')).toBeTruthy();
        expect(screen.getByTestId('resources-tooltip-PostgreSQL')).toBeTruthy();
    });

    // ── Zero counts ──
    it('renders with zero instance counts', () => {
        render(
            <Provider
                store={makeStore({
                    databaseHome: {
                        aggregatedHostsCount: null,
                        aggregatedPgSqlHostsCount: null,
                        aggregatedOracleHostsCount: null
                    }
                })}
            >
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getByTestId('chart')).toBeTruthy();
    });

    // ── Overview text in sections ──
    it('renders overview text for each section', () => {
        render(
            <Provider store={makeStore()}>
                <DatabaseResources />
            </Provider>
        );
        expect(screen.getAllByText('databases.dashboard.overview').length).toBeGreaterThanOrEqual(3);
    });
});
