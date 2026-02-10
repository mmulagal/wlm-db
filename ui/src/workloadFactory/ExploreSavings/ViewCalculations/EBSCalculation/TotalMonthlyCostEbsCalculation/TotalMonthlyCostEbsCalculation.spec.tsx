import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TotalMonthlyCostEbsCalculation from './TotalMonthlyCostEbsCalculation';
import { GENERAL } from '../../../../../utils/appConstants';

// ========================
//  Mocks
// ========================

vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ children, ValueContent, title, isLoading, isDisabled, id }: any) => (
        <div data-testid="accordion-card" data-loading={isLoading} data-disabled={isDisabled} data-id={id}>
            <div data-testid="accordion-title">{title}</div>
            <div data-testid="accordion-value">{ValueContent && <ValueContent />}</div>
            <div data-testid="accordion-children">{children}</div>
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-testid="ds-typography" data-variant={variant} className={className} style={style}>
            {children}
        </span>
    )
}));

const mockViewCalculationForEBS = vi.fn().mockReturnValue({
    totalMonthlyCost: [
        { label: 'EC2 instances', value: '$200' },
        { label: 'EBS volumes', value: '$100' },
        { label: 'Total monthly cost', value: '$300' }
    ]
});
vi.mock('../../../SavingsCalculator/savingsUtil', () => ({
    viewCalculationForEBS: (...args: any[]) => mockViewCalculationForEBS(...args)
}));

vi.mock('../../ViewCalculationsUtils', () => ({
    TableLayout: ({ data }: any) => (
        <div data-testid="table-layout" data-label={data.label}>
            {data.value}
        </div>
    )
}));

// ========================
//  Helpers
// ========================

const createMockStore = (overrides: Record<string, any> = {}) => {
    const defaults = {
        viewCalculationsResponse: { ebsTotalCost: '500' },
        selectedDeploymentModel: 'Standalone',
        viewCalculationsLoading: false,
        selectedHostDetails: null,
        ...overrides
    };
    return configureStore({
        reducer: {
            exploreSavings: () => ({
                viewCalculationsResponse: defaults.viewCalculationsResponse,
                selectedDeploymentModel: defaults.selectedDeploymentModel,
                viewCalculationsLoading: defaults.viewCalculationsLoading,
                selectedHostDetails: defaults.selectedHostDetails
            })
        }
    });
};

const renderComponent = (overrides: Record<string, any> = {}) => {
    const store = createMockStore(overrides);
    return render(
        <Provider store={store}>
            <TotalMonthlyCostEbsCalculation />
        </Provider>
    );
};

// ========================
//  Tests
// ========================

describe('TotalMonthlyCostEbsCalculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockViewCalculationForEBS.mockReturnValue({
            totalMonthlyCost: [
                { label: 'EC2 instances', value: '$200' },
                { label: 'EBS volumes', value: '$100' },
                { label: 'Total monthly cost', value: '$300' }
            ]
        });
    });

    it('should render without crashing', () => {
        const { container } = renderComponent();
        expect(container.firstChild).toBeTruthy();
    });

    it('should render AccordionCard with correct title', () => {
        renderComponent();
        expect(screen.getByTestId('accordion-title').textContent).toBe(GENERAL.ES_TOTAL_MONTHLY_COST);
    });

    // ---- setHeader ----

    it('should show cost in header when response exists', () => {
        renderComponent({ viewCalculationsResponse: { ebsTotalCost: '750' } });
        expect(screen.getByTestId('accordion-value').textContent).toContain('$750');
    });

    it('should show N/A in header when response is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.getByTestId('accordion-value').textContent).toContain(GENERAL.NOT_AVAILABLE);
    });

    // ---- Loading state ----

    it('should set isLoading when viewCalculationsLoading is true', () => {
        renderComponent({ viewCalculationsLoading: true });
        expect(screen.getByTestId('accordion-card').getAttribute('data-loading')).toBe('true');
    });

    it('should set isLoading when selectedHostDetails.loading is true', () => {
        renderComponent({ selectedHostDetails: { loading: true } });
        expect(screen.getByTestId('accordion-card').getAttribute('data-loading')).toBe('true');
    });

    it('should not be loading when both are false', () => {
        renderComponent({ viewCalculationsLoading: false, selectedHostDetails: { loading: false } });
        expect(screen.getByTestId('accordion-card').getAttribute('data-loading')).toBe('false');
    });

    // ---- Content ----

    it('should render accordion content when data exists', () => {
        renderComponent();
        const layouts = screen.getAllByTestId('table-layout');
        expect(layouts.length).toBe(3);
    });

    it('should not render content when viewCalculationsResponse is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });

    it('should call viewCalculationForEBS with correct arguments', () => {
        const response = { ebsTotalCost: '500' };
        renderComponent({ viewCalculationsResponse: response, selectedDeploymentModel: 'FCI' });
        expect(mockViewCalculationForEBS).toHaveBeenCalledWith(response, 'FCI');
    });
});
