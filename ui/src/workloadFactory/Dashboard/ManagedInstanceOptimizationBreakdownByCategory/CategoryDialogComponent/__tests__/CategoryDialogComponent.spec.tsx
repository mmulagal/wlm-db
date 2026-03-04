import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CategoryDialogComponent from '../CategoryDialogComponent';
import databaseHomeSlice from '../../../../../store/workloadFactory/databaseHomeSlice';

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    DsTypography: ({ children, variant }: any) => <span data-testid={`typography-${variant}`}>{children}</span>,
    Table: ({ tableProps }: any) => <div data-testid="table" />,
    useTable: vi.fn(() => ({
        selectionState: { rows: {} }
    })),
    TableTopBar: ({ pluralTitle }: any) => <div data-testid="table-top-bar">{pluralTitle}</div>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-redux', async importOriginal => {
    const actual = (await importOriginal()) as any;
    return {
        ...actual,
        useDispatch: () => vi.fn()
    };
});

vi.mock('../../../../../utils/consts', async () => {
    const actual = await vi.importActual('../../../../../utils/consts');
    return {
        ...actual,
        INVENTORY_STATUS: {
            RUNNING: 'RUNNING',
            CASE_SENSITIVE_UP: 'Up',
            STOPPED: 'STOPPED',
            CASE_SENSITIVE_DOWN: 'Down',
            UNKNOWN: 'UNKNOWN',
            ONLINE: 'Online',
            OFFLINE: 'Offline'
        }
    };
});

vi.mock('../../../../../utils/appConstants', () => ({
    GENERAL: { NOT_AVAILABLE: 'N/A' }
}));

vi.mock('./CategoryDialogComponent.module.scss', () => ({
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

const createStore = (selectedAssessmentRow: any = null) =>
    configureStore({
        reducer: { databaseHome: databaseHomeSlice.reducer },
        preloadedState: {
            databaseHome: {
                ...databaseHomeSlice.getInitialState(),
                selectedAssessmentRow
            }
        } as any
    });

const renderWithStore = (tableData: any = [], selectedAssessmentRow: any = null) => {
    const store = createStore(selectedAssessmentRow);
    return render(
        <Provider store={store}>
            <CategoryDialogComponent tableData={tableData} />
        </Provider>
    );
};

describe('CategoryDialogComponent', () => {
    it('renders without crashing with empty tableData', () => {
        renderWithStore([]);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders category dialog description text', () => {
        renderWithStore([]);
        expect(screen.getByText('databases.dashboard.category-dialog-component')).toBeTruthy();
    });

    it('renders table component', () => {
        renderWithStore([]);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders table top bar', () => {
        renderWithStore([]);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders with tableData containing items', () => {
        const tableData = [{ id: '1', databaseInstanceName: 'Instance1', status: 'Up', score: 85 }];
        renderWithStore(tableData);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with selectedAssessmentRow in store', () => {
        const tableData = [{ id: '1', databaseInstanceName: 'Instance1', status: 'Up', score: 85 }];
        const selectedRow = { id: '1', databaseInstanceName: 'Instance1' };
        renderWithStore(tableData, selectedRow);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
