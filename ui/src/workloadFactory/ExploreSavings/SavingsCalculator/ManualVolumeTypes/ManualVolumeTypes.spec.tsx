import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ManualVolumeTypes from './ManualVolumeTypes';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, onClick }: any) => (
        <span data-variant={variant} className={className} onClick={onClick}>{children}</span>
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
        <div data-testid={`manual-tco-input-${type}`} data-throughput-disable={String(!!throughPutDisable)} data-iops-disable={String(!!IOPSDisable)} data-from={from || ''}>
            ManualTCOInputComponent-{type}
        </div>
    )
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedVolumeType: (val: any) => ({ type: 'test/setSelectedVolumeType', payload: val }),
    setVolumeFilledStatus: (val: any) => ({ type: 'test/setVolumeFilledStatus', payload: val })
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

const emptyVolumeTypes = {
    io2: { manualTCONumberOfVolumes: null, manualTCOStorageAmount: null, manualTCOProvisionedIOPS: null, manualTCOThroughput: null },
    io1: { manualTCONumberOfVolumes: null, manualTCOStorageAmount: null, manualTCOProvisionedIOPS: null, manualTCOThroughput: null },
    gp2: { manualTCONumberOfVolumes: null, manualTCOStorageAmount: null, manualTCOProvisionedIOPS: null, manualTCOThroughput: null },
    gp3: { manualTCONumberOfVolumes: null, manualTCOStorageAmount: null, manualTCOProvisionedIOPS: null, manualTCOThroughput: null },
    st1: { manualTCONumberOfVolumes: null, manualTCOStorageAmount: null, manualTCOProvisionedIOPS: null, manualTCOThroughput: null }
};

const filledGp3VolumeTypes = {
    ...emptyVolumeTypes,
    gp3: { manualTCONumberOfVolumes: 5, manualTCOStorageAmount: 100, manualTCOProvisionedIOPS: 3000, manualTCOThroughput: 125 }
};

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            selectedVolumeTab: 'gp2',
            manualTCOVolumeTypes: emptyVolumeTypes,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('ManualVolumeTypes', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders Volume Types heading', () => {
        const { container } = render(<Provider store={makeStore()}><ManualVolumeTypes /></Provider>);
        expect(container.textContent).toContain('Volume Types');
    });

    it('renders sub-text about filling at least one volume type', () => {
        const { container } = render(<Provider store={makeStore()}><ManualVolumeTypes /></Provider>);
        expect(container.textContent).toContain('At least one volume type should be filled.');
    });

    it('renders total volumes as 0 when no volumes are filled', () => {
        const { container } = render(<Provider store={makeStore()}><ManualVolumeTypes /></Provider>);
        expect(container.textContent).toContain('(Total volumes: 0)');
    });

    it('renders total volumes > 0 when gp3 is filled', () => {
        const store = makeStore({ manualTCOVolumeTypes: filledGp3VolumeTypes });
        const { container } = render(<Provider store={store}><ManualVolumeTypes /></Provider>);
        expect(container.textContent).toContain('(Total volumes: 5)');
    });

    it('dispatches setVolumeFilledStatus(true) when volumes are filled', () => {
        const store = makeStore({ manualTCOVolumeTypes: filledGp3VolumeTypes });
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ManualVolumeTypes /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setVolumeFilledStatus', payload: true });
    });

    it('dispatches setVolumeFilledStatus(false) when no volumes are filled', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(<Provider store={store}><ManualVolumeTypes /></Provider>);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setVolumeFilledStatus', payload: false });
    });

    it('renders all 5 volume type tabs: gp2, gp3, io1, io2, st1', () => {
        const { container } = render(<Provider store={makeStore()}><ManualVolumeTypes /></Provider>);
        expect(container.textContent).toContain('gp2');
        expect(container.textContent).toContain('gp3');
        expect(container.textContent).toContain('io1');
        expect(container.textContent).toContain('io2');
        expect(container.textContent).toContain('st1');
    });

    it('renders gp2 tab with active class when selectedVolumeTab is gp2', () => {
        const { container } = render(<Provider store={makeStore({ selectedVolumeTab: 'gp2' })}><ManualVolumeTypes /></Provider>);
        const tabs = container.querySelectorAll('.headerPart1');
        const gp2Tab = Array.from(tabs).find(t => t.textContent === 'gp2');
        expect(gp2Tab?.className).toContain('active');
    });

    it('renders io1 tab with active class when selectedVolumeTab is io1', () => {
        const { container } = render(<Provider store={makeStore({ selectedVolumeTab: 'io1' })}><ManualVolumeTypes /></Provider>);
        const tabs = container.querySelectorAll('.headerPart1');
        const io1Tab = Array.from(tabs).find(t => t.textContent === 'io1');
        expect(io1Tab?.className).toContain('active');
    });

    it('dispatches setSelectedVolumeType on tab click', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        const { container } = render(<Provider store={store}><ManualVolumeTypes /></Provider>);
        const tabs = container.querySelectorAll('.headerPart1');
        const gp3Tab = Array.from(tabs).find(t => t.textContent === 'gp3');
        fireEvent.click(gp3Tab!);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSelectedVolumeType', payload: 'gp3' });
    });

    it('renders ManualTCOInputComponent for gp2 when selectedVolumeTab is gp2', () => {
        render(<Provider store={makeStore({ selectedVolumeTab: 'gp2' })}><ManualVolumeTypes /></Provider>);
        const input = screen.getByTestId('manual-tco-input-gp2');
        expect(input).toBeTruthy();
        expect(input).toHaveAttribute('data-throughput-disable', 'true');
        expect(input).toHaveAttribute('data-iops-disable', 'true');
        expect(input).toHaveAttribute('data-from', 'primary');
    });

    it('renders ManualTCOInputComponent for gp3 when selectedVolumeTab is gp3', () => {
        render(<Provider store={makeStore({ selectedVolumeTab: 'gp3' })}><ManualVolumeTypes /></Provider>);
        const input = screen.getByTestId('manual-tco-input-gp3');
        expect(input).toBeTruthy();
        expect(input).toHaveAttribute('data-throughput-disable', 'false');
        expect(input).toHaveAttribute('data-iops-disable', 'false');
        expect(input).toHaveAttribute('data-from', 'primary');
    });

    it('renders ManualTCOInputComponent for io1 with throughPutDisable', () => {
        render(<Provider store={makeStore({ selectedVolumeTab: 'io1' })}><ManualVolumeTypes /></Provider>);
        const input = screen.getByTestId('manual-tco-input-io1');
        expect(input).toHaveAttribute('data-throughput-disable', 'true');
        expect(input).toHaveAttribute('data-iops-disable', 'false');
    });

    it('renders ManualTCOInputComponent for io2 with throughPutDisable', () => {
        render(<Provider store={makeStore({ selectedVolumeTab: 'io2' })}><ManualVolumeTypes /></Provider>);
        const input = screen.getByTestId('manual-tco-input-io2');
        expect(input).toHaveAttribute('data-throughput-disable', 'true');
        expect(input).toHaveAttribute('data-iops-disable', 'false');
    });

    it('renders ManualTCOInputComponent for st1 with throughPutDisable and IOPSDisable', () => {
        render(<Provider store={makeStore({ selectedVolumeTab: 'st1' })}><ManualVolumeTypes /></Provider>);
        const input = screen.getByTestId('manual-tco-input-st1');
        expect(input).toHaveAttribute('data-throughput-disable', 'true');
        expect(input).toHaveAttribute('data-iops-disable', 'true');
    });

    it('does not render ManualTCOInputComponent for unselected tabs', () => {
        render(<Provider store={makeStore({ selectedVolumeTab: 'gp2' })}><ManualVolumeTypes /></Provider>);
        expect(screen.queryByTestId('manual-tco-input-gp3')).toBeNull();
        expect(screen.queryByTestId('manual-tco-input-io1')).toBeNull();
        expect(screen.queryByTestId('manual-tco-input-io2')).toBeNull();
        expect(screen.queryByTestId('manual-tco-input-st1')).toBeNull();
    });

    it('clicking different tabs dispatches different volume types', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        const { container } = render(<Provider store={store}><ManualVolumeTypes /></Provider>);
        const tabs = container.querySelectorAll('.headerPart1');

        const io2Tab = Array.from(tabs).find(t => t.textContent === 'io2');
        fireEvent.click(io2Tab!);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSelectedVolumeType', payload: 'io2' });

        const st1Tab = Array.from(tabs).find(t => t.textContent === 'st1');
        fireEvent.click(st1Tab!);
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'test/setSelectedVolumeType', payload: 'st1' });
    });

    it('calculates totalVolumes with multiple filled volume types', () => {
        const multiFilledVolumeTypes = {
            ...emptyVolumeTypes,
            gp3: { manualTCONumberOfVolumes: 5, manualTCOStorageAmount: 100, manualTCOProvisionedIOPS: 3000, manualTCOThroughput: 125 },
            io1: { manualTCONumberOfVolumes: 3, manualTCOStorageAmount: 200, manualTCOProvisionedIOPS: 5000, manualTCOThroughput: null }
        };
        const store = makeStore({ manualTCOVolumeTypes: multiFilledVolumeTypes });
        const { container } = render(<Provider store={store}><ManualVolumeTypes /></Provider>);
        // io1 has null throughput, but allPropertiesHaveValues only checks the 3 io1 properties (volumes, storage, iops)
        // so io1Complete = 1, gp3Complete = 1, total = 5 + 3 = 8
        expect(container.textContent).toContain('(Total volumes: 8)');
    });
});
