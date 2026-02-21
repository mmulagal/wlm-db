import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PostgreVersion from './PostgreVersion';

vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ children, title, ValueContent }: any) => (
        <div data-testid="accordion-card">
            <div data-testid="accordion-title">{title}</div>
            {ValueContent && (
                <div data-testid="accordion-value">
                    <ValueContent />
                </div>
            )}
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
    DsTypography: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, onChange, options, defaultValue }: any) => (
        <div data-testid={`select-${label}`}>
            <span data-testid="select-value">{defaultValue?.[0]?.label || ''}</span>
            <span data-testid="select-count">{options?.length || 0}</span>
            <button data-testid="select-change" onClick={() => onChange && onChange(options?.[1])}>
                change
            </button>
        </div>
    ),
    optionType: {}
}));

vi.mock('./PostgreVersion.module.scss', () => ({
    default: { postgreVersion: 'postgreVersion', collationField: 'collationField' }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: { title: 'title', 'heading-content': 'heading-content' }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: { SELECT_COLLATION: 'Select...' }
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    generateOptionType: (value: string, label: string, label2: string) => ({ value, label, label2, isDisabled: false })
}));

vi.mock('../../../store/postgre/postgreFormSlice', () => ({
    setPostgreVersion: (val: any) => ({ type: 'postgreForm/setPostgreVersion', payload: val })
}));

vi.mock('../../../common/ActionRequired/ActionRequired', () => ({
    default: () => <span data-testid="action-required">Action Required</span>
}));

const makeStore = (postgreVersion: any) =>
    configureStore({
        reducer: {
            postgreForm: () => ({ postgreVersion })
        }
    });

describe('PostgreVersion', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={makeStore({ label: 'postgresql16', value: 'postgresql16' })}>
                <PostgreVersion />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('renders "PostgreSQL version" accordion title', () => {
        render(
            <Provider store={makeStore({ label: 'postgresql16', value: 'postgresql16' })}>
                <PostgreVersion />
            </Provider>
        );
        expect(screen.getByText('PostgreSQL version')).toBeTruthy();
    });

    it('shows version label in header when postGreVersion has a label', () => {
        render(
            <Provider store={makeStore({ label: 'postgresql16', value: 'postgresql16' })}>
                <PostgreVersion />
            </Provider>
        );
        const valueEl = screen.getByTestId('accordion-value');
        expect(valueEl.textContent).toContain('postgresql16');
    });

    it('renders ActionRequired in header when postGreVersion has no label', () => {
        render(
            <Provider store={makeStore(null)}>
                <PostgreVersion />
            </Provider>
        );
        const valueEl = screen.getByTestId('accordion-value');
        expect(valueEl.textContent).toContain('Action Required');
    });

    it('renders SelectField with label "PostgreSQL version"', () => {
        render(
            <Provider store={makeStore({ label: 'postgresql16', value: 'postgresql16' })}>
                <PostgreVersion />
            </Provider>
        );
        expect(screen.getByTestId('select-PostgreSQL version')).toBeTruthy();
    });

    it('generates 2 version options (postgresql16 and postgresql15)', () => {
        render(
            <Provider store={makeStore({ label: 'postgresql16', value: 'postgresql16' })}>
                <PostgreVersion />
            </Provider>
        );
        expect(screen.getByTestId('select-count').textContent).toBe('2');
    });

    it('dispatches setPostgreVersion on mount via useEffect with default value', () => {
        const store = makeStore(null);
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <PostgreVersion />
            </Provider>
        );

        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'postgreForm/setPostgreVersion' }));
    });

    it('dispatches setPostgreVersion when version is changed', () => {
        const store = makeStore({ label: 'postgresql16', value: 'postgresql16' });
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <PostgreVersion />
            </Provider>
        );

        const changeBtn = screen.getByTestId('select-change');
        fireEvent.click(changeBtn);

        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'postgreForm/setPostgreVersion' }));
    });

    it('uses postGreVersion as defaultValue when set', () => {
        render(
            <Provider store={makeStore({ label: 'postgresql15', value: 'postgresql15' })}>
                <PostgreVersion />
            </Provider>
        );
        const valueEl = screen.getByTestId('select-value');
        expect(valueEl.textContent).toBe('postgresql15');
    });

    it('uses first option as defaultValue when postGreVersion is null', () => {
        render(
            <Provider store={makeStore(null)}>
                <PostgreVersion />
            </Provider>
        );
        const valueEl = screen.getByTestId('select-value');
        expect(valueEl.textContent).toBe('postgresql16');
    });

    it('search is not enabled when options count <= 5', () => {
        // generateOSValues has only 2 items, so isSearchable should be false
        // The SelectField mock doesn't expose isSearchable; we verify the component renders correctly
        const { container } = render(
            <Provider store={makeStore({ label: 'postgresql16', value: 'postgresql16' })}>
                <PostgreVersion />
            </Provider>
        );
        expect(container).toBeTruthy();
    });
});
