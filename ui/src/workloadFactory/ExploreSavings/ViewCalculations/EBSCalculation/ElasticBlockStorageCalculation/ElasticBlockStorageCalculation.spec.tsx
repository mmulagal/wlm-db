import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ElasticBlockStorageCalculation from './ElasticBlockStorageCalculation';
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
    gp3VolumeType: [{ label: 'gp3 cost', value: '$10' }],
    io2VolumeType: [{ label: 'io2 cost', value: '$20' }],
    io1VolumeType: [{ label: 'io1 cost', value: '$15' }],
    gp2VolumeType: [{ label: 'gp2 cost', value: '$12' }],
    st1VolumeType: [{ label: 'st1 cost', value: '$8' }],
    ebsTotalCost: [{ label: 'EBS total cost', value: '$100' }]
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

const fullResponse = {
    ebsOnlyCost: '500',
    ebsCalculation: {
        gp3: { cost: '10' },
        io2: { cost: '20' },
        io1: { cost: '15' },
        gp2: { cost: '12' },
        st1: { cost: '8' }
    }
};

const createMockStore = (overrides: Record<string, any> = {}) => {
    const defaults = {
        viewCalculationsResponse: fullResponse,
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
            <ElasticBlockStorageCalculation />
        </Provider>
    );
};

// ========================
//  Tests
// ========================

describe('ElasticBlockStorageCalculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockViewCalculationForEBS.mockReturnValue({
            gp3VolumeType: [{ label: 'gp3 cost', value: '$10' }],
            io2VolumeType: [{ label: 'io2 cost', value: '$20' }],
            io1VolumeType: [{ label: 'io1 cost', value: '$15' }],
            gp2VolumeType: [{ label: 'gp2 cost', value: '$12' }],
            st1VolumeType: [{ label: 'st1 cost', value: '$8' }],
            ebsTotalCost: [{ label: 'EBS total cost', value: '$100' }]
        });
    });

    it('should render without crashing', () => {
        const { container } = renderComponent();
        expect(container.firstChild).toBeTruthy();
    });

    it('should render AccordionCard with correct title', () => {
        renderComponent();
        expect(screen.getByTestId('accordion-title').textContent).toBe(GENERAL.ES_EBS);
    });

    // ---- setHeader ----

    it('should show cost in header when response exists', () => {
        renderComponent();
        expect(screen.getByTestId('accordion-value').textContent).toContain('$500');
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

    // ---- Content when null ----

    it('should not render content when viewCalculationsResponse is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.queryByText(GENERAL.ES_EBS_DESC)).toBeNull();
    });

    // ---- Content with all volume types ----

    it('should render EBS description', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_EBS_DESC)).toBeTruthy();
    });

    it('should render GP3 section when gp3 data exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_GP3_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render IO2 section when io2 data exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_IO2_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render IO1 section when io1 data exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_IO1_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render GP2 section when gp2 data exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_GP2_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render ST1 section when st1 data exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_ST1_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render EBS total cost section', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_EBS_TOTAL_COST)).toBeTruthy();
    });

    // ---- Volume type absent ----

    it('should not render GP3 section when gp3 is absent', () => {
        renderComponent({
            viewCalculationsResponse: { ...fullResponse, ebsCalculation: { ...fullResponse.ebsCalculation, gp3: null } }
        });
        expect(screen.queryByText(GENERAL.ES_GP3_VOLUME_TYPE)).toBeNull();
    });

    it('should not render IO2 section when io2 is absent', () => {
        renderComponent({
            viewCalculationsResponse: { ...fullResponse, ebsCalculation: { ...fullResponse.ebsCalculation, io2: null } }
        });
        expect(screen.queryByText(GENERAL.ES_IO2_VOLUME_TYPE)).toBeNull();
    });

    it('should not render IO1 section when io1 is absent', () => {
        renderComponent({
            viewCalculationsResponse: { ...fullResponse, ebsCalculation: { ...fullResponse.ebsCalculation, io1: null } }
        });
        expect(screen.queryByText(GENERAL.ES_IO1_VOLUME_TYPE)).toBeNull();
    });

    it('should not render GP2 section when gp2 is absent', () => {
        renderComponent({
            viewCalculationsResponse: { ...fullResponse, ebsCalculation: { ...fullResponse.ebsCalculation, gp2: null } }
        });
        expect(screen.queryByText(GENERAL.ES_GP2_VOLUME_TYPE)).toBeNull();
    });

    it('should not render ST1 section when st1 is absent', () => {
        renderComponent({
            viewCalculationsResponse: { ...fullResponse, ebsCalculation: { ...fullResponse.ebsCalculation, st1: null } }
        });
        expect(screen.queryByText(GENERAL.ES_ST1_VOLUME_TYPE)).toBeNull();
    });

    it('should call viewCalculationForEBS with correct arguments', () => {
        renderComponent({ selectedDeploymentModel: 'FCI' });
        expect(mockViewCalculationForEBS).toHaveBeenCalledWith(fullResponse, 'FCI');
    });
});
