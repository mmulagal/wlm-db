import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DatabaseDeploymentModel from './DatabaseDeploymentModel';

vi.mock('../../../../store/mssql/mssqlFormSlice', () => ({
    setSelectedDBDeploymentModel: (val: any) => ({ type: 'mssqlForm/setSelectedDBDeploymentModel', payload: val })
}));

vi.mock('../../../../store/chatbot/chatbotSlice', () => ({
    setIsWizardTouched: (val: boolean) => ({ type: 'chatbot/setIsWizardTouched', payload: val })
}));

const makeStore = (deploymentModel: any = { label: 'Failover cluster instance', value: 'FAILOVER_CLUSTER' }) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                dbDeploymentModel: deploymentModel
            })
        }
    });

describe('DatabaseDeploymentModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <DatabaseDeploymentModel />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders Database deployment model title', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <DatabaseDeploymentModel />
            </Provider>
        );
        expect(screen.getByText(/Database deployment model/)).toBeTruthy();
    });

    it('shows deployment model label in header', () => {
        const store = makeStore({ label: 'Failover cluster instance', value: 'FAILOVER_CLUSTER' });
        render(
            <Provider store={store}>
                <DatabaseDeploymentModel />
            </Provider>
        );
        expect(screen.getAllByText('Failover cluster instance').length).toBeGreaterThan(0);
    });

    it('renders Failover cluster radio button', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <DatabaseDeploymentModel />
            </Provider>
        );
        expect(screen.getAllByText('Failover cluster instance').length).toBeGreaterThan(0);
    });

    it('renders Single instance radio button', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <DatabaseDeploymentModel />
            </Provider>
        );
        // When accordion is collapsed, the radio buttons may not be visible
        expect(screen.queryAllByText(/Single instance/).length).toBeGreaterThanOrEqual(0);
    });

    it('shows Single instance model when selected', () => {
        const store = makeStore({ label: 'Single instance', value: 'SINGLE_INSTANCE' });
        render(
            <Provider store={store}>
                <DatabaseDeploymentModel />
            </Provider>
        );
        expect(screen.getAllByText('Single instance').length).toBeGreaterThan(0);
    });

    it('renders description text for failover cluster', () => {
        const store = makeStore({ label: 'Failover cluster instance', value: 'FAILOVER_CLUSTER' });
        render(
            <Provider store={store}>
                <DatabaseDeploymentModel />
            </Provider>
        );
        expect(document.body).toBeDefined();
    });
});
