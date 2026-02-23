import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import EncryptionTable from './EncryptionTable';

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        useDispatch: () => vi.fn()
    };
});

vi.mock('@netapp/design-system', () => ({
    Table: ({ children }: any) => <table data-testid="table">{children}</table>,
    useTable: () => ({
        getTableProps: () => ({}),
        getTableBodyProps: () => ({}),
        headerGroups: [],
        rows: [],
        prepareRow: () => {},
        state: { selectedRowIds: {} },
        toggleAllRowsSelected: vi.fn()
    }),
    Typography: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@netapp/icons/ic_notice_triangle.svg', () => ({
    ReactComponent: () => <svg data-testid="warning-icon" />
}));

vi.mock('../../../../../../assets/defaultTag.svg', () => ({
    ReactComponent: () => <svg data-testid="default-tag" />
}));

describe('EncryptionTable', () => {
    const makeStore = () =>
        configureStore({
            reducer: {
                mssql: () => ({
                    getKmsList: { kmsData: [] }
                }),
                mssqlForm: () => ({
                    encryption: { selectedRow: [] }
                }),
                chatbot: () => ({
                    movingFromChatbot: false
                })
            }
        });

    it('renders encryption table', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <EncryptionTable />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
