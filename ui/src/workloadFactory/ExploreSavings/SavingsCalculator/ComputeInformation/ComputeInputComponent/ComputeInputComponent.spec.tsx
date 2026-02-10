import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ComputeInputComponent from './ComputeInputComponent';

vi.mock('@netapp/design-system', () => ({
    TextField: ({ onChange, value, placeholder, className }: any) => (
        <input data-testid="text-field" onChange={onChange} value={value || ''} placeholder={placeholder} className={className} />
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ onChange, options, value, isDisabled, isClearable, isSearchable }: any) => (
        <div data-testid="select-field" data-disabled={String(!!isDisabled)}>
            {value && <span data-testid="selected-value">{value.label}</span>}
            <span data-testid="options-count">{options?.length || 0}</span>
            <button data-testid="select-change-btn" onClick={() => onChange({ label: 'Up to 10 Gbps', value: 'Up to 10 Gbps' })}>change</button>
        </div>
    )
}));

vi.mock('./ComputeInputComponent.module.scss', () => ({
    default: {
        computeInputComponent: 'computeInputComponent',
        col2: 'col2',
        col3: 'col3',
        col4: 'col4',
        keyField: 'keyField',
        mockInputClone: 'mockInputClone',
        inputField: 'inputField'
    }
}));

vi.mock('../../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: () => [null, vi.fn()]
}));

vi.mock('../../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setOnPremNetworkPerformance: (val: any) => ({ type: 'test/setOnPremNetworkPerformance', payload: val }),
    setOnPremStorageAndComputeInfo: (val: any) => ({ type: 'test/setOnPremStorageAndComputeInfo', payload: val })
}));

vi.mock('../../../../../utils/utilityFunctions', () => ({
    generateOptionType: (label: string, value: string) => ({ label, value })
}));

vi.mock('../../../../../utils/consts', () => ({
    NETWORK_PERFORMANCE_OPTIONS: {
        'Up to 10 Gbps': 'upTo10',
        'Above 10 Gbps': 'above10'
    }
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            onPremNetworkPerformance: null as any,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('ComputeInputComponent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders text fields for CPU and memory when printState is false', () => {
        render(<Provider store={makeStore()}><ComputeInputComponent index={0} /></Provider>);
        const fields = screen.getAllByTestId('text-field');
        expect(fields.length).toBe(2);
    });

    it('renders select field for network performance', () => {
        render(<Provider store={makeStore()}><ComputeInputComponent index={0} /></Provider>);
        expect(screen.getByTestId('select-field')).toBeTruthy();
    });

    it('renders printState mockInputClone divs when printState is true', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ComputeInputComponent index={0} printState data={{ sqlInstanceName: 'inst1', noOfVcpusInUse: 4, memory: 16 }} />
            </Provider>
        );
        const mockInputs = container.querySelectorAll('.mockInputClone');
        expect(mockInputs.length).toBe(2);
    });

    it('does not render text fields when printState is true', () => {
        render(
            <Provider store={makeStore()}>
                <ComputeInputComponent index={0} printState data={{ sqlInstanceName: 'inst1', noOfVcpusInUse: 4, memory: 16 }} />
            </Provider>
        );
        expect(screen.queryAllByTestId('text-field').length).toBe(0);
    });

    it('disables select when index is not 0', () => {
        render(<Provider store={makeStore()}><ComputeInputComponent index={1} /></Provider>);
        expect(screen.getByTestId('select-field')).toHaveAttribute('data-disabled', 'true');
    });

    it('enables select when index is 0', () => {
        render(<Provider store={makeStore()}><ComputeInputComponent index={0} /></Provider>);
        expect(screen.getByTestId('select-field')).toHaveAttribute('data-disabled', 'false');
    });

    it('generates 2 network performance options', () => {
        render(<Provider store={makeStore()}><ComputeInputComponent index={0} /></Provider>);
        expect(screen.getByTestId('options-count').textContent).toBe('2');
    });

    it('dispatches setOnPremNetworkPerformance on select change', () => {
        const store = makeStore({ onPremNetworkPerformance: { label: 'Above 10 Gbps', value: 'Above 10 Gbps' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ComputeInputComponent index={0} /></Provider>);
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('select-change-btn'));
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setOnPremNetworkPerformance', payload: { label: 'Up to 10 Gbps', value: 'Up to 10 Gbps' } });
    });

    it('dispatches setOnPremStorageAndComputeInfo on select change', () => {
        const store = makeStore({ onPremNetworkPerformance: { label: 'Above 10 Gbps', value: 'Above 10 Gbps' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ComputeInputComponent index={0} data={{ sqlInstanceName: 'inst1' }} /></Provider>);
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('select-change-btn'));
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setOnPremStorageAndComputeInfo',
            payload: { type: 'inst1', mode: 'networkPerformance', value: 'upTo10' }
        });
    });

    it('strips non-numeric characters from CPU input', () => {
        render(<Provider store={makeStore()}><ComputeInputComponent index={0} /></Provider>);
        const fields = screen.getAllByTestId('text-field');
        fireEvent.change(fields[0], { target: { value: '8abc' } });
        expect((fields[0] as HTMLInputElement).value).toBe('8');
    });

    it('strips non-numeric characters from memory input', () => {
        render(<Provider store={makeStore()}><ComputeInputComponent index={0} /></Provider>);
        const fields = screen.getAllByTestId('text-field');
        fireEvent.change(fields[1], { target: { value: '16xyz' } });
        expect((fields[1] as HTMLInputElement).value).toBe('16');
    });

    it('sets CPU and memory from data prop', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ComputeInputComponent index={0} data={{ sqlInstanceName: 'inst1', noOfVcpusInUse: 4, memory: 16 }} />
            </Provider>
        );
        const fields = screen.getAllByTestId('text-field');
        expect((fields[0] as HTMLInputElement).value).toBe('4');
        expect((fields[1] as HTMLInputElement).value).toBe('16');
    });

    it('dispatches setOnPremNetworkPerformance on mount when onPremNetworkPerformance is null (upTo10)', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ComputeInputComponent index={0} data={{ networkPerformance: 'upTo10' }} /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setOnPremNetworkPerformance',
            payload: { label: 'Up to 10 Gbps', value: 'Up to 10 Gbps' }
        });
    });

    it('dispatches setOnPremNetworkPerformance on mount with above10 when networkPerformance is not upTo10', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ComputeInputComponent index={0} data={{ networkPerformance: 'above10' }} /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setOnPremNetworkPerformance',
            payload: { label: 'Above 10 Gbps', value: 'Above 10 Gbps' }
        });
    });

    it('does not dispatch setOnPremNetworkPerformance when already set', () => {
        const store = makeStore({ onPremNetworkPerformance: { label: 'Up to 10 Gbps', value: 'Up to 10 Gbps' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ComputeInputComponent index={0} data={{ networkPerformance: 'upTo10' }} /></Provider>);
        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setOnPremNetworkPerformance' }));
    });

    it('uses uniqueKey as storeKey when provided', () => {
        const store = makeStore({ onPremNetworkPerformance: { label: 'Up to 10 Gbps', value: 'Up to 10 Gbps' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ComputeInputComponent index={0} uniqueKey="resource1_inst1" data={{ sqlInstanceName: 'inst1' }} /></Provider>);
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('select-change-btn'));
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setOnPremStorageAndComputeInfo',
            payload: expect.objectContaining({ type: 'resource1_inst1' })
        });
    });

    it('shows selected network performance value', () => {
        const store = makeStore({ onPremNetworkPerformance: { label: 'Above 10 Gbps', value: 'Above 10 Gbps' } });
        render(<Provider store={store}><ComputeInputComponent index={0} /></Provider>);
        expect(screen.getByTestId('selected-value').textContent).toBe('Above 10 Gbps');
    });
});
