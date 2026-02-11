import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import SecondaryManualVolType from './SecondaryManualVolType';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, onClick }: any) => (
        <span data-variant={variant} className={className} onClick={onClick}>
            {children}
        </span>
    ),
    TextField: ({ label, onChange, value, className }: any) => (
        <input aria-label={label} onChange={onChange} value={value || ''} className={className} />
    )
}));

vi.mock('./ManualVolumeTypes.module.scss', () => ({
    default: {
        manualVolumeTypes: 'manualVolumeTypes',
        volSection: 'volSection',
        subText: 'subText',
        overviewTabsVolumeType: 'overviewTabsVolumeType',
        headerPart1: 'headerPart1',
        active: 'active',
        contentContainer: 'contentContainer'
    }
}));

vi.mock('./ManualTCOInputComponent', () => ({
    default: ({ type, throughPutDisable, IOPSDisable, from }: any) => (
        <div
            data-testid={`manual-tco-input-${type}`}
            data-throughput-disable={String(!!throughPutDisable)}
            data-iops-disable={String(!!IOPSDisable)}
            data-from={from || 'secondary'}
        >
            ManualTCOInputComponent-{type}
        </div>
    )
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedVolumeTabForSecondary: (val: any) => ({ type: 'test/setSelectedVolumeTabForSecondary', payload: val }),
    setSecondaryVolumeFilledStatus: (val: any) => ({ type: 'test/setSecondaryVolumeFilledStatus', payload: val })
}));

vi.mock('../savingsUtil', () => ({
    allPropertiesHaveValues: (obj: any) => {
        if (!obj) return 0;
        for (const key in obj) {
            if (obj[key] === null || obj[key] === undefined || obj[key] === '' || parseInt(obj[key]) === 0) {
                return 0;
            }
        }
        return 1;
    },
    calculateTotalVolumes: (io1: number, io2: number, gp2: number, gp3: number, st1: number, volTypes: any) =>
        Number(io1 ? volTypes?.io1?.manualTCONumberOfVolumes : 0) +
        Number(io2 ? volTypes?.io2?.manualTCONumberOfVolumes : 0) +
        Number(gp2 ? volTypes?.gp2?.manualTCONumberOfVolumes : 0) +
        Number(gp3 ? volTypes?.gp3?.manualTCONumberOfVolumes : 0) +
        Number(st1 ? volTypes?.st1?.manualTCONumberOfVolumes : 0)
}));

const emptyVolumeTypes2 = {
    io2: {
        manualTCONumberOfVolumes: null,
        manualTCOStorageAmount: null,
        manualTCOProvisionedIOPS: null,
        manualTCOThroughput: null
    },
    io1: {
        manualTCONumberOfVolumes: null,
        manualTCOStorageAmount: null,
        manualTCOProvisionedIOPS: null,
        manualTCOThroughput: null
    },
    gp2: {
        manualTCONumberOfVolumes: null,
        manualTCOStorageAmount: null,
        manualTCOProvisionedIOPS: null,
        manualTCOThroughput: null
    },
    gp3: {
        manualTCONumberOfVolumes: null,
        manualTCOStorageAmount: null,
        manualTCOProvisionedIOPS: null,
        manualTCOThroughput: null
    },
    st1: {
        manualTCONumberOfVolumes: null,
        manualTCOStorageAmount: null,
        manualTCOProvisionedIOPS: null,
        manualTCOThroughput: null
    }
};

const filledGp2VolumeTypes2 = {
    ...emptyVolumeTypes2,
    gp2: {
        manualTCONumberOfVolumes: 10,
        manualTCOStorageAmount: 200,
        manualTCOProvisionedIOPS: null,
        manualTCOThroughput: null
    }
};

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedVolumeTabForSecondary: 'gp2',
            manualTCOVolumeTypes2: emptyVolumeTypes2,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('SecondaryManualVolType', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders Volume Types heading', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SecondaryManualVolType />
            </Provider>
        );
        expect(container.textContent).toContain('Volume Types');
    });

    it('renders sub-text about filling at least one volume type', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SecondaryManualVolType />
            </Provider>
        );
        expect(container.textContent).toContain('At least one volume type should be filled.');
    });

    it('renders total volumes as 0 when no volumes are filled', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SecondaryManualVolType />
            </Provider>
        );
        expect(container.textContent).toContain('(Total volumes: 0)');
    });

    it('renders total volumes > 0 when gp2 is filled', () => {
        const store = makeStore({ manualTCOVolumeTypes2: filledGp2VolumeTypes2 });
        const { container } = render(
            <Provider store={store}>
                <SecondaryManualVolType />
            </Provider>
        );
        expect(container.textContent).toContain('(Total volumes: 10)');
    });

    it('dispatches setSecondaryVolumeFilledStatus(true) when volumes are filled', () => {
        const store = makeStore({ manualTCOVolumeTypes2: filledGp2VolumeTypes2 });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <SecondaryManualVolType />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSecondaryVolumeFilledStatus', payload: true });
    });

    it('dispatches setSecondaryVolumeFilledStatus(false) when no volumes are filled', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <SecondaryManualVolType />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSecondaryVolumeFilledStatus', payload: false });
    });

    it('renders all 5 volume type tabs: gp2, gp3, io1, io2, st1', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <SecondaryManualVolType />
            </Provider>
        );
        expect(container.textContent).toContain('gp2');
        expect(container.textContent).toContain('gp3');
        expect(container.textContent).toContain('io1');
        expect(container.textContent).toContain('io2');
        expect(container.textContent).toContain('st1');
    });

    it('renders gp2 tab with active class when selectedVolumeTabForSecondary is gp2', () => {
        const { container } = render(
            <Provider store={makeStore({ selectedVolumeTabForSecondary: 'gp2' })}>
                <SecondaryManualVolType />
            </Provider>
        );
        const tabs = container.querySelectorAll('.headerPart1');
        const gp2Tab = Array.from(tabs).find(t => t.textContent === 'gp2');
        expect(gp2Tab?.className).toContain('active');
    });

    it('renders gp3 tab with active class when selectedVolumeTabForSecondary is gp3', () => {
        const { container } = render(
            <Provider store={makeStore({ selectedVolumeTabForSecondary: 'gp3' })}>
                <SecondaryManualVolType />
            </Provider>
        );
        const tabs = container.querySelectorAll('.headerPart1');
        const gp3Tab = Array.from(tabs).find(t => t.textContent === 'gp3');
        expect(gp3Tab?.className).toContain('active');
    });

    it('dispatches setSelectedVolumeTabForSecondary on tab click', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        const { container } = render(
            <Provider store={store}>
                <SecondaryManualVolType />
            </Provider>
        );
        const tabs = container.querySelectorAll('.headerPart1');
        const io1Tab = Array.from(tabs).find(t => t.textContent === 'io1');
        fireEvent.click(io1Tab!);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSelectedVolumeTabForSecondary', payload: 'io1' });
    });

    it('renders ManualTCOInputComponent for gp2 tab (no from prop, throughPutDisable and IOPSDisable)', () => {
        render(
            <Provider store={makeStore({ selectedVolumeTabForSecondary: 'gp2' })}>
                <SecondaryManualVolType />
            </Provider>
        );
        const input = screen.getByTestId('manual-tco-input-gp2');
        expect(input).toBeTruthy();
        expect(input).toHaveAttribute('data-throughput-disable', 'true');
        expect(input).toHaveAttribute('data-iops-disable', 'true');
    });

    it('renders ManualTCOInputComponent for gp3 tab (no disable flags)', () => {
        render(
            <Provider store={makeStore({ selectedVolumeTabForSecondary: 'gp3' })}>
                <SecondaryManualVolType />
            </Provider>
        );
        const input = screen.getByTestId('manual-tco-input-gp3');
        expect(input).toHaveAttribute('data-throughput-disable', 'false');
        expect(input).toHaveAttribute('data-iops-disable', 'false');
    });

    it('renders ManualTCOInputComponent for io1 with throughPutDisable', () => {
        render(
            <Provider store={makeStore({ selectedVolumeTabForSecondary: 'io1' })}>
                <SecondaryManualVolType />
            </Provider>
        );
        const input = screen.getByTestId('manual-tco-input-io1');
        expect(input).toHaveAttribute('data-throughput-disable', 'true');
        expect(input).toHaveAttribute('data-iops-disable', 'false');
    });

    it('renders ManualTCOInputComponent for io2 with throughPutDisable', () => {
        render(
            <Provider store={makeStore({ selectedVolumeTabForSecondary: 'io2' })}>
                <SecondaryManualVolType />
            </Provider>
        );
        const input = screen.getByTestId('manual-tco-input-io2');
        expect(input).toHaveAttribute('data-throughput-disable', 'true');
        expect(input).toHaveAttribute('data-iops-disable', 'false');
    });

    it('renders ManualTCOInputComponent for st1 with throughPutDisable and IOPSDisable', () => {
        render(
            <Provider store={makeStore({ selectedVolumeTabForSecondary: 'st1' })}>
                <SecondaryManualVolType />
            </Provider>
        );
        const input = screen.getByTestId('manual-tco-input-st1');
        expect(input).toHaveAttribute('data-throughput-disable', 'true');
        expect(input).toHaveAttribute('data-iops-disable', 'true');
    });

    it('does not render ManualTCOInputComponent for unselected tabs', () => {
        render(
            <Provider store={makeStore({ selectedVolumeTabForSecondary: 'io2' })}>
                <SecondaryManualVolType />
            </Provider>
        );
        expect(screen.queryByTestId('manual-tco-input-gp2')).toBeNull();
        expect(screen.queryByTestId('manual-tco-input-gp3')).toBeNull();
        expect(screen.queryByTestId('manual-tco-input-io1')).toBeNull();
        expect(screen.queryByTestId('manual-tco-input-st1')).toBeNull();
    });

    it('clicking different tabs dispatches correct values', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        const { container } = render(
            <Provider store={store}>
                <SecondaryManualVolType />
            </Provider>
        );
        const tabs = container.querySelectorAll('.headerPart1');

        fireEvent.click(Array.from(tabs).find(t => t.textContent === 'st1')!);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSelectedVolumeTabForSecondary', payload: 'st1' });

        fireEvent.click(Array.from(tabs).find(t => t.textContent === 'io2')!);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSelectedVolumeTabForSecondary', payload: 'io2' });
    });

    it('calculates totalVolumes with multiple filled volume types', () => {
        const multiFilledVolumeTypes2 = {
            ...emptyVolumeTypes2,
            gp2: {
                manualTCONumberOfVolumes: 10,
                manualTCOStorageAmount: 200,
                manualTCOProvisionedIOPS: null,
                manualTCOThroughput: null
            },
            io2: {
                manualTCONumberOfVolumes: 7,
                manualTCOStorageAmount: 300,
                manualTCOProvisionedIOPS: 5000,
                manualTCOThroughput: null
            }
        };
        const store = makeStore({ manualTCOVolumeTypes2: multiFilledVolumeTypes2 });
        const { container } = render(
            <Provider store={store}>
                <SecondaryManualVolType />
            </Provider>
        );
        // gp2Complete checks manualTCONumberOfVolumes + manualTCOStorageAmount => both filled => 1
        // io2Complete checks manualTCONumberOfVolumes + manualTCOStorageAmount + manualTCOProvisionedIOPS => all filled => 1
        // total = 10 + 7 = 17
        expect(container.textContent).toContain('(Total volumes: 17)');
    });
});
