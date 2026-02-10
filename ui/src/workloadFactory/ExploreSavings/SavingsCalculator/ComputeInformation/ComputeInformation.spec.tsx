import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ComputeInformation from './ComputeInformation';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style, className }: any) => <span data-variant={variant} style={style} className={className}>{children}</span>
}));

vi.mock('./ComputeInputComponent/ComputeInputComponent', () => ({
    default: ({ data, uniqueKey, index, printState }: any) => (
        <div data-testid={`compute-input-${uniqueKey}`} data-print={String(printState)} data-index={index}>
            {data?.sqlInstanceName}
        </div>
    )
}));

vi.mock('./ComputeInformation.module.scss', () => ({
    default: { computeInformation: 'computeInformation', computeTable: 'computeTable', row1: 'row1', col1: 'col1', col2: 'col2', col3: 'col3', col4: 'col4' }
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            onPremStorageAndComputeInfo: {
                'host1_inst1': { sqlInstanceName: 'SQL1', noOfVcpusInUse: 4 },
                'host1_inst2': { sqlInstanceName: 'SQL2', noOfVcpusInUse: 8 }
            },
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('ComputeInformation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the header text', () => {
        const { container } = render(<Provider store={makeStore()}><ComputeInformation printState={false} /></Provider>);
        expect(container.textContent).toContain('Compute information:');
    });

    it('renders column headers', () => {
        const { container } = render(<Provider store={makeStore()}><ComputeInformation printState={false} /></Provider>);
        expect(container.textContent).toContain('Number of vCPUs in use');
        expect(container.textContent).toContain('Memory (GiB)');
        expect(container.textContent).toContain('Network performance');
    });

    it('renders ComputeInputComponent for each entry in single host mode', () => {
        render(<Provider store={makeStore()}><ComputeInformation printState={false} /></Provider>);
        expect(screen.getByTestId('compute-input-host1_inst1')).toBeTruthy();
        expect(screen.getByTestId('compute-input-host1_inst2')).toBeTruthy();
    });

    it('renders SQL instance names', () => {
        const { container } = render(<Provider store={makeStore()}><ComputeInformation printState={false} /></Provider>);
        expect(container.textContent).toContain('SQL1');
        expect(container.textContent).toContain('SQL2');
    });

    it('filters data for specific host in bulk mode', () => {
        const store = makeStore({
            onPremStorageAndComputeInfo: {
                'hostA_inst1': { sqlInstanceName: 'A1' },
                'hostB_inst1': { sqlInstanceName: 'B1' }
            }
        });
        render(<Provider store={store}><ComputeInformation printState={false} host={{ resourceId: 'hostA' }} /></Provider>);
        expect(screen.getByTestId('compute-input-hostA_inst1')).toBeTruthy();
        expect(screen.queryByTestId('compute-input-hostB_inst1')).toBeNull();
    });

    it('shows all data when no host prop', () => {
        const store = makeStore({
            onPremStorageAndComputeInfo: {
                'hostA_inst1': { sqlInstanceName: 'A1' },
                'hostB_inst1': { sqlInstanceName: 'B1' }
            }
        });
        render(<Provider store={store}><ComputeInformation printState={false} /></Provider>);
        expect(screen.getByTestId('compute-input-hostA_inst1')).toBeTruthy();
        expect(screen.getByTestId('compute-input-hostB_inst1')).toBeTruthy();
    });

    it('passes printState to ComputeInputComponent', () => {
        render(<Provider store={makeStore()}><ComputeInformation printState={true} /></Provider>);
        expect(screen.getByTestId('compute-input-host1_inst1')).toHaveAttribute('data-print', 'true');
    });

    it('renders nothing when data is empty', () => {
        render(<Provider store={makeStore({ onPremStorageAndComputeInfo: {} })}><ComputeInformation printState={false} /></Provider>);
        expect(screen.queryByTestId(/compute-input/)).toBeNull();
    });
});
