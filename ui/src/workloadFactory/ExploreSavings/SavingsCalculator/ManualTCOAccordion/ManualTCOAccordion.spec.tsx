import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ManualTCOAccordion from './ManualTCOAccordion';

vi.mock('@netapp/design-system', () => ({
    DsAccordion: ({ id, title, variant, value, children, onClick }: any) => (
        <div data-testid="ds-accordion" data-id={id}>
            <div data-testid="accordion-title" onClick={onClick}>
                {title}
            </div>
            <div data-testid="accordion-children">{children}</div>
        </div>
    )
}));

vi.mock('../ManualEC2/SecondaryManualEC2', () => ({
    default: () => <div data-testid="secondary-manual-ec2" />
}));

vi.mock('../ManualVolumeTypes/SecondaryManualVolType', () => ({
    default: () => <div data-testid="secondary-manual-vol-type" />
}));

vi.mock('./ManualTCOAccordion.module.scss', () => ({
    default: { manualAccordion: 'manualAccordion' }
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSecondaryVolDetails: (val: any) => ({ type: 'test/setSecondaryVolDetails', payload: val }),
    setSelectedSecondaryManualInstanceType: (val: any) => ({
        type: 'test/setSelectedSecondaryManualInstanceType',
        payload: val
    })
}));

const volDefaults = {
    manualTCONumberOfVolumes: 1,
    manualTCOStorageAmount: 100,
    manualTCOProvisionedIOPS: 3000,
    manualTCOThroughput: 125
};

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            manualTCOVolumeTypes: {
                io2: { ...volDefaults },
                io1: { ...volDefaults },
                gp2: { ...volDefaults },
                gp3: { ...volDefaults },
                st1: { ...volDefaults }
            },
            selectedManualInstanceType: { label: 'm5.xlarge', value: 'm5.xlarge' },
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('ManualTCOAccordion', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the accordion with correct title', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <ManualTCOAccordion />
            </Provider>
        );
        expect(container.textContent).toContain('Secondary EC2 specifications');
    });

    it('renders SecondaryManualEC2 component', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOAccordion />
            </Provider>
        );
        expect(screen.getByTestId('secondary-manual-ec2')).toBeTruthy();
    });

    it('renders SecondaryManualVolType component', () => {
        render(
            <Provider store={makeStore()}>
                <ManualTCOAccordion />
            </Provider>
        );
        expect(screen.getByTestId('secondary-manual-vol-type')).toBeTruthy();
    });

    it('dispatches setSecondaryVolDetails on mount', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualTCOAccordion />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSecondaryVolDetails' }));
    });

    it('dispatches setSelectedSecondaryManualInstanceType on mount', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualTCOAccordion />
            </Provider>
        );
        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'test/setSelectedSecondaryManualInstanceType',
            payload: { label: 'm5.xlarge', value: 'm5.xlarge' }
        });
    });

    it('re-dispatches on accordion click (toggle)', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <ManualTCOAccordion />
            </Provider>
        );
        dispatchSpy.mockClear();
        fireEvent.click(screen.getByTestId('accordion-title'));
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setSecondaryVolDetails' }));
    });
});
