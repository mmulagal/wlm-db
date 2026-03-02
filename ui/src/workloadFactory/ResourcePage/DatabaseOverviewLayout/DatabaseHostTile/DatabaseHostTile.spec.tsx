import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DatabaseHostTile from './DatabaseHostTile';

vi.mock('@netapp/design-system', () => ({
    FlashingDotsLoader: ({ className }: any) => (
        <div data-testid="flashing-dots-loader" className={className}>
            Loading...
        </div>
    ),
    Typography: ({ children, variant, className, title }: any) => (
        <span data-testid="typography" data-variant={variant} className={className} title={title}>
            {children}
        </span>
    )
}));

vi.mock('../../../../assets/Description Icons.svg', () => ({
    ReactComponent: () => <svg data-testid="description-icon" />
}));

vi.mock('../../../../assets/success.svg', () => ({
    ReactComponent: () => <svg data-testid="success-icon" />
}));

vi.mock('../../../../assets/error-icon.svg', () => ({
    ReactComponent: () => <svg data-testid="failure-icon" />
}));

vi.mock('./DatabaseHostTile.module.scss', () => ({
    default: {
        dbHostTile: 'dbHostTile',
        dbHostSection: 'dbHostSection',
        secondLevel: 'secondLevel',
        loaderHeight: 'loaderHeight',
        textManage: 'textManage',
        dbHostSeparator: 'dbHostSeparator',
        statusSection: 'statusSection',
        firstSection: 'firstSection',
        commonSection: 'commonSection',
        commonSectionLevel: 'commonSectionLevel'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        INSTANCE_NAME: 'Instance Name',
        STATUS: 'Status',
        NO_OF_DBS: 'No of DBs',
        SQL_VERSION: 'SQL Version',
        RESOURCE_DEPLOYMENT_MODEL: 'Deployment Model',
        RESOURCE_EDITION: 'Edition'
    }
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        workloadFactoryResource: {
            resourceLoading: false,
            resourceDetails: {
                status: 'Up',
                databaseCount: 5,
                databaseServer: {
                    serverVersion: '2019',
                    serverEdition: 'Enterprise'
                },
                topology: {
                    serverInstallationMode: 'Standalone'
                }
            },
            selectedHostname: 'host1',
            selectedDatabaseInstanceName: 'instance1',
            ...overrides
        }
    };
    return configureStore({
        reducer: {
            workloadFactoryResource: () => defaultState.workloadFactoryResource
        }
    });
};

describe('DatabaseHostTile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render description icon', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByTestId('description-icon')).toBeTruthy();
    });

    it('should render hostname and instance name when not loading', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByText('host1 \\ instance1')).toBeTruthy();
    });

    it('should show loader in hostname section when resourceLoading is true', () => {
        const store = createMockStore({ resourceLoading: true });
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        const loaders = screen.getAllByTestId('flashing-dots-loader');
        expect(loaders.length).toBeGreaterThan(0);
    });

    it('should render success icon when status is Up', () => {
        const store = createMockStore({
            resourceDetails: {
                status: 'Up',
                databaseCount: 1,
                databaseServer: { serverVersion: '2019', serverEdition: 'Enterprise' },
                topology: { serverInstallationMode: 'Standalone' }
            }
        });
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByTestId('success-icon')).toBeTruthy();
    });

    it('should render failure icon when status is not Up', () => {
        const store = createMockStore({
            resourceDetails: {
                status: 'Down',
                databaseCount: 1,
                databaseServer: { serverVersion: '2019', serverEdition: 'Enterprise' },
                topology: { serverInstallationMode: 'Standalone' }
            }
        });
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByTestId('failure-icon')).toBeTruthy();
    });

    it('should render database count', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByText('5')).toBeTruthy();
    });

    it('should render server version', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByText('2019')).toBeTruthy();
    });

    it('should render server edition', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByText('Enterprise')).toBeTruthy();
    });

    it('should render deployment model', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByText('Standalone')).toBeTruthy();
    });

    it('should show loaders in multiple sections when resourceLoading is true', () => {
        const store = createMockStore({ resourceLoading: true });
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        const loaders = screen.getAllByTestId('flashing-dots-loader');
        expect(loaders.length).toBeGreaterThanOrEqual(5);
    });

    it('should render label texts', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseHostTile />
            </Provider>
        );
        expect(screen.getByText('Instance Name')).toBeTruthy();
        expect(screen.getByText('Status')).toBeTruthy();
        expect(screen.getByText('No of DBs')).toBeTruthy();
        expect(screen.getByText('SQL Version')).toBeTruthy();
        expect(screen.getByText('Deployment Model')).toBeTruthy();
        expect(screen.getByText('Edition')).toBeTruthy();
    });
});
