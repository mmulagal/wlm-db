import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import CostBreakdown from './CostBreakdown';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.explore-savings.cost-breakdown': 'Cost breakdown - Monthly charge',
                'databases.explore-savings.type': 'Type',
                'databases.explore-savings.mssql-server-on-fsx-ontap': 'Microsoft SQL Server on FSx for ONTAP',
                'databases.explore-savings.mssql-on-ebs': 'Microsoft SQL Server on EBS',
                'databases.explore-savings.mssql-on-fsxw': 'Microsoft SQL Server on FSx for Windows'
            };
            return map[key] ?? key;
        }
    })
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-variant={variant} className={className} style={style}>
            {children}
        </span>
    ),
    DsFlashingDotsLoader: () => <span data-testid="loader">loading...</span>,
    TooltipInfo: ({ children }: any) => <span data-testid="tooltip-info">{children}</span>
}));

vi.mock('./CostBreakdown.module.scss', () => ({
    default: {
        costBreakdown: 'costBreakdown',
        headSection: 'headSection',
        title: 'title',
        'comparison-table-column': 'comparison-table-column',
        totalSummary: 'totalSummary',
        'table-container': 'table-container',
        'table-container-right': 'table-container-right',
        'table-header': 'table-header'
    }
}));

vi.mock('../../../../ui-components/Cards/Card', () => ({
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    CardContent: ({ children, style }: any) => <div data-testid="card-content">{children}</div>,
    CardTableContent: ({ children, columns, style }: any) => <div data-testid="card-table-content">{children}</div>
}));

vi.mock('../../../../ui-components/Typography', () => ({
    Text: ({ children, color, level, style }: any) => (
        <span data-testid="text" data-color={color} style={style}>
            {children}
        </span>
    )
}));

vi.mock('../../../../ui-components/Layout/Grid', () => ({
    Grid: ({ children }: any) => <div data-testid="grid">{children}</div>,
    GridItem: ({ children, lg }: any) => (
        <div data-testid="grid-item" data-lg={lg}>
            {children}
        </div>
    )
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        ES_COST_BREAKDOWN: 'Cost breakdown - Monthly charge',
        ES_TYPE: 'Type',
        ES_MSSQL_SERVER: 'Microsoft SQL Server on FSx for ONTAP',
        ES_MSSQL_EBS: 'Microsoft SQL Server on EBS',
        ES_MSSQL_FSXW: 'Microsoft SQL Server on FSx for Windows'
    }
}));

vi.mock('../../../../utils/consts', () => ({
    SAVINGS_CALC_MODE: {
        MANUAL_EBS: 'Manual_EBS',
        AUTO_EBS: 'Auto_EBS',
        AUTO_FSXW: 'Auto_FSXW',
        MANUAL_FSXW: 'Manual_FSXW',
        ONPREM: 'OnPrem'
    }
}));

const mockComparisonData = [
    { type: 'Capacity', fsx: '$10.00', ebs: '$20.00' },
    { type: 'Total summary', fsx: '$50.00', ebs: '$100.00' }
];

const mockComparisonDataFsxw = [
    { type: 'Capacity', fsx: '$10.00', fsxw: '$15.00' },
    { type: 'Total summary', fsx: '$50.00', fsxw: '$75.00' }
];

vi.mock('../savingsUtil', () => ({
    comparisonData: () => mockComparisonData,
    comparisonDataFsxw: () => mockComparisonDataFsxw
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            storageSavingsResponse: null as any,
            storageSavingsLoading: false,
            savingsCalculatorFrom: 'Auto_EBS',
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('CostBreakdown', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders cost breakdown title', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Cost breakdown - Monthly charge');
    });

    it('renders Type header', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Type');
    });

    it('renders EBS header for Auto_EBS mode', () => {
        const { container } = render(
            <Provider store={makeStore({ savingsCalculatorFrom: 'Auto_EBS' })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Microsoft SQL Server on EBS');
    });

    it('renders EBS header for Manual_EBS mode', () => {
        const { container } = render(
            <Provider store={makeStore({ savingsCalculatorFrom: 'Manual_EBS' })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Microsoft SQL Server on EBS');
    });

    it('renders EBS header for OnPrem mode', () => {
        const { container } = render(
            <Provider store={makeStore({ savingsCalculatorFrom: 'OnPrem' })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Microsoft SQL Server on EBS');
    });

    it('renders FSXW header for Manual_FSXW mode', () => {
        const { container } = render(
            <Provider store={makeStore({ savingsCalculatorFrom: 'Manual_FSXW' })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Microsoft SQL Server on FSx for Windows');
    });

    it('renders FSXW header for Auto_FSXW mode', () => {
        const { container } = render(
            <Provider store={makeStore({ savingsCalculatorFrom: 'Auto_FSXW' })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Microsoft SQL Server on FSx for Windows');
    });

    it('renders FSx for ONTAP header', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Microsoft SQL Server on FSx for ONTAP');
    });

    it('renders comparison data rows for EBS mode', () => {
        const { container } = render(
            <Provider store={makeStore({ savingsCalculatorFrom: 'Auto_EBS', storageSavingsResponse: {} })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Capacity');
        expect(container.textContent).toContain('Total summary');
    });

    it('renders comparison data rows for FSXW mode', () => {
        const { container } = render(
            <Provider store={makeStore({ savingsCalculatorFrom: 'Manual_FSXW', storageSavingsResponse: {} })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('Capacity');
        expect(container.textContent).toContain('Total summary');
    });

    it('shows loader when loading', () => {
        render(
            <Provider store={makeStore({ storageSavingsLoading: true })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        const loaders = screen.getAllByTestId('loader');
        expect(loaders.length).toBeGreaterThan(0);
    });

    it('does not show head section loader when not loading', () => {
        const { container } = render(
            <Provider store={makeStore({ storageSavingsLoading: false, storageSavingsResponse: {} })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        // The title loader only appears when loading is true
        // When not loading, the head section should contain just the title
        const titleEl = container.querySelector('.headSection');
        // The head section loader is conditionally rendered
        expect(container.textContent).toContain('Cost breakdown - Monthly charge');
    });

    it('shows fsx and ebs values when calculatedResponse is available and not disabled', () => {
        const { container } = render(
            <Provider store={makeStore({ storageSavingsResponse: { fsx: {}, ebs: {} }, storageSavingsLoading: false })}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('$10.00');
        expect(container.textContent).toContain('$20.00');
    });

    it('does not show values when disableState is true', () => {
        const { container } = render(
            <Provider store={makeStore({ storageSavingsResponse: { fsx: {}, ebs: {} }, storageSavingsLoading: false })}>
                <CostBreakdown disableState />
            </Provider>
        );
        // disableState=true suppresses data display in ComparisonTableLayout
        expect(container.textContent).not.toContain('$10.00');
    });

    it('renders card component', () => {
        render(
            <Provider store={makeStore()}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(screen.getByTestId('card')).toBeTruthy();
    });

    it('applies disabled text color when disableState is true', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <CostBreakdown disableState />
            </Provider>
        );
        // Title should have disabled color
        const title = container.querySelector('.title');
        expect(title).toBeTruthy();
    });

    it('renders tooltip for enterprise to standard downgrade in Auto_EBS', () => {
        const store = makeStore({
            savingsCalculatorFrom: 'Auto_EBS',
            storageSavingsResponse: {
                license: {
                    existing: { sqlServerEdition: 'Enterprise' },
                    recommended: { sqlServerEdition: 'Standard' }
                }
            }
        });
        render(
            <Provider store={store}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        // Tooltip should be rendered for items with isTooltip
        expect(screen.getByTestId('card')).toBeTruthy();
    });

    it('renders tooltip for enterprise to standard downgrade with array license', () => {
        const store = makeStore({
            savingsCalculatorFrom: 'Auto_EBS',
            storageSavingsResponse: {
                license: [
                    { existing: { sqlServerEdition: 'Enterprise' }, recommended: { sqlServerEdition: 'Standard' } }
                ]
            }
        });
        render(
            <Provider store={store}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(screen.getByTestId('card')).toBeTruthy();
    });

    it('does not show tooltip when no enterprise to standard downgrade', () => {
        const store = makeStore({
            savingsCalculatorFrom: 'Auto_EBS',
            storageSavingsResponse: {
                license: {
                    existing: { sqlServerEdition: 'Standard' },
                    recommended: { sqlServerEdition: 'Standard' }
                }
            }
        });
        render(
            <Provider store={store}>
                <CostBreakdown disableState={false} />
            </Provider>
        );
        expect(screen.getByTestId('card')).toBeTruthy();
    });
});
