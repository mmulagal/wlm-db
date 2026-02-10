import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ClonesFsxwCalculation from './ClonesFsxwCalculation';
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

const mockViewCalculationForFsxw = vi.fn().mockReturnValue({
    cloneCalculation: [
        { label: 'Clone volume cost', value: '$10' },
        { label: 'Total clones monthly cost', value: '$50' }
    ]
});
vi.mock('../../../SavingsCalculator/savingsUtil', () => ({
    viewCalculationForFsxw: (...args: any[]) => mockViewCalculationForFsxw(...args)
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
        viewCalculationsResponse: { fsxwCloneCalculation: { totalCloneMonthlyCost: '100' } },
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
            <ClonesFsxwCalculation />
        </Provider>
    );
};

// ========================
//  Tests
// ========================

describe('ClonesFsxwCalculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockViewCalculationForFsxw.mockReturnValue({
            cloneCalculation: [
                { label: 'Clone volume cost', value: '$10' },
                { label: 'Total clones monthly cost', value: '$50' }
            ]
        });
    });

    it('should render without crashing', () => {
        const { container } = renderComponent();
        expect(container.firstChild).toBeTruthy();
    });

    it('should render AccordionCard with correct title', () => {
        renderComponent();
        expect(screen.getByTestId('accordion-title').textContent).toBe(GENERAL.ES_CLONES);
    });

    // ---- setHeader ----

    it('should show cost in header when viewCalculationsResponse exists', () => {
        renderComponent({ viewCalculationsResponse: { fsxwCloneCalculation: { totalCloneMonthlyCost: '250' } } });
        expect(screen.getByTestId('accordion-value').textContent).toContain('$250');
    });

    it('should show N/A in header when viewCalculationsResponse is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.getByTestId('accordion-value').textContent).toContain(GENERAL.NOT_AVAILABLE);
    });

    // ---- isLoading / isDisabled ----

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

    it('should set isDisabled when viewCalculationsResponse is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.getByTestId('accordion-card').getAttribute('data-disabled')).toBe('true');
    });

    // ---- Accordion content ----

    it('should render accordion content with clone description when data exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_CLONES_DESC)).toBeTruthy();
    });

    it('should not render accordion content when viewCalculationsResponse is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.queryByText(GENERAL.ES_CLONES_DESC)).toBeNull();
    });

    it('should render TableLayout items from viewCalculationForFsxw', () => {
        renderComponent();
        const layouts = screen.getAllByTestId('table-layout');
        expect(layouts.length).toBe(2);
        expect(layouts[0].getAttribute('data-label')).toBe('Clone volume cost');
    });

    it('should call viewCalculationForFsxw with correct arguments', () => {
        const response = { fsxwCloneCalculation: { totalCloneMonthlyCost: '100' } };
        renderComponent({ viewCalculationsResponse: response, selectedDeploymentModel: 'FCI' });
        expect(mockViewCalculationForFsxw).toHaveBeenCalledWith(response, 'FCI');
    });
});
