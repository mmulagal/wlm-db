import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Collation from '../Collation';
import createNewUserSlice from '../../../../../../store/workloadFactory/createNewDBSlice';

// Mock design system
vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ title, ValueContent, children, id, isLoading }: any) => (
        <div data-testid={`accordion-card-${id}`} data-loading={isLoading}>
            <div data-testid="accordion-title">{title}</div>
            <div data-testid="accordion-value-content">
                <ValueContent />
            </div>
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>,
    DsTypography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant || 'default'}`} className={className}>
            {children}
        </span>
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({
        label,
        options,
        onChange,
        isLoading,
        placeholder,
        defaultValue,
        isSearchable,
        isClearable,
        id,
        className
    }: any) => (
        <div>
            <label htmlFor={id}>{label}</label>
            <select
                data-testid={`select-${id || label}`}
                id={id}
                onChange={e => {
                    const found = options?.find((o: any) => o.value === e.target.value);
                    onChange && onChange(found || { value: e.target.value, label: e.target.value });
                }}
            >
                <option value="">-- {placeholder} --</option>
                {options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value} disabled={opt.isDisabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    )
}));

vi.mock('../../../../../../common/ActionRequired/ActionRequired', () => ({
    default: ({ error }: any) => (
        <div data-testid="action-required" data-error={error}>
            Action Required
        </div>
    )
}));

vi.mock('../../../../../../utils/appConstants', () => ({
    GENERAL: {
        COLLATION: 'Collation',
        SELECT_COLLATION: 'Select collation'
    }
}));

vi.mock('../../../../../../utils/utilityFunctions', () => ({
    generateOptionType: vi.fn((value, label, desc, disabled, msg) => ({
        value,
        label,
        description: desc,
        isDisabled: disabled,
        disabledMsg: msg
    }))
}));

vi.mock('../Collation.module.scss', () => ({
    default: {
        collation: 'collation',
        collationField: 'collationField',
        selectField: 'selectField'
    }
}));

vi.mock('../../../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        'heading-content': 'heading-content',
        title: 'title'
    }
}));

describe('Collation Component', () => {
    const createMockStore = (createNewUserOverrides = {}) =>
        configureStore({
            reducer: {
                [createNewUserSlice.name]: createNewUserSlice.reducer
            } as any,
            preloadedState: {
                createNewUser: {
                    selectedCollation: null,
                    collationList: null,
                    collationListLoading: false,
                    ...createNewUserOverrides
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
                <Collation />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('should render accordion card with id 5', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card-5')).toBeTruthy();
    });

    it('should show ActionRequired when no collation is selected', () => {
        const store = createMockStore({ selectedCollation: null });
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });

    it('should show selected collation label in header when collation is selected', () => {
        const store = createMockStore({
            selectedCollation: { label: 'SQL_Latin1_General_CP1_CI_AS', value: 'SQL_Latin1_General_CP1_CI_AS' }
        });
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        expect(screen.getByText('Default: SQL_Latin1_General_CP1_CI_AS')).toBeTruthy();
    });

    it('should show ActionRequired when selectedCollation has no label', () => {
        const store = createMockStore({ selectedCollation: {} });
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        expect(screen.getByTestId('action-required')).toBeTruthy();
    });

    it('should render SelectField with collation id', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        expect(screen.getByTestId('select-db-create-collation')).toBeTruthy();
    });

    it('should pass isLoading to accordion card when collationListLoading is true', () => {
        const store = createMockStore({ collationListLoading: true });
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        const accordion = screen.getByTestId('accordion-card-5');
        expect(accordion.getAttribute('data-loading')).toBe('true');
    });

    it('should generate options from collationList', () => {
        const store = createMockStore({
            collationList: {
                collationList: [
                    { name: 'SQL_Latin1', description: 'Latin 1' },
                    { name: 'Latin1_General', description: 'General' }
                ],
                defaultCollation: null
            }
        });
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        const select = screen.getByTestId('select-db-create-collation');
        expect(select.querySelectorAll('option').length).toBe(3); // 2 options + placeholder
    });

    it('should dispatch setSelectedCollation when default collation matches', () => {
        const store = createMockStore({
            collationList: {
                collationList: [
                    { name: 'SQL_Latin1', description: 'Latin 1' },
                    { name: 'Latin1_General', description: 'General' }
                ],
                defaultCollation: 'SQL_Latin1'
            }
        });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        // setSelectedCollation should be dispatched for the default collation
        expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should dispatch setSelectedCollation when user selects an option', () => {
        const store = createMockStore({
            collationList: {
                collationList: [
                    { name: 'SQL_Latin1', description: 'Latin 1' },
                    { name: 'Latin1_General', description: 'General' }
                ],
                defaultCollation: null
            }
        });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        const select = screen.getByTestId('select-db-create-collation');
        fireEvent.change(select, { target: { value: 'SQL_Latin1' } });
        expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should handle null collationList gracefully', () => {
        const store = createMockStore({ collationList: null });
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card-5')).toBeTruthy();
    });

    it('should handle empty collationList.collationList', () => {
        const store = createMockStore({
            collationList: { collationList: [], defaultCollation: null }
        });
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        const select = screen.getByTestId('select-db-create-collation');
        // Only placeholder option
        expect(select.querySelectorAll('option').length).toBe(1);
    });

    it('should show the accordion card title text', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        expect(screen.getAllByText('Collation').length).toBeGreaterThan(0);
    });

    it('should enable searchable when collation options > 5', () => {
        const store = createMockStore({
            collationList: {
                collationList: [
                    { name: 'C1', description: '' },
                    { name: 'C2', description: '' },
                    { name: 'C3', description: '' },
                    { name: 'C4', description: '' },
                    { name: 'C5', description: '' },
                    { name: 'C6', description: '' }
                ],
                defaultCollation: null
            }
        });
        render(
            <Provider store={store}>
                <Collation />
            </Provider>
        );
        // isSearchable=true when > 5 options - renders without error
        expect(screen.getByTestId('select-db-create-collation')).toBeTruthy();
    });
});
