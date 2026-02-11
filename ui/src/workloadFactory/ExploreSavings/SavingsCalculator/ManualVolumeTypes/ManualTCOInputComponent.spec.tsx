import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import ManualTCOInputComponent from './ManualTCOInputComponent';

vi.mock('@netapp/design-system', () => ({
    DsTextField: ({ title, disabledReason, isDisabled, className }: any) => (
        <div
            data-testid={`ds-text-field-${title?.replace(/\s+/g, '-')}`}
            data-disabled={String(!!isDisabled)}
            data-reason={disabledReason || ''}
        >
            {title}
        </div>
    ),
    Popover: ({ children }: any) => <div>{children}</div>,
    TextField: ({ label, onChange, value, className, error, info, isDisabled }: any) => (
        <div data-testid={`text-field-${label?.replace(/\s+/g, '-')}`}>
            <input
                aria-label={label}
                onChange={onChange}
                value={value || ''}
                data-error={error || ''}
                data-info={info || ''}
                data-disabled={String(!!isDisabled)}
            />
            {error && <span data-testid={`error-${label?.replace(/\s+/g, '-')}`}>{error}</span>}
            {info && <span data-testid={`info-${label?.replace(/\s+/g, '-')}`}>{info}</span>}
        </div>
    )
}));

vi.mock('./ManualTCOInputComponent.module.scss', () => ({
    default: { mainSection: 'mainSection', row: 'row', deploymentModelWidth: 'deploymentModelWidth' }
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../../store/workloadFactory/exploreSavingsSlice', () => ({
    setVolumeTypeOperation: (val: any) => ({ type: 'test/setVolumeTypeOperation', payload: val }),
    setSecondaryVolumeTypeOperation: (val: any) => ({ type: 'test/setSecondaryVolumeTypeOperation', payload: val })
}));

vi.mock('../../../../common/hooks/useSearchDebounce', () => ({
    useSearchDebounce: () => [null, vi.fn()]
}));

const emptyVolumeTypes = {
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

const makeStore = (overrides: any = {}) => {
    const slice = createSlice({
        name: 'exploreSavings',
        initialState: {
            manualTCOVolumeTypes: emptyVolumeTypes,
            manualTCOVolumeTypes2: emptyVolumeTypes,
            ...overrides
        },
        reducers: {}
    });
    return configureStore({ reducer: { exploreSavings: slice.reducer } });
};

describe('ManualTCOInputComponent', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('basic rendering for gp3 (no disable flags)', () => {
        it('renders Number of volumes field', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.getByLabelText('Number of volumes')).toBeTruthy();
        });

        it('renders Storage amount per volume field', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.getByLabelText('Storage amount per volume (GiB)')).toBeTruthy();
        });

        it('renders Provisioned IOPS per volume as enabled TextField', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.getByLabelText('Provisioned IOPS per volume')).toBeTruthy();
        });

        it('renders Throughput (MB/s) as enabled TextField', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.getByLabelText('Throughput (MB/s)')).toBeTruthy();
        });
    });

    describe('disabled fields', () => {
        it('renders disabled IOPS DsTextField when IOPSDisable is true', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp2" IOPSDisable from="primary" />
                </Provider>
            );
            const field = screen.getByTestId('ds-text-field-Provisioned-IOPS-per-volume');
            expect(field).toBeTruthy();
            expect(field).toHaveAttribute('data-disabled', 'true');
        });

        it('renders disabled Throughput DsTextField when throughPutDisable is true', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="io1" throughPutDisable from="primary" />
                </Provider>
            );
            const field = screen.getByTestId('ds-text-field-Throughput-(MB/s)');
            expect(field).toBeTruthy();
            expect(field).toHaveAttribute('data-disabled', 'true');
        });

        it('renders both disabled DsTextField for gp2 (IOPSDisable + throughPutDisable)', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp2" IOPSDisable throughPutDisable from="primary" />
                </Provider>
            );
            expect(screen.getByTestId('ds-text-field-Provisioned-IOPS-per-volume')).toHaveAttribute(
                'data-disabled',
                'true'
            );
            expect(screen.getByTestId('ds-text-field-Throughput-(MB/s)')).toHaveAttribute('data-disabled', 'true');
        });
    });

    describe('input onChange - strips non-numeric chars', () => {
        it('updates volume value on change', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            const input = screen.getByLabelText('Number of volumes') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '123abc' } });
            expect(input.value).toBe('123');
        });

        it('updates storage amount value on change', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            const input = screen.getByLabelText('Storage amount per volume (GiB)') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '50xyz' } });
            expect(input.value).toBe('50');
        });

        it('updates IOPS value on change', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            const input = screen.getByLabelText('Provisioned IOPS per volume') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '3000abc' } });
            expect(input.value).toBe('3000');
        });

        it('updates throughput value on change', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            const input = screen.getByLabelText('Throughput (MB/s)') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '125xyz' } });
            expect(input.value).toBe('125');
        });
    });

    describe('IOPS error handling for primary', () => {
        it('shows gp3 IOPS error when value < 3000', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOProvisionedIOPS: 100 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            const errorEl = screen.queryByTestId('error-Provisioned-IOPS-per-volume');
            expect(errorEl?.textContent).toBe('IOPS must be between 3000 and 16000.');
        });

        it('shows gp3 IOPS error when value > 16000', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOProvisionedIOPS: 20000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')?.textContent).toBe(
                'IOPS must be between 3000 and 16000.'
            );
        });

        it('shows io1 IOPS error when value < 100', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                io1: { ...emptyVolumeTypes.io1, manualTCOProvisionedIOPS: 50 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="io1" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')?.textContent).toBe(
                'IOPS must be between 100 and 64000.'
            );
        });

        it('shows io1 IOPS error when value > 64000', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                io1: { ...emptyVolumeTypes.io1, manualTCOProvisionedIOPS: 70000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="io1" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')?.textContent).toBe(
                'IOPS must be between 100 and 64000.'
            );
        });

        it('shows io2 IOPS error when value < 100', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                io2: { ...emptyVolumeTypes.io2, manualTCOProvisionedIOPS: 10 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="io2" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')?.textContent).toBe(
                'IOPS must be between 100 and 256000.'
            );
        });

        it('shows io2 IOPS error when value > 256000', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                io2: { ...emptyVolumeTypes.io2, manualTCOProvisionedIOPS: 300000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="io2" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')?.textContent).toBe(
                'IOPS must be between 100 and 256000.'
            );
        });

        it('no IOPS error for valid gp3 value', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOProvisionedIOPS: 5000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')).toBeNull();
        });
    });

    describe('IOPS error handling for secondary', () => {
        it('shows gp3 secondary IOPS error when value < 3000', () => {
            const volTypes2 = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOProvisionedIOPS: 2000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes2: volTypes2 })}>
                    <ManualTCOInputComponent type="gp3" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')?.textContent).toBe(
                'IOPS must be between 3000 and 16000.'
            );
        });

        it('shows io1 secondary IOPS error when value > 64000', () => {
            const volTypes2 = {
                ...emptyVolumeTypes,
                io1: { ...emptyVolumeTypes.io1, manualTCOProvisionedIOPS: 70000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes2: volTypes2 })}>
                    <ManualTCOInputComponent type="io1" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')?.textContent).toBe(
                'IOPS must be between 100 and 64000.'
            );
        });

        it('shows io2 secondary IOPS error when value > 256000', () => {
            const volTypes2 = {
                ...emptyVolumeTypes,
                io2: { ...emptyVolumeTypes.io2, manualTCOProvisionedIOPS: 300000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes2: volTypes2 })}>
                    <ManualTCOInputComponent type="io2" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Provisioned-IOPS-per-volume')?.textContent).toBe(
                'IOPS must be between 100 and 256000.'
            );
        });
    });

    describe('throughput error handling', () => {
        it('shows gp3 throughput error when primary value < 125', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOThroughput: 50 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Throughput-(MB/s)')?.textContent).toBe(
                'Throughput must be between 125 and 1000.'
            );
        });

        it('shows gp3 throughput error when primary value > 1000', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOThroughput: 2000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Throughput-(MB/s)')?.textContent).toBe(
                'Throughput must be between 125 and 1000.'
            );
        });

        it('shows gp3 throughput error for secondary when value < 125', () => {
            const volTypes2 = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOThroughput: 10 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes2: volTypes2 })}>
                    <ManualTCOInputComponent type="gp3" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Throughput-(MB/s)')?.textContent).toBe(
                'Throughput must be between 125 and 1000.'
            );
        });

        it('no throughput error for io1 type', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                io1: { ...emptyVolumeTypes.io1, manualTCOThroughput: 50 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="io1" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Throughput-(MB/s)')).toBeNull();
        });
    });

    describe('volume error handling', () => {
        it('shows error when primary volume exceeds 1000000000', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCONumberOfVolumes: 2000000000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Number-of-volumes')?.textContent).toBe('Maximum value is 1000000000');
        });

        it('shows error when secondary volume exceeds 1000000000', () => {
            const volTypes2 = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCONumberOfVolumes: 2000000000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes2: volTypes2 })}>
                    <ManualTCOInputComponent type="gp3" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Number-of-volumes')?.textContent).toBe('Maximum value is 1000000000');
        });

        it('no error when volume is within limits', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCONumberOfVolumes: 100 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Number-of-volumes')).toBeNull();
        });
    });

    describe('storage capacity error handling', () => {
        it('shows io2 max capacity error for primary when > 65536', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                io2: { ...emptyVolumeTypes.io2, manualTCOStorageAmount: 70000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="io2" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Maximum capacity allowed: 64 TiB.'
            );
        });

        it('shows io2 min capacity error for primary when < 4', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                io2: { ...emptyVolumeTypes.io2, manualTCOStorageAmount: 2 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="io2" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Minimum capacity allowed: 4 GiB.'
            );
        });

        it('shows st1 min capacity error for primary when < 125', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                st1: { ...emptyVolumeTypes.st1, manualTCOStorageAmount: 50 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="st1" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Minimum capacity allowed: 125 GiB.'
            );
        });

        it('shows st1 max capacity error for primary when > 16384', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                st1: { ...emptyVolumeTypes.st1, manualTCOStorageAmount: 20000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="st1" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Maximum capacity allowed: 16 TiB.'
            );
        });

        it('shows max capacity error for other types (gp3) when > 16384', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOStorageAmount: 20000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Maximum capacity allowed: 16 TiB.'
            );
        });

        it('shows io2 max capacity error for secondary when > 65536', () => {
            const volTypes2 = {
                ...emptyVolumeTypes,
                io2: { ...emptyVolumeTypes.io2, manualTCOStorageAmount: 70000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes2: volTypes2 })}>
                    <ManualTCOInputComponent type="io2" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Maximum capacity allowed: 64 TiB.'
            );
        });

        it('shows non-io2 max capacity error for secondary when > 16384', () => {
            const volTypes2 = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOStorageAmount: 20000 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes2: volTypes2 })}>
                    <ManualTCOInputComponent type="gp3" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Maximum capacity allowed: 16 TiB.'
            );
        });

        it('no storage error for valid value', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: { ...emptyVolumeTypes.gp3, manualTCOStorageAmount: 500 }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('error-Storage-amount-per-volume-(GiB)')).toBeNull();
        });
    });

    describe('info text', () => {
        it('shows io2 storage info as 64 TiB', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="io2" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('info-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Maximum capacity allowed: 64 TiB.'
            );
        });

        it('shows non-io2 storage info as 16 TiB', () => {
            render(
                <Provider store={makeStore()}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(screen.queryByTestId('info-Storage-amount-per-volume-(GiB)')?.textContent).toBe(
                'Maximum capacity allowed: 16 TiB.'
            );
        });
    });

    describe('dispatches for primary vs secondary', () => {
        it('dispatches setVolumeTypeOperation for primary', () => {
            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');
            render(
                <Provider store={store}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/setVolumeTypeOperation' }));
        });

        it('dispatches setSecondaryVolumeTypeOperation for non-primary', () => {
            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');
            render(
                <Provider store={store}>
                    <ManualTCOInputComponent type="gp3" />
                </Provider>
            );
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'test/setSecondaryVolumeTypeOperation' })
            );
        });
    });

    describe('default values from Redux state', () => {
        it('shows primary default values in fields', () => {
            const volTypes = {
                ...emptyVolumeTypes,
                gp3: {
                    manualTCONumberOfVolumes: 5,
                    manualTCOStorageAmount: 100,
                    manualTCOProvisionedIOPS: 3000,
                    manualTCOThroughput: 125
                }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes: volTypes })}>
                    <ManualTCOInputComponent type="gp3" from="primary" />
                </Provider>
            );
            expect((screen.getByLabelText('Number of volumes') as HTMLInputElement).value).toBe('5');
            expect((screen.getByLabelText('Storage amount per volume (GiB)') as HTMLInputElement).value).toBe('100');
            expect((screen.getByLabelText('Provisioned IOPS per volume') as HTMLInputElement).value).toBe('3000');
            expect((screen.getByLabelText('Throughput (MB/s)') as HTMLInputElement).value).toBe('125');
        });

        it('shows secondary default values in fields', () => {
            const volTypes2 = {
                ...emptyVolumeTypes,
                io1: {
                    manualTCONumberOfVolumes: 8,
                    manualTCOStorageAmount: 200,
                    manualTCOProvisionedIOPS: 5000,
                    manualTCOThroughput: null
                }
            };
            render(
                <Provider store={makeStore({ manualTCOVolumeTypes2: volTypes2 })}>
                    <ManualTCOInputComponent type="io1" />
                </Provider>
            );
            expect((screen.getByLabelText('Number of volumes') as HTMLInputElement).value).toBe('8');
            expect((screen.getByLabelText('Storage amount per volume (GiB)') as HTMLInputElement).value).toBe('200');
            expect((screen.getByLabelText('Provisioned IOPS per volume') as HTMLInputElement).value).toBe('5000');
        });
    });
});
