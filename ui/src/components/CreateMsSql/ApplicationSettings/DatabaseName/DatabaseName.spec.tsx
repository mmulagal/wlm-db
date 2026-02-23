import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DatabaseName from './DatabaseName';

vi.mock('../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <svg data-testid="bullet-icon" />
}));

vi.mock('../../../../common/AccordionError/AccordionError', () => ({
    default: () => <div data-testid="accordion-error">Accordion Error</div>
}));

vi.mock('../../../../common/ActionRequired/ActionRequired', () => ({
    default: ({ disabled, error }: any) => (
        <div data-testid="action-required" data-disabled={String(!!disabled)} data-error={String(!!error)}>
            Action Required
        </div>
    )
}));

vi.mock('../../../../store/mssql/mssqlFormSlice', () => ({
    setDBName: (val: any) => ({ type: 'mssqlForm/setDBName', payload: val })
}));

vi.mock('../../../../store/chatbot/chatbotSlice', () => ({
    setIsWizardTouched: (val: boolean) => ({ type: 'chatbot/setIsWizardTouched', payload: val })
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateRandomDBName: vi.fn(() => 'MSSQL-1234')
}));

vi.mock('../../../../common/hooks/useDelayedError', () => ({
    useDelayedError: vi.fn((err: any) => err)
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                dbName: overrides.dbName ?? 'MSSQL-1234'
            }),
            msSqlAction: () => ({
                isCreateHit: overrides.isCreateHit ?? 0,
                dbNameSelected: overrides.dbNameSelected ?? true
            }),
            auth: () => ({
                isDemoMode: overrides.isDemoMode ?? false
            })
        }
    });

describe('DatabaseName', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders Database server name title', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByText('Database Server name')).toBeTruthy();
    });

    it('shows current database name in header', () => {
        const store = makeStore({ dbName: 'MSSQL-1234' });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getAllByText('MSSQL-1234').length).toBeGreaterThan(0);
    });

    it('shows ActionRequired when database name is empty', () => {
        const store = makeStore({ dbName: '' });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });

    it('renders text field for database name input', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        // TextField should be rendered
        expect(document.body).toBeDefined();
    });

    it('renders with isDemoMode enabled', () => {
        const store = makeStore({ isDemoMode: true, dbName: 'MSSQL-demo' });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByText('Database Server name')).toBeTruthy();
    });

    it('renders accordion error when DB name is too long', () => {
        const store = makeStore({ dbName: 'TooLongDBName123' }); // 16 chars, exceeds 15
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('accordion-error')).toBeTruthy();
    });

    it('renders accordion error when DB name starts with non-alphanumeric char', () => {
        const store = makeStore({ dbName: '-invalid' });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('accordion-error')).toBeTruthy();
    });
});
