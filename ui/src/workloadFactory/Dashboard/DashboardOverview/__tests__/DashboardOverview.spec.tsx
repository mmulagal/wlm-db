import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DashboardOverview from '../DashboardOverview';

vi.mock('../DatabaseResources/DatabaseResources', () => ({
    default: () => <div data-testid="database-resources" />
}));

vi.mock('../WellArchitectedScore/WellArchitectedScore', () => ({
    default: () => <div data-testid="well-architected-score" />
}));

vi.mock('../ErrorInvestigationOverview/ErrorInvestigationOverview', () => ({
    default: () => <div data-testid="error-investigation-overview" />
}));

vi.mock('../../PotentialSavings/NewPotentialSavings', () => ({
    default: () => <div data-testid="new-potential-savings" />
}));

vi.mock('../../../DatabaseHomePage/EstimatedCost/EstimatedCost', () => ({
    default: ({ hostData, hostsLoading }: any) => (
        <div data-testid="estimated-cost">{hostsLoading ? 'loading' : 'loaded'}</div>
    )
}));

vi.mock('../Sandboxes/Sanboxes', () => ({
    default: () => <div data-testid="sandboxes" />
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            databaseHome: (
                state = {
                    aggregatedCosts: { total: 100 },
                    ...overrides.databaseHome
                }
            ) => state,
            inventoryV2: (
                state = {
                    getDatabaseHosts: { fullHostDataLoading: false },
                    getPgSqlDatabaseHosts: { fullHostDataLoading: false },
                    ...overrides.inventoryV2
                }
            ) => state,
            headers: (
                state = {
                    multiDataLoading: false,
                    ...overrides.headers
                }
            ) => state
        }
    });

describe('DashboardOverview', () => {
    it('renders all child components', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardOverview />
            </Provider>
        );
        expect(screen.getByTestId('database-resources')).toBeTruthy();
        expect(screen.getByTestId('well-architected-score')).toBeTruthy();
        expect(screen.getByTestId('error-investigation-overview')).toBeTruthy();
        expect(screen.getByTestId('new-potential-savings')).toBeTruthy();
        expect(screen.getByTestId('estimated-cost')).toBeTruthy();
        expect(screen.getByTestId('sandboxes')).toBeTruthy();
    });

    it('passes loading state to EstimatedCost when mssql is loading', () => {
        const store = createMockStore({
            inventoryV2: {
                getDatabaseHosts: { fullHostDataLoading: true },
                getPgSqlDatabaseHosts: { fullHostDataLoading: false }
            }
        });
        render(
            <Provider store={store}>
                <DashboardOverview />
            </Provider>
        );
        expect(screen.getByText('loading')).toBeTruthy();
    });

    it('passes loading state to EstimatedCost when pgsql is loading', () => {
        const store = createMockStore({
            inventoryV2: {
                getDatabaseHosts: { fullHostDataLoading: false },
                getPgSqlDatabaseHosts: { fullHostDataLoading: true }
            }
        });
        render(
            <Provider store={store}>
                <DashboardOverview />
            </Provider>
        );
        expect(screen.getByText('loading')).toBeTruthy();
    });

    it('passes loading state to EstimatedCost when multiDataLoading', () => {
        const store = createMockStore({ headers: { multiDataLoading: true } });
        render(
            <Provider store={store}>
                <DashboardOverview />
            </Provider>
        );
        expect(screen.getByText('loading')).toBeTruthy();
    });

    it('shows loaded state when nothing is loading', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DashboardOverview />
            </Provider>
        );
        expect(screen.getByText('loaded')).toBeTruthy();
    });
});
