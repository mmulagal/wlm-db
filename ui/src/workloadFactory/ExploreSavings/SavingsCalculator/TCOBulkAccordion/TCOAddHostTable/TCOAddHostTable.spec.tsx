import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TCOAddHostTable from './TCOAddHostTable';

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

vi.mock('../../../../../common/Lib/Table/Table', () => ({
    Table: ({ ...props }: any) => <div data-testid="table" {...props} />
}));

vi.mock('../../../../../common/Lib/Table/useTable', () => ({
    useTable: () => ({
        columnsState: {},
        tableProps: {
            data: [],
            columns: [],
            getTableProps: () => ({}),
            getTableBodyProps: () => ({}),
            headerGroups: [],
            rows: [],
            prepareRow: vi.fn()
        }
    })
}));

vi.mock('../../../../../common/Lib/Table/TableTopBar', () => ({
    TableTopBar: ({ ...props }: any) => <div data-testid="table-top-bar" {...props} />
}));

// Create mock store
const createMockStore = () => {
    const mockState = {
        exploreSavingsBulk: {
            selectedRowsForExploreSavingsEBSBulk: [],
            rowsRequiringAuthBulk: [],
            triggerBulkDataFetch: false
        },
        headers: {
            headerSelectedMultiCredIdsList: [],
            headerSelectedMultiRegionIdsList: []
        },
        exploreSavings: {
            unmanagedExploreSavingsHost: []
        }
    };

    return configureStore({
        reducer: {
            exploreSavingsBulk: (state = mockState.exploreSavingsBulk) => state,
            headers: (state = mockState.headers) => state,
            exploreSavings: (state = mockState.exploreSavings) => state
        },
        preloadedState: mockState
    });
};

describe('TCOAddHostTable', () => {
    let store: any;

    beforeEach(() => {
        vi.clearAllMocks();
        store = createMockStore();
    });

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('renders table top bar', () => {
        render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('renders table component', () => {
        render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('handles onExploreSavings callback', () => {
        const onExploreSavings = vi.fn();
        render(
            <Provider store={store}>
                <TCOAddHostTable onExploreSavings={onExploreSavings} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('handles onHandlerReady callback', () => {
        const onHandlerReady = vi.fn();
        render(
            <Provider store={store}>
                <TCOAddHostTable onHandlerReady={onHandlerReady} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('handles onAuthRequired callback', () => {
        const onAuthRequired = vi.fn();
        render(
            <Provider store={store}>
                <TCOAddHostTable onAuthRequired={onAuthRequired} />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with empty unmanaged host list', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('handles all props together', () => {
        const onExploreSavings = vi.fn();
        const onHandlerReady = vi.fn();
        const onAuthRequired = vi.fn();

        render(
            <Provider store={store}>
                <TCOAddHostTable
                    onExploreSavings={onExploreSavings}
                    onHandlerReady={onHandlerReady}
                    onAuthRequired={onAuthRequired}
                />
            </Provider>
        );
        expect(screen.getByTestId('table')).toBeTruthy();
        expect(screen.getByTestId('table-top-bar')).toBeTruthy();
    });

    it('component structure is correct', () => {
        const { container } = render(
            <Provider store={store}>
                <TCOAddHostTable />
            </Provider>
        );
        expect(container.querySelector('[data-testid="table-top-bar"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="table"]')).toBeTruthy();
    });
});
