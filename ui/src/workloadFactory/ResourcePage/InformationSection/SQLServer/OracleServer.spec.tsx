import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import OracleServer from './OracleServer';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.oracle-inner-page.oracle-server': 'Oracle server'
            };
            return map[key] || key;
        }
    })
}));

vi.mock('moment', () => {
    const mockMoment: any = (val: any) => ({
        format: () => 'January 01, 2024, 10:00:00 AM'
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
        NODE_NAMES: 'Node Names',
        STATUS_INFO: 'Status',
        CONNECTIONS_INFO: 'Active Connections',
        DATE_CREATED: 'Date Created'
    }
}));

const createMockStore = (oracleDetails: any = {}) =>
    configureStore({
        reducer: {
            oracleSlice: () => ({
                resourceDetails: {
                    topology: { serverInstallationMode: 'Standalone' },
                    databaseServer: {
                        operatingSystem: 'Oracle Linux 8',
                        serverEdition: 'Enterprise Edition',
                        serverVersion: '19c',
                        nodeNames: ['oraNode1'],
                        activeConnections: 20,
                        creationDate: '2024-01-01T00:00:00Z'
                    },
                    status: 'Up',
                    ...oracleDetails
                }
            })
        }
    });

describe('OracleServer', () => {
    const defaultProps = { handleToggle: vi.fn(), openKey: 'Oracle server' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render accordion with "Oracle server" heading', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Oracle server')).toBeTruthy();
    });

    it('should render Deployment Model label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Deployment Model')).toBeTruthy();
    });

    it('should render serverInstallationMode value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Standalone')).toBeTruthy();
    });

    it('should render Operating System label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Operating System')).toBeTruthy();
    });

    it('should render OS value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Oracle Linux 8')).toBeTruthy();
    });

    it('should render Edition value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Enterprise Edition')).toBeTruthy();
    });

    it('should render Version value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('19c')).toBeTruthy();
    });

    it('should render Node Names joined', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('oraNode1')).toBeTruthy();
    });

    it('should render Status value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Up')).toBeTruthy();
    });

    it('should render Active Connections count', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('20')).toBeTruthy();
    });

    it('should render formatted creation date when creationDate is present', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('January 01, 2024, 10:00:00 AM')).toBeTruthy();
    });

    it('should render empty string when creationDate is absent', () => {
        const store = createMockStore({
            databaseServer: {
                operatingSystem: 'Linux',
                serverEdition: 'SE2',
                serverVersion: '12c',
                nodeNames: ['n1'],
                activeConnections: 5,
                creationDate: null
            }
        });
        render(
            <Provider store={store}>
                <OracleServer {...defaultProps} />
            </Provider>
        );
        expect(screen.getByText('Oracle server')).toBeTruthy();
    });

    it('should NOT show content when accordion is closed', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <OracleServer handleToggle={vi.fn()} openKey="Other" />
            </Provider>
        );
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });
});
