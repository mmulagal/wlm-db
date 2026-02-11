import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import CostSavings from './CostSavings';
import { GENERAL } from '../../../../utils/appConstants';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style, id }: any) => (
        <span data-variant={variant} className={className} style={style} id={id}>
            {children}
        </span>
    ),
    FlashingDotsLoader: () => <div data-testid="loader" />,
    Popover: ({ children, container, trigger }: any) => (
        <div data-testid="popover">
            {container}
            {children}
        </div>
    )
}));

vi.mock('@netapp/icons/ic_info.svg', () => ({
    ReactComponent: () => <svg data-testid="info-icon" />
}));

vi.mock('../../../../assets/cost-savings.svg', () => ({
    ReactComponent: () => <svg data-testid="cost-savings-image" />
}));

vi.mock('../../../../assets/Cost-Disabled.svg', () => ({
    ReactComponent: () => <svg data-testid="cost-disabled-image" />
}));

vi.mock('./CostSavings.module.scss', () => ({
    default: {
        costSavings: 'costSavings',
        leftSide: 'leftSide',
        setImage: 'setImage',
        textContent: 'textContent',
        changeWidth: 'changeWidth',
        topValue: 'topValue',
        dollar: 'dollar',
        dollarHeight: 'dollarHeight',
        bottomValue: 'bottomValue',
        separator: 'separator',
        separatorNewWidth: 'separatorNewWidth',
        costZeroCase: 'costZeroCase',
        costZeroCaseSmallRes: 'costZeroCaseSmallRes',
        rightSide: 'rightSide',
        firstRow: 'firstRow',
        popover: 'popover',
        smallResolutionMessage: 'smallResolutionMessage'
    }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatFractionalNumber: (val: number) => String(val),
    formatFractionalNumberForCost: (val: number, dec: number, comma?: boolean) => String(Math.round(val)),
    formatNumberWithCustomComma: (val: number, flag?: boolean) => String(val)
}));

vi.mock('../../../../common/hooks/useResize', () => ({
    default: () => ({ width: 1600 })
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            storageSavingsResponse: {
                totalSummary: { recommendedTotal: 500, existing: 1000 }
            },
            storageSavingsLoading: false,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('CostSavings', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders dollar sign', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostSavings />
            </Provider>
        );
        expect(container.textContent).toContain('$');
    });

    it('renders cost savings label', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostSavings />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.ES_COST_SAVINGS);
    });

    it('renders percentage savings label when savings exist', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostSavings />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.ES_SAVINGS_PERCENTAGE);
    });

    it('renders percentage symbol when savings exist', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostSavings />
            </Provider>
        );
        expect(container.textContent).toContain('%');
    });

    it('shows cost savings image when not disabled', () => {
        render(
            <Provider store={makeStore()}>
                <CostSavings />
            </Provider>
        );
        expect(screen.getByTestId('cost-savings-image')).toBeTruthy();
    });

    it('shows disabled image when disabled', () => {
        render(
            <Provider store={makeStore()}>
                <CostSavings disableState />
            </Provider>
        );
        expect(screen.getByTestId('cost-disabled-image')).toBeTruthy();
    });

    it('shows loaders when loading', () => {
        render(
            <Provider store={makeStore({ storageSavingsLoading: true })}>
                <CostSavings />
            </Provider>
        );
        const loaders = screen.getAllByTestId('loader');
        expect(loaders.length).toBeGreaterThan(0);
    });

    it('handles zero savings (fsxTotal > ebsTotal)', () => {
        const { container } = render(
            <Provider
                store={makeStore({
                    storageSavingsResponse: { totalSummary: { recommendedTotal: 1500, existing: 1000 } }
                })}
            >
                <CostSavings />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.NOTICE_MESSAGE_COST_SAVINGS);
    });

    it('shows 0 cost when no savings', () => {
        const { container } = render(
            <Provider
                store={makeStore({
                    storageSavingsResponse: { totalSummary: { recommendedTotal: 1500, existing: 1000 } }
                })}
            >
                <CostSavings />
            </Provider>
        );
        expect(container.textContent).toContain('0');
    });

    it('handles null storageSavingsResponse', () => {
        const { container } = render(
            <Provider store={makeStore({ storageSavingsResponse: null })}>
                <CostSavings />
            </Provider>
        );
        expect(container.textContent).toContain('0');
    });

    it('calculates savings correctly', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostSavings />
            </Provider>
        );
        // savings = 1000 - 500 = 500
        expect(container.textContent).toContain('500');
    });

    it('handles empty totalSummary', () => {
        const { container } = render(
            <Provider
                store={makeStore({
                    storageSavingsResponse: { totalSummary: {} }
                })}
            >
                <CostSavings />
            </Provider>
        );
        expect(container.textContent).toContain('0');
    });
});
