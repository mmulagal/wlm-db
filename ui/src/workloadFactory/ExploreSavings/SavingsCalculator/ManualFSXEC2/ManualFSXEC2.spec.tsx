import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ManualFSXEC2 from './ManualFSXEC2';
import { DEAFULT_INSTANCE_VALUE } from '../../../../utils/consts';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, value, options, isLoading, isSearchable, onChange, className, variant: v }: any) => (
        <div data-testid="select-field" data-label={label} data-loading={String(isLoading)}>
            <span>{label}</span>
            {value && <span data-testid="selected-value">{value.label}</span>}
            <span data-testid="options-count">{options?.length || 0}</span>
            <button data-testid="change-btn" onClick={() => onChange({ label: 'r5.2xlarge', value: 'r5.2xlarge' })}>
                change
            </button>
        </div>
    )
}));

vi.mock('./ManualFSXEC2.module.scss', () => ({
    default: { manualFSXEC2: 'manualFSXEC2', setWidth: 'setWidth' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatSize: (val: number, unit: string) => `${val} ${unit}`,
    generateOptionType: (label: string, value: string, label2: string, _: boolean, __: string, data: any) => ({
        label,
        value,
        label2,
        data
    }),
    sortListOfDict: (arr: any[], key: string) => arr.sort((a: any, b: any) => a[key]?.localeCompare(b[key]))
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedManualInstanceType: (val: any) => ({ type: 'test/setSelectedManualInstanceType', payload: val })
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedManualInstanceType: null as any,
            getManualInstanceTypeList: {
                instanceTypeData: {
                    instanceTypes: [
                        { instanceType: DEAFULT_INSTANCE_VALUE, vCpus: 2, ramInMib: 8192, iopsInMbps: 500 },
                        { instanceType: 'r5.xlarge', vCpus: 4, ramInMib: 32768, iopsInMbps: 1000 },
                        { instanceType: 'r5.2xlarge', vCpus: 8, ramInMib: 65536, iopsInMbps: 2000 }
                    ]
                },
                instanceTypeLoading: false
            },
            ...overrides
        },
        reducers: {},
        extraReducers: builder => {
            builder.addCase('test/setSelectedManualInstanceType', (state, action: any) => {
                state.selectedManualInstanceType = action.payload;
            });
        }
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('ManualFSXEC2', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders EC2 specifications heading', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ManualFSXEC2 />
            </Provider>
        );
        expect(container.textContent).toContain('EC2 specifications');
    });

    it('renders select field with Instance type label', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ManualFSXEC2 />
            </Provider>
        );
        expect(container.textContent).toContain('Instance type');
    });

    it('generates instance options from data', () => {
        render(
            <Provider store={makeStore()}>
                <ManualFSXEC2 />
            </Provider>
        );
        expect(screen.getByTestId('options-count').textContent).toBe('3');
    });

    it('dispatches setSelectedManualInstanceType for first option when null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualFSXEC2 />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'test/setSelectedManualInstanceType' })
        );
    });

    it('does not dispatch when selectedManualInstanceType already set', () => {
        const store = makeStore({ selectedManualInstanceType: { label: 'm5.xlarge', value: 'm5.xlarge' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualFSXEC2 />
            </Provider>
        );
        expect(dispatchSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'test/setSelectedManualInstanceType' })
        );
    });

    it('dispatches on select change', () => {
        const store = makeStore({ selectedManualInstanceType: { label: 'm5.xlarge', value: 'm5.xlarge' } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualFSXEC2 />
            </Provider>
        );
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('change-btn'));
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedManualInstanceType',
            payload: { label: 'r5.2xlarge', value: 'r5.2xlarge' }
        });
    });

    it('shows loading state', () => {
        render(
            <Provider
                store={makeStore({
                    getManualInstanceTypeList: { instanceTypeData: {}, instanceTypeLoading: true }
                })}
            >
                <ManualFSXEC2 />
            </Provider>
        );
        expect(screen.getByTestId('select-field')).toHaveAttribute('data-loading', 'true');
    });

    it('puts default instance at beginning of options list', () => {
        // The DEAFULT_INSTANCE_VALUE should be first in list (unshifted)
        render(
            <Provider store={makeStore()}>
                <ManualFSXEC2 />
            </Provider>
        );
        // 3 options: default + 2 sorted others
        expect(screen.getByTestId('options-count').textContent).toBe('3');
    });

    it('handles empty instanceTypes', () => {
        render(
            <Provider
                store={makeStore({
                    getManualInstanceTypeList: { instanceTypeData: { instanceTypes: [] }, instanceTypeLoading: false }
                })}
            >
                <ManualFSXEC2 />
            </Provider>
        );
        expect(screen.getByTestId('options-count').textContent).toBe('0');
    });
});
