import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import OptimizedModel from './OptimizedModel';
import { TCO_CALCULATOR_MODE } from '../../../../utils/consts';

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className }: any) => (
        <span data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

vi.mock('@netapp/design-system', () => ({
    DsButton: ({ children, onClick, type, variant, isThin, isLoading }: any) => (
        <button onClick={onClick} data-type={type} data-variant={variant} data-loading={String(isLoading)}>
            {children}
        </button>
    )
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('../../../../assets/optimizeES.svg', () => ({
    ReactComponent: () => <svg data-testid="optimize-image" />
}));

vi.mock('./OptimizedModel.module.scss', () => ({
    default: {
        optimizedModel: 'optimizedModel',
        overlay: 'overlay',
        modal: 'modal',
        header: 'header',
        content: 'content',
        description: 'description',
        footer: 'footer'
    }
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setOptimizeLink: (val: any) => ({ type: 'test/setOptimizeLink', payload: val }),
    setShowOptimizeMode: (val: any) => ({ type: 'test/setShowOptimizeMode', payload: val }),
    setStorageSavingsResponse: (val: any) => ({ type: 'test/setStorageSavingsResponse', payload: val }),
    setViewCalculationsResponse: (val: any) => ({ type: 'test/setViewCalculationsResponse', payload: val }),
    setSelectedCalculatorMode: (val: any) => ({ type: 'test/setSelectedCalculatorMode', payload: val })
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            showOptimizeMode: { optimizeLoading: false, showCalcMode: false },
            standardStorageSavingsResponse: { std: 'savings' },
            standardViewCalculationsResponse: { std: 'calc' },
            optimizedStorageSavingsResponse: { opt: 'savings' },
            optimizedViewCalculationsResponse: { opt: 'calc' },
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('OptimizedModel', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the optimize image', () => {
        render(
            <Provider store={makeStore()}>
                <OptimizedModel />
            </Provider>
        );
        expect(screen.getByTestId('optimize-image')).toBeTruthy();
    });

    it('renders dialog title', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <OptimizedModel />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.optimize-dialog-title');
    });

    it('renders dialog description', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <OptimizedModel />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.optimize-dialog-description');
    });

    it('renders maybe later button', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <OptimizedModel />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.maybe-later');
    });

    it('renders optimize savings button', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <OptimizedModel />
            </Provider>
        );
        expect(container.textContent).toContain('databases.explore-savings.optimize-savings');
    });

    it('dispatches optimize actions on optimize button click', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <OptimizedModel />
            </Provider>
        );
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByText('databases.explore-savings.optimize-savings'));
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
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setShowOptimizeMode',
            payload: { optimizeLoading: false, showCalcMode: true }
        });
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setOptimizeLink', payload: false });
    });

    it('dispatches standard actions on maybe later click', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <OptimizedModel />
            </Provider>
        );
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByText('databases.explore-savings.maybe-later'));
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
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setOptimizeLink', payload: true });
    });

    it('shows loading state on optimize button when loading', () => {
        render(
            <Provider store={makeStore({ showOptimizeMode: { optimizeLoading: true, showCalcMode: false } })}>
                <OptimizedModel />
            </Provider>
        );
        const optimizeBtn = screen.getByText('databases.explore-savings.optimize-savings');
        expect(optimizeBtn).toHaveAttribute('data-loading', 'true');
    });
});
