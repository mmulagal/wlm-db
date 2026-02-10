import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import SavingsSelection from './SavingsSelection';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style }: any) => <span data-variant={variant} className={className}>{children}</span>,
    Button: ({ children, onClick, variant }: any) => <button data-testid="button" onClick={onClick}>{children}</button>,
    SelectField: ({ label, value, options, onChange, isDisabled, isLoading, defaultValue, info, className }: any) => (
        <div data-testid={`select-${label?.replace(/\s+/g, '-')}`} data-disabled={String(!!isDisabled)} data-loading={String(!!isLoading)}>
            <span data-testid={`select-value-${label?.replace(/\s+/g, '-')}`}>{(value || defaultValue)?.label || ''}</span>
            <span data-testid={`select-count-${label?.replace(/\s+/g, '-')}`}>{options?.length || 0}</span>
            <button data-testid={`select-btn-${label?.replace(/\s+/g, '-')}`} onClick={() => onChange && onChange(options?.[0])}>change</button>
        </div>
    ),
    TextField: ({ label, onChange, value, isDisabled, isOptional, error, info, className }: any) => (
        <div data-testid={`text-field-${label?.replace(/\s+/g, '-')}`} data-disabled={String(!!isDisabled)}>
            <input aria-label={label} onChange={onChange} value={value || ''} />
            {error && <span data-testid={`error-${label?.replace(/\s+/g, '-')}`}>{error}</span>}
        </div>
    ),
    TooltipInfo: ({ children }: any) => <span data-testid="tooltip-info">{children}</span>,
    useDialog: () => ({ setDialog: vi.fn(), closeDialog: vi.fn() })
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({ optionType: {} }));

vi.mock('@netapp/icons/ic_info.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="info-icon" {...props} />
}));

vi.mock('./SavingsSelection.module.scss', () => ({
    default: {
        savingsSelection: 'savingsSelection',
        onPremMode: 'onPremMode',
        firstRow: 'firstRow',
        secondRow: 'secondRow',
        widthSet: 'widthSet',
        widthSetOnPrem: 'widthSetOnPrem',
        deploymentModelWidth: 'deploymentModelWidth',
        mockInput: 'mockInput',
        mockInputClone: 'mockInputClone',
        mockLabel: 'mockLabel',
        inputField: 'inputField',
        infoCenter: 'infoCenter',
        notice: 'notice',
        setSVG: 'setSVG',
        contentWidth: 'contentWidth'
    }
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: (label: string, value: any) => ({ label, value })
}));

vi.mock('../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: () => [null, vi.fn()]
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setMonthlyChangeRate: (val: any) => ({ type: 'test/setMonthlyChangeRate', payload: val }),
    setNumberOfClonedCopies: (val: any) => ({ type: 'test/setNumberOfClonedCopies', payload: val }),
    setSelectedCloneRefresh: (val: any) => ({ type: 'test/setSelectedCloneRefresh', payload: val }),
    setSelectedMonthlyBYOLCost: (val: any) => ({ type: 'test/setSelectedMonthlyBYOLCost', payload: val }),
    setSelectedSnapshotFrequency: (val: any) => ({ type: 'test/setSelectedSnapshotFrequency', payload: val })
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        ES_SAVINGS_SELECTION_TEXT: 'Savings selection text',
        ES_SNAPSHOT_FREQUENCY: 'Snapshot frequency',
        ES_CLONE_REFRESH_FREQUENCY: 'Clone refresh frequency',
        ES_NO_SNAPSHOT_STORAGE: 'No snapshot storage',
        NUMBER_OF_CLONED_COPIES: 'Number of cloned copies',
        MONTHLY_CHANGE_RATE: 'Monthly change rate (%)',
        MONTHLY_CHANGE_RATE_TOOLTIP: 'Monthly change rate tooltip',
        TOOLTIP_MESSAGE_SNAPSHOT_FREQ: 'Snapshot freq tooltip',
        REFER_SNAPSHOTS: 'Refer to snapshots',
        BYOL_TEXT: 'Monthly SQL BYOL costs($)',
        CLONED_COPIES_MAX_LIMIT: 'Max cloned copies limit',
        CHANGE_RATE_MAX_LIMIT: 'Max change rate limit',
        LEARN_HOW_DIALOG: { TITLE: 'Improve compute cost accuracy' },
        CLOSE: 'Close'
    }
}));

vi.mock('../../../../utils/consts', () => ({
    FINDINGS: { INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS' },
    MAX_CLONED_COPIES: 10,
    MAX_MONTHLY_CHANGE_RATE: 100,
    SAVINGS_CALC_MODE: {
        MANUAL_EBS: 'Manual_EBS',
        AUTO_EBS: 'Auto_EBS',
        AUTO_FSXW: 'Auto_FSXW',
        MANUAL_FSXW: 'Manual_FSXW',
        ONPREM: 'OnPrem'
    },
    SNAPSHOT_FREQUENCY: [
        { label: 'No snapshot storage', value: 'NoSnapShotStorage' },
        { label: 'Hourly', value: 'Hourly' },
        { label: 'Daily', value: 'Daily' }
    ],
    WLF_TABS: {
        MSSQL_ON_PREMISES: 'MSSQL_ON_PREMISES',
        MSSQL_ELASTIC_BLOCK_STORE: 'MSSQL_ELASTIC_BLOCK_STORE'
    }
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content, primaryButton, callback }: any) => <div data-testid="dialog">{header}</div>
}));

vi.mock('./LearnHowDialog/LearnHowDialog', () => ({
    default: ({ type }: any) => <div data-testid="learn-how-dialog">{type}</div>
}));

vi.mock('../savingsUtil', () => ({
    checkIfByolFieldRequired: () => false
}));

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedSnapshotFrequency: null as any,
            numberOfClonedCopies: 1,
            selectedCloneRefresh: null as any,
            monthlyChangeRate: 8,
            loading: false,
            storageSavingsResponse: null as any,
            monthlyBYOLCost: '',
            selectedHostDetails: {},
            savingsCalculatorFrom: 'Auto_EBS',
            snapshotLoading: false,
            selectedExploreSavingsTab: 'MSSQL_ELASTIC_BLOCK_STORE',
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('SavingsSelection', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('non on-prem mode (selectedExploreSavingsTab !== MSSQL_ON_PREMISES)', () => {
        it('renders savings selection text', () => {
            const { container } = render(<Provider store={makeStore()}><SavingsSelection printState={false} /></Provider>);
            expect(container.textContent).toContain('Savings selection text');
        });

        it('renders Snapshot frequency select', () => {
            render(<Provider store={makeStore()}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('select-Snapshot-frequency')).toBeTruthy();
        });

        it('renders Monthly change rate text field', () => {
            render(<Provider store={makeStore()}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('text-field-Monthly-change-rate-(%)')).toBeTruthy();
        });

        it('renders Number of cloned copies for Auto_EBS', () => {
            render(<Provider store={makeStore({ savingsCalculatorFrom: 'Auto_EBS' })}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('text-field-Number-of-cloned-copies')).toBeTruthy();
        });

        it('renders Clone refresh frequency for Auto_EBS', () => {
            render(<Provider store={makeStore({ savingsCalculatorFrom: 'Auto_EBS' })}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('select-Clone-refresh-frequency')).toBeTruthy();
        });

        it('renders Number of cloned copies for Auto_FSXW', () => {
            render(<Provider store={makeStore({ savingsCalculatorFrom: 'Auto_FSXW' })}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('text-field-Number-of-cloned-copies')).toBeTruthy();
        });

        it('does not render Clone refresh frequency for Auto_FSXW', () => {
            render(<Provider store={makeStore({ savingsCalculatorFrom: 'Auto_FSXW' })}><SavingsSelection printState={false} /></Provider>);
            expect(screen.queryByTestId('select-Clone-refresh-frequency')).toBeNull();
        });

        it('renders info icon with refer snapshots text', () => {
            const { container } = render(<Provider store={makeStore()}><SavingsSelection printState={false} /></Provider>);
            expect(container.textContent).toContain('Refer to snapshots');
        });

        it('renders mockInput when printState is true for Auto_EBS', () => {
            const { container } = render(<Provider store={makeStore()}><SavingsSelection printState={true} /></Provider>);
            const mocks = container.querySelectorAll('.mockInput');
            expect(mocks.length).toBeGreaterThan(0);
        });

        it('generates 3 snapshot frequency options', () => {
            render(<Provider store={makeStore()}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('select-count-Snapshot-frequency').textContent).toBe('3');
        });

        it('generates 3 clone refresh options for Auto_EBS', () => {
            render(<Provider store={makeStore({ savingsCalculatorFrom: 'Auto_EBS' })}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('select-count-Clone-refresh-frequency').textContent).toBe('3');
        });

        it('shows error for cloned copies > MAX_CLONED_COPIES', () => {
            render(<Provider store={makeStore({ savingsCalculatorFrom: 'Auto_EBS', numberOfClonedCopies: 1 })}><SavingsSelection printState={false} /></Provider>);
            const input = screen.getByLabelText('Number of cloned copies');
            fireEvent.change(input, { target: { value: '15' } });
            expect(screen.getByTestId('error-Number-of-cloned-copies')?.textContent).toBe('Max cloned copies limit');
        });

        it('shows error for change rate > MAX_MONTHLY_CHANGE_RATE', () => {
            render(<Provider store={makeStore()}><SavingsSelection printState={false} /></Provider>);
            const input = screen.getByLabelText('Monthly change rate (%)');
            fireEvent.change(input, { target: { value: '150' } });
            expect(screen.getByTestId('error-Monthly-change-rate-(%)').textContent).toBe('Max change rate limit');
        });

        it('strips non-numeric chars from cloned copies input', () => {
            render(<Provider store={makeStore({ savingsCalculatorFrom: 'Auto_EBS' })}><SavingsSelection printState={false} /></Provider>);
            const input = screen.getByLabelText('Number of cloned copies') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '5abc' } });
            expect(input.value).toBe('5');
        });
    });

    describe('on-prem mode (selectedExploreSavingsTab === MSSQL_ON_PREMISES)', () => {
        const onPremOverrides = {
            selectedExploreSavingsTab: 'MSSQL_ON_PREMISES',
            savingsCalculatorFrom: 'OnPrem'
        };

        it('renders Snapshot & clones heading', () => {
            const { container } = render(<Provider store={makeStore(onPremOverrides)}><SavingsSelection printState={false} /></Provider>);
            expect(container.textContent).toContain('Snapshot & clones');
        });

        it('renders provide values description text', () => {
            const { container } = render(<Provider store={makeStore(onPremOverrides)}><SavingsSelection printState={false} /></Provider>);
            expect(container.textContent).toContain('Provide clone and snapshot values to calculate the cost savings.');
        });

        it('renders Snapshot frequency select', () => {
            render(<Provider store={makeStore(onPremOverrides)}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('select-Snapshot-frequency')).toBeTruthy();
        });

        it('renders Number of cloned copies text field', () => {
            render(<Provider store={makeStore(onPremOverrides)}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('text-field-Number-of-cloned-copies')).toBeTruthy();
        });

        it('renders Monthly change rate text field', () => {
            render(<Provider store={makeStore(onPremOverrides)}><SavingsSelection printState={false} /></Provider>);
            expect(screen.getByTestId('text-field-Monthly-change-rate-(%)')).toBeTruthy();
        });

        it('renders printState mock fields when printState is true', () => {
            const { container } = render(<Provider store={makeStore(onPremOverrides)}><SavingsSelection printState={true} /></Provider>);
            const mocks = container.querySelectorAll('.mockInputClone');
            expect(mocks.length).toBeGreaterThan(0);
        });
    });

    describe('auto-selection effects', () => {
        it('auto-selects snapshot frequency for Auto_FSXW when null', () => {
            const store = makeStore({ savingsCalculatorFrom: 'Auto_FSXW' });
            const dispatchSpy = vi.spyOn(store, 'dispatch');
            render(<Provider store={store}><SavingsSelection printState={false} /></Provider>);
            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedSnapshotFrequency' }));
        });

        it('auto-selects clone refresh for Auto_EBS when null', () => {
            const store = makeStore({ savingsCalculatorFrom: 'Auto_EBS' });
            const dispatchSpy = vi.spyOn(store, 'dispatch');
            render(<Provider store={store}><SavingsSelection printState={false} /></Provider>);
            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSelectedCloneRefresh' }));
        });
    });
});
