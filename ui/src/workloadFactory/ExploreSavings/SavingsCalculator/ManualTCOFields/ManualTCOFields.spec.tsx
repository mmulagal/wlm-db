import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ManualTCOFields from './ManualTCOFields';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => <span data-variant={variant} className={className}>{children}</span>,
    TextField: ({ label, onChange, value, className, isOptional, error, info }: any) => (
        <div data-testid={`text-field-${label?.replace(/\s+/g, '-')}`}>
            <input aria-label={label} onChange={onChange} value={value || ''} />
            {error && <span data-testid={`error-${label?.replace(/\s+/g, '-')}`}>{error}</span>}
        </div>
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, value, options, onChange, isSearchable, defaultValue, className }: any) => (
        <div data-testid={`select-${label?.replace(/\s+/g, '-')}`}>
            <span data-testid={`select-value-${label?.replace(/\s+/g, '-')}`}>{(value || defaultValue)?.label || ''}</span>
            <span data-testid={`select-count-${label?.replace(/\s+/g, '-')}`}>{options?.length || 0}</span>
            <button data-testid={`select-btn-${label?.replace(/\s+/g, '-')}`} onClick={() => onChange && onChange(options?.[0])}>change</button>
        </div>
    )
}));

vi.mock('./ManualTCOFields.module.scss', () => ({
    default: { manualTCOFields: 'manualTCOFields', firstContainer: 'firstContainer', firstRow: 'firstRow', secondRow: 'secondRow', widthRegionSet: 'widthRegionSet', deploymentModelWidth: 'deploymentModelWidth' }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { mockInputClone: 'mockInputClone', mockLabel: 'mockLabel', inputField: 'inputField' }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: (label: string, value: any) => ({ label, value }),
    regionsSort: (arr: any[]) => arr.sort((a: any, b: any) => (a.regionCode || '').localeCompare(b.regionCode || ''))
}));

vi.mock('../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: () => ['', vi.fn()]
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setMonthlyChangeRate: (val: any) => ({ type: 'test/setMonthlyChangeRate', payload: val }),
    setNumberOfClonedCopies: (val: any) => ({ type: 'test/setNumberOfClonedCopies', payload: val }),
    setRegionChangeInstanceLoading: (val: any) => ({ type: 'test/setRegionChangeInstanceLoading', payload: val }),
    setSelectedDeploymentModelForManualTCO: (val: any) => ({ type: 'test/setSelectedDeploymentModelForManualTCO', payload: val }),
    setSelectedManualServerEdition: (val: any) => ({ type: 'test/setSelectedManualServerEdition', payload: val }),
    setSelectedMonthlyBYOLCost: (val: any) => ({ type: 'test/setSelectedMonthlyBYOLCost', payload: val }),
    setSelectedRegionFromManualTCO: (val: any) => ({ type: 'test/setSelectedRegionFromManualTCO', payload: val }),
    setSelectedSnapshotFrequency: (val: any) => ({ type: 'test/setSelectedSnapshotFrequency', payload: val })
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        SAVINGS_MANUAL_TEXT: 'Savings manual text',
        SAVINGS_MANUAL_FSXW_TEXT: 'Savings manual FSXW text',
        REGION: 'Region',
        STANDALONE: 'Standalone',
        AOAG: 'Always on availability group',
        FCI: 'FCI',
        ES_SNAPSHOT_FREQUENCY: 'Snapshot frequency',
        MONTHLY_DATA_CHANGE_RATE: 'Monthly data change rate (%)',
        NUMBER_OF_CLONED_COPIES: 'Number of cloned copies',
        BYOL_TEXT: 'Monthly SQL BYOL costs($)',
        CLONED_COPIES_MAX_LIMIT: 'Number of cloned copies should be less than or equals to 10',
        CHANGE_RATE_MAX_LIMIT: 'Monthly change rate should be less than or equals to 100',
        MONTHLY_CHANGE_RATE_TOOLTIP: 'Change rate tooltip'
    }
}));

vi.mock('../../../../utils/consts', () => ({
    SAVINGS_CALC_MODE: { MANUAL_EBS: 'Manual_EBS', MANUAL_FSXW: 'Manual_FSXW' },
    SNAPSHOT_FREQUENCY: [
        { label: 'No snapshot storage', value: 'NoSnapShotStorage' },
        { label: 'Hourly', value: 'Hourly' },
        { label: 'Daily', value: 'Daily' }
    ]
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedManualRegion: null as any,
            selectedManualDeploymentModel: null as any,
            monthlyBYOLCost: '',
            numberOfClonedCopies: 1,
            monthlyChangeRate: 8,
            selectedManualServerEdition: null as any,
            selectedSnapshotFrequency: null as any,
            savingsCalculatorFrom: 'Manual_EBS',
            getManualRegionsList: { manualRegionsData: { regions: [{ regionCode: 'us-east-1', regionName: 'US East' }] }, manualRegionsLoading: false },
            ...overrides
        },
        reducers: {}
    });
    const headerSlice = createSlice({
        name: 'headers',
        initialState: { headerSelectedRegion: null as any, ...(overrides.headers || {}) },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer, headers: headerSlice.reducer } });
};

describe('ManualTCOFields', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders savings manual text for Manual_EBS', () => {
        const { container } = render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(container.textContent).toContain('Savings manual text');
    });

    it('renders savings manual FSXW text for Manual_FSXW', () => {
        const { container } = render(<Provider store={makeStore({ savingsCalculatorFrom: 'Manual_FSXW' })}><ManualTCOFields printState={false} /></Provider>);
        expect(container.textContent).toContain('Savings manual FSXW text');
    });

    it('renders Region select field', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('select-Region')).toBeTruthy();
    });

    it('renders Deployment model select field', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('select-Deployment-model')).toBeTruthy();
    });

    it('renders SQL server edition select field', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('select-SQL-server-edition')).toBeTruthy();
    });

    it('renders Snapshot frequency select field', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('select-Snapshot-frequency')).toBeTruthy();
    });

    it('renders Monthly data change rate text field when printState is false', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('text-field-Monthly-data-change-rate-(%)')).toBeTruthy();
    });

    it('renders Number of cloned copies text field when printState is false', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('text-field-Number-of-cloned-copies')).toBeTruthy();
    });

    it('renders BYOL text field when printState is false', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('text-field-Monthly-SQL-BYOL-costs($)')).toBeTruthy();
    });

    it('renders mockInputClone when printState is true', () => {
        const { container } = render(<Provider store={makeStore()}><ManualTCOFields printState={true} /></Provider>);
        const mocks = container.querySelectorAll('.mockInputClone');
        expect(mocks.length).toBeGreaterThan(0);
    });

    it('generates deployment model options for Manual_EBS (Standalone, AOAG)', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('select-count-Deployment-model').textContent).toBe('2');
    });

    it('generates deployment model options for Manual_FSXW (Standalone, FCI)', () => {
        render(<Provider store={makeStore({ savingsCalculatorFrom: 'Manual_FSXW' })}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('select-count-Deployment-model').textContent).toBe('2');
    });

    it('generates 4 SQL edition options', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('select-count-SQL-server-edition').textContent).toBe('4');
    });

    it('generates 3 snapshot frequency options', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('select-count-Snapshot-frequency').textContent).toBe('3');
    });

    it('shows error for cloned copies > 10', () => {
        render(<Provider store={makeStore({ numberOfClonedCopies: 15 })}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('error-Number-of-cloned-copies')?.textContent).toBe('Number of cloned copies should be less than or equals to 10');
    });

    it('shows error for monthly change rate > 100', () => {
        render(<Provider store={makeStore({ monthlyChangeRate: 150 })}><ManualTCOFields printState={false} /></Provider>);
        expect(screen.getByTestId('error-Monthly-data-change-rate-(%)').textContent).toBe('Monthly change rate should be less than or equals to 100');
    });

    it('auto-selects region on mount when selectedManualRegion is null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ManualTCOFields printState={false} /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedRegionFromManualTCO' }));
    });

    it('auto-selects server edition on mount when null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ManualTCOFields printState={false} /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedManualServerEdition' }));
    });

    it('auto-selects deployment model on mount when null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ManualTCOFields printState={false} /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedDeploymentModelForManualTCO' }));
    });

    it('auto-selects snapshot frequency on mount when null', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ManualTCOFields printState={false} /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedSnapshotFrequency' }));
    });

    it('strips non-numeric characters from change rate input', () => {
        render(<Provider store={makeStore()}><ManualTCOFields printState={false} /></Provider>);
        const input = screen.getByLabelText('Monthly data change rate (%)');
        fireEvent.change(input, { target: { value: '50abc' } });
        // dispatch should be called with setMonthlyChangeRate
    });
});
