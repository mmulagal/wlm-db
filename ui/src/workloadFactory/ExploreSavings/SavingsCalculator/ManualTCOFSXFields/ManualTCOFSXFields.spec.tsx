import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ManualTCOFSXFields from './ManualTCOFSXFields';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => (
        <span data-variant={variant} className={className}>
            {children}
        </span>
    ),
    SelectField: ({ label, value, options, onChange, isDisabled, defaultValue, className }: any) => (
        <div data-testid={`select-${label?.replace(/\s+/g, '-')}`} data-disabled={String(!!isDisabled)}>
            <span data-testid={`select-value-${label?.replace(/\s+/g, '-')}`}>
                {(value || defaultValue)?.label || ''}
            </span>
            <span data-testid={`select-count-${label?.replace(/\s+/g, '-')}`}>{options?.length || 0}</span>
            <button
                data-testid={`select-btn-${label?.replace(/\s+/g, '-')}`}
                onClick={() => onChange && onChange(options?.[0])}
            >
                change
            </button>
        </div>
    ),
    TextField: ({ label, onChange, value, className, error }: any) => (
        <div data-testid={`text-field-${label?.replace(/\s+/g, '-')}`}>
            <input aria-label={label} onChange={onChange} value={value || ''} />
            {error && <span data-testid={`error-${label?.replace(/\s+/g, '-')}`}>{error}</span>}
        </div>
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({ optionType: {} }));

vi.mock('./ManualTCOFSXFields.module.scss', () => ({
    default: {
        manualTCOFSX: 'manualTCOFSX',
        fieldContainer: 'fieldContainer',
        rowContainer: 'rowContainer',
        deploymentModelWidth: 'deploymentModelWidth',
        storageCapacityField: 'storageCapacityField',
        SCWidth: 'SCWidth',
        SCUnitWidth: 'SCUnitWidth'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { mockInputClone: 'mockInputClone', mockLabel: 'mockLabel', inputField: 'inputField' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: (label: string, value: any) => ({ label, value })
}));

vi.mock('../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: () => [null, vi.fn()]
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedManualDeploymentType: (val: any) => ({ type: 'test/setSelectedManualDeploymentType', payload: val }),
    setSelectedManualStorageCapacity: (val: any) => ({ type: 'test/setSelectedManualStorageCapacity', payload: val }),
    setSelectedManualStorageCapacityUnit: (val: any) => ({
        type: 'test/setSelectedManualStorageCapacityUnit',
        payload: val
    }),
    setSelectedManualStorageType: (val: any) => ({ type: 'test/setSelectedManualStorageType', payload: val }),
    setSelectedManualFSXIOPS: (val: any) => ({ type: 'test/setSelectedManualFSXIOPS', payload: val }),
    setSelectedManualFSXThroughput: (val: any) => ({ type: 'test/setSelectedManualFSXThroughput', payload: val })
}));

vi.mock('../../../../utils/consts', () => ({
    TCO_MANUAL_DEPLOYMENT_TYPE: { SINGLE: 'Single availability zone', MULTI: 'Multi availability zone' }
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedManualDeploymentType: null as any,
            selectedManualDeploymentModel: null as any,
            selectedManualStorageType: null as any,
            selectedManualStorageCapacityUnit: null as any,
            manualStorageCapacity: 2,
            selectedManualFSXIOPS: 6000,
            selectedManualFSXThroughput: 128,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('ManualTCOFSXFields', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders FSx for Windows File Server settings heading', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(container.textContent).toContain('FSx for Windows File Server settings');
    });

    it('renders Deployment type select', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('select-Deployment-type')).toBeTruthy();
    });

    it('renders Storage type select (disabled)', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        const storageType = screen.getByTestId('select-Storage-type');
        expect(storageType).toBeTruthy();
        expect(storageType).toHaveAttribute('data-disabled', 'true');
    });

    it('renders Total storage capacity text field', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('text-field-Total-storage-capacity')).toBeTruthy();
    });

    it('renders Provisioned SSD IOPS text field', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('text-field-Provisioned-SSD-IOPS')).toBeTruthy();
    });

    it('renders Throughput (MB/s) text field', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('text-field-Throughput-(MB/s)')).toBeTruthy();
    });

    it('renders storage capacity unit select (hide label)', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('select-hide')).toBeTruthy();
    });

    it('renders mockInputClone when printState is true', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState />
            </Provider>
        );
        const mocks = container.querySelectorAll('.mockInputClone');
        expect(mocks.length).toBe(3);
    });

    it('does not render TextFields when printState is true', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState />
            </Provider>
        );
        expect(screen.queryByTestId('text-field-Total-storage-capacity')).toBeNull();
        expect(screen.queryByTestId('text-field-Provisioned-SSD-IOPS')).toBeNull();
        expect(screen.queryByTestId('text-field-Throughput-(MB/s)')).toBeNull();
    });

    it('generates 2 deployment type options', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('select-count-Deployment-type').textContent).toBe('2');
    });

    it('generates 1 storage type option (SSD)', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('select-count-Storage-type').textContent).toBe('1');
    });

    it('generates 2 storage capacity unit options (TiB, GiB)', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(screen.getByTestId('select-count-hide').textContent).toBe('2');
    });

    it('shows storage capacity error when > 64 TiB', () => {
        const store = makeStore({ selectedManualStorageCapacityUnit: { label: 'TiB', value: 'TiB' } });
        render(
            <Provider store={store}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        const input = screen.getByLabelText('Total storage capacity');
        fireEvent.change(input, { target: { value: '100' } });
        expect(screen.getByTestId('error-Total-storage-capacity')?.textContent).toBe(
            'Maximum capacity value is 64 TiB'
        );
    });

    it('shows IOPS error when value < 96', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        const input = screen.getByLabelText('Provisioned SSD IOPS');
        fireEvent.change(input, { target: { value: '50' } });
        expect(screen.getByTestId('error-Provisioned-SSD-IOPS')?.textContent).toBe('Value should be 96 - 400,000');
    });

    it('shows IOPS error when value > 400000', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        const input = screen.getByLabelText('Provisioned SSD IOPS');
        fireEvent.change(input, { target: { value: '500000' } });
        expect(screen.getByTestId('error-Provisioned-SSD-IOPS')?.textContent).toBe('Value should be 96 - 400,000');
    });

    it('shows throughput error when value < 8', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        const input = screen.getByLabelText('Throughput (MB/s)');
        fireEvent.change(input, { target: { value: '3' } });
        expect(screen.getByTestId('error-Throughput-(MB/s)')?.textContent).toBe('Value should be 8-12,288 MB/s');
    });

    it('shows throughput error when value > 12288', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        const input = screen.getByLabelText('Throughput (MB/s)');
        fireEvent.change(input, { target: { value: '20000' } });
        expect(screen.getByTestId('error-Throughput-(MB/s)')?.textContent).toBe('Value should be 8-12,288 MB/s');
    });

    it('auto-selects deployment type Multi when deploymentModel is FCI', () => {
        const store = makeStore({ selectedManualDeploymentModel: { label: 'FCI', value: 'FCI' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedManualDeploymentType',
            payload: { label: 'Multi availability zone', value: 'Multi availability zone' }
        });
    });

    it('auto-selects deployment type Single when deploymentModel is not FCI', () => {
        const store = makeStore({ selectedManualDeploymentModel: { label: 'Standalone', value: 'Standalone' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedManualDeploymentType',
            payload: { label: 'Single availability zone', value: 'Single availability zone' }
        });
    });

    it('auto-selects storage type on mount when null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'test/setSelectedManualStorageType' })
        );
    });

    it('auto-selects storage capacity unit on mount when null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'test/setSelectedManualStorageCapacityUnit' })
        );
    });

    it('strips non-numeric characters from storage capacity input', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOFSXFields printState={false} />
            </Provider>
        );
        const input = screen.getByLabelText('Total storage capacity') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '5abc' } });
        expect(input.value).toBe('5');
    });
});
