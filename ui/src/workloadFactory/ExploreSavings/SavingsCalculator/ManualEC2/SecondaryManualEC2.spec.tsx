import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import SecondaryManualEC2 from './SecondaryManualEC2';
import { DEAFULT_INSTANCE_VALUE } from '../../../../utils/consts';

vi.mock('@netapp/design-system', () => ({
    TextField: ({ label, onChange, value, className, isOptional }: any) => (
        <input data-testid="machine-desc-field" aria-label={label} onChange={onChange} value={value || ''} />
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, value, options, isLoading, onChange }: any) => (
        <div data-testid="select-field" data-label={label} data-loading={String(isLoading)}>
            {value && !Array.isArray(value) && <span data-testid="selected-value">{value.label}</span>}
            <span data-testid="options-count">{options?.length || 0}</span>
            <button data-testid="change-btn" onClick={() => onChange({ label: 'r5.xlarge', value: 'r5.xlarge' })}>change</button>
        </div>
    )
}));

vi.mock('./ManualEC2.module.scss', () => ({
    default: { manualEc2: 'manualEc2', firstRow: 'firstRow', setWidth: 'setWidth' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatSize: (val: number, unit: string) => `${val}${unit}`,
    generateOptionType: (label: string, value: string, label2: string, _: boolean, __: string, data: any) => ({ label, value, label2, data }),
    sortListOfDict: (arr: any[], key: string) => arr.sort((a: any, b: any) => a[key]?.localeCompare(b[key]))
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSecondarySelectedMachineDescription: (val: any) => ({ type: 'test/setSecondarySelectedMachineDescription', payload: val }),
    setSelectedSecondaryManualInstanceType: (val: any) => ({ type: 'test/setSelectedSecondaryManualInstanceType', payload: val })
}));

vi.mock('../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: () => ['', vi.fn()]
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            manualSecondaryMachineDescription: '',
            selectedSecondaryManualInstanceType: null as any,
            selectedManualInstanceType: null as any,
            manualMonthlyDescription: '',
            getManualInstanceTypeList: {
                instanceTypeData: {
                    instanceTypes: [
                        { instanceType: DEAFULT_INSTANCE_VALUE, vCpus: 4, ramInMib: 16384, iopsInMbps: 1000 },
                        { instanceType: 'r5.xlarge', vCpus: 8, ramInMib: 32768, iopsInMbps: 2000 }
                    ]
                },
                instanceTypeLoading: false
            },
            ...overrides
        },
        reducers: {},
        extraReducers: (builder) => {
            builder.addCase('test/setSelectedSecondaryManualInstanceType', (state, action: any) => {
                state.selectedSecondaryManualInstanceType = action.payload;
            });
        }
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('SecondaryManualEC2', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders machine description text field', () => {
        render(<Provider store={makeStore()}><SecondaryManualEC2 /></Provider>);
        expect(screen.getByTestId('machine-desc-field')).toBeTruthy();
    });

    it('renders select field', () => {
        render(<Provider store={makeStore()}><SecondaryManualEC2 /></Provider>);
        expect(screen.getByTestId('select-field')).toBeTruthy();
    });

    it('auto-selects primary instance type when secondary is null and primary exists', () => {
        const store = makeStore({ selectedManualInstanceType: { label: 'r5.xlarge', value: 'r5.xlarge' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><SecondaryManualEC2 /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedSecondaryManualInstanceType',
            payload: { label: 'r5.xlarge', value: 'r5.xlarge' }
        });
    });

    it('auto-selects first option when secondary and primary are null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><SecondaryManualEC2 /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedSecondaryManualInstanceType' }));
    });

    it('does not auto-select when secondary is already set', () => {
        const store = makeStore({ selectedSecondaryManualInstanceType: { label: 'r5.xlarge', value: 'r5.xlarge' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><SecondaryManualEC2 /></Provider>);
        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedSecondaryManualInstanceType' }));
    });

    it('dispatches on select change', () => {
        const store = makeStore({ selectedSecondaryManualInstanceType: { label: 'r5.xlarge', value: 'r5.xlarge' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><SecondaryManualEC2 /></Provider>);
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('change-btn'));
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSelectedSecondaryManualInstanceType', payload: { label: 'r5.xlarge', value: 'r5.xlarge' } });
    });

    it('uses manualMonthlyDescription as value when manualSecondaryMachineDescription is empty', () => {
        render(<Provider store={makeStore({ manualSecondaryMachineDescription: '', manualMonthlyDescription: 'Primary Desc' })}><SecondaryManualEC2 /></Provider>);
        expect((screen.getByTestId('machine-desc-field') as HTMLInputElement).value).toBe('Primary Desc');
    });

    it('shows loading state for select', () => {
        render(<Provider store={makeStore({
            getManualInstanceTypeList: { instanceTypeData: { instanceTypes: [] }, instanceTypeLoading: true }
        })}><SecondaryManualEC2 /></Provider>);
        expect(screen.getByTestId('select-field')).toHaveAttribute('data-loading', 'true');
    });
});
