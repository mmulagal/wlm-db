import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CreateNewSandboxCodebox from './CreateNewSandboxCodebox';

const { mockGenerateCreateSandboxPayload, mockGetBaseUrl, mockCreateSandboxCurlTemplate } = vi.hoisted(() => ({
    mockGenerateCreateSandboxPayload: vi.fn(),
    mockGetBaseUrl: vi.fn(() => 'https://api.example.com'),
    mockCreateSandboxCurlTemplate: vi.fn((...args: any[]) => `curl -X POST ${args[0]} ...`)
}));

vi.mock('../../../../common/CodeBoxHeading/CodeBoxHeading', () => ({
    default: () => <div data-testid="code-box-heading" />
}));

vi.mock('../../../../common/CodeBoxScroll/CodeBoxScroll', () => ({
    default: ({ dropDownValue, setDisplayedDataInCodeBox }: any) => (
        <div data-testid="code-box-scroll">
            <span>{dropDownValue}</span>
            <div>{setDisplayedDataInCodeBox}</div>
        </div>
    )
}));

vi.mock('../../../../common/CodeBoxColor/CodeBoxColor', () => ({
    default: ({ credID, region, actualData, endpoint }: any) => (
        <div data-testid="code-box-color">
            <span data-testid="cred-id">{credID}</span>
            <span data-testid="region">{region}</span>
            <span data-testid="endpoint">{endpoint}</span>
        </div>
    )
}));

vi.mock('../../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: ({ value, iconProvided }: any) => <div data-testid="copy-to-clipboard">{iconProvided}</div>
}));

vi.mock('../../../../assets/copyBlackBackground.svg', () => ({
    ReactComponent: () => <svg data-testid="copy-icon" />
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style, className }: any) => (
        <div data-testid="ds-typography" data-variant={variant}>
            {children}
        </div>
    ),
    Popover: ({ children, container, popoverClass }: any) => (
        <div data-testid="popover">
            <div data-testid="popover-container">{container}</div>
            <div data-testid="popover-content">{children}</div>
        </div>
    )
}));

vi.mock('../../../../utils/appConstants', () => ({
    CODE_VIEWER: {
        REST_API: 'REST API',
        COPIED_TO_CLIPBOARD: 'Copied to clipboard!'
    },
    GENERAL: {
        CREATE_NEW_SANDBOX: 'Create New Sandbox'
    }
}));

vi.mock('../../../../utils/consts', () => ({
    CREATE_SANDBOX_CURL_REQ_TEMPLATE: mockCreateSandboxCurlTemplate,
    CREATE_SANDBOX_ENDPOINT: '/api/v1/sandboxes',
    CRED_PLACEHOLDERS: {
        CRED_ID: 'CRED_ID_PLACEHOLDER',
        REGION: 'REGION_PLACEHOLDER',
        TOKEN: 'TOKEN_PLACEHOLDER'
    }
}));

vi.mock('../../SandboxUtility', () => ({
    generateCreateSandboxPayload: (state: any) => mockGenerateCreateSandboxPayload(state)
}));

vi.mock('../../../../utils/apiService', () => ({
    getBaseUrl: () => mockGetBaseUrl()
}));

vi.mock('./CreateNewSandboxCodebox.module.scss', () => ({
    default: {
        createNewSandboxCodebox: 'createNewSandboxCodebox',
        createDbHeader: 'createDbHeader',
        createDBText: 'createDBText',
        payloadContainer: 'payloadContainer',
        payloadHeader: 'payloadHeader',
        inputPart: 'inputPart',
        actionPopOver: 'actionPopOver',
        actions: 'actions',
        menuItem: 'menuItem',
        'copy-popover': 'copy-popover'
    }
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            createSandbox: () => ({
                selectedSandboxCredId: 'cred1',
                selectedSandboxRegionId: 'us-east-1',
                source: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' },
                    selectedDatabase: { value: 'db1', label: 'Database 1' }
                },
                target: {
                    selectedDatabaseHost: { value: 'targetHost1' },
                    selectedDatabaseInstance: { value: 'targetInst1' },
                    selectedDatabase: 'sandbox_db'
                },
                ...overrides.createSandbox
            }),
            auth: () => ({
                isWorkloadFactory: false,
                ...overrides.auth
            })
        }
    });

const renderCodebox = (storeOverrides: any = {}) => {
    const store = createMockStore(storeOverrides);
    return {
        ...render(
            <Provider store={store}>
                <CreateNewSandboxCodebox />
            </Provider>
        ),
        store
    };
};

describe('CreateNewSandboxCodebox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateCreateSandboxPayload.mockReturnValue({
            sandboxName: 'sandbox_db',
            source: { host: 'host1', instance: 'inst1', database: 'db1' },
            destination: { host: 'targetHost1', instance: 'targetInst1', database: 'sandbox_db' }
        });
    });

    it('should render the CodeBoxHeading component', () => {
        renderCodebox();
        expect(screen.getByTestId('code-box-heading')).toBeTruthy();
    });

    it('should render "Create New Sandbox" header text', () => {
        renderCodebox();
        expect(screen.getByText('Create New Sandbox')).toBeTruthy();
    });

    it('should render the CodeBoxScroll with REST API dropdown value', () => {
        renderCodebox();
        expect(screen.getByTestId('code-box-scroll')).toBeTruthy();
        expect(screen.getAllByText('REST API').length).toBeGreaterThan(0);
    });

    it('should render the Popover for copy action', () => {
        renderCodebox();
        expect(screen.getByTestId('popover')).toBeTruthy();
    });

    it('should render copy to clipboard component', () => {
        renderCodebox();
        expect(screen.getByTestId('copy-to-clipboard')).toBeTruthy();
    });

    it('should render copy icon', () => {
        renderCodebox();
        expect(screen.getByTestId('copy-icon')).toBeTruthy();
    });

    it('should render "Copied to clipboard!" text in popover', () => {
        renderCodebox();
        expect(screen.getByText('Copied to clipboard!')).toBeTruthy();
    });

    it('should render CodeBoxColor with correct props', () => {
        renderCodebox();
        const codeBoxColor = screen.getByTestId('code-box-color');
        expect(codeBoxColor).toBeTruthy();
        expect(screen.getByTestId('cred-id').textContent).toBe('cred1');
        expect(screen.getByTestId('region').textContent).toBe('us-east-1');
        expect(screen.getByTestId('endpoint').textContent).toBe('/api/v1/sandboxes');
    });

    it('should use CRED_ID placeholder when selectedSandboxCredId is null', () => {
        renderCodebox({
            createSandbox: { selectedSandboxCredId: null, selectedSandboxRegionId: null }
        });
        expect(screen.getByTestId('cred-id').textContent).toBe('CRED_ID_PLACEHOLDER');
        expect(screen.getByTestId('region').textContent).toBe('REGION_PLACEHOLDER');
    });

    it('should call generateCreateSandboxPayload to build the payload', () => {
        renderCodebox();
        expect(mockGenerateCreateSandboxPayload).toHaveBeenCalled();
    });

    it('should call getBaseUrl to build the REST API template', () => {
        renderCodebox();
        expect(mockGetBaseUrl).toHaveBeenCalled();
    });

    it('should call CREATE_SANDBOX_CURL_REQ_TEMPLATE with correct params for copyResponseData', () => {
        renderCodebox();
        // copyResponseData is called when the copy button is activated
        // Since CopyToClipboardCommon receives the value prop, the function is invoked during render
        expect(mockCreateSandboxCurlTemplate).toHaveBeenCalledWith(
            'https://api.example.com',
            'cred1',
            'us-east-1',
            'TOKEN_PLACEHOLDER',
            expect.any(String),
            false
        );
    });

    it('should use isWorkloadFactory flag in curl template', () => {
        renderCodebox({ auth: { isWorkloadFactory: true } });
        expect(mockCreateSandboxCurlTemplate).toHaveBeenCalledWith(
            'https://api.example.com',
            'cred1',
            'us-east-1',
            'TOKEN_PLACEHOLDER',
            expect.any(String),
            true
        );
    });

    it('should use REGION placeholder when selectedSandboxRegionId is null', () => {
        renderCodebox({
            createSandbox: {
                selectedSandboxCredId: 'cred1',
                selectedSandboxRegionId: null
            }
        });
        expect(mockCreateSandboxCurlTemplate).toHaveBeenCalledWith(
            expect.any(String),
            'cred1',
            'REGION_PLACEHOLDER',
            'TOKEN_PLACEHOLDER',
            expect.any(String),
            false
        );
    });
});
