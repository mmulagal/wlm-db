import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import CalculatorMode from './CalculatorMode';
import { TCO_CALCULATOR_MODE } from '../../../../utils/consts';

vi.mock('@tlveng/wlm-ds', () => ({
    DsRadioButton: ({ id, title, isSelected, onClick, ...rest }: any) => (
        <button data-testid={id} data-selected={String(isSelected)} onClick={onClick}>
            {title}
        </button>
    ),
    DsTypography: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('./CalculatorMode.module.scss', () => ({
    default: {
        calcMode: 'calcMode',
        radioContainer: 'radioContainer',
        staticRadio: 'staticRadio',
        radioIcon: 'radioIcon'
    }
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedCalculatorMode: (val: any) => ({ type: 'test/setSelectedCalculatorMode', payload: val }),
    setStorageSavingsResponse: (val: any) => ({ type: 'test/setStorageSavingsResponse', payload: val }),
    setViewCalculationsResponse: (val: any) => ({ type: 'test/setViewCalculationsResponse', payload: val })
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedCalculatorMode: TCO_CALCULATOR_MODE.OPTIMIZED,
            optimizedStorageSavingsResponse: { opt: 'savings' },
            standardStorageSavingsResponse: { std: 'savings' },
            optimizedViewCalculationsResponse: { opt: 'calc' },
            standardViewCalculationsResponse: { std: 'calc' },
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('CalculatorMode', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the mode title text', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CalculatorMode />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.select-calculator-mode');
    });

    it('renders optimized radio button', () => {
        render(
            <Provider store={makeStore()}>
                <CalculatorMode />
            </Provider>
        );
        expect(screen.getByTestId('select-optimized-type')).toBeTruthy();
    });

    it('renders standard radio button', () => {
        render(
            <Provider store={makeStore()}>
                <CalculatorMode />
            </Provider>
        );
        expect(screen.getByTestId('select-standard-type')).toBeTruthy();
    });

    it('marks optimized as selected when mode is optimized', () => {
        render(
            <Provider store={makeStore()}>
                <CalculatorMode />
            </Provider>
        );
        expect(screen.getByTestId('select-optimized-type')).toHaveAttribute('data-selected', 'true');
        expect(screen.getByTestId('select-standard-type')).toHaveAttribute('data-selected', 'false');
    });

    it('marks standard as selected when mode is standard', () => {
        render(
            <Provider store={makeStore({ selectedCalculatorMode: TCO_CALCULATOR_MODE.STANDARD })}>
                <CalculatorMode />
            </Provider>
        );
        expect(screen.getByTestId('select-standard-type')).toHaveAttribute('data-selected', 'true');
        expect(screen.getByTestId('select-optimized-type')).toHaveAttribute('data-selected', 'false');
    });

    it('dispatches optimized responses on optimized click', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <CalculatorMode />
            </Provider>
        );
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('select-optimized-type'));
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setStorageSavingsResponse',
            payload: { opt: 'savings' }
        });
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setViewCalculationsResponse',
            payload: { opt: 'calc' }
        });
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedCalculatorMode',
            payload: TCO_CALCULATOR_MODE.OPTIMIZED
        });
    });

    it('dispatches standard responses on standard click', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <CalculatorMode />
            </Provider>
        );
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('select-standard-type'));
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setStorageSavingsResponse',
            payload: { std: 'savings' }
        });
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setViewCalculationsResponse',
            payload: { std: 'calc' }
        });
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedCalculatorMode',
            payload: TCO_CALCULATOR_MODE.STANDARD
        });
    });

    it('renders static radio buttons when printState is true with optimized selected', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CalculatorMode printState />
            </Provider>
        );
        expect(screen.queryByTestId('select-optimized-type')).toBeNull();
        expect(screen.queryByTestId('select-standard-type')).toBeNull();
        const radios = container.querySelectorAll('.staticRadio');
        expect(radios).toHaveLength(2);
        // Selected radio uses ◉ (U+25C9), unselected uses ○ (U+25CB)
        expect(container.textContent).toContain('\u25C9');
        expect(container.textContent).toContain('\u25CB');
        expect(container.textContent).toContain('databases.explore-savings.optimized-based-on-usage');
        expect(container.textContent).toContain('databases.explore-savings.standard');
    });

    it('renders static radio buttons when printState is true with standard selected', () => {
        const { container } = render(
            <Provider store={makeStore({ selectedCalculatorMode: TCO_CALCULATOR_MODE.STANDARD })}>
                <CalculatorMode printState />
            </Provider>
        );
        expect(screen.queryByTestId('select-optimized-type')).toBeNull();
        expect(screen.queryByTestId('select-standard-type')).toBeNull();
        const radios = container.querySelectorAll('.staticRadio');
        expect(radios).toHaveLength(2);
        expect(container.textContent).toContain('databases.explore-savings.optimized-based-on-usage');
        expect(container.textContent).toContain('databases.explore-savings.standard');
    });
});
