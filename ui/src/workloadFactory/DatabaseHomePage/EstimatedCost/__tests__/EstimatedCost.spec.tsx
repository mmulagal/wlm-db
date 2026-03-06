import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import EstimatedCost from '../EstimatedCost';

const mockSetDialog = vi.fn();

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>{children}</span>
    ),
    Button: ({ children, onClick, variant }: any) => (
        <button data-testid={`button-${variant}`} onClick={onClick}>{children}</button>
    ),
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>,
    useDialog: () => ({ setDialog: mockSetDialog })
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../SquareComponent/../../../DatabaseHomePage/SquareComponent/SquareComponent', () => ({
    default: ({ value, text }: any) => <div data-testid={`square-${text}`}>{value}</div>
}));

vi.mock('../../SquareComponent/SquareComponent', () => ({
    default: ({ value, text }: any) => <div data-testid={`square-${text}`}>{value}</div>
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header }: any) => <div data-testid="dialog">{header}</div>
}));

vi.mock('../../EstimatedCostDialogContent/EstimatedCostDialogContent', () => ({
    default: () => <div data-testid="estimated-cost-dialog-content" />
}));

vi.mock('../EstimatedCostDialogContent/EstimatedCostDialogContent', () => ({
    default: () => <div data-testid="estimated-cost-dialog-content" />
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatNumberWithCustomComma: (val: any) => (val ? String(val) : '0')
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        ESTIMATED_MONTHLY_COST: 'Estimated Monthly Cost',
        ESTIMATED_COST_TOOLTIP: 'Tooltip text',
        LEARN_HOW_ESTIMATED_COST: 'Learn how',
        CLOSE: 'Close'
    }
}));

vi.mock('../EstimatedCost.module.scss', () => ({ default: {} }));
vi.mock('../../../../utils/CommonStyles.module.scss', () => ({ default: { notAvailable: 'notAvailable' } }));

const makeStore = (showNA = false) =>
    configureStore({
        reducer: {
            headers: (state = { showNA }) => state
        }
    });

const renderComponent = (hostData: any = null, hostsLoading = false, showNA = false) => {
    return render(
        <Provider store={makeStore(showNA)}>
            <EstimatedCost hostData={hostData} hostsLoading={hostsLoading} />
        </Provider>
    );
};

describe('EstimatedCost', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders title', () => {
        renderComponent();
        expect(screen.getByText('Estimated Monthly Cost')).toBeDefined();
    });

    it('renders $0 when hostData is null', () => {
        renderComponent(null);
        expect(screen.getAllByText('$0').length).toBeGreaterThan(0);
    });

    it('renders totalCost when hostData is provided', () => {
        renderComponent({ totalCost: 1234 });
        expect(screen.getByText('$1234')).toBeDefined();
    });

    it('renders N/A text when showNA is true', () => {
        renderComponent(null, false, true);
        expect(screen.getAllByText('databases.general.not-available').length).toBeGreaterThan(0);
    });

    it('shows FlashingDotsLoader when hostsLoading is true', () => {
        renderComponent({ totalCost: 500 }, true);
        expect(screen.getByTestId('flashing-dots-loader')).toBeDefined();
    });

    it('does not show FlashingDotsLoader when hostsLoading is false', () => {
        renderComponent({ totalCost: 500 }, false);
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('shows "Learn how" button when linkChk is true (requireBillingPerm)', () => {
        renderComponent({ requireBillingPerm: true });
        expect(screen.getByText('Learn how')).toBeDefined();
    });

    it('does not show "Learn how" button when requireBillingPerm is false', () => {
        renderComponent({ requireBillingPerm: false });
        expect(screen.queryByText('Learn how')).toBeNull();
    });

    it('calls setDialog when costDialog is triggered', () => {
        renderComponent({ requireBillingPerm: true });
        fireEvent.click(screen.getByText('Learn how'));
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
    });

    it('renders storage square component', () => {
        renderComponent({ storageCost: 100 });
        expect(screen.getByTestId('square-Storage')).toBeDefined();
    });

    it('renders compute square component', () => {
        renderComponent({ computeCost: 200 });
        expect(screen.getByTestId('square-Compute')).toBeDefined();
    });

    it('renders connectivity square component', () => {
        renderComponent({ connectivityCost: 50 });
        expect(screen.getByTestId('square-Connectivity')).toBeDefined();
    });

    it('renders other square component', () => {
        renderComponent({ otherCost: 30 });
        expect(screen.getByTestId('square-Other')).toBeDefined();
    });

    it('renders grey disabled bar when all percents are 0', () => {
        const { container } = renderComponent({
            storageCostPercent: 0,
            computeCostPercent: 0,
            connectivityCostPercent: 0,
            otherCostPercent: 0
        });
        const disabled = container.querySelector('[style*="var(--chart-disabled)"]');
        expect(disabled).not.toBeNull();
    });

    it('renders storage bar when storageCostPercent is non-zero', () => {
        const { container } = renderComponent({
            storageCostPercent: 50,
            computeCostPercent: 0,
            connectivityCostPercent: 0,
            otherCostPercent: 0
        });
        const bar = container.querySelector('[style*="var(--chart-9)"]');
        expect(bar).not.toBeNull();
    });

    it('renders compute bar when computeCostPercent is non-zero', () => {
        const { container } = renderComponent({
            storageCostPercent: 0,
            computeCostPercent: 40,
            connectivityCostPercent: 0,
            otherCostPercent: 0
        });
        const bar = container.querySelector('[style*="var(--chart-1)"]');
        expect(bar).not.toBeNull();
    });

    it('renders connectivity bar when connectivityCostPercent is non-zero', () => {
        const { container } = renderComponent({
            storageCostPercent: 0,
            computeCostPercent: 0,
            connectivityCostPercent: 30,
            otherCostPercent: 0
        });
        const bar = container.querySelector('[style*="var(--chart-3)"]');
        expect(bar).not.toBeNull();
    });

    it('renders other bar when otherCostPercent is non-zero', () => {
        const { container } = renderComponent({
            storageCostPercent: 0,
            computeCostPercent: 0,
            connectivityCostPercent: 0,
            otherCostPercent: 20
        });
        const bar = container.querySelector('[style*="var(--chart-4)"]');
        expect(bar).not.toBeNull();
    });
});
