import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import WindowFileServer from './WindowFileServer';
import { GENERAL } from '../../../../utils/appConstants';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => <span data-variant={variant} className={className}>{children}</span>,
    DsFlashingDotsLoader: () => <div data-testid="loader" />
}));

vi.mock('../../../../ui-components/Layout/Grid', () => ({
    Grid: ({ children }: any) => <div data-testid="grid">{children}</div>,
    GridItem: ({ children, lg }: any) => <div data-testid={`grid-item-${lg}`}>{children}</div>
}));

vi.mock('../../../../ui-components/Typography', () => ({
    Text: ({ children, color, level, style }: any) => <span data-color={color} data-level={level}>{children}</span>
}));

vi.mock('./WindowFileServer.module.scss', () => ({
    default: { winServer: 'winServer', head: 'head', loading: 'loading', 'comparison-table-column': 'comparison-table-column' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    getAzType: (val: string) => val === 'multi' ? 'Multi-AZ' : val === 'single' ? 'Single-AZ' : ''
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedHostDetails: {
                sqlServerInstances: [
                    {
                        deploymentTypes: [{ type: 'single' }]
                    }
                ]
            },
            viewCalculationsResponse: {
                fsxwCalculation: {
                    desiredStorageCapacity: '500 GiB',
                    sumOfDefaultAndAdditionalProvisionedIops: 10000,
                    provisionedThroughputCapacity: 512
                }
            },
            viewCalculationsLoading: false,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('WindowFileServer', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the header text', () => {
        const { container } = render(<Provider store={makeStore()}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain(GENERAL.WINDOW_FILE_SERVER_DETAILS);
    });

    it('renders deployment type from host details', () => {
        const { container } = render(<Provider store={makeStore()}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain('Single-AZ');
    });

    it('renders total storage amount', () => {
        const { container } = render(<Provider store={makeStore()}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain('500 GiB');
    });

    it('renders provisioned IOPS', () => {
        const { container } = render(<Provider store={makeStore()}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain('10000 IOPS');
    });

    it('renders throughput', () => {
        const { container } = render(<Provider store={makeStore()}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain('512 MB/s');
    });

    it('shows NOT_AVAILABLE when no deployment type found', () => {
        const { container } = render(<Provider store={makeStore({ selectedHostDetails: {} })}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain(GENERAL.NOT_AVAILABLE);
    });

    it('shows NOT_AVAILABLE for missing storage values', () => {
        const { container } = render(<Provider store={makeStore({
            viewCalculationsResponse: { fsxwCalculation: {} }
        })}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain(GENERAL.NOT_AVAILABLE);
    });

    it('shows loader when viewCalculationsLoading is true', () => {
        render(<Provider store={makeStore({ viewCalculationsLoading: true })}><WindowFileServer /></Provider>);
        const loaders = screen.getAllByTestId('loader');
        expect(loaders.length).toBeGreaterThan(0);
    });

    it('does not show loader when viewCalculationsLoading is false', () => {
        render(<Provider store={makeStore({ viewCalculationsLoading: false })}><WindowFileServer /></Provider>);
        expect(screen.queryByTestId('loader')).toBeNull();
    });

    it('renders deployment type label', () => {
        const { container } = render(<Provider store={makeStore()}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain('Deployment type');
    });

    it('renders labels for all fields', () => {
        const { container } = render(<Provider store={makeStore()}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain('Total storage amount');
        expect(container.textContent).toContain('Total provisioned IOPS');
        expect(container.textContent).toContain('Total throughput');
    });

    it('handles null viewCalculationsResponse', () => {
        const { container } = render(<Provider store={makeStore({ viewCalculationsResponse: null })}><WindowFileServer /></Provider>);
        expect(container.textContent).toContain(GENERAL.NOT_AVAILABLE);
    });
});
