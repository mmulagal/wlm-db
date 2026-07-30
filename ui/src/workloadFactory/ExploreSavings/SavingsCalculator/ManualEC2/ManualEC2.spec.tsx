import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ManualEC2 from './ManualEC2';
import { GENERAL } from '../../../../utils/appConstants';
import { DEAFULT_INSTANCE_VALUE } from '../../../../utils/consts';

const TRANSLATIONS: Record<string, string> = {
    'databases.explore-savings.manual-machine-description': 'Machine description',
    'databases.explore-savings.manual-instance-type': 'Instance type'
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => TRANSLATIONS[key] || key })
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
    TextField: ({ label, onChange, value, className, isOptional }: any) => (
        <input
            data-testid="machine-desc-field"
            aria-label={label}
            onChange={onChange}
            value={value || ''}
            data-optional={String(isOptional)}
        />
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, value, options, isLoading, onChange }: any) => (
        <div data-testid="select-field" data-label={label} data-loading={String(isLoading)}>
            {value && <span data-testid="selected-value">{value.label}</span>}
            <span data-testid="options-count">{options?.length || 0}</span>
            <button data-testid="change-btn" onClick={() => onChange({ label: 'r5.xlarge', value: 'r5.xlarge' })}>
                change
            </button>
        </div>
    )
}));

vi.mock('./ManualEC2.module.scss', () => ({
    default: { manualEc2: 'manualEc2', firstRow: 'firstRow', setWidth: 'setWidth' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatSize: (val: number, unit: string) => `${val}${unit}`,
    generateOptionType: (label: string, value: string, label2: string, _: boolean, __: string, data: any) => ({
        label,
        value,
        label2,
        data
    }),
    sortListOfDict: (arr: any[], key: string) => arr.sort((a: any, b: any) => a[key]?.localeCompare(b[key]))
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedMachineDescription: (val: any) => ({ type: 'test/setSelectedMachineDescription', payload: val }),
    setSelectedManualInstanceType: (val: any) => ({ type: 'test/setSelectedManualInstanceType', payload: val })
}));

vi.mock('../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: () => ['', vi.fn()]
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            manualMonthlyDescription: '',
            selectedManualInstanceType: null as any,
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
        extraReducers: builder => {
            builder.addCase('test/setSelectedManualInstanceType', (state, action: any) => {
                state.selectedManualInstanceType = action.payload;
            });
        }
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('ManualEC2', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders EC2 specifications heading', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ManualEC2 />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.EC2_SPECIFICATIONS);
    });

    it('renders machine description text field', () => {
        render(
            <Provider store={makeStore()}>
                <ManualEC2 />
            </Provider>
        );
        expect(screen.getByTestId('machine-desc-field')).toBeTruthy();
    });

    it('renders select field with Instance type label', () => {
        render(
            <Provider store={makeStore()}>
                <ManualEC2 />
            </Provider>
        );
        expect(screen.getByTestId('select-field')).toHaveAttribute('data-label', 'Instance type');
    });

    it('auto-selects first instance when selectedManualInstanceType is null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualEC2 />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'test/setSelectedManualInstanceType' })
        );
    });

    it('does not auto-select when selectedManualInstanceType already set and valid', () => {
        const store = makeStore({
            selectedManualInstanceType: { label: DEAFULT_INSTANCE_VALUE, value: DEAFULT_INSTANCE_VALUE }
        });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualEC2 />
            </Provider>
        );
        expect(dispatchSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'test/setSelectedManualInstanceType' })
        );
    });

    it('dispatches on select change', () => {
        const store = makeStore({
            selectedManualInstanceType: { label: DEAFULT_INSTANCE_VALUE, value: DEAFULT_INSTANCE_VALUE }
        });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualEC2 />
            </Provider>
        );
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('change-btn'));
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedManualInstanceType',
            payload: { label: 'r5.xlarge', value: 'r5.xlarge' }
        });
    });

    it('updates machine description on change', () => {
        render(
            <Provider store={makeStore()}>
                <ManualEC2 />
            </Provider>
        );
        fireEvent.change(screen.getByTestId('machine-desc-field'), { target: { value: 'MyMachine' } });
        expect((screen.getByTestId('machine-desc-field') as HTMLInputElement).value).toBe('MyMachine');
    });

    it('shows loading state for select field', () => {
        render(
            <Provider
                store={makeStore({
                    getManualInstanceTypeList: { instanceTypeData: { instanceTypes: [] }, instanceTypeLoading: true }
                })}
            >
                <ManualEC2 />
            </Provider>
        );
        expect(screen.getByTestId('select-field')).toHaveAttribute('data-loading', 'true');
    });

    it('generates correct option count', () => {
        render(
            <Provider store={makeStore()}>
                <ManualEC2 />
            </Provider>
        );
        expect(screen.getByTestId('options-count').textContent).toBe('2');
    });
});
