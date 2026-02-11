import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import OnPremRegion from './OnPremRegion';
import { GENERAL } from '../../../../utils/appConstants';

// Mocks
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, ...props }: any) => <span {...props}>{children}</span>
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, value, options, isSearchable, isLoading, onChange, className }: any) => (
        <div
            data-testid="select-field"
            data-label={label}
            data-loading={String(isLoading)}
            data-searchable={String(isSearchable)}
        >
            <span>{label}</span>
            {value && <span data-testid="selected-value">{value.label}</span>}
            <span data-testid="options-count">{options?.length || 0}</span>
            <button
                data-testid="change-btn"
                onClick={() => onChange({ label: 'us-east-1', data: { regionCode: 'us-east-1' } })}
            >
                change
            </button>
        </div>
    )
}));

vi.mock('./OnPremRegion.module.scss', () => ({
    default: { onPremRegion: 'onPremRegion', firstRow: 'firstRow', widthRegionSet: 'widthRegionSet' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: (label: string, value: string, _: string, __: boolean, ___: string, data: any) => ({
        label,
        value,
        data
    }),
    regionsSort: (arr: any[]) => arr
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedOnPremRegion: (val: any) => ({ type: 'exploreSavings/setSelectedOnPremRegion', payload: val })
}));

const makeStore = (overrides: any = {}) => {
    const initialState = {
        selectedOnPremRegion: null as any,
        getOnPremRegionList: {
            onPremRegionsData: {
                regions: [
                    { regionCode: 'us-east-1', regionName: 'US East' },
                    { regionCode: 'us-west-2', regionName: 'US West' }
                ]
            },
            onPremRegionsLoading: false
        },
        ...overrides
    };

    const exploreSavingsSlice = createSlice({
        name: 'exploreSavings',
        initialState,
        reducers: {},
        extraReducers: builder => {
            builder.addCase('exploreSavings/setSelectedOnPremRegion', (state, action: any) => {
                state.selectedOnPremRegion = action.payload;
            });
        }
    });

    const headersSlice = createSlice({
        name: 'headers',
        initialState: {
            headerSelectedRegion: overrides.headerSelectedRegion || null
        },
        reducers: {}
    });

    return configureStore({
        reducer: {
            exploreSavings: exploreSavingsSlice.reducer,
            headers: headersSlice.reducer
        }
    });
};

describe('OnPremRegion', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the select field with Region label', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <OnPremRegion />
            </Provider>
        );
        expect(container.textContent).toContain(GENERAL.REGION);
    });

    it('generates region options from Redux data', () => {
        render(
            <Provider store={makeStore()}>
                <OnPremRegion />
            </Provider>
        );
        expect(screen.getByTestId('options-count').textContent).toBe('2');
    });

    it('dispatches setSelectedOnPremRegion for first region when no selectedOnPremRegion and no matching header region', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <OnPremRegion />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'exploreSavings/setSelectedOnPremRegion' })
        );
    });

    it('dispatches the matching header region when found', () => {
        const store = makeStore({ headerSelectedRegion: { data: { regionCode: 'us-west-2' } } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <OnPremRegion />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'exploreSavings/setSelectedOnPremRegion' })
        );
    });

    it('does not dispatch when selectedOnPremRegion already set', () => {
        const store = makeStore({ selectedOnPremRegion: { label: 'us-east-1', data: { regionCode: 'us-east-1' } } });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <OnPremRegion />
            </Provider>
        );
        expect(dispatchSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'exploreSavings/setSelectedOnPremRegion' })
        );
    });

    it('shows loading state', () => {
        render(
            <Provider
                store={makeStore({
                    getOnPremRegionList: { onPremRegionsData: { regions: [] }, onPremRegionsLoading: true }
                })}
            >
                <OnPremRegion />
            </Provider>
        );
        expect(screen.getByTestId('select-field')).toHaveAttribute('data-loading', 'true');
    });

    it('enables searchable when more than 5 options', () => {
        const regions = Array.from({ length: 6 }, (_, i) => ({ regionCode: `reg-${i}`, regionName: `Region ${i}` }));
        render(
            <Provider
                store={makeStore({
                    getOnPremRegionList: { onPremRegionsData: { regions }, onPremRegionsLoading: false }
                })}
            >
                <OnPremRegion />
            </Provider>
        );
        expect(screen.getByTestId('select-field')).toHaveAttribute('data-searchable', 'true');
    });

    it('dispatches on change of select', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <OnPremRegion />
            </Provider>
        );
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('change-btn'));
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'exploreSavings/setSelectedOnPremRegion',
            payload: { label: 'us-east-1', data: { regionCode: 'us-east-1' } }
        });
    });

    it('handles empty regions data', () => {
        render(
            <Provider
                store={makeStore({
                    getOnPremRegionList: { onPremRegionsData: { regions: [] }, onPremRegionsLoading: false }
                })}
            >
                <OnPremRegion />
            </Provider>
        );
        expect(screen.getByTestId('options-count').textContent).toBe('0');
    });
});
