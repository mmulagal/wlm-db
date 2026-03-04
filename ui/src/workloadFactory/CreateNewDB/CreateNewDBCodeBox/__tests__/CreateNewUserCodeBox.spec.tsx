import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CreateNewUserCodeBox from '../CreateNewUserCodeBox';
import createNewUserSlice from '../../../../store/workloadFactory/createNewDBSlice';
import authSlice from '../../../../store/authSlice';

// Mock design system
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, style, className }: any) => (
        <span data-testid={`typography-${variant || 'default'}`} style={style} className={className}>
            {children}
        </span>
    ),
    Popover: ({ children, container, popoverClass }: any) => (
        <div data-testid="popover" className={popoverClass}>
            <span data-testid="popover-content">{children}</span>
            <div data-testid="popover-container">{container}</div>
        </div>
    )
}));

vi.mock('@netapp/design-system/dist/components/Select', () => ({
    SelectField: ({ label, options, onChange, defaultValue }: any) => (
        <select
            data-testid={`select-${label}`}
            onChange={e => onChange && onChange({ value: e.target.value, label: e.target.value })}
        >
            {options?.map((opt: any) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    )
}));

// Mock common components
vi.mock('../../../../common/CodeBoxHeading/CodeBoxHeading', () => ({
    default: () => <div data-testid="code-box-heading">CodeBoxHeading</div>
}));

vi.mock('../../../../common/CodeBoxScroll/CodeBoxScroll', () => ({
    default: ({ dropDownValue, setDisplayedDataInCodeBox }: any) => (
        <div data-testid="code-box-scroll">
            <div data-testid="codebox-dropdown-value">{dropDownValue}</div>
            <div data-testid="codebox-displayed-data">{setDisplayedDataInCodeBox}</div>
        </div>
    )
}));

vi.mock('../../../../common/CodeBoxColor/CodeBoxColor', () => ({
    default: ({ credID, region, actualData, endpoint }: any) => (
        <div data-testid="code-box-color" data-credid={credID} data-region={region} data-endpoint={endpoint}>
            CodeBoxColor
        </div>
    )
}));

vi.mock('../../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: ({ value, iconProvided }: any) => (
        <div data-testid="copy-to-clipboard" data-value={value}>
            {iconProvided}
        </div>
    )
}));

// Mock SVG
vi.mock('../../../../assets/copyBlackBackground.svg', () => ({
    ReactComponent: () => <svg data-testid="copy-icon" />
}));

vi.mock('../../../../utils/appConstants', () => ({
    CODE_VIEWER: {
        REST_API: 'REST API',
        COPIED_TO_CLIPBOARD: 'Copied to clipboard'
    },
    GENERAL: {
        CREATE_USER_DB_TITLE: 'Create user database'
    }
}));

vi.mock('../../../../utils/consts', () => ({
    CREATE_DB_CURL_REQ_TEMPLATE: vi.fn(
        (baseUrl, credId, region, resourceId, token, payload, isWLF) => `curl -X POST ${baseUrl}`
    ),
    CREATE_DB_ENDPOINT: vi.fn(resourceId => `/database-hosts/${resourceId}/database`),
    CRED_PLACEHOLDERS: {
        CRED_ID: '<credential-id>',
        REGION: '<region>',
        DATABASE_HOST_ID: '<database-host-id>',
        TOKEN: '<token>'
    },
    UI_IDS: {
        WIZARD_CODEBOX_COPY: 'wizard-codebox-copy'
    }
}));

vi.mock('../../../../utils/apiService', () => ({
    getBaseUrl: vi.fn(() => 'https://api.example.com')
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    generateOptionType: vi.fn((value, label, desc, disabled, msg) => ({
        value,
        label,
        description: desc,
        isDisabled: disabled
    }))
}));

vi.mock('../CreateNewDBFooter/createUserDBPayload', () => ({
    createUserDbPayload: vi.fn(() => ({
        databaseName: 'TestDB',
        dataFileConfig: { fileName: 'testdata.mdf', volumeSize: 10, drive: 'C', isExisting: false },
        logFileConfig: { fileName: 'testlog.ldf', volumeSize: 2, drive: 'D', isExisting: false }
    }))
}));

vi.mock('../CreateNewUserCodeBox.module.scss', () => ({
    default: {
        createNewUserCodeBox: 'createNewUserCodeBox',
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

// Must mock createUserDbPayload used inside the component
vi.mock('../../CreateNewDBFooter/createUserDBPayload', () => ({
    createUserDbPayload: vi.fn(() => ({
        databaseName: 'TestDB',
        dataFileConfig: { fileName: 'testdata.mdf', volumeSize: 10, drive: 'C', isExisting: false },
        logFileConfig: { fileName: 'testlog.ldf', volumeSize: 2, drive: 'D', isExisting: false }
    }))
}));

describe('CreateNewUserCodeBox', () => {
    const createMockStore = (authOverrides = {}, createNewUserOverrides = {}) =>
        configureStore({
            reducer: {
                [createNewUserSlice.name]: createNewUserSlice.reducer,
                [authSlice.name]: authSlice.reducer
            } as any,
            preloadedState: {
                createNewUser: {
                    cdbCredId: 'cred-123',
                    cdbRegionId: 'us-east-1',
                    newUserDBName: 'TestDB',
                    dbHostName: 'test-host',
                    ...createNewUserOverrides
                },
                auth: {
                    resourceId: 'res-001',
                    isWorkloadFactory: true,
                    ...authOverrides
                }
            } as any
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without crashing', () => {
        const store = createMockStore();
        const { container } = render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('should render CodeBoxHeading', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        expect(screen.getByTestId('code-box-heading')).toBeTruthy();
    });

    it('should render the title text', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        expect(screen.getByText('Create user database')).toBeTruthy();
    });

    it('should render CodeBoxScroll', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        expect(screen.getByTestId('code-box-scroll')).toBeTruthy();
    });

    it('should render CopyToClipboard with value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        expect(screen.getByTestId('copy-to-clipboard')).toBeTruthy();
    });

    it('should render Popover with copy functionality', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        expect(screen.getByTestId('popover')).toBeTruthy();
    });

    it('should display REST API as default dropdown value', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        const dropdownValue = screen.getByTestId('codebox-dropdown-value');
        expect(dropdownValue.textContent).toBe('REST API');
    });

    it('should render CodeBoxColor with correct credID when cdbCredId is set', () => {
        const store = createMockStore({}, { cdbCredId: 'my-cred-id', cdbRegionId: 'eu-west-1' });
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        const codeBoxColor = screen.getByTestId('code-box-color');
        expect(codeBoxColor.getAttribute('data-credid')).toBe('my-cred-id');
    });

    it('should render CodeBoxColor with CRED_PLACEHOLDER when cdbCredId is empty', () => {
        const store = createMockStore({}, { cdbCredId: '' });
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        const codeBoxColor = screen.getByTestId('code-box-color');
        expect(codeBoxColor.getAttribute('data-credid')).toBe('<credential-id>');
    });

    it('should render CodeBoxColor with correct region when cdbRegionId is set', () => {
        const store = createMockStore({}, { cdbCredId: 'cred', cdbRegionId: 'us-west-2' });
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        const codeBoxColor = screen.getByTestId('code-box-color');
        expect(codeBoxColor.getAttribute('data-region')).toBe('us-west-2');
    });

    it('should use CRED_PLACEHOLDER for region when cdbRegionId is empty', () => {
        const store = createMockStore({}, { cdbRegionId: '' });
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        const codeBoxColor = screen.getByTestId('code-box-color');
        expect(codeBoxColor.getAttribute('data-region')).toBe('<region>');
    });

    it('should build correct endpoint with resourceId', () => {
        const store = createMockStore({ resourceId: 'res-xyz' });
        render(
            <Provider store={store}>
                <CreateNewUserCodeBox />
            </Provider>
        );
        const codeBoxColor = screen.getByTestId('code-box-color');
        expect(codeBoxColor.getAttribute('data-endpoint')).toContain('res-xyz');
    });
});
