import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import FsxnMazCalculation from './FsxnMazCalculation';
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

const mockViewCalculation = vi.fn().mockReturnValue({
    FSxNCalculation: [
        { label: 'FSxN storage cost', value: '$200' },
        { label: 'Total cost', value: '$500' }
    ]
});
vi.mock('../../../SavingsCalculator/savingsUtil', () => ({
    viewCalculation: (...args: any[]) => mockViewCalculation(...args)
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

const defaultResponse = { totalAzCost: '400' };

const createMockStore = (overrides: Record<string, any> = {}) => {
    const defaults = {
        viewCalculationsResponse: defaultResponse,
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
            <FsxnMazCalculation />
        </Provider>
    );
};

// ========================
//  Tests
// ========================

describe('FsxnMazCalculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockViewCalculation.mockReturnValue({
            FSxNCalculation: [
                { label: 'FSxN storage cost', value: '$200' },
                { label: 'Total cost', value: '$500' }
            ]
        });
    });

    it('should render without crashing', () => {
        const { container } = renderComponent();
        expect(container.firstChild).toBeTruthy();
    });

    it('should render AccordionCard with Multi AZ title', () => {
        renderComponent();
        expect(screen.getByTestId('accordion-title').textContent).toBe(GENERAL.ES_FSXN_MULTI);
    });

    // ---- setHeader ----

    it('should show cost in header when response exists', () => {
        renderComponent();
        expect(screen.getByTestId('accordion-value').textContent).toContain('$400');
    });

    it('should show N/A in header when response is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.getByTestId('accordion-value').textContent).toContain(GENERAL.NOT_AVAILABLE);
    });

    // ---- isLoading ----

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

    it('should render AZ description when data exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_FSXN_AZ_DESC)).toBeTruthy();
    });

    it('should not render content when response is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });

    it('should render TableLayout items', () => {
        renderComponent();
        const layouts = screen.getAllByTestId('table-layout');
        expect(layouts.length).toBe(2);
    });

    it('should call viewCalculation with type Multi and correct args', () => {
        renderComponent({ selectedDeploymentModel: 'FCI' });
        expect(mockViewCalculation).toHaveBeenCalledWith({ ...defaultResponse, type: 'Multi' }, 'FCI');
    });
});
