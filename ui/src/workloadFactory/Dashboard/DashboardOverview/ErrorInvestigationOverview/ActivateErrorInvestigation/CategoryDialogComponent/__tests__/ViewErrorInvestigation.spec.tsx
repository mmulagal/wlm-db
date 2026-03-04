import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import ViewErrorInvestigation from '../ViewErrorInvestigation';

vi.mock('@tlveng/wlm-ds', () => ({
    DsFlashingDotsLoader: () => <div data-testid="loader" />,
    DsTypography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant}`} className={className}>
            {children}
        </span>
    )
}));

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="loader" />,
    DsTypography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant}`} className={className}>
            {children}
        </span>
    ),
    Table: ({ tableProps }: any) => <table data-testid="table" />,
    useTable: (props: any) => ({
        selectionState: { rows: {} },
        ...props
    }),
    TableTopBar: ({ tableProps, pluralTitle }: any) => <div data-testid="table-top-bar">{pluralTitle}</div>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../../../../../store/workloadFactory/agenticAISlice', () => ({
    setSelectedViewErrorInvestigationRow: vi.fn((val: any) => ({
        type: 'setSelectedViewErrorInvestigationRow',
        payload: val
    }))
}));

vi.mock('../../../../../../../utils/consts', () => ({
    INVENTORY_STATUS: {
        RUNNING: 'RUNNING',
        CASE_SENSITIVE_UP: 'Up',
        STOPPED: 'STOPPED',
        CASE_SENSITIVE_DOWN: 'Down',
        UNKNOWN: 'Unknown',
        ONLINE: 'Online',
        OFFLINE: 'Offline'
    }
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            agenticAI: (
                state = {
                    selectedViewInvestigationRow: null,
                    ...overrides.agenticAI
                }
            ) => state
        }
    });

describe('ViewErrorInvestigation', () => {
    const defaultTableData = [
        {
            id: '1',
            databaseInstanceName: 'Instance1',
            databaseHostName: 'host1',
            type: 'MSSQL',
            status: 'Up',
            logAnalyzerErrorCount: 5,
            loadingStatus: false,
            loading: false
        },
        {
            id: '2',
            databaseInstanceName: 'Instance2',
            databaseHostName: 'host2',
            type: 'ORACLE',
            status: 'Down',
            logAnalyzerErrorCount: 3,
            loadingStatus: false,
            loading: false
        }
    ];

    it('renders the dialog content', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ViewErrorInvestigation tableData={defaultTableData} />
            </Provider>
        );
        expect(screen.getByText('databases.dashboard.view-error-investigation-dialog-text')).toBeTruthy();
    });

    it('renders table top bar', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ViewErrorInvestigation tableData={defaultTableData} />
            </Provider>
        );
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders table', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ViewErrorInvestigation tableData={defaultTableData} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty table data', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ViewErrorInvestigation tableData={[]} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with previously selected row', () => {
        const store = createMockStore({
            agenticAI: { selectedViewInvestigationRow: { id: '1' } }
        });
        render(
            <Provider store={store}>
                <ViewErrorInvestigation tableData={defaultTableData} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with Unknown status row', () => {
        const data = [{ ...defaultTableData[0], status: 'Unknown' }];
        const store = createMockStore();
        render(
            <Provider store={store}>
                <ViewErrorInvestigation tableData={data} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
