import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DatabaseName from '../DatabaseName';
import createNewUserSlice from '../../../../../../store/workloadFactory/createNewDBSlice';
import msSqlActionSlice from '../../../../../../store/mssql/msSqlActionSlice';
import authSlice from '../../../../../../store/authSlice';

// Mock accordion context
const mockSetOpenChildren = vi.fn();
vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ title, ValueContent, children, id }: any) => (
        <div data-testid={`accordion-card-${id}`}>
            <div data-testid="accordion-title">{title}</div>
            <div data-testid="accordion-value-content">
                <ValueContent />
            </div>
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    DsTypography: ({ children, variant, className, title: tipTitle }: any) => (
        <span data-testid={`typography-${variant || 'default'}`} className={className} title={tipTitle}>
            {children}
        </span>
    ),
    TextField: ({ label, value, onChange, error, info, id, ref }: any) => (
        <div>
            <label htmlFor={id}>{label}</label>
            <input
                data-testid={`textfield-${id || label}`}
                id={id}
                value={value || ''}
                onChange={e => onChange && onChange(e)}
            />
            {error && <span data-testid="textfield-error">{error}</span>}
            {info && <div data-testid="textfield-info">{info}</div>}
        </div>
    ),
    useAccordionContext: () => ({ setOpenChildren: mockSetOpenChildren })
}));

vi.mock('../../../../../../common/ActionRequired/ActionRequired', () => ({
    default: ({ error }: any) => (
        <div data-testid="action-required" data-error={error}>
            Action Required
        </div>
    )
}));

vi.mock('../../../../../../common/AccordionError/AccordionError', () => ({
    default: () => <div data-testid="accordion-error">Accordion Error</div>
}));

vi.mock('../../../../../../common/hooks/useDelayedError', () => ({
    useDelayedError: (error: any) => error
}));

vi.mock('../../../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <svg data-testid="bullet-icon" />
}));

vi.mock('../../../../../../utils/appConstants', () => ({
    GENERAL: {
        ACTION_REQUIRED: 'Action required',
        DB_NAME_ERROR_CHECK: 'Check database name criteria',
        DB_CREATE_DATABASE_NAME: 'Database name',
        CREATE_DB_NAME_TOOLTIP: [
            'Up to 123 characters.',
            'Only alphanumeric, underscore (_), and forward slash (/) characters.',
            'Cannot start with a number.'
        ]
    }
}));

vi.mock('../DatabaseName.module.scss', () => ({
    default: {
        dataBaseName: 'dataBaseName',
        headerWrap: 'headerWrap',
        dbNameField: 'dbNameField',
        dbNameTooltip: 'dbNameTooltip',
        listItem: 'listItem',
        textWidth: 'textWidth'
    }
}));

vi.mock('../../../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        'heading-content': 'heading-content',
        title: 'title'
    }
}));

describe('DatabaseName Component', () => {
    const createMockStore = (createNewUserOverrides = {}, msSqlActionOverrides = {}, authOverrides = {}) =>
        configureStore({
            reducer: {
                [createNewUserSlice.name]: createNewUserSlice.reducer,
                [msSqlActionSlice.name]: msSqlActionSlice.reducer,
                [authSlice.name]: authSlice.reducer
            } as any,
            preloadedState: {
                createNewUser: {
                    newUserDBName: '',
                    ...createNewUserOverrides
                },
                msSqlAction: {
                    isDbCreatePressed: false,
                    isDbCreateHit: 0,
                    dbCreateNameAdded: true,
                    dbCreateDataNameAdded: true,
                    dbCreateLogNameAdded: true,
                    dbCreateDataSizeValid: true,
                    dbCreateLogSizeValid: true,
                    ...msSqlActionOverrides
                },
                auth: {
                    isDemoMode: false,
                    ...authOverrides
                }
            } as any
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without crashing', () => {
        const store = createMockStore();
        const { container } = render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('should render accordion card with id 1', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card-1')).toBeTruthy();
    });

    it('should render the database name TextField', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('textfield-db-create-database-name')).toBeTruthy();
    });

    it('should show ActionRequired when no name and dbCreateNameAdded is true (no error shown)', () => {
        const store = createMockStore({ newUserDBName: '' }, { dbCreateNameAdded: true });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });

    it('should show ActionRequired with error=true when dbCreateNameAdded is false and no name', () => {
        const store = createMockStore({ newUserDBName: '' }, { dbCreateNameAdded: false });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        const actionRequired = screen.getByTestId('action-required');
        expect(actionRequired.getAttribute('data-error')).toBe('true');
    });

    it('should show the DB name in header when name is valid and set', () => {
        const store = createMockStore({ newUserDBName: 'MyDatabase' }, { dbCreateNameAdded: true });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByText('MyDatabase')).toBeTruthy();
    });

    it('should show AccordionError when DB name is invalid (too long)', () => {
        const invalidName = 'a'.repeat(124);
        const store = createMockStore({ newUserDBName: invalidName }, { dbCreateNameAdded: true });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('accordion-error')).toBeTruthy();
    });

    it('should show AccordionError when DB name has invalid characters', () => {
        const store = createMockStore({ newUserDBName: 'invalid name!' }, { dbCreateNameAdded: true });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('accordion-error')).toBeTruthy();
    });

    it('should dispatch setNewUserDBName on input change', () => {
        const store = createMockStore({ newUserDBName: '' });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        const input = screen.getByTestId('textfield-db-create-database-name');
        fireEvent.change(input, { target: { value: 'NewDB' } });
        expect(dispatchSpy).toHaveBeenCalled();
        expect(store.getState().createNewUser.newUserDBName).toBe('NewDB');
    });

    it('should call accordionContext on initial mount to open accordion 1', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(mockSetOpenChildren).toHaveBeenCalledWith({ 1: true });
    });

    it('should trigger accordion open logic when isDbCreatePressed is true with errors', () => {
        const store = createMockStore(
            { newUserDBName: '' },
            {
                isDbCreatePressed: true,
                dbCreateNameAdded: false,
                dbCreateDataNameAdded: false,
                dbCreateLogNameAdded: true,
                dbCreateDataSizeValid: true,
                dbCreateLogSizeValid: true
            }
        );
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        // Should call setOpenChildren to open erroneous accordions
        expect(mockSetOpenChildren).toHaveBeenCalled();
    });

    it('should NOT trigger accordion logic when isDbCreatePressed is true but all fields valid', () => {
        const store = createMockStore(
            { newUserDBName: 'ValidDB' },
            {
                isDbCreatePressed: true,
                dbCreateNameAdded: true,
                dbCreateDataNameAdded: true,
                dbCreateLogNameAdded: true,
                dbCreateDataSizeValid: true,
                dbCreateLogSizeValid: true
            }
        );
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        // Only initial mount call is expected (not error accordion logic)
        expect(mockSetOpenChildren).toHaveBeenCalledWith({ 1: true });
    });

    it('should render tooltip info inside TextField', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        expect(screen.getByTestId('textfield-info')).toBeTruthy();
    });

    it('should display DB name error in TextField when invalid name', () => {
        const invalidName = 'a'.repeat(124);
        const store = createMockStore({ newUserDBName: invalidName });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        const error = screen.getByTestId('textfield-error');
        expect(error.textContent).toBe('Check database name criteria');
    });

    it('should return ACTION_REQUIRED error when dbCreateNameAdded is false and name is empty', () => {
        const store = createMockStore({ newUserDBName: '' }, { dbCreateNameAdded: false, isDbCreateHit: 1 });
        render(
            <Provider store={store}>
                <DatabaseName />
            </Provider>
        );
        const error = screen.getByTestId('textfield-error');
        expect(error.textContent).toBe('Action required');
    });
});
