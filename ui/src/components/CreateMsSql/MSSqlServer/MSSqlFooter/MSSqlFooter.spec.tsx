import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import MSSqlFooter from './MSSqlFooter';
import { handleCreateSQLServer } from './createSqlServer';

const { mockDispatch, mockNavigate, mockDeploySqlTemplate, mockPostBlueXPMessage } = vi.hoisted(() => ({
    mockDispatch: vi.fn(),
    mockNavigate: vi.fn(),
    mockDeploySqlTemplate: vi.fn(),
    mockPostBlueXPMessage: vi.fn()
}));

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        useDispatch: () => mockDispatch
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual('@netapp/design-system');
    return {
        ...actual,
        Button: ({ children, onClick, variant, isThin, id }: any) => (
            <button data-testid={id || `button-${variant}`} onClick={onClick}>
                {children}
            </button>
        ),
        postBlueXPMessage: mockPostBlueXPMessage
    };
});

vi.mock('../../../../utils/apiService', () => ({
    useDeploySqlTemplateMutation: vi.fn(() => [mockDeploySqlTemplate])
}));

vi.mock('./createSqlServer', () => ({
    handleCreateSQLServer: vi.fn()
}));

vi.mock('../../../../utils/appConfig', () => ({
    navigateToCanvas: vi.fn()
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    handleURL: vi.fn()
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                awsAccount: { selectedCredential: { data: { credentialsId: 'cred-1' } } },
                regionAndVpc: { selectedRegion: { data: { regionCode: 'us-east-1' } } },
                ...overrides.mssqlForm
            }),
            msSqlAction: () => ({
                databaseHostEntryPoint: 'database',
                ...overrides.msSqlAction
            }),
            auth: () => ({
                isWorkloadFactory: true,
                ...overrides.auth
            })
        }
    });

describe('MSSqlFooter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders Cancel button', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('button-secondary')).toBeTruthy();
    });

    it('renders Create button', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('wizard-deploy-btn')).toBeTruthy();
    });

    it('calls handleCreateSQLServer when Create clicked', () => {
        const mockHandleCreate = handleCreateSQLServer as any;
        mockHandleCreate.mockReturnValue({ payload: 'test-payload' });
        mockDeploySqlTemplate.mockResolvedValue({ data: { cloudFormationStackId: 'stack-1' } });

        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const createButton = screen.getByTestId('wizard-deploy-btn');
        fireEvent.click(createButton);
        expect(mockHandleCreate).toHaveBeenCalled();
    });

    it('does not deploy if payload is null', () => {
        const mockHandleCreate = handleCreateSQLServer as any;
        mockHandleCreate.mockReturnValue(null);

        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const createButton = screen.getByTestId('wizard-deploy-btn');
        fireEvent.click(createButton);
        expect(mockDeploySqlTemplate).not.toHaveBeenCalled();
    });

    it('dispatches setIsLoading when deployment starts', () => {
        const mockHandleCreate = handleCreateSQLServer as any;
        mockHandleCreate.mockReturnValue({ payload: 'test-payload' });
        mockDeploySqlTemplate.mockResolvedValue({ data: { cloudFormationStackId: 'stack-1' } });

        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const createButton = screen.getByTestId('wizard-deploy-btn');
        fireEvent.click(createButton);
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsLoading') })
        );
    });

    it('handles Cancel button click for workload factory', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const cancelButton = screen.getByTestId('button-secondary');
        fireEvent.click(cancelButton);
        expect(mockPostBlueXPMessage).toHaveBeenCalled();
    });

    it('handles deployment error', async () => {
        const mockHandleCreate = handleCreateSQLServer as any;
        mockHandleCreate.mockReturnValue({ payload: 'test-payload' });
        mockDeploySqlTemplate.mockRejectedValue(new Error('Deployment failed'));

        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const createButton = screen.getByTestId('wizard-deploy-btn');
        fireEvent.click(createButton);

        // Wait for the error to be handled
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setIsLoading') })
        );
    });

    it('handles permission warning scenario', async () => {
        const mockHandleCreate = handleCreateSQLServer as any;
        mockHandleCreate.mockReturnValue({ payload: 'test-payload' });
        mockDeploySqlTemplate.mockResolvedValue({
            data: {
                cloudFormationUrl: 'https://console.aws.amazon.com',
                warningMessage: 'Missing permissions',
                missingPermissions: ['ec2:DescribeInstances']
            }
        });

        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const createButton = screen.getByTestId('wizard-deploy-btn');
        fireEvent.click(createButton);

        await new Promise(resolve => setTimeout(resolve, 100));
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setPermissionWarning') })
        );
    });

    it('handles full permission flow', async () => {
        const mockHandleCreate = handleCreateSQLServer as any;
        mockHandleCreate.mockReturnValue({ payload: 'test-payload' });
        mockDeploySqlTemplate.mockResolvedValue({
            data: {
                cloudFormationStackId: 'stack-123',
                cloudFormationUrl: 'https://console.aws.amazon.com'
            }
        });

        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const createButton = screen.getByTestId('wizard-deploy-btn');
        fireEvent.click(createButton);

        await new Promise(resolve => setTimeout(resolve, 100));
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('addNotification') })
        );
    });

    it('handles Cancel from inventory entry point', () => {
        const store = makeStore({ msSqlAction: { databaseHostEntryPoint: 'inventory' } });
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const cancelButton = screen.getByTestId('button-secondary');
        fireEvent.click(cancelButton);
        expect(mockPostBlueXPMessage).toHaveBeenCalled();
    });

    it('handles Cancel from home entry point for non-workload factory', () => {
        const store = makeStore({
            msSqlAction: { databaseHostEntryPoint: 'home' },
            auth: { isWorkloadFactory: false }
        });
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlFooter />
                </BrowserRouter>
            </Provider>
        );

        const cancelButton = screen.getByTestId('button-secondary');
        fireEvent.click(cancelButton);
        expect(mockPostBlueXPMessage).toHaveBeenCalled();
    });
});
