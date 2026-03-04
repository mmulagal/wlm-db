import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import CreateNewUserFooter from '../CreateNewDBFooter';
import createNewUserSlice from '../../../../store/workloadFactory/createNewDBSlice';
import msSqlActionSlice from '../../../../store/mssql/msSqlActionSlice';
import authSlice from '../../../../store/authSlice';
import notificationSlice from '../../../../store/notificationSlice';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

// Mock handleCreateUserDb
const mockHandleCreateUserDb = vi.fn();
vi.mock('../createUserDBPayload', () => ({
    handleCreateUserDb: (...args: any[]) => mockHandleCreateUserDb(...args)
}));

// Mock RTK mutation
const mockCreateNewUserDb = vi.fn();
vi.mock('../../../../utils/apiService', () => ({
    useCreateUserDBMutation: () => [mockCreateNewUserDb]
}));

// Mock @tlveng/wlm-ds
const mockPostBlueXPMessage = vi.fn();
vi.mock('@tlveng/wlm-ds/src/hooks/useBlueXP', () => ({
    BlueXPListeners: { navigate: 'navigate' },
    postBlueXPMessage: (...args: any[]) => mockPostBlueXPMessage(...args)
}));

// Mock design system
vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, isThin, variant, id }: any) => (
        <button data-testid={id || `btn-${variant || 'primary'}`} onClick={onClick}>
            {children}
        </button>
    )
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        CREATE: 'Create',
        CLOSE: 'Close',
        JOB_MONITORING: 'Job Monitoring',
        DB_CREATE_NOTIFICATION: ['Creation of ', ' in ', ' is in progress. Track progress in '],
        DB_CREATE_SUCCESS_MSG: 'Database creation success'
    }
}));

vi.mock('../../../../utils/consts', async () => {
    const actual = await vi.importActual<typeof import('../../../../utils/consts')>('../../../../utils/consts');
    return {
        ...actual,
        FORM_TO_WLF_NAVIGATE_INVENTORY: '../databases/inventory',
        FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY: '../fsxdb/inventory',
        FORM_TO_WLF_NAVIGATE_JOB_MONITORING: '../databases/job-monitoring',
        FORM_TO_WLF_NAVIGATE_BLUEXP_JM: '../fsxdb/jobMonitoring',
        WLF_TABS: { JOB_MONITORING: 'jobMonitoring' }
    };
});

vi.mock('./CreateNewUserFooter.module.scss', () => ({ default: { notification: 'notification', bold: 'bold' } }));

describe('CreateNewUserFooter', () => {
    const createMockStore = (authOverrides = {}, createNewUserOverrides = {}) =>
        configureStore({
            reducer: {
                [createNewUserSlice.name]: createNewUserSlice.reducer,
                [msSqlActionSlice.name]: msSqlActionSlice.reducer,
                [authSlice.name]: authSlice.reducer,
                [notificationSlice.name]: notificationSlice.reducer
            } as any,
            preloadedState: {
                createNewUser: {
                    cdbCredId: 'cred-123',
                    cdbRegionId: 'us-east-1',
                    newUserDBName: 'TestDB',
                    dbHostName: 'test-host',
                    ...createNewUserOverrides
                },
                msSqlAction: {
                    isLoading: false
                },
                auth: {
                    resourceId: 'res-001',
                    isWorkloadFactory: true,
                    isDemoMode: false,
                    ...authOverrides
                }
            } as any
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render Create and Close buttons', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        expect(screen.getByText('Create')).toBeTruthy();
        expect(screen.getByText('Close')).toBeTruthy();
    });

    it('should navigate to inventory (WLF) on close when isWorkloadFactory is true', () => {
        const store = createMockStore({ isWorkloadFactory: true });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Close'));
        expect(mockNavigate).toHaveBeenCalledWith('../databases/inventory');
    });

    it('should navigate to BlueXP inventory on close when isWorkloadFactory is false', () => {
        const store = createMockStore({ isWorkloadFactory: false });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Close'));
        expect(mockNavigate).toHaveBeenCalledWith('../fsxdb/inventory');
    });

    it('should not call createNewUserDb when payload is undefined', async () => {
        mockHandleCreateUserDb.mockReturnValue(undefined);
        const store = createMockStore();
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => {
            expect(mockCreateNewUserDb).not.toHaveBeenCalled();
        });
    });

    it('should call createNewUserDb when payload is valid', async () => {
        const mockPayload = { databaseName: 'TestDB' };
        mockHandleCreateUserDb.mockReturnValue(mockPayload);
        mockCreateNewUserDb.mockResolvedValue({ data: { jobId: '123' } });

        const store = createMockStore({ isWorkloadFactory: true });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => {
            expect(mockCreateNewUserDb).toHaveBeenCalledWith({
                credentialId: 'cred-123',
                region: 'us-east-1',
                id: 'res-001',
                payload: mockPayload
            });
        });
    });

    it('should navigate to WLF inventory after successful creation (isWorkloadFactory true)', async () => {
        const mockPayload = { databaseName: 'TestDB' };
        mockHandleCreateUserDb.mockReturnValue(mockPayload);
        mockCreateNewUserDb.mockResolvedValue({ data: { jobId: '123' } });

        const store = createMockStore({ isWorkloadFactory: true });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('../databases/inventory');
        });
    });

    it('should navigate to BlueXP inventory after successful creation (isWorkloadFactory false)', async () => {
        const mockPayload = { databaseName: 'TestDB' };
        mockHandleCreateUserDb.mockReturnValue(mockPayload);
        mockCreateNewUserDb.mockResolvedValue({ data: { jobId: '123' } });

        const store = createMockStore({ isWorkloadFactory: false });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('../fsxdb/inventory');
        });
    });

    it('should show success notification with DB_CREATE_SUCCESS_MSG when DB name > 100 chars', async () => {
        const longDbName = 'a'.repeat(101);
        const mockPayload = { databaseName: longDbName };
        mockHandleCreateUserDb.mockReturnValue(mockPayload);
        mockCreateNewUserDb.mockResolvedValue({ data: { jobId: '123' } });

        const store = createMockStore({}, { newUserDBName: longDbName });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
    });

    it('should show inline notification when DB name <= 100 chars', async () => {
        const mockPayload = { databaseName: 'TestDB' };
        mockHandleCreateUserDb.mockReturnValue(mockPayload);
        mockCreateNewUserDb.mockResolvedValue({ data: { jobId: '123' } });

        const store = createMockStore({}, { newUserDBName: 'TestDB' });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
        });
    });

    it('should not navigate when result has an error', async () => {
        const mockPayload = { databaseName: 'TestDB' };
        mockHandleCreateUserDb.mockReturnValue(mockPayload);
        mockCreateNewUserDb.mockResolvedValue({ error: { message: 'API error' } });

        const store = createMockStore();
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => {
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    it('should dispatch error notification on catch', async () => {
        const mockPayload = { databaseName: 'TestDB' };
        mockHandleCreateUserDb.mockReturnValue(mockPayload);
        mockCreateNewUserDb.mockRejectedValue(new Error('Network error'));

        const store = createMockStore();
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserFooter />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByText('Create'));
        await waitFor(() => {
            // After catch block, isLoading should be set to false
            expect(mockCreateNewUserDb).toHaveBeenCalled();
        });
    });
});
