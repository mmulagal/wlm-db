import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import RebaseRollbackContent from './RebaseRollbackContent';

const mockGetRollbackSnapshotApi = vi.fn();

vi.mock('../../../../utils/apiService', () => ({
    useLazyGetRollbackSnapshotsQuery: () => [mockGetRollbackSnapshotApi]
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    formatDateWithTime: vi.fn(val => `formatted_${val}`),
    generateOptionType: vi.fn((value, label) => ({ value, label, isDisabled: false }))
}));

vi.mock('@netapp/design-system', () => ({
    DsRadioButton: ({ id, isSelected, title, onClick }: any) => (
        <button data-testid={`radio-${id}`} data-selected={isSelected} onClick={onClick}>
            {title}
        </button>
    ),
    SelectField: ({ label, onChange, value, options, isDisabled, isLoading }: any) => (
        <div data-testid="select-field" data-disabled={isDisabled} data-loading={isLoading}>
            <span>{label}</span>
            {options?.map((opt: any) => (
                <div key={opt.value} onClick={() => onChange(opt)}>
                    {opt.label}
                </div>
            ))}
        </div>
    )
}));

vi.mock('./RebaseRollbackContent.module.scss', () => ({
    default: {
        rebaseRollBack: 'rebaseRollBack',
        radioContainer: 'radioContainer',
        widthSet: 'widthSet'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        REFRESH_CURRENT_RADIO: 'Refresh from current point in time',
        REFRESH_SNAPSHOT_RADIO: 'Rollback to a snapshot'
    }
}));

vi.mock('../../../../utils/consts', () => ({
    WLF_TABS: { SANDBOXES: 'sandboxes' }
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        sandbox: {
            isRollbackSelected: false,
            rollbackSnapshotList: [],
            selectedRollbackSnapshot: null,
            rollbackSnapshotsLoading: false,
            ...overrides.sandbox
        },
        headers: {
            headerSelectedCredSandbox: { data: { credentialsId: 'cred1' } },
            headerSelectedRegionSandbox: { label2: 'us-east-1' },
            ...overrides.headers
        },
        workloadFactoryResource: {
            selectedResourceCredId: 'cred1',
            selectedResourceRegionId: 'us-east-1',
            ...overrides.workloadFactoryResource
        }
    };

    return configureStore({
        reducer: {
            sandbox: () => defaultState.sandbox,
            headers: () => defaultState.headers,
            workloadFactoryResource: () => defaultState.workloadFactoryResource
        }
    });
};

describe('RebaseRollbackContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRollbackSnapshotApi.mockResolvedValue({ data: { snapshots: [] } });
    });

    describe('Rendering', () => {
        it('should render radio buttons', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <RebaseRollbackContent
                        rowData={{ databaseHostId: 'h1', instanceId: 'i1', name: 'sb1' }}
                        fromPage="sandboxes"
                    />
                </Provider>
            );

            expect(screen.getByText('Refresh from current point in time')).toBeTruthy();
            expect(screen.getByText('Rollback to a snapshot')).toBeTruthy();
        });

        it('should render SelectField', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <RebaseRollbackContent rowData={{}} fromPage="sandboxes" />
                </Provider>
            );

            expect(screen.getByTestId('select-field')).toBeTruthy();
        });

        it('should show first radio as selected by default', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <RebaseRollbackContent rowData={{}} fromPage="sandboxes" />
                </Provider>
            );

            const refreshCurrentRadio = screen.getByTestId('radio-refresh-current-time');
            expect(refreshCurrentRadio.getAttribute('data-selected')).toBe('true');
        });

        it('should show snapshot radio as NOT selected by default', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <RebaseRollbackContent rowData={{}} fromPage="sandboxes" />
                </Provider>
            );

            const snapshotRadio = screen.getByTestId('radio-refresh-snapshot');
            expect(snapshotRadio.getAttribute('data-selected')).toBe('false');
        });

        it('should disable SelectField when isRollbackSelected is false', () => {
            const store = createMockStore({ sandbox: { isRollbackSelected: false } });

            render(
                <Provider store={store}>
                    <RebaseRollbackContent rowData={{}} fromPage="sandboxes" />
                </Provider>
            );

            expect(screen.getByTestId('select-field').getAttribute('data-disabled')).toBe('true');
        });

        it('should enable SelectField when isRollbackSelected is true', () => {
            const store = createMockStore({ sandbox: { isRollbackSelected: true } });

            render(
                <Provider store={store}>
                    <RebaseRollbackContent rowData={{}} fromPage="sandboxes" />
                </Provider>
            );

            expect(screen.getByTestId('select-field').getAttribute('data-disabled')).toBe('false');
        });

        it('should show loading state in SelectField when rollbackSnapshotsLoading is true', () => {
            const store = createMockStore({ sandbox: { isRollbackSelected: true, rollbackSnapshotsLoading: true } });

            render(
                <Provider store={store}>
                    <RebaseRollbackContent rowData={{}} fromPage="sandboxes" />
                </Provider>
            );

            expect(screen.getByTestId('select-field').getAttribute('data-loading')).toBe('true');
        });
    });

    describe('Interaction', () => {
        it('should dispatch updateIsRollbackSelected(true) when snapshot radio clicked', () => {
            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <RebaseRollbackContent rowData={{}} fromPage="sandboxes" />
                </Provider>
            );

            fireEvent.click(screen.getByText('Rollback to a snapshot'));

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('updateIsRollbackSelected') })
            );
        });

        it('should dispatch updateIsRollbackSelected(false) when refresh current radio clicked', () => {
            const store = createMockStore({ sandbox: { isRollbackSelected: true } });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <RebaseRollbackContent rowData={{}} fromPage="sandboxes" />
                </Provider>
            );

            fireEvent.click(screen.getByText('Refresh from current point in time'));

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('updateIsRollbackSelected') })
            );
        });

        it('should fetch snapshots when isRollbackSelected becomes true', async () => {
            mockGetRollbackSnapshotApi.mockResolvedValue({
                data: { snapshots: [{ name: 'snap1', created: '2023-01-01' }] }
            });

            const store = createMockStore({ sandbox: { isRollbackSelected: true, rollbackSnapshotList: [] } });

            render(
                <Provider store={store}>
                    <RebaseRollbackContent
                        rowData={{ databaseHostId: 'h1', instanceId: 'i1', name: 'sb1' }}
                        fromPage="sandboxes"
                    />
                </Provider>
            );

            expect(mockGetRollbackSnapshotApi).toHaveBeenCalled();
        });

        it('should dispatch updateRollbackSnapshotList when snapshots fetch succeeds', async () => {
            mockGetRollbackSnapshotApi.mockResolvedValue({
                data: { snapshots: [{ name: 'snap1', created: '2023-01-01' }] }
            });

            const store = createMockStore({ sandbox: { isRollbackSelected: true, rollbackSnapshotList: [] } });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <RebaseRollbackContent
                        rowData={{ databaseHostId: 'h1', instanceId: 'i1', name: 'sb1' }}
                        fromPage="sandboxes"
                    />
                </Provider>
            );

            await vi.waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: expect.stringContaining('updateRollbackSnapshotList') })
                );
            });
        });

        it('should dispatch empty list when no snapshots in response', async () => {
            mockGetRollbackSnapshotApi.mockResolvedValue({ data: {} });

            const store = createMockStore({ sandbox: { isRollbackSelected: true, rollbackSnapshotList: [] } });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <RebaseRollbackContent
                        rowData={{ databaseHostId: 'h1', instanceId: 'i1', name: 'sb1' }}
                        fromPage="sandboxes"
                    />
                </Provider>
            );

            await vi.waitFor(() => {
                const calls = dispatchSpy.mock.calls.filter((call: any) =>
                    call[0]?.type?.includes('updateRollbackSnapshotList')
                );
                expect(calls.some((call: any) => Array.isArray(call[0].payload) && call[0].payload.length === 0)).toBe(
                    true
                );
            });
        });

        it('should use selectedResourceCredId and regionId when fromPage is not sandboxes', () => {
            const store = createMockStore({
                sandbox: { isRollbackSelected: true, rollbackSnapshotList: [] },
                workloadFactoryResource: { selectedResourceCredId: 'wcred', selectedResourceRegionId: 'eu-west-1' }
            });

            render(
                <Provider store={store}>
                    <RebaseRollbackContent
                        rowData={{ databaseHostId: 'h1', instanceId: 'i1', name: 'sb1' }}
                        fromPage="inventory"
                    />
                </Provider>
            );

            expect(mockGetRollbackSnapshotApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    credentialId: 'wcred',
                    region: 'eu-west-1'
                })
            );
        });
    });
});
