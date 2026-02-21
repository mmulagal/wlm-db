import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PostgreOperatingSystem from './PostgreOperatingSystem';

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
    SelectField: ({ label, onChange, options, defaultValue, isDisabled }: any) => (
        <div data-testid={`select-${label}`}>
            <span data-testid="select-value">{defaultValue?.[0]?.label || ''}</span>
            <button
                data-testid="select-change"
                onClick={() => onChange && onChange(options?.[1] || options?.[0])}
                disabled={isDisabled}
            >
                change
            </button>
            {isDisabled && <span data-testid="select-disabled">disabled</span>}
        </div>
    ),
    optionType: {}
}));

vi.mock('./PostgreOperatingSystem.module.scss', () => ({
    default: { postgreOS: 'postgreOS', collationField: 'collationField' }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: { title: 'title', 'heading-content': 'heading-content' }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: { SELECT_COLLATION: 'Select...' }
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    generateOptionType: (value: string, label: string) => ({ value, label, label2: label, isDisabled: false })
}));

vi.mock('../../../store/postgre/postgreFormSlice', () => ({
    setPostgreOperatingSystem: (val: any) => ({ type: 'postgreForm/setPostgreOperatingSystem', payload: val })
}));

vi.mock('../../../common/ActionRequired/ActionRequired', () => ({
    default: () => <span data-testid="action-required">Action Required</span>
}));

const makeStore = (postgreOS: any) =>
    configureStore({
        reducer: {
            postgreForm: () => ({ postgreOS })
        }
    });

describe('PostgreOperatingSystem', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={makeStore({ label: 'Amazon Linux 2023 AMI', value: 'Amazon Linux 2023 AMI' })}>
                <PostgreOperatingSystem />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('renders "Operating system" accordion title', () => {
        render(
            <Provider store={makeStore({ label: 'Amazon Linux 2023 AMI', value: 'Amazon Linux 2023 AMI' })}>
                <PostgreOperatingSystem />
            </Provider>
        );
        expect(screen.getByText('Operating system')).toBeTruthy();
    });

    it('renders OS label in header when postGreOS has a label', () => {
        render(
            <Provider store={makeStore({ label: 'Amazon Linux 2023 AMI', value: 'Amazon Linux 2023 AMI' })}>
                <PostgreOperatingSystem />
            </Provider>
        );
        const valueEl = screen.getByTestId('accordion-value');
        expect(valueEl.textContent).toContain('Amazon Linux 2023 AMI');
    });

    it('renders ActionRequired in header when postGreOS has no label', () => {
        render(
            <Provider store={makeStore(null)}>
                <PostgreOperatingSystem />
            </Provider>
        );
        const valueEl = screen.getByTestId('accordion-value');
        expect(valueEl.textContent).toContain('Action Required');
    });

    it('renders the SelectField for operating system', () => {
        render(
            <Provider store={makeStore({ label: 'Amazon Linux 2023 AMI', value: 'Amazon Linux 2023 AMI' })}>
                <PostgreOperatingSystem />
            </Provider>
        );
        expect(screen.getByTestId('select-Operating system: Amazon Linux')).toBeTruthy();
    });

    it('renders select as disabled', () => {
        render(
            <Provider store={makeStore({ label: 'Amazon Linux 2023 AMI', value: 'Amazon Linux 2023 AMI' })}>
                <PostgreOperatingSystem />
            </Provider>
        );
        expect(screen.getByTestId('select-disabled')).toBeTruthy();
    });

    it('dispatches setPostgreOperatingSystem on mount with default OS value', () => {
        const store = makeStore(null);
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <PostgreOperatingSystem />
            </Provider>
        );

        // useEffect on generateOSValues should dispatch the default OS
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'postgreForm/setPostgreOperatingSystem' })
        );
    });

    it('dispatches setPostgreOperatingSystem when OS is changed in SelectField', () => {
        const store = makeStore({ label: 'Amazon Linux 2023 AMI', value: 'Amazon Linux 2023 AMI' });
        const dispatchSpy = vi.spyOn(store, 'dispatch');

        render(
            <Provider store={store}>
                <PostgreOperatingSystem />
            </Provider>
        );

        const changeBtn = screen.getByTestId('select-change');
        fireEvent.click(changeBtn);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'postgreForm/setPostgreOperatingSystem' })
        );
    });

    it('uses postGreOS value for defaultValue when set', () => {
        render(
            <Provider store={makeStore({ label: 'Amazon Linux 2023 AMI', value: 'Amazon Linux 2023 AMI' })}>
                <PostgreOperatingSystem />
            </Provider>
        );
        const valueEl = screen.getByTestId('select-value');
        expect(valueEl.textContent).toBe('Amazon Linux 2023 AMI');
    });

    it('uses first generated option for defaultValue when postGreOS is null', () => {
        render(
            <Provider store={makeStore(null)}>
                <PostgreOperatingSystem />
            </Provider>
        );
        const valueEl = screen.getByTestId('select-value');
        expect(valueEl.textContent).toBe('Amazon Linux 2023 AMI');
    });
});
