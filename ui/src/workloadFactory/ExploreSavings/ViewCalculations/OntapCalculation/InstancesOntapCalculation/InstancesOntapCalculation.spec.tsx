import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InstancesOntapCalculation from './InstancesOntapCalculation';
import { GENERAL } from '../../../../../utils/appConstants';

// ========================
//  Mocks
// ========================

const mockSetOpenChildren = vi.fn();

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
    ),
    useAccordionContext: () => ({ setOpenChildren: mockSetOpenChildren })
}));

const mockViewCalculation = vi.fn().mockReturnValue({
    Ec2InstanceCalculation: [
        { label: 'EC2 instance type', value: 'm5.xlarge' },
        { label: 'EC2 machines total cost', value: '$200' }
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

const singleResponse = {
    totalFsxEc2MachineCost: '300',
    fsxInstanceCalculation: [
        { label: 'EC2 instance type', value: 'm5.xlarge' },
        { label: 'EC2 machines total cost', value: '$300' }
    ]
};

const bulkResponse = {
    totalFsxEc2MachineCost: '600',
    fsxInstanceCalculation: [
        {
            hostName: 'Host1',
            fsxInstanceCalculation: [
                { label: 'EC2 instance type', value: 'm5.xlarge' },
                { label: 'EC2 machines total cost', value: '$300' }
            ]
        },
        {
            hostName: 'Host2',
            fsxInstanceCalculation: [
                { label: 'EC2 instance type', value: 'm5.2xlarge' },
                { label: 'EC2 machines total cost', value: '$300' }
            ]
        }
    ]
};

const createMockStore = (overrides: Record<string, any> = {}) => {
    const defaults = {
        viewCalculationsResponse: singleResponse,
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
            <InstancesOntapCalculation />
        </Provider>
    );
};

// ========================
//  Tests
// ========================

describe('InstancesOntapCalculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockViewCalculation.mockReturnValue({
            Ec2InstanceCalculation: [
                { label: 'EC2 instance type', value: 'm5.xlarge' },
                { label: 'EC2 machines total cost', value: '$300' }
            ]
        });
    });

    it('should render without crashing', () => {
        const { container } = renderComponent();
        expect(container.firstChild).toBeTruthy();
    });

    // ---- useAccordionContext – second useEffect ----

    describe('accordion context effect', () => {
        it('should close all accordions when loading', () => {
            renderComponent({ viewCalculationsLoading: true });
            expect(mockSetOpenChildren).toHaveBeenCalledWith({
                1: false,
                2: false,
                3: false,
                4: false,
                5: false,
                6: false,
                7: false,
                8: false,
                9: false,
                10: false,
                11: false
            });
        });

        it('should open first accordion when not loading and response exists', () => {
            renderComponent({ viewCalculationsLoading: false });
            expect(mockSetOpenChildren).toHaveBeenCalledWith({ 1: true });
        });

        it('should not open accordions when not loading and response is null', () => {
            renderComponent({ viewCalculationsResponse: null, viewCalculationsLoading: false });
            // setOpenChildren should NOT have been called with { 1: true }
            const { calls } = mockSetOpenChildren.mock;
            const openCall = calls.find((c: any) => c[0]?.['1'] === true);
            expect(openCall).toBeUndefined();
        });
    });

    // ---- Single (non-bulk) mode ----

    describe('Single host mode', () => {
        it('should render single AccordionCard with correct title', () => {
            renderComponent();
            expect(screen.getByTestId('accordion-title').textContent).toBe(GENERAL.ES_MSSQL_EC2_INSTANCES);
        });

        it('should show total cost in header', () => {
            renderComponent();
            expect(screen.getByTestId('accordion-value').textContent).toContain('$300');
        });

        it('should render TableLayout items from viewCalculation', () => {
            renderComponent();
            const layouts = screen.getAllByTestId('table-layout');
            expect(layouts.length).toBe(2);
        });

        it('should show N/A in header when viewCalculationsResponse is null', () => {
            renderComponent({ viewCalculationsResponse: null });
            expect(screen.getByTestId('accordion-value').textContent).toContain(GENERAL.NOT_AVAILABLE);
        });

        it('should not render content when viewCalculationsResponse is null', () => {
            renderComponent({ viewCalculationsResponse: null });
            expect(screen.queryByTestId('accordion-content')).toBeNull();
        });

        it('should handle viewCalculation returning null Ec2InstanceCalculation', () => {
            mockViewCalculation.mockReturnValue({ Ec2InstanceCalculation: null });
            renderComponent();
            // || [] fallback means no crash and no table layouts
            expect(screen.queryByTestId('table-layout')).toBeNull();
        });
    });

    // ---- Bulk mode ----

    describe('Bulk host mode', () => {
        it('should render multiple AccordionCards for bulk data', () => {
            renderComponent({ viewCalculationsResponse: bulkResponse });
            const cards = screen.getAllByTestId('accordion-card');
            expect(cards.length).toBe(2);
        });

        it('should include hostName in title', () => {
            renderComponent({ viewCalculationsResponse: bulkResponse });
            const titles = screen.getAllByTestId('accordion-title');
            expect(titles[0].textContent).toContain('Host1');
            expect(titles[1].textContent).toContain('Host2');
        });

        it('should show host-specific cost in header from bulk calculation', () => {
            renderComponent({ viewCalculationsResponse: bulkResponse });
            const values = screen.getAllByTestId('accordion-value');
            expect(values[0].textContent).toContain('$300');
        });

        it('should render TableLayout items for each host', () => {
            renderComponent({ viewCalculationsResponse: bulkResponse });
            const layouts = screen.getAllByTestId('table-layout');
            expect(layouts.length).toBe(4); // 2 per host
        });

        it('should fallback to "Host N" when hostName is empty', () => {
            const bulkNoName = {
                ...bulkResponse,
                fsxInstanceCalculation: [
                    { hostName: 'ValidHost', fsxInstanceCalculation: [{ label: 'cost', value: '$1' }] },
                    { hostName: '', fsxInstanceCalculation: [{ label: 'cost', value: '$2' }] }
                ]
            };
            renderComponent({ viewCalculationsResponse: bulkNoName });
            const titles = screen.getAllByTestId('accordion-title');
            expect(titles[1].textContent).toContain('Host 2');
        });

        it('should show $0 when totalCostEntry is not found in host calculation', () => {
            const bulkNoCost = {
                ...bulkResponse,
                fsxInstanceCalculation: [{ hostName: 'H1', fsxInstanceCalculation: [{ label: 'other', value: '$5' }] }]
            };
            renderComponent({ viewCalculationsResponse: bulkNoCost });
            expect(screen.getByTestId('accordion-value').textContent).toContain('$0');
        });

        it('should handle null fsxInstanceCalculation in a host (|| [] fallback)', () => {
            const bulkNullCalc = {
                ...bulkResponse,
                fsxInstanceCalculation: [{ hostName: 'H1', fsxInstanceCalculation: null }]
            };
            renderComponent({ viewCalculationsResponse: bulkNullCalc });
            // No crash; header shows $0
            expect(screen.getByTestId('accordion-value').textContent).toContain('$0');
        });
    });

    // ---- Loading state ----

    describe('Loading state', () => {
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
    });
});
