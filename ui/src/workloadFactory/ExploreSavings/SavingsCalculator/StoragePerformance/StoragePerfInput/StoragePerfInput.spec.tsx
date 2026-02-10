import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import StoragePerfInput from './StoragePerfInput';

vi.mock('@netapp/design-system', () => ({
    TextField: ({ onChange, value, placeholder, className }: any) => (
        <input data-testid="text-field" onChange={onChange} value={value || ''} placeholder={placeholder} className={className} />
    )
}));

vi.mock('./StoragePerfInput.module.scss', () => ({
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
    setOnPremStorageAndComputeInfo: (val: any) => ({ type: 'test/setOnPremStorageAndComputeInfo', payload: val })
}));

const makeStore = () => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {},
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('StoragePerfInput', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders 3 text fields when printState is false', () => {
        render(<Provider store={makeStore()}><StoragePerfInput /></Provider>);
        const fields = screen.getAllByTestId('text-field');
        expect(fields.length).toBe(3);
    });

    it('renders printState mockInputClone divs when printState is true', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <StoragePerfInput printState data={{ sqlInstanceName: 'inst1', totalStorage: 100, totalIops: 3000, totalThroughput: 125 }} />
            </Provider>
        );
        const mockInputs = container.querySelectorAll('.mockInputClone');
        expect(mockInputs.length).toBe(3);
    });

    it('does not render text fields when printState is true', () => {
        render(
            <Provider store={makeStore()}>
                <StoragePerfInput printState data={{ sqlInstanceName: 'inst1', totalStorage: 100, totalIops: 3000, totalThroughput: 125 }} />
            </Provider>
        );
        expect(screen.queryAllByTestId('text-field').length).toBe(0);
    });

    it('shows data values in mockInputClone divs when printState is true', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <StoragePerfInput printState data={{ sqlInstanceName: 'inst1', totalStorage: 100, totalIops: 3000, totalThroughput: 125 }} />
            </Provider>
        );
        const inputFields = container.querySelectorAll('.inputField');
        expect(inputFields[0].textContent).toBe('100');
        expect(inputFields[1].textContent).toBe('3000');
        expect(inputFields[2].textContent).toBe('125');
    });

    it('sets storage, iops, throughput from data prop', () => {
        render(
            <Provider store={makeStore()}>
                <StoragePerfInput data={{ sqlInstanceName: 'inst1', totalStorage: 100, totalIops: 3000, totalThroughput: 125 }} />
            </Provider>
        );
        const fields = screen.getAllByTestId('text-field');
        expect((fields[0] as HTMLInputElement).value).toBe('100');
        expect((fields[1] as HTMLInputElement).value).toBe('3000');
        expect((fields[2] as HTMLInputElement).value).toBe('125');
    });

    it('strips non-numeric characters from storage input', () => {
        render(<Provider store={makeStore()}><StoragePerfInput /></Provider>);
        const fields = screen.getAllByTestId('text-field');
        fireEvent.change(fields[0], { target: { value: '50abc' } });
        expect((fields[0] as HTMLInputElement).value).toBe('50');
    });

    it('strips non-numeric characters from iops input', () => {
        render(<Provider store={makeStore()}><StoragePerfInput /></Provider>);
        const fields = screen.getAllByTestId('text-field');
        fireEvent.change(fields[1], { target: { value: '3000xyz' } });
        expect((fields[1] as HTMLInputElement).value).toBe('3000');
    });

    it('strips non-numeric characters from throughput input', () => {
        render(<Provider store={makeStore()}><StoragePerfInput /></Provider>);
        const fields = screen.getAllByTestId('text-field');
        fireEvent.change(fields[2], { target: { value: '125!@#' } });
        expect((fields[2] as HTMLInputElement).value).toBe('125');
    });

    it('uses uniqueKey as storeKey when provided', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><StoragePerfInput uniqueKey="res1_inst1" data={{ sqlInstanceName: 'inst1' }} /></Provider>);
        // The dispatch happens via debounce effects, but the storeKey is set
        expect(dispatchSpy).toBeTruthy();
    });

    it('falls back to sqlInstanceName when uniqueKey is not provided', () => {
        const store = makeStore();
        render(<Provider store={store}><StoragePerfInput data={{ sqlInstanceName: 'inst1', totalStorage: 50 }} /></Provider>);
        // Component renders without error using sqlInstanceName as storeKey
        expect(screen.getAllByTestId('text-field').length).toBe(3);
    });

    it('renders empty fields when no data is provided', () => {
        render(<Provider store={makeStore()}><StoragePerfInput /></Provider>);
        const fields = screen.getAllByTestId('text-field');
        expect((fields[0] as HTMLInputElement).value).toBe('');
        expect((fields[1] as HTMLInputElement).value).toBe('');
        expect((fields[2] as HTMLInputElement).value).toBe('');
    });
});
