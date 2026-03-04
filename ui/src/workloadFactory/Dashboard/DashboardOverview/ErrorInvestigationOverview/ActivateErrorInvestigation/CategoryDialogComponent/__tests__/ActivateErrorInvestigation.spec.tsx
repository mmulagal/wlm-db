import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ActivateErrorInvestigation from '../ActivateErrorInvestigation';
import agenticAISlice from '../../../../../../../store/workloadFactory/agenticAISlice';

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    DsTypography: ({ children, variant }: any) => <span data-testid={`typography-${variant}`}>{children}</span>,
    Table: () => <div data-testid="table" />,
    useTable: vi.fn(() => ({
        selectionState: { rows: {} }
    })),
    TableTopBar: ({ pluralTitle }: any) => <div data-testid="table-top-bar">{pluralTitle}</div>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock(
    '../../../../../../../workloadFactory/GetWell/WellArchitectDashboard/ErrorInvestigation/ErrorInvestigationUtility',
    () => ({
        eiErrorCodesOptions: {},
        eiSeverityOptionList: {},
        eiSeverityOptionListOracle: {},
        eiTimeOptions: {}
    })
);

vi.mock('react-redux', async importOriginal => {
    const actual = (await importOriginal()) as any;
    return {
        ...actual,
        useDispatch: () => vi.fn()
    };
});

vi.mock('../../../../../../utils/consts', () => ({
    INVENTORY_STATUS: {
        RUNNING: 'RUNNING',
        CASE_SENSITIVE_UP: 'Up',
        STOPPED: 'STOPPED',
        CASE_SENSITIVE_DOWN: 'Down',
        UNKNOWN: 'UNKNOWN',
        ONLINE: 'Online',
        OFFLINE: 'Offline'
    }
}));

vi.mock('./ActivateErrorInvestigation.module.scss', () => ({
    default: {
        categoryDialogContent: 'categoryDialogContent',
        table: 'table',
        firstColText: 'firstColText',
        statusIcon: 'statusIcon',
        circle: 'circle',
        online: 'online',
        offline: 'offline',
        unknown: 'unknown'
    }
}));

const createStore = () =>
    configureStore({
        reducer: { agenticAI: agenticAISlice.reducer },
        preloadedState: {
            agenticAI: {
                ...agenticAISlice.getInitialState(),
                selectedErrorInvestigationRow: null
            }
        } as any
    });

const renderWithStore = (tableData: any = []) => {
    const store = createStore();
    return render(
        <Provider store={store}>
            <ActivateErrorInvestigation tableData={tableData} />
        </Provider>
    );
};

describe('ActivateErrorInvestigation', () => {
    it('renders without crashing', () => {
        renderWithStore([]);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders activation dialog description text', () => {
        renderWithStore([]);
        expect(screen.getByText('databases.dashboard.activation-dialog-text')).toBeTruthy();
    });

    it('renders table component', () => {
        renderWithStore([]);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with tableData containing items', () => {
        const tableData = [{ id: '1', databaseInstanceName: 'Instance1', status: 'Up' }];
        renderWithStore(tableData);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
