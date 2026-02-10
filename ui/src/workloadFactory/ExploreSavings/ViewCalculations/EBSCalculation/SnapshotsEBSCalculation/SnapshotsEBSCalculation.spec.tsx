import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SnapshotsEBSCalculation from './SnapshotsEBSCalculation';
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
    gp3SnapshotType: [{ label: 'gp3 snap cost', value: '$5' }],
    io2SnapshotType: [{ label: 'io2 snap cost', value: '$10' }],
    io1SnapshotType: [{ label: 'io1 snap cost', value: '$8' }],
    gp2SnapshotType: [{ label: 'gp2 snap cost', value: '$6' }],
    st1SnapshotType: [{ label: 'st1 snap cost', value: '$4' }],
    snapshotsTotalCost: [{ label: 'Total snapshots cost', value: '$50' }]
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
    ebsSnapshotCalculation: {
        totalEbsSnapshotCost: '150',
        gp3: { totalEbsSnapshotCost: '30' },
        io2: { totalEbsSnapshotCost: '40' },
        io1: { totalEbsSnapshotCost: '25' },
        gp2: { totalEbsSnapshotCost: '20' },
        st1: { totalEbsSnapshotCost: '15' }
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
            <SnapshotsEBSCalculation />
        </Provider>
    );
};

// ========================
//  Tests
// ========================

describe('SnapshotsEBSCalculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockViewCalculationForEBS.mockReturnValue({
            gp3SnapshotType: [{ label: 'gp3 snap cost', value: '$5' }],
            io2SnapshotType: [{ label: 'io2 snap cost', value: '$10' }],
            io1SnapshotType: [{ label: 'io1 snap cost', value: '$8' }],
            gp2SnapshotType: [{ label: 'gp2 snap cost', value: '$6' }],
            st1SnapshotType: [{ label: 'st1 snap cost', value: '$4' }],
            snapshotsTotalCost: [{ label: 'Total snapshots cost', value: '$50' }]
        });
    });

    it('should render without crashing', () => {
        const { container } = renderComponent();
        expect(container.firstChild).toBeTruthy();
    });

    it('should render AccordionCard with correct title', () => {
        renderComponent();
        expect(screen.getByTestId('accordion-title').textContent).toBe(GENERAL.ES_SNAPSHOTS);
    });

    // ---- setHeader ----

    it('should show cost in header when response exists', () => {
        renderComponent();
        expect(screen.getByTestId('accordion-value').textContent).toContain('$150');
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

    // ---- Content when null ----

    it('should not render content when response is null', () => {
        renderComponent({ viewCalculationsResponse: null });
        expect(screen.queryByText(GENERAL.ES_SNAPSHOTS_DESC)).toBeNull();
    });

    // ---- Content with all snapshot volume types ----

    it('should render snapshot description', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_SNAPSHOTS_DESC)).toBeTruthy();
    });

    it('should render GP3 section when gp3 snapshot cost exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_GP3_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render IO2 section when io2 snapshot cost exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_IO2_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render IO1 section when io1 snapshot cost exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_IO1_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render GP2 section when gp2 snapshot cost exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_GP2_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render ST1 section when st1 snapshot cost exists', () => {
        renderComponent();
        expect(screen.getByText(GENERAL.ES_ST1_VOLUME_TYPE)).toBeTruthy();
    });

    it('should render snapshots total cost section', () => {
        renderComponent();
        expect(screen.getByText(`${GENERAL.ES_SNAPSHOTS} total cost`)).toBeTruthy();
    });

    // ---- Snapshot volume type absent ----

    it('should not render GP3 section when gp3 snapshot cost is falsy', () => {
        renderComponent({
            viewCalculationsResponse: {
                ...fullResponse,
                ebsSnapshotCalculation: { ...fullResponse.ebsSnapshotCalculation, gp3: { totalEbsSnapshotCost: '' } }
            }
        });
        expect(screen.queryByText(GENERAL.ES_GP3_VOLUME_TYPE)).toBeNull();
    });

    it('should not render IO2 section when io2 snapshot cost is falsy', () => {
        renderComponent({
            viewCalculationsResponse: {
                ...fullResponse,
                ebsSnapshotCalculation: { ...fullResponse.ebsSnapshotCalculation, io2: { totalEbsSnapshotCost: '' } }
            }
        });
        expect(screen.queryByText(GENERAL.ES_IO2_VOLUME_TYPE)).toBeNull();
    });

    it('should not render IO1 section when io1 snapshot cost is falsy', () => {
        renderComponent({
            viewCalculationsResponse: {
                ...fullResponse,
                ebsSnapshotCalculation: { ...fullResponse.ebsSnapshotCalculation, io1: { totalEbsSnapshotCost: '' } }
            }
        });
        expect(screen.queryByText(GENERAL.ES_IO1_VOLUME_TYPE)).toBeNull();
    });

    it('should not render GP2 section when gp2 snapshot cost is falsy', () => {
        renderComponent({
            viewCalculationsResponse: {
                ...fullResponse,
                ebsSnapshotCalculation: { ...fullResponse.ebsSnapshotCalculation, gp2: { totalEbsSnapshotCost: '' } }
            }
        });
        expect(screen.queryByText(GENERAL.ES_GP2_VOLUME_TYPE)).toBeNull();
    });

    it('should not render ST1 section when st1 snapshot cost is falsy', () => {
        renderComponent({
            viewCalculationsResponse: {
                ...fullResponse,
                ebsSnapshotCalculation: { ...fullResponse.ebsSnapshotCalculation, st1: { totalEbsSnapshotCost: '' } }
            }
        });
        expect(screen.queryByText(GENERAL.ES_ST1_VOLUME_TYPE)).toBeNull();
    });

    it('should call viewCalculationForEBS with correct arguments', () => {
        renderComponent({ selectedDeploymentModel: 'FCI' });
        expect(mockViewCalculationForEBS).toHaveBeenCalledWith(fullResponse, 'FCI');
    });
});
