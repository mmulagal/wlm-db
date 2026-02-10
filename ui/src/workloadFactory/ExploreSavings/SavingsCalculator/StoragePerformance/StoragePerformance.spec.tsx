import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StoragePerformance from './StoragePerformance';

// Mocks
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style, className }: any) => <span data-variant={variant} style={style} className={className}>{children}</span>
}));

vi.mock('./StoragePerfInput/StoragePerfInput', () => ({
    default: ({ printState, data, uniqueKey }: any) => (
        <div data-testid={`storage-perf-input-${uniqueKey}`} data-print={String(printState)}>
            {data?.sqlInstanceName}
        </div>
    )
}));

vi.mock('./StoragePerformance.module.scss', () => ({
    default: {
        storagePerf: 'storagePerf',
        computeTable: 'computeTable',
        row1: 'row1',
        col1: 'col1',
        col2: 'col2',
        col3: 'col3',
        col4: 'col4'
    }
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            exploreSavings: () => ({
                onPremStorageAndComputeInfo: {
                    'host1_inst1': { sqlInstanceName: 'Instance1', totalStorage: 100 },
                    'host1_inst2': { sqlInstanceName: 'Instance2', totalStorage: 200 }
                },
                ...overrides
            })
        }
    });

describe('StoragePerformance', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the header text', () => {
        const { container } = render(<Provider store={makeStore()}><StoragePerformance printState={false} /></Provider>);
        expect(container.textContent).toContain('Storage & performance:');
    });

    it('renders column headers', () => {
        const { container } = render(<Provider store={makeStore()}><StoragePerformance printState={false} /></Provider>);
        expect(container.textContent).toContain('Total Storage amount (GiB)');
        expect(container.textContent).toContain('IOPS');
        expect(container.textContent).toContain('Throughput (MB/s)');
    });

    it('renders StoragePerfInput for each data entry in single host mode', () => {
        render(<Provider store={makeStore()}><StoragePerformance printState={false} /></Provider>);
        expect(screen.getByTestId('storage-perf-input-host1_inst1')).toBeTruthy();
        expect(screen.getByTestId('storage-perf-input-host1_inst2')).toBeTruthy();
    });

    it('renders SQL instance names', () => {
        const { container } = render(<Provider store={makeStore()}><StoragePerformance printState={false} /></Provider>);
        expect(container.textContent).toContain('Instance1');
        expect(container.textContent).toContain('Instance2');
    });

    it('filters data for specific host in bulk mode', () => {
        const store = makeStore({
            onPremStorageAndComputeInfo: {
                'hostA_inst1': { sqlInstanceName: 'HostA-Inst1' },
                'hostB_inst1': { sqlInstanceName: 'HostB-Inst1' }
            }
        });
        render(
            <Provider store={store}>
                <StoragePerformance printState={false} host={{ resourceId: 'hostA' }} />
            </Provider>
        );
        expect(screen.getByTestId('storage-perf-input-hostA_inst1')).toBeTruthy();
        expect(screen.queryByTestId('storage-perf-input-hostB_inst1')).toBeNull();
    });

    it('shows all data when no host prop (single mode)', () => {
        const store = makeStore({
            onPremStorageAndComputeInfo: {
                'hostA_inst1': { sqlInstanceName: 'HostA-Inst1' },
                'hostB_inst1': { sqlInstanceName: 'HostB-Inst1' }
            }
        });
        render(
            <Provider store={store}>
                <StoragePerformance printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('storage-perf-input-hostA_inst1')).toBeTruthy();
        expect(screen.getByTestId('storage-perf-input-hostB_inst1')).toBeTruthy();
    });

    it('passes printState to StoragePerfInput', () => {
        render(<Provider store={makeStore()}><StoragePerformance printState={true} /></Provider>);
        expect(screen.getByTestId('storage-perf-input-host1_inst1')).toHaveAttribute('data-print', 'true');
    });

    it('renders nothing when no data', () => {
        render(
            <Provider store={makeStore({ onPremStorageAndComputeInfo: {} })}>
                <StoragePerformance printState={false} />
            </Provider>
        );
        expect(screen.queryByTestId(/storage-perf-input/)).toBeNull();
    });
});
