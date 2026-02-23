import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import CloudWatch from './CloudWatch';

vi.mock('../../../../store/mssql/mssqlFormSlice', () => ({
    setCloudWatch: (val: any) => ({ type: 'mssqlForm/setCloudWatch', payload: val })
}));

vi.mock('../../../../store/chatbot/chatbotSlice', () => ({
    setIsWizardTouched: (val: boolean) => ({ type: 'chatbot/setIsWizardTouched', payload: val })
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                cloudWatch: overrides.cloudWatch ?? false
            }),
            postgreForm: () => ({
                selectedDatabaseType: overrides.databaseType ?? 'mssql'
            }),
            auth: () => ({ isDemoMode: false })
        }
    });

describe('CloudWatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <CloudWatch />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders CloudWatch Monitoring title', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <CloudWatch />
            </Provider>
        );
        expect(screen.getByText(/CloudWatch [mM]onitoring/)).toBeTruthy();
    });

    it('shows Disabled in header when toggle is false', () => {
        const store = makeStore({ cloudWatch: false });
        render(
            <Provider store={store}>
                <CloudWatch />
            </Provider>
        );
        expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    });

    it('shows Enabled in header when toggle is true', () => {
        const store = makeStore({ cloudWatch: true });
        render(
            <Provider store={store}>
                <CloudWatch />
            </Provider>
        );
        expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0);
    });

    it('renders with MSSQL database type', () => {
        const store = makeStore({ databaseType: 'mssql' });
        render(
            <Provider store={store}>
                <CloudWatch wizardType="mssql" />
            </Provider>
        );
        expect(screen.getByText(/CloudWatch [mM]onitoring/)).toBeTruthy();
    });

    it('renders with pgsql database type', () => {
        const store = makeStore({ databaseType: 'pgsql' });
        render(
            <Provider store={store}>
                <CloudWatch wizardType="pgsql" />
            </Provider>
        );
        expect(screen.getByText(/CloudWatch [mM]onitoring/)).toBeTruthy();
    });

    it('renders without wizardType prop', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <CloudWatch />
            </Provider>
        );
        expect(container).toBeDefined();
    });
});
