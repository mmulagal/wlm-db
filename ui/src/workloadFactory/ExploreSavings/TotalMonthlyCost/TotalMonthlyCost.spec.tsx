import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TotalMonthlyCost from './TotalMonthlyCost';
import { GENERAL } from '../../../utils/appConstants';
import { SAVINGS_CALC_MODE } from '../../../utils/consts';

// Mock SVG component
vi.mock('../../../assets/ic_graph.svg', () => ({
    ReactComponent: (props: any) => <div data-testid="graph-icon" {...props} />
}));

// Mock ComparisonChart to capture props
const MockComparisonChart = vi.fn((props: any) => {
    // Call yTickFormatter if provided to cover that branch
    const formattedValue = props.yTickFormatter ? props.yTickFormatter(1000) : null;
    return (
        <div data-testid="comparison-chart" data-formatted={formattedValue}>
            {JSON.stringify({ data: props.data, height: props.height, categories: props.categories })}
        </div>
    );
});

vi.mock('../../../ui-components/Charts/ComparisionChart', () => ({
    default: (props: any) => MockComparisonChart(props)
}));

// Mock @netapp/design-system
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style }: any) => (
        <div data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </div>
    ),
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />
}));

// Mock formatNumberWithCustomComma
vi.mock('../../../utils/utilityFunctions', () => ({
    formatNumberWithCustomComma: (num: number, round: boolean) => num.toLocaleString()
}));

// Helper to create mock store
const createMockStore = (overrides: Record<string, any> = {}) =>
    configureStore({
        reducer: {
            exploreSavings: () => ({
                storageSavingsResponse: {},
                storageSavingsLoading: false,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS,
                ...overrides
            })
        }
    });

// Helper to render component
const renderComponent = (disableState?: boolean, storeOverrides: Record<string, any> = {}) => {
    const store = createMockStore(storeOverrides);
    return render(
        <Provider store={store}>
            <TotalMonthlyCost disableState={disableState} />
        </Provider>
    );
};

describe('TotalMonthlyCost', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Header Section', () => {
        it('should render the title "Total monthly cost"', () => {
            renderComponent();
            expect(screen.getByText(GENERAL.TOTAL_MONTHLY_COST)).toBeTruthy();
        });

        it('should render title with primary text color when disableState is false', () => {
            renderComponent(false);
            const title = screen.getByText(GENERAL.TOTAL_MONTHLY_COST);
            expect(title.style.color).toBe('var(--text-primary)');
        });

        it('should render title with disabled text color when disableState is true', () => {
            renderComponent(true);
            const title = screen.getByText(GENERAL.TOTAL_MONTHLY_COST);
            expect(title.style.color).toBe('var(--text-disabled)');
        });

        it('should show DsFlashingDotsLoader when loading', () => {
            renderComponent(false, { storageSavingsLoading: true });
            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
        });

        it('should not show DsFlashingDotsLoader when not loading', () => {
            renderComponent(false, { storageSavingsLoading: false });
            expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
        });
    });

    describe('Loading State (storageSavingsLoading = true)', () => {
        it('should render loading chart with data [1, 1] and height 120', () => {
            renderComponent(false, { storageSavingsLoading: true });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [1, 1],
                    height: 120,
                    colors: ['chart-9', 'chart-6']
                })
            );
        });

        it('should use EBS category for MANUAL_EBS savingsCalculatorFrom', () => {
            renderComponent(false, {
                storageSavingsLoading: true,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]
                })
            );
        });

        it('should use EBS category for AUTO_EBS savingsCalculatorFrom', () => {
            renderComponent(false, {
                storageSavingsLoading: true,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]
                })
            );
        });

        it('should use EBS category for ONPREM savingsCalculatorFrom', () => {
            renderComponent(false, {
                storageSavingsLoading: true,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]
                })
            );
        });

        it('should use FSXW category for non-EBS/ONPREM savingsCalculatorFrom', () => {
            renderComponent(false, {
                storageSavingsLoading: true,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_FSXW
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.FSXW_CATEGORY]
                })
            );
        });

        it('should call yTickFormatter that returns $0', () => {
            renderComponent(false, { storageSavingsLoading: true });
            // The mock chart calls yTickFormatter with 1000, the formatter always returns $0
            const chart = screen.getAllByTestId('comparison-chart')[0];
            expect(chart.getAttribute('data-formatted')).toBe('$0');
        });
    });

    describe('Disabled State (noData = true, not loading)', () => {
        it('should render graph icon', () => {
            renderComponent(true, { storageSavingsLoading: false });
            expect(screen.getByTestId('graph-icon')).toBeTruthy();
        });

        it('should render "To view storage" message', () => {
            renderComponent(true, { storageSavingsLoading: false });
            expect(screen.getByText(GENERAL.TO_VIEW_STORAGE)).toBeTruthy();
        });

        it('should render chart with data [0, 0] and height 75', () => {
            renderComponent(true, { storageSavingsLoading: false });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [0, 0],
                    height: 75
                })
            );
        });

        it('should use EBS category for MANUAL_EBS in disabled state', () => {
            renderComponent(true, {
                storageSavingsLoading: false,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]
                })
            );
        });

        it('should use FSXW category for FSXW mode in disabled state', () => {
            renderComponent(true, {
                storageSavingsLoading: false,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_FSXW
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.FSXW_CATEGORY]
                })
            );
        });
    });

    describe('Normal State (not disabled, not loading)', () => {
        it('should render chart with response data', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                storageSavingsResponse: {
                    totalSummary: { recommendedTotal: 500, existing: 1200 }
                }
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [500, 1200],
                    height: 370,
                    colors: ['chart-9', 'chart-6']
                })
            );
        });

        it('should default to 0 when recommendedTotal is missing', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                storageSavingsResponse: { totalSummary: { existing: 800 } }
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [0, 800]
                })
            );
        });

        it('should default to 0 when existing is missing', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                storageSavingsResponse: { totalSummary: { recommendedTotal: 300 } }
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [300, 0]
                })
            );
        });

        it('should default to [0, 0] when totalSummary is missing', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                storageSavingsResponse: {}
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [0, 0]
                })
            );
        });

        it('should pass falsy colors when storageSavingsResponse is falsy', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                storageSavingsResponse: null
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    colors: null
                })
            );
        });

        it('should use EBS category for MANUAL_EBS', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_EBS
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]
                })
            );
        });

        it('should use EBS category for AUTO_EBS', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.AUTO_EBS
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]
                })
            );
        });

        it('should use EBS category for ONPREM', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.ONPREM
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.CATEGORY_POINT_TWO]
                })
            );
        });

        it('should use FSXW category for MANUAL_FSXW', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                savingsCalculatorFrom: SAVINGS_CALC_MODE.MANUAL_FSXW
            });
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    categories: [GENERAL.CATEGORY_POINT_ONE, GENERAL.FSXW_CATEGORY]
                })
            );
        });

        it('should call yTickFormatter with formatted value', () => {
            renderComponent(false, {
                storageSavingsLoading: false,
                storageSavingsResponse: { totalSummary: { recommendedTotal: 500, existing: 1200 } }
            });
            const chart = screen.getByTestId('comparison-chart');
            // Our mock formatNumberWithCustomComma returns num.toLocaleString()
            expect(chart.getAttribute('data-formatted')).toBe('$1,000');
        });
    });

    describe('Default Props', () => {
        it('should default disableState to false when not provided', () => {
            const store = createMockStore({
                storageSavingsLoading: false,
                storageSavingsResponse: { totalSummary: { recommendedTotal: 100, existing: 200 } }
            });
            render(
                <Provider store={store}>
                    <TotalMonthlyCost />
                </Provider>
            );
            // Should render the normal chart (not disabled state)
            expect(screen.queryByTestId('graph-icon')).toBeNull();
            expect(MockComparisonChart).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [100, 200],
                    height: 370
                })
            );
        });
    });
});
