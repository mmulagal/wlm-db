import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PostgressFooter from './PostgressFooter';
import { handleCreatePgsql } from '../PostgreUtils';

const mockNavigate = vi.fn();
const mockPostBlueXPMessage = vi.fn();
const mockDeployPgsqlTemplate = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant, isThin, Component }: any) => (
        <button data-testid={`btn-${children?.toString().replace(/\s+/g, '-').toLowerCase()}`} onClick={onClick}>
            {children}
        </button>
    ),
    postBlueXPMessage: (...args: any[]) => mockPostBlueXPMessage(...args),
    BlueXPListeners: { navigate: 'navigate' }
}));

vi.mock('../../../utils/apiService', () => ({
    useDeployPgsqlTemplateMutation: () => [mockDeployPgsqlTemplate]
}));

vi.mock('../PostgreUtils', () => ({
    handleCreatePgsql: vi.fn().mockReturnValue({ networkConfiguration: {}, sqlConfiguration: {} })
}));

vi.mock('../../../utils/appConfig', () => ({
    navigateToCanvas: vi.fn()
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        CREATE_PGSQL_INFO_MESSAGE_WLM: ['Creating PostgreSQL server ', 'View job status', ' in job monitoring.']
    }
}));

vi.mock('../../../utils/consts', () => ({
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING: '/wlf/job-monitoring',
    FORM_TO_WLF_NAVIGATE_BLUEXP: '/bluexp',
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM: '/bluexp/job-monitoring',
    WLF_TABS: { JOB_MONITORING: 'JobMonitoring' }
}));

vi.mock('../../../store/mssql/msSqlActionSlice', () => ({
    setDeployRedirectToCfLink: (val: any) => ({ type: 'msSqlAction/setDeployRedirectToCfLink', payload: val }),
    setIsLoading: (val: any) => ({ type: 'msSqlAction/setIsLoading', payload: val }),
    setPermissionData: (val: any) => ({ type: 'msSqlAction/setPermissionData', payload: val }),
    setPermissionWarning: (val: any) => ({ type: 'msSqlAction/setPermissionWarning', payload: val })
}));

vi.mock('../../../store/workloadFactory/inventoryV2Slice', () => ({
    setIsRefreshed: (val: any) => ({ type: 'inventoryV2/setIsRefreshed', payload: val }),
    setSelectedHeaderTab: (val: any) => ({ type: 'inventoryV2/setSelectedHeaderTab', payload: val })
}));

vi.mock('../../../store/workloadFactory/headersSlice', () => ({
    setMultiDataStatus: (val: any) => ({ type: 'headers/setMultiDataStatus', payload: val })
}));

vi.mock('../../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { INFO: 'info', ERROR: 'error' },
    addNotification: (val: any) => ({ type: 'notification/addNotification', payload: val }),
    clearNotifications: () => ({ type: 'notification/clearNotifications' })
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    handleURL: vi.fn()
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            msSqlAction: () => ({
                databaseHostEntryPoint: overrides.databaseHostEntryPoint ?? '',
                isLoading: false,
                ...overrides.msSqlAction
            }),
            mssqlForm: () => ({
                awsAccount: {
                    selectedCredential: overrides.selectedCredential ?? { data: { credentialsId: 'cred-1' } }
                },
                regionAndVpc: { selectedRegion: overrides.selectedRegion ?? { data: { regionCode: 'us-east-1' } } }
            }),
            auth: () => ({
                isWorkloadFactory: overrides.isWorkloadFactory ?? false
            })
        }
    });

describe('PostgressFooter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDeployPgsqlTemplate.mockResolvedValue({ data: null });
    });

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <PostgressFooter />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('renders Cancel button', () => {
        render(
            <Provider store={makeStore()}>
                <PostgressFooter />
            </Provider>
        );
        expect(screen.getByTestId('btn-cancel')).toBeTruthy();
    });

    it('renders Create button', () => {
        render(
            <Provider store={makeStore()}>
                <PostgressFooter />
            </Provider>
        );
        expect(screen.getByTestId('btn-create')).toBeTruthy();
    });

    describe('handleCancel navigation', () => {
        it('posts BlueXP navigate to inventory (WLF) when entryPoint is "inventory" and isWorkloadFactory', () => {
            render(
                <Provider store={makeStore({ databaseHostEntryPoint: 'inventory', isWorkloadFactory: true })}>
                    <PostgressFooter />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('btn-cancel'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ pathname: '../../databases/inventory' }) })
            );
        });

        it('posts BlueXP navigate to fsxdb inventory when entryPoint is "inventory" and not WLF', () => {
            render(
                <Provider store={makeStore({ databaseHostEntryPoint: 'inventory', isWorkloadFactory: false })}>
                    <PostgressFooter />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('btn-cancel'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ pathname: '../../fsxdb/inventory' }) })
            );
        });

        it('posts BlueXP navigate to databases dashboard when entryPoint is "database" and WLF', () => {
            render(
                <Provider store={makeStore({ databaseHostEntryPoint: 'database', isWorkloadFactory: true })}>
                    <PostgressFooter />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('btn-cancel'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ pathname: '../../databases/dashboard' }) })
            );
        });

        it('posts BlueXP navigate to fsxdb dashboard when entryPoint is "database" and not WLF', () => {
            render(
                <Provider store={makeStore({ databaseHostEntryPoint: 'database', isWorkloadFactory: false })}>
                    <PostgressFooter />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('btn-cancel'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ pathname: '../../fsxdb/dashboard' }) })
            );
        });

        it('calls navigateToCanvas("/") when entryPoint is empty and isWorkloadFactory', async () => {
            const { navigateToCanvas } = await import('../../../utils/appConfig');
            render(
                <Provider store={makeStore({ databaseHostEntryPoint: '', isWorkloadFactory: true })}>
                    <PostgressFooter />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('btn-cancel'));
            expect(navigateToCanvas).toHaveBeenCalledWith('/');
        });

        it('posts BlueXP navigate to fsxhome when entryPoint is empty and not WLF', () => {
            render(
                <Provider store={makeStore({ databaseHostEntryPoint: '', isWorkloadFactory: false })}>
                    <PostgressFooter />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('btn-cancel'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ pathname: '../../../../../fsxhome' }) })
            );
        });
    });

    describe('clickCreatePgsql', () => {
        it('does nothing when handleCreatePgsql returns falsy', async () => {
            vi.mocked(handleCreatePgsql).mockReturnValueOnce(undefined);
            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <PostgressFooter />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('btn-create'));

            await vi.waitFor(() => {
                const loadingCalls = dispatchSpy.mock.calls.filter(
                    (c: any) => c[0]?.type === 'msSqlAction/setIsLoading'
                );
                expect(loadingCalls.length).toBe(0);
            });
        });

        it('dispatches setIsLoading(true) and setMultiDataStatus when payload is valid', async () => {
            vi.mocked(handleCreatePgsql).mockReturnValueOnce({ networkConfiguration: {}, sqlConfiguration: {} } as any);
            mockDeployPgsqlTemplate.mockResolvedValue({ data: null });

            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <PostgressFooter />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('btn-create'));

            await vi.waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'msSqlAction/setIsLoading', payload: true })
                );
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'headers/setMultiDataStatus' })
                );
            });
        });

        it('dispatches setIsLoading(false) and addNotification on full permission flow', async () => {
            vi.mocked(handleCreatePgsql).mockReturnValueOnce({ networkConfiguration: {}, sqlConfiguration: {} } as any);
            mockDeployPgsqlTemplate.mockResolvedValue({
                data: { cloudFormationStackId: 'stack/mystack/abc123', cloudFormationUrl: 'https://cf.aws.com' }
            });

            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <PostgressFooter />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('btn-create'));

            await vi.waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'msSqlAction/setIsLoading', payload: false })
                );
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'notification/addNotification' })
                );
            });
        });

        it('dispatches setPermissionWarning and setDeployRedirectToCfLink when url but no stackName', async () => {
            vi.mocked(handleCreatePgsql).mockReturnValueOnce({ networkConfiguration: {}, sqlConfiguration: {} } as any);
            mockDeployPgsqlTemplate.mockResolvedValue({
                data: { cloudFormationStackId: null, cloudFormationUrl: 'https://cf.aws.com', warningMessage: null }
            });

            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <PostgressFooter />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('btn-create'));

            await vi.waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'msSqlAction/setPermissionWarning', payload: true })
                );
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'msSqlAction/setDeployRedirectToCfLink' })
                );
            });
        });

        it('dispatches setIsLoading(false) on API error', async () => {
            vi.mocked(handleCreatePgsql).mockReturnValueOnce({ networkConfiguration: {}, sqlConfiguration: {} } as any);
            mockDeployPgsqlTemplate.mockRejectedValue(new Error('API error'));

            const store = makeStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <PostgressFooter />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('btn-create'));

            await vi.waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'msSqlAction/setIsLoading', payload: false })
                );
            });
        });
    });
});
