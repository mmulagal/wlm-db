import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PostgreDeploymentModel from './PostgreDeploymentModel';

vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ children, title, ValueContent }: any) => (
        <div data-testid="accordion-card">
            <div data-testid="accordion-title">{title}</div>
            {ValueContent && (
                <div data-testid="accordion-value">
                    <ValueContent />
                </div>
            )}
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
    RadioButton: ({ children, isChecked, onChange, className, 'data-testid': testId }: any) => (
        <div>
            <input
                type="radio"
                data-testid={testId || 'radio-button'}
                checked={isChecked}
                onChange={onChange}
                readOnly={!onChange}
            />
            <label>{children}</label>
        </div>
    ),
    Typography: ({ children, variant, className, style }: any) => <div data-variant={variant}>{children}</div>
}));

vi.mock('./PostgreDeploymentModel.module.scss', () => ({
    default: {
        'db-deployment': 'db-deployment',
        failOver: 'failOver',
        radio: 'radio',
        separator: 'separator',
        failoverText: 'failoverText'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: { title: 'title', 'heading-content': 'heading-content' }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        FAILOVER_CLUSTER: 'Failover cluster instance (FCI)',
        HIGH_AVAILABILITY: 'High availability',
        SINGLE_INSTANCE: 'Single instance',
        STANDALONE_INSTANCE: 'Standalone instance',
        PGSQL_HA: 'Creates a highly available PostgreSQL cluster.',
        PGSQL_STANDALONE: 'Creates a single PostgreSQL instance.'
    }
}));

vi.mock('../../../utils/consts', () => ({
    SQL_DEPLOYMENT_MODE: {
        FAILOVER_CLUSTER_VALUE: 'fci',
        SINGLE_INSTANCE_VALUE: 'standalone'
    }
}));

vi.mock('../../../store/mssql/mssqlFormSlice', () => ({
    setSelectedDBDeploymentModel: (val: any) => ({ type: 'mssqlForm/setSelectedDBDeploymentModel', payload: val })
}));

const makeStore = (deploymentModelLabel: string) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                dbDeploymentModel: { label: deploymentModelLabel, value: 'fci' }
            })
        }
    });

describe('PostgreDeploymentModel', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={makeStore('Failover cluster instance (FCI)')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('renders "Deployment model" title', () => {
        render(
            <Provider store={makeStore('Failover cluster instance (FCI)')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        expect(screen.getByText('Deployment model')).toBeTruthy();
    });

    it('renders High availability label when deploymentModel is Failover cluster', () => {
        render(
            <Provider store={makeStore('Failover cluster instance (FCI)')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        expect(screen.getAllByText('High availability').length).toBeGreaterThan(0);
    });

    it('renders Standalone instance label when deploymentModel is Single instance', () => {
        render(
            <Provider store={makeStore('Single instance')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        expect(screen.getAllByText('Standalone instance').length).toBeGreaterThan(0);
    });

    it('shows "High availability" in header when Failover cluster is selected', () => {
        render(
            <Provider store={makeStore('Failover cluster instance (FCI)')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        // Header value content should show HA
        const valueEl = screen.getByTestId('accordion-value');
        expect(valueEl.textContent).toContain('High availability');
    });

    it('shows "Standalone instance" in header when Single instance is selected', () => {
        render(
            <Provider store={makeStore('Single instance')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        const valueEl = screen.getByTestId('accordion-value');
        expect(valueEl.textContent).toContain('Standalone instance');
    });

    it('renders HA radio button checked when Failover cluster selected', () => {
        render(
            <Provider store={makeStore('Failover cluster instance (FCI)')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        const haRadio = screen.getByTestId('wlm-db-deployment-model-high-availability') as HTMLInputElement;
        expect(haRadio.checked).toBe(true);
    });

    it('renders standalone radio button checked when Single instance selected', () => {
        render(
            <Provider store={makeStore('Single instance')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        const standaloneRadio = screen.getByTestId('wlm-db-deployment-model-standalone') as HTMLInputElement;
        expect(standaloneRadio.checked).toBe(true);
    });

    it('dispatches setSelectedDBDeploymentModel with HA values on HA radio change', () => {
        const store = makeStore('Single instance');
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <PostgreDeploymentModel />
            </Provider>
        );

        const haRadio = screen.getByTestId('wlm-db-deployment-model-high-availability');
        fireEvent.click(haRadio);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'mssqlForm/setSelectedDBDeploymentModel',
                payload: { label: 'Failover cluster instance (FCI)', value: 'fci' }
            })
        );
    });

    it('dispatches setSelectedDBDeploymentModel with standalone values on standalone radio change', () => {
        const store = makeStore('Failover cluster instance (FCI)');
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <PostgreDeploymentModel />
            </Provider>
        );

        const standaloneRadio = screen.getByTestId('wlm-db-deployment-model-standalone');
        fireEvent.click(standaloneRadio);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'mssqlForm/setSelectedDBDeploymentModel',
                payload: { label: 'Single instance', value: 'standalone' }
            })
        );
    });

    it('renders description texts for both options', () => {
        render(
            <Provider store={makeStore('Failover cluster instance (FCI)')}>
                <PostgreDeploymentModel />
            </Provider>
        );
        expect(screen.getByText('Creates a highly available PostgreSQL cluster.')).toBeTruthy();
        expect(screen.getByText('Creates a single PostgreSQL instance.')).toBeTruthy();
    });
});
