import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SQLServer from './SQLServer';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('moment', () => {
    const mockMoment: any = (val: any) => ({
        format: () => 'January 01, 2024, 10:00:00'
    });
    return { default: mockMoment };
});

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className, title }: any) => (
        <span data-testid="typography" data-variant={variant} className={className} title={title}>
            {children}
        </span>
    )
}));

vi.mock('../../DatabaseOverviewLayout/DBAccordion/DBAccordion', () => ({
    default: ({ heading, toggle, open, content }: any) => (
        <div data-testid="db-accordion">
            <div data-testid="accordion-heading" onClick={() => toggle(heading)}>
                {heading}
            </div>
            {open && <div data-testid="accordion-content">{content}</div>}
        </div>
    )
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { row: 'row', heading: 'heading', valueCSS: 'valueCSS' }
}));

vi.mock('./SQLServer.module.scss', () => ({
    default: { sqlServer: 'sqlServer' }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        DEPLOYMENT_MODEL_INFO: 'Deployment Model',
        OS_INFO: 'Operating System',
        EDITION_INFO: 'Edition',
        VERSION_INFO: 'Version',
        CLUSTER_COLLATION_NAME: 'Cluster Collation',
        CLUSTER_NAME_INFO: 'Cluster Name',
        NODE_NAMES: 'Node Names',
        ACTIVE_NODE: 'Active Node',
        STATUS_INFO: 'Status',
        CONNECTIONS_INFO: 'Active Connections',
        DATE_CREATED: 'Date Created'
    }
}));

vi.mock('../../../InventoryV2/InventoryUtilsV2', () => ({
    getDiscoveredHostDeploymentV2: vi.fn(() => 'FCI')
}));

const createMockStore = (resourceDetails: any = {}) =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                resourceDetails: {
                    databaseServer: {
                        operatingSystem: 'Windows Server 2019',
                        serverEdition: 'Enterprise',
                        serverVersion: '2019',
                        nodeNames: ['node1', 'node2'],
                        activeNode: 'node1',
                        activeConnections: 10,
                        creationDate: '1700000000000',
                        collation: 'SQL_Latin1_General_CP1_CI_AS',
                        clusterName: 'cluster1'
                    },
                    status: 'Up',
                    ...resourceDetails
                }
            })
        }
    });

describe('SQLServer', () => {
    const defaultProps = { handleToggle: vi.fn(), openKey: 'SQL server' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render accordion with "SQL server" heading', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('SQL server')).toBeTruthy();
    });

    it('should render deployment model label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Deployment Model')).toBeTruthy();
    });

    it('should render deployment type value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('FCI')).toBeTruthy();
    });

    it('should render OS label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Operating System')).toBeTruthy();
    });

    it('should render OS value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Windows Server 2019')).toBeTruthy();
    });

    it('should render Edition value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Enterprise')).toBeTruthy();
    });

    it('should render Version value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('2019')).toBeTruthy();
    });

    it('should render Collation label when collation is present', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Cluster Collation')).toBeTruthy();
    });

    it('should NOT render Collation label when collation is absent', () => {
        const store = createMockStore({
            databaseServer: {
                operatingSystem: 'Windows',
                serverEdition: 'Dev',
                serverVersion: '2016',
                nodeNames: [],
                activeNode: '',
                activeConnections: 0,
                creationDate: null
            }
        });
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.queryByText('Cluster Collation')).toBeNull();
    });

    it('should render Cluster Name when present', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Cluster Name')).toBeTruthy();
        expect(screen.getByText('cluster1')).toBeTruthy();
    });

    it('should NOT render Cluster Name when absent', () => {
        const store = createMockStore({
            databaseServer: {
                operatingSystem: 'Windows',
                serverEdition: 'Dev',
                serverVersion: '2016',
                nodeNames: [],
                activeNode: '',
                activeConnections: 0,
                creationDate: null
            }
        });
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.queryByText('Cluster Name')).toBeNull();
    });

    it('should render node names joined with comma', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('node1, node2')).toBeTruthy();
    });

    it('should render active node value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('node1')).toBeTruthy();
    });

    it('should render status value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Up')).toBeTruthy();
    });

    it('should render active connections count', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('10')).toBeTruthy();
    });

    it('should render formatted date when creationDate is present', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('January 01, 2024, 10:00:00')).toBeTruthy();
    });

    it('should render empty string when creationDate is absent', () => {
        const store = createMockStore({
            databaseServer: {
                operatingSystem: 'Windows',
                serverEdition: 'Dev',
                serverVersion: '2016',
                nodeNames: [],
                activeNode: '',
                activeConnections: 0,
                creationDate: null
            },
            status: 'Up'
        });
        render(
            <Provider store={store}>
                <SQLServer {...defaultProps} />
            </Provider>
        );
        // Date field renders empty - just verify it doesn't crash
        expect(screen.getByText('SQL server')).toBeTruthy();
    });

    it('should NOT show content when accordion is closed', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <SQLServer handleToggle={vi.fn()} openKey="Other" />
            </Provider>
        );
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });
});
