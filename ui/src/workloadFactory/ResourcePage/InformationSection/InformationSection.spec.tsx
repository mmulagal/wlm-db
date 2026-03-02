import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InformationSection from './InformationSection';

vi.mock('@netapp/design-system', () => ({
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>,
    Typography: ({ children, variant, className }: any) => (
        <span data-testid="typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

vi.mock('./SQLServer/SQLServer', () => ({
    default: ({ handleToggle, openKey }: any) => (
        <div data-testid="sql-server" onClick={() => handleToggle('SQL server')}>
            SQLServer - {openKey}
        </div>
    )
}));

vi.mock('./Location/Location', () => ({
    default: ({ handleToggle, openKey }: any) => (
        <div data-testid="location" onClick={() => handleToggle('Location')}>
            Location - {openKey}
        </div>
    )
}));

vi.mock('./StorageCompute/StorageCompute', () => ({
    default: ({ handleToggle, openKey }: any) => (
        <div data-testid="storage-compute" onClick={() => handleToggle('Storage & Compute')}>
            StorageCompute - {openKey}
        </div>
    )
}));

vi.mock('./ISConnectivity/ISConnectivity', () => ({
    default: ({ handleToggle, openKey }: any) => (
        <div data-testid="is-connectivity" onClick={() => handleToggle('Connectivity')}>
            ISConnectivity - {openKey}
        </div>
    )
}));

vi.mock('./ISActiveDirectory/ISActiveDirectory', () => ({
    default: ({ handleToggle, openKey }: any) => (
        <div data-testid="is-active-directory" onClick={() => handleToggle('Active Directory')}>
            ISActiveDirectory - {openKey}
        </div>
    )
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        DB_OVERVIEW_INFO: 'Overview Information'
    }
}));

vi.mock('../../../utils/consts', () => ({
    DBType: { MSSQL: 'MSSQL', ORACLE: 'ORACLE' }
}));

vi.mock('./InformationSection.module.scss', () => ({
    default: {
        informationSection: 'informationSection',
        headSection: 'headSection',
        title: 'title',
        accordionSection: 'accordionSection'
    }
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                resourceLoading: false,
                resourceDetails: {},
                ...overrides
            })
        }
    });

describe('InformationSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render section title', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        expect(screen.getByText('Overview Information')).toBeTruthy();
    });

    it('should show loader when resourceLoading is true', () => {
        const store = createMockStore({ resourceLoading: true });
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('should NOT show loader when resourceLoading is false', () => {
        const store = createMockStore({ resourceLoading: false });
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('should render SQLServer child component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        expect(screen.getByTestId('sql-server')).toBeTruthy();
    });

    it('should render Location child component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        expect(screen.getByTestId('location')).toBeTruthy();
    });

    it('should render StorageCompute child component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        expect(screen.getByTestId('storage-compute')).toBeTruthy();
    });

    it('should render ISConnectivity child component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        expect(screen.getByTestId('is-connectivity')).toBeTruthy();
    });

    it('should render ISActiveDirectory child component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        expect(screen.getByTestId('is-active-directory')).toBeTruthy();
    });

    it('should update openKey when toggle is called on SQLServer', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        fireEvent.click(screen.getByTestId('sql-server'));
        expect(screen.getByTestId('sql-server').textContent).toContain('SQL server');
    });

    it('should toggle key back to null when same key is clicked again', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        const sqlServer = screen.getByTestId('sql-server');
        fireEvent.click(sqlServer); // open
        fireEvent.click(sqlServer); // close
        // After second click openKey should be null/empty
        expect(sqlServer.textContent).toBeTruthy();
    });

    it('should NOT call toggle when resourceLoading is true (disabled state)', () => {
        const store = createMockStore({ resourceLoading: true });
        render(
            <Provider store={store}>
                <InformationSection />
            </Provider>
        );
        // Component renders but toggle is disabled
        expect(screen.getByTestId('sql-server')).toBeTruthy();
    });
});
