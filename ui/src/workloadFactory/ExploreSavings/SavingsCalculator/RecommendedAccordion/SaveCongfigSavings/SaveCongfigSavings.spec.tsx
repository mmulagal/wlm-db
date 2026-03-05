import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SaveConfigSavings from './SaveCongfigSavings';
import { GENERAL } from '../../../../../utils/appConstants';

// Mocks
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    TextField: ({ label, onChange, value, className }: any) => (
        <input data-testid="text-field" aria-label={label} onChange={onChange} value={value} className={className} />
    )
}));

vi.mock('sanitize-html', () => ({
    default: (val: string) => val
}));

vi.mock('./SaveConfigSavings.module.scss', () => ({
    default: { saveConfigSaving: 'saveConfigSaving', textField: 'textField' }
}));

vi.mock('../../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSaveConfigName: (val: any) => ({ type: 'test/setSaveConfigName', payload: val })
}));

const makeStore = () =>
    configureStore({
        reducer: {
            exploreSavings: (s: any = {}, _action: any) => s
        }
    });

describe('SaveConfigSavings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders description text', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SaveConfigSavings description="Enter a name" />
            </Provider>
        );
        expect(container.textContent).toContain('Enter a name');
    });

    it('renders the text field with correct label', () => {
        render(
            <Provider store={makeStore()}>
                <SaveConfigSavings description="desc" />
            </Provider>
        );
        const input = screen.getByTestId('text-field');
        expect(input).toBeTruthy();
        expect(input).toHaveAttribute('aria-label', GENERAL.CONFIG_NAME);
    });

    it('updates local state and dispatches on change', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <SaveConfigSavings description="desc" />
            </Provider>
        );
        const input = screen.getByTestId('text-field');
        fireEvent.change(input, { target: { value: 'MyConfig' } });
        // After change, input should reflect the new value
        expect((input as HTMLInputElement).value).toBe('MyConfig');
    });

    it('starts with empty value', () => {
        render(
            <Provider store={makeStore()}>
                <SaveConfigSavings description="desc" />
            </Provider>
        );
        const input = screen.getByTestId('text-field') as HTMLInputElement;
        expect(input.value).toBe('');
    });

    it('dispatches setSaveConfigName on change', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <SaveConfigSavings description="desc" />
            </Provider>
        );
        const input = screen.getByTestId('text-field');
        fireEvent.change(input, { target: { value: 'NewName' } });
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSaveConfigName', payload: 'NewName' });
    });
});
