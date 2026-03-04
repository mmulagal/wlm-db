import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SandboxDialog from '../SandboxDialog';
import sandboxSlice from '../../../../../../store/workloadFactory/sandboxSlice';

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

vi.mock('react-redux', async importOriginal => {
    const actual = (await importOriginal()) as any;
    return {
        ...actual,
        useDispatch: () => vi.fn()
    };
});

vi.mock('../../../../../../utils/appConstants', () => ({
    GENERAL: { NOT_AVAILABLE: 'N/A' }
}));

vi.mock('../../../../../../utils/consts', async () => {
    const actual = await vi.importActual('../../../../../../utils/consts');
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

vi.mock('./SandboxDialog.module.scss', () => ({
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

const createStore = (selectedSandboxRow: any = null) =>
    configureStore({
        reducer: { sandbox: sandboxSlice.reducer },
        preloadedState: {
            sandbox: {
                ...sandboxSlice.getInitialState(),
                selectedSandboxRow
            }
        } as any
    });

const renderWithStore = (tableData: any = []) => {
    const store = createStore();
    return render(
        <Provider store={store}>
            <SandboxDialog tableData={tableData} />
        </Provider>
    );
};

describe('SandboxDialog', () => {
    it('renders without crashing', () => {
        renderWithStore([]);
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders dialog description text', () => {
        renderWithStore([]);
        expect(screen.getByText('databases.dashboard.sandbox-dialog-text')).toBeTruthy();
    });

    it('renders table component', () => {
        renderWithStore([]);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with tableData containing items', () => {
        const tableData = [
            {
                id: '1',
                databaseInstanceName: 'Instance1',
                status: 'Up',
                sandboxCount: 2
            }
        ];
        renderWithStore(tableData);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
