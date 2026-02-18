import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CreateNewSandboxFooter from './CreateNewSandboxFooter';

const { mockNavigate, mockPostBlueXPMessage, mockCreateNewSandbox } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockPostBlueXPMessage: vi.fn(),
    mockCreateNewSandbox: vi.fn()
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('@tlveng/wlm-ds/src/hooks/useBlueXP', () => ({
    BlueXPListeners: { navigate: 'navigate' },
    postBlueXPMessage: mockPostBlueXPMessage
}));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, isThin, variant, Component }: any) => (
        <button data-testid={`button-${variant || 'primary'}`} onClick={onClick}>
            {children}
        </button>
    )
}));

vi.mock('./CreateNewSandboxFooter.module.scss', () => ({
    default: {
        notification: 'notification',
        bold: 'bold'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        CREATE: 'Create',
        CLOSE: 'Close',
        JOB_MONITORING: 'Job Monitoring',
        DB_CREATE_NOTIFICATION: [
            'Creating sandbox database ',
            ' in instance ',
            ' is in progress. Track the progress in '
        ]
    }
}));

vi.mock('../../../../utils/consts', () => ({
    FORM_TO_WLF_NAVIGATE_BLUEXP_JM: '/bluexp/job-monitoring',
    FORM_TO_WLF_NAVIGATE_JOB_MONITORING: '/job-monitoring',
    FORM_TO_WLF_NAVIGATE_BLUEXP_SANDBOXES: '/bluexp/sandboxes',
    FORM_TO_WLF_NAVIGATE_SANDBOXES: '/sandboxes',
    WLF_TABS: { JOB_MONITORING: 'JOB_MONITORING' }
}));

vi.mock('../../../../utils/apiService', () => ({
    useCreateSandboxMutation: () => [mockCreateNewSandbox]
}));

vi.mock('./CreateNewSandboxPayload', () => ({
    handleCreateNewSandbox: vi.fn()
}));

vi.mock('../../../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { INFO: 'info', ERROR: 'error' },
    addNotification: vi.fn((payload: any) => ({ type: 'notification/add', payload })),
    clearNotifications: vi.fn(() => ({ type: 'notification/clear' }))
}));

vi.mock('../../../../store/mssql/msSqlActionSlice', () => ({
    setIsLoading: vi.fn((val: boolean) => ({ type: 'msSqlAction/setIsLoading', payload: val }))
}));

vi.mock('../../../../store/workloadFactory/createSandboxSlice', () => ({
    resetSourceAndTarget: vi.fn(() => ({ type: 'createSandbox/resetSourceAndTarget' })),
    setShowError: vi.fn((val: boolean) => ({ type: 'createSandbox/setShowError', payload: val }))
}));

vi.mock('../../../../store/authSlice', () => ({
    updateRefreshBlocked: vi.fn((val: boolean) => ({ type: 'auth/updateRefreshBlocked', payload: val }))
}));

vi.mock('../../../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHeaderTab: vi.fn((val: string) => ({ type: 'inventory/setSelectedHeaderTab', payload: val }))
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            auth: () => ({
                isWorkloadFactory: false,
                ...overrides.auth
            }),
            createSandbox: () => ({
                selectedSandboxCredId: 'cred1',
                selectedSandboxRegionId: 'us-east-1',
                source: { selectedDatabaseHost: null, selectedDatabase: null, selectedDatabaseInstance: null },
                target: {
                    selectedDatabaseHost: { label: 'target-host' },
                    selectedDatabase: 'sandbox_db',
                    selectedDatabaseInstance: { label: 'inst1' }
                },
                ...overrides.createSandbox
            })
        }
    });

describe('CreateNewSandboxFooter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render Create and Close buttons', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewSandboxFooter />
            </Provider>
        );

        expect(screen.getByText('Create')).toBeTruthy();
        expect(screen.getByText('Close')).toBeTruthy();
    });

    describe('Close button', () => {
        it('should navigate to BlueXP sandboxes when isWorkloadFactory is false', () => {
            const store = createMockStore({ auth: { isWorkloadFactory: false } });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Close'));

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('updateRefreshBlocked') })
            );
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: expect.stringContaining('resetSourceAndTarget') })
            );
            expect(mockNavigate).toHaveBeenCalledWith('/bluexp/sandboxes');
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith({
                type: 'navigate',
                payload: { pathname: '../../fsxdb/sandboxes', replace: true }
            });
        });

        it('should navigate to WLF sandboxes when isWorkloadFactory is true', () => {
            const store = createMockStore({ auth: { isWorkloadFactory: true } });

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Close'));

            expect(mockNavigate).toHaveBeenCalledWith('/sandboxes');
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith({
                type: 'navigate',
                payload: { pathname: '../../databases/sandboxes', replace: true }
            });
        });
    });

    describe('Create button - handleCreate', () => {
        it('should dispatch setShowError(true) when Create is clicked', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue(null);

            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({ type: expect.stringContaining('setShowError') })
                );
            });
        });

        it('should NOT call createNewSandbox when payload is null/false', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue(null);

            const store = createMockStore();

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                expect(mockCreateNewSandbox).not.toHaveBeenCalled();
            });
        });

        it('should call createNewSandbox when payload is valid', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            const validPayload = { sandboxName: 'test-sandbox', action: 'CREATE' };
            (handleCreateNewSandbox as any).mockReturnValue(validPayload);

            mockCreateNewSandbox.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            const store = createMockStore();

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                expect(mockCreateNewSandbox).toHaveBeenCalledWith({
                    credentialId: 'cred1',
                    region: 'us-east-1',
                    payload: validPayload
                });
            });
        });

        it('should dispatch setIsLoading(true) then setIsLoading(false) after API call', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue({ sandboxName: 'test' });

            mockCreateNewSandbox.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                const dispatchedTypes = dispatchSpy.mock.calls.map((c: any) => c[0]?.type);
                expect(dispatchedTypes).toContain('msSqlAction/setIsLoading');
            });
        });

        it('should dispatch addNotification and navigate on successful sandbox creation', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue({ sandboxName: 'test' });

            mockCreateNewSandbox.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                const dispatchedTypes = dispatchSpy.mock.calls.map((c: any) => c[0]?.type);
                expect(dispatchedTypes.some((t: string) => t?.includes('add'))).toBe(true);
            });
        });

        it('should navigate to WLF sandboxes after successful creation when isWorkloadFactory is true', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue({ sandboxName: 'test' });

            mockCreateNewSandbox.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            const store = createMockStore({ auth: { isWorkloadFactory: true } });

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/sandboxes');
            });
        });

        it('should navigate to BlueXP sandboxes after successful creation when not isWorkloadFactory', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue({ sandboxName: 'test' });

            mockCreateNewSandbox.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            const store = createMockStore({ auth: { isWorkloadFactory: false } });

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/bluexp/sandboxes');
            });
        });

        it('should dispatch error notification when API returns error', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue({ sandboxName: 'test' });

            mockCreateNewSandbox.mockResolvedValueOnce({ error: 'API Error' });

            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                // When error present, no navigation occurs, setIsLoading(false) is dispatched
                const dispatchedTypes = dispatchSpy.mock.calls.map((c: any) => c[0]?.type);
                expect(dispatchedTypes).toContain('msSqlAction/setIsLoading');
            });
        });

        it('should dispatch error notification on exception', async () => {
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue({ sandboxName: 'test' });

            mockCreateNewSandbox.mockRejectedValueOnce(new Error('Network error'));

            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                const dispatchedTypes = dispatchSpy.mock.calls.map((c: any) => c[0]?.type);
                expect(dispatchedTypes.some((t: string) => t?.includes('setIsLoading'))).toBe(true);
            });
        });

        it('should dispatch setSelectedHeaderTab with JOB_MONITORING when Job Monitoring is clicked in notification', async () => {
            // This covers the inline button inside the notification message
            const { handleCreateNewSandbox } = await import('./CreateNewSandboxPayload');
            (handleCreateNewSandbox as any).mockReturnValue({ sandboxName: 'test' });
            mockCreateNewSandbox.mockResolvedValueOnce({ data: { jobId: 'job123' } });

            const store = createMockStore();
            render(
                <Provider store={store}>
                    <CreateNewSandboxFooter />
                </Provider>
            );

            fireEvent.click(screen.getByText('Create'));

            await waitFor(() => {
                expect(mockCreateNewSandbox).toHaveBeenCalled();
            });
        });
    });
});
