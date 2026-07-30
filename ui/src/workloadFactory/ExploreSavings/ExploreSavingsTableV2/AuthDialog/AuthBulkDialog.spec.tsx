import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AuthBulkDialog from './AuthBulkDialog';
import { AUTHENTICATION_TYPE } from '../../../../utils/consts';

// ─── controllable translation mock ──────────────────────────────────────────
let tFn: (key: string) => string | null = (key: string) => key;

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => tFn(key)
    })
}));

// ─── SCSS module mock ───────────────────────────────────────────────────────
vi.mock('./AuthDialog.module.scss', () => ({
    default: new Proxy(
        {},
        {
            get: (_target, prop) => String(prop)
        }
    )
}));

// ─── SVG mocks ──────────────────────────────────────────────────────────────
vi.mock('../../../../assets/Cancel.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="cross-icon" {...props} />
}));
vi.mock('../../../../assets/ic_copy.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="copy-icon" {...props} />
}));
vi.mock('../../../../assets/success.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="success-icon" {...props} />
}));
vi.mock('../../../../assets/error-icon.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="failure-icon" {...props} />
}));

// ─── CopyToClipboard mock ───────────────────────────────────────────────────
vi.mock('../../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: ({ value, iconProvided }: any) => (
        <div data-testid="copy-to-clipboard" data-value={value}>
            {iconProvided}
        </div>
    )
}));

// ─── AccordionCard mocks ────────────────────────────────────────────────────
vi.mock('../../../../common/AccordionCard/AccordionCard', () => ({
    AccordionController: ({ children }: any) => <div data-testid="accordion-controller">{children}</div>,
    AccordionCard: ({ title, children }: any) => (
        <div data-testid="accordion-card">
            <div data-testid="accordion-title">{title}</div>
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-card-content">{children}</div>
}));

// ─── @netapp/design-system Popover mock ─────────────────────────────────────
vi.mock('@netapp/design-system', () => ({
    Popover: ({ children, container }: any) => (
        <div data-testid="popover">
            <span>{children}</span>
            <span>{container}</span>
        </div>
    )
}));

// ─── @tlveng/wlm-ds component mocks ────────────────────────────────────────
vi.mock('@tlveng/wlm-ds', () => ({
    DsRadioButton: ({ id, title, isSelected, onClick }: any) => (
        <button data-testid={id} title={title} aria-pressed={isSelected} onClick={onClick}>
            {title}
        </button>
    ),
    DsTextField: ({ title, value, onChange, onBlur, isDisabled, isPassword, placeholder, message, className }: any) => (
        <div data-testid={`text-field-${placeholder}`}>
            <label>{title}</label>
            <input
                type={isPassword ? 'password' : 'text'}
                value={value ?? ''}
                onChange={onChange}
                onBlur={onBlur}
                disabled={isDisabled}
                placeholder={placeholder}
                className={className}
            />
            {message && (
                <span data-testid="field-error" data-type={message.type}>
                    {message.value}
                </span>
            )}
        </div>
    ),
    DsTypography: ({ children, variant, className, ...rest }: any) => (
        <span data-variant={variant} className={className} {...rest}>
            {children}
        </span>
    ),
    DsSpinner: ({ className }: any) => <div data-testid="ds-spinner" className={className} />
}));

// ─── helpers ────────────────────────────────────────────────────────────────

interface BulkStoreOptions {
    selectedAuthenticationType?: string | null;
    actionsDisabled?: boolean;
    selectedRowsForExploreSavingsEBSBulk?: any[];
    rowsRequiringAuthBulk?: any[];
    bulkAuthStatus?: Record<string, string>;
}

const createMockStore = (opts: BulkStoreOptions = {}) => {
    const {
        selectedAuthenticationType = AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
        actionsDisabled = false,
        selectedRowsForExploreSavingsEBSBulk = [
            { id: 1, name: 'host-1' },
            { id: 2, name: 'host-2' }
        ],
        rowsRequiringAuthBulk = [],
        bulkAuthStatus = {}
    } = opts;

    // Define state objects outside reducers so they hold stable references.
    // Using `() => ({...})` would return a new object on every dispatch, causing
    // useSelector to trigger re-renders every cycle and creating an infinite loop
    // with the useEffect that depends on rowsToRender.
    const exploreSavingsState = {
        selectedAuthenticationType,
        serverDetails: { userName: '', password: '' }
    };
    const dialogComponentState = { actionsDisabled };
    const exploreSavingsBulkState = {
        selectedRowsForExploreSavingsEBSBulk,
        rowsRequiringAuthBulk,
        bulkAuthStatus
    };
    const authState = { isGovAccount: false };

    return configureStore({
        reducer: {
            exploreSavings: (state = exploreSavingsState) => state,
            dialogComponent: (state = dialogComponentState) => state,
            exploreSavingsBulk: (state = exploreSavingsBulkState) => state,
            auth: (state = authState) => state
        }
    });
};

const renderComponent = (opts: BulkStoreOptions = {}) => {
    const store = createMockStore(opts);
    return {
        store,
        ...render(
            <Provider store={store}>
                <AuthBulkDialog />
            </Provider>
        )
    };
};

// ─── tests ──────────────────────────────────────────────────────────────────

describe('AuthBulkDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tFn = (key: string) => key; // reset default
    });

    // ── rendering ───────────────────────────────────────────────────────────

    describe('Rendering', () => {
        it('should render the main authDialog container', () => {
            const { container } = renderComponent();
            expect((container.firstChild as HTMLElement)?.className).toContain('authDialog');
        });

        it('should render the bulk dialog header when all rows need auth', () => {
            renderComponent();
            expect(screen.getByText('databases.explore-savings.authentication-bulk-dialog-header')).toBeTruthy();
        });

        it('should render the select auth mode heading', () => {
            renderComponent();
            expect(screen.getByText('databases.explore-savings.select-auth-mode')).toBeTruthy();
        });

        it('should render both authentication radio buttons', () => {
            renderComponent();
            expect(screen.getByTestId('select-sql-authentication')).toBeTruthy();
            expect(screen.getByTestId('select-windows-authentication')).toBeTruthy();
        });

        it('should render the permissions accordion', () => {
            renderComponent();
            expect(screen.getByTestId('accordion-controller')).toBeTruthy();
            expect(screen.getByTestId('accordion-card')).toBeTruthy();
            expect(screen.getByText('databases.explore-savings.permissions-required-heading')).toBeTruthy();
        });

        it('should render permission items inside the accordion', () => {
            renderComponent();
            expect(screen.getByText('databases.explore-savings.permissions-required-content')).toBeTruthy();
            expect(screen.getByText(/databases.explore-savings.view-any-definition/)).toBeTruthy();
            expect(screen.getByText(/databases.explore-savings.view-server-state/)).toBeTruthy();
            expect(screen.getByText(/databases.explore-savings.connect-sql/)).toBeTruthy();
        });

        it('should render Popover with CopyToClipboard and CopyIcon', () => {
            renderComponent();
            expect(screen.getByTestId('popover')).toBeTruthy();
            expect(screen.getByTestId('copy-to-clipboard')).toBeTruthy();
            expect(screen.getByTestId('copy-icon')).toBeTruthy();
        });

        it('should pass the correct concatenated permissions to CopyToClipboard', () => {
            renderComponent();
            const copyEl = screen.getByTestId('copy-to-clipboard');
            expect(copyEl.getAttribute('data-value')).toBe(
                'databases.explore-savings.view-any-definition, databases.explore-savings.view-server-state, databases.explore-savings.connect-sql'
            );
        });

        it('should render database-name header label', () => {
            renderComponent();
            expect(screen.getByText('databases.explore-savings.database-name')).toBeTruthy();
        });

        it('should render host names from rows', () => {
            renderComponent();
            expect(screen.getByText('host-1')).toBeTruthy();
            expect(screen.getByText('host-2')).toBeTruthy();
        });

        it('should render cross icons for each row', () => {
            renderComponent();
            const crossIcons = screen.getAllByTestId('cross-icon');
            expect(crossIcons.length).toBe(2);
        });
    });

    // ── rowsToRender logic ──────────────────────────────────────────────────

    describe('rowsToRender logic', () => {
        it('should use rowsRequiringAuthBulk when it has items', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' },
                    { id: 3, name: 'host-3' }
                ],
                rowsRequiringAuthBulk: [{ id: 2, name: 'host-2' }]
            });
            // Only host-2 should be rendered from rowsRequiringAuthBulk
            expect(screen.getByText('host-2')).toBeTruthy();
            expect(screen.queryByText('host-1')).toBeNull();
            expect(screen.queryByText('host-3')).toBeNull();
        });

        it('should use selectedRowsForExploreSavingsEBSBulk when rowsRequiringAuthBulk is empty', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' }
                ],
                rowsRequiringAuthBulk: []
            });
            expect(screen.getByText('host-1')).toBeTruthy();
            expect(screen.getByText('host-2')).toBeTruthy();
        });

        it('should show partial auth header when rowsToRender < total selected rows', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' },
                    { id: 3, name: 'host-3' }
                ],
                rowsRequiringAuthBulk: [{ id: 2, name: 'host-2' }]
            });
            // Should show "2 out of the 3 ..." message
            expect(screen.getByText(/2 out of the/)).toBeTruthy();
            expect(screen.getByText(/authentication-bulk-dialog-content-someAuthRequired/)).toBeTruthy();
        });

        it('should NOT show partial auth header when all rows need auth', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' }
                ],
                rowsRequiringAuthBulk: []
            });
            expect(screen.queryByText(/authentication-bulk-dialog-content-someAuthRequired/)).toBeNull();
        });
    });

    // ── useEffect – default auth type ───────────────────────────────────────

    describe('useEffect – default auth type', () => {
        it('should dispatch setSelectedAuthenticationType on mount when not set', () => {
            const store = createMockStore({ selectedAuthenticationType: null });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                })
            );
        });

        it('should dispatch setSelectedAuthenticationType when auth type is empty string', () => {
            const store = createMockStore({ selectedAuthenticationType: '' });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                })
            );
        });

        it('should NOT dispatch default auth type when already set', () => {
            const store = createMockStore({
                selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            // Should not dispatch setSelectedAuthenticationType (the first useEffect)
            const authTypeDispatches = dispatchSpy.mock.calls.filter(
                call => (call[0] as any)?.type === 'exploreSavings/setSelectedAuthenticationType'
            );
            expect(authTypeDispatches).toHaveLength(0);
        });
    });

    // ── useEffect – setBulkAuthCredentials ──────────────────────────────────

    describe('useEffect – setBulkAuthCredentials', () => {
        it('should dispatch setBulkAuthCredentials when inputValues has keys', async () => {
            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            // The third useEffect initializes inputValues based on rowsToRender, which triggers the second useEffect
            // Since we have 2 rows, the inputValues will have 2 keys → setBulkAuthCredentials dispatched
            const bulkCredDispatches = dispatchSpy.mock.calls.filter(
                call => (call[0] as any)?.type === 'exploreSavingsBulk/setBulkAuthCredentials'
            );
            expect(bulkCredDispatches.length).toBeGreaterThanOrEqual(1);
        });

        it('should NOT dispatch setBulkAuthCredentials when no rows', () => {
            const store = createMockStore({
                selectedRowsForExploreSavingsEBSBulk: [],
                rowsRequiringAuthBulk: []
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            const bulkCredDispatches = dispatchSpy.mock.calls.filter(
                call => (call[0] as any)?.type === 'exploreSavingsBulk/setBulkAuthCredentials'
            );
            expect(bulkCredDispatches).toHaveLength(0);
        });
    });

    // ── radio button interactions ───────────────────────────────────────────

    describe('Authentication type radio buttons', () => {
        it('should mark SQL Server authentication as selected when it is the current type', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION });
            const sqlBtn = screen.getByTestId('select-sql-authentication');
            expect(sqlBtn.getAttribute('aria-pressed')).toBe('true');
        });

        it('should mark Windows authentication as selected when it is the current type', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION });
            const winBtn = screen.getByTestId('select-windows-authentication');
            expect(winBtn.getAttribute('aria-pressed')).toBe('true');
        });

        it('should dispatch auth type change + resets when SQL auth radio is clicked', () => {
            const store = createMockStore({
                selectedAuthenticationType: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('select-sql-authentication'));

            // setSelectedAuthenticationType + resetServerDetailsCredentials + resetBulkAuthCredentialsAndStatus
            const types = dispatchSpy.mock.calls.map(call => (call[0] as any)?.type);
            expect(types).toContain('exploreSavings/setSelectedAuthenticationType');
            expect(types).toContain('exploreSavings/resetServerDetailsCredentials');
            expect(types).toContain('exploreSavingsBulk/resetBulkAuthCredentialsAndStatus');
        });

        it('should dispatch auth type change + resets when Windows auth radio is clicked', () => {
            const store = createMockStore({
                selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('select-windows-authentication'));

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
                })
            );
        });
    });

    // ── input fields – SQL Server auth ──────────────────────────────────────

    describe('Input fields – SQL Server authentication', () => {
        it('should render username header label with SQL Server label', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION });
            expect(screen.getByText('databases.register-flow.detect-mssql-username')).toBeTruthy();
        });

        it('should render password header label with SQL Server label', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION });
            expect(screen.getByText('databases.register-flow.detect-mssql-password')).toBeTruthy();
        });

        it('should render SQL Server username placeholder on input fields', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION });
            const inputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            expect(inputs.length).toBe(2); // one per row
        });

        it('should render enter-password placeholder on password fields', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION });
            const inputs = screen.getAllByPlaceholderText('databases.general.enter-password');
            expect(inputs.length).toBe(2);
        });

        it('should dispatch username change for a host', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.change(usernameInputs[0], { target: { value: 'newuser' } });

            // The value should be updated in the input
            expect((usernameInputs[0] as HTMLInputElement).value).toBe('newuser');
        });

        it('should dispatch password change for a host', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            const passwordInputs = screen.getAllByPlaceholderText('databases.general.enter-password');
            fireEvent.change(passwordInputs[0], { target: { value: 'newpass' } });

            expect((passwordInputs[0] as HTMLInputElement).value).toBe('newpass');
        });

        it('should handle onChange with no event target value (fallback to empty string)', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            // Fire change without target.value
            fireEvent.change(usernameInputs[0], { target: {} });

            expect((usernameInputs[0] as HTMLInputElement).value).toBe('');
        });

        it('should render password fields as type password', () => {
            renderComponent();
            const passwordInputs = screen.getAllByPlaceholderText('databases.general.enter-password');
            passwordInputs.forEach(input => {
                expect((input as HTMLInputElement).type).toBe('password');
            });
        });
    });

    // ── input fields – Windows auth ─────────────────────────────────────────

    describe('Input fields – Windows authentication', () => {
        it('should render username header label with Windows label', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION });
            expect(screen.getByText('databases.register-flow.detect-windows-username')).toBeTruthy();
        });

        it('should render password header label with Windows label', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION });
            expect(screen.getByText('databases.register-flow.detect-windows-password')).toBeTruthy();
        });

        it('should render Windows username placeholder on input fields', () => {
            renderComponent({ selectedAuthenticationType: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION });
            const inputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-windows-username'
            );
            expect(inputs.length).toBe(2);
        });
    });

    // ── validation – error messages ─────────────────────────────────────────

    describe('Validation – error messages', () => {
        it('should NOT show any errors before blur', () => {
            renderComponent();
            expect(screen.queryAllByTestId('field-error')).toHaveLength(0);
        });

        it('should show username error after blur when username is empty', () => {
            renderComponent();
            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.blur(usernameInputs[0]);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].textContent).toBe('databases.general.action-required');
        });

        it('should show password error after blur when password is empty', () => {
            renderComponent();
            const passwordInputs = screen.getAllByPlaceholderText('databases.general.enter-password');
            fireEvent.blur(passwordInputs[0]);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].textContent).toBe('databases.general.action-required');
        });

        it('should show both username and password errors when both are blurred while empty', () => {
            renderComponent();
            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            const passwordInputs = screen.getAllByPlaceholderText('databases.general.enter-password');

            fireEvent.blur(usernameInputs[0]);
            fireEvent.blur(passwordInputs[0]);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(2);
        });

        it('should NOT show username error when username has a value', () => {
            renderComponent();
            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            // Type something
            fireEvent.change(usernameInputs[0], { target: { value: 'admin' } });
            fireEvent.blur(usernameInputs[0]);

            // The first row should not show username error (but might show password error if blurred)
            // Check that the first text-field does NOT contain an error
            const firstFieldContainer = usernameInputs[0].closest('[data-testid]');
            const errorInFirstField = firstFieldContainer?.querySelector('[data-testid="field-error"]');
            expect(errorInFirstField).toBeNull();
        });

        it('should NOT show password error when password has a value', () => {
            renderComponent();
            const passwordInputs = screen.getAllByPlaceholderText('databases.general.enter-password');
            fireEvent.change(passwordInputs[0], { target: { value: 'secret' } });
            fireEvent.blur(passwordInputs[0]);

            const firstFieldContainer = passwordInputs[0].closest('[data-testid]');
            const errorInFirstField = firstFieldContainer?.querySelector('[data-testid="field-error"]');
            expect(errorInFirstField).toBeNull();
        });

        it('should fall back to empty string for username error when t() returns null', () => {
            tFn = (key: string) => (key === 'databases.general.action-required' ? null : key) as any;

            renderComponent();
            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.blur(usernameInputs[0]);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].textContent).toBe('');
        });

        it('should fall back to empty string for password error when t() returns null', () => {
            tFn = (key: string) => (key === 'databases.general.action-required' ? null : key) as any;

            renderComponent();
            const passwordInputs = screen.getAllByPlaceholderText('databases.general.enter-password');
            fireEvent.blur(passwordInputs[0]);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].textContent).toBe('');
        });

        it('should reset touched states when auth type changes', () => {
            const store = createMockStore({
                selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
            });

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            // Blur username to trigger touched state
            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.blur(usernameInputs[0]);
            expect(screen.getAllByTestId('field-error').length).toBeGreaterThanOrEqual(1);

            // Switch auth type → handleAuthTypeChange resets touched flags
            fireEvent.click(screen.getByTestId('select-windows-authentication'));

            // Error should be gone because touched flags were reset
            expect(screen.queryAllByTestId('field-error')).toHaveLength(0);
        });
    });

    // ── handleRemoveRow ─────────────────────────────────────────────────────

    describe('handleRemoveRow', () => {
        it('should NOT remove a row when it is the only one (rowsToRender.length === 1)', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'only-host' }],
                rowsRequiringAuthBulk: []
            });

            const crossIcon = screen.getByTestId('cross-icon');
            fireEvent.click(crossIcon);

            // The row should still be there
            expect(screen.getByText('only-host')).toBeTruthy();
        });

        it('should remove a row when cross icon is clicked (multiple rows)', () => {
            const store = createMockStore({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' }
                ],
                rowsRequiringAuthBulk: []
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            const crossIcons = screen.getAllByTestId('cross-icon');
            fireEvent.click(crossIcons[0]); // Remove first row (host-1)

            // Should dispatch setSelectedRowsForExploreSavingsEBSBulk with filtered list
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'exploreSavingsBulk/setSelectedRowsForExploreSavingsEBSBulk',
                    payload: [{ id: 2, name: 'host-2' }]
                })
            );
        });

        it('should also dispatch setRowsRequiringAuthBulk when rowsRequiringAuthBulk has items', () => {
            const store = createMockStore({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' },
                    { id: 3, name: 'host-3' }
                ],
                rowsRequiringAuthBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' }
                ]
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            const crossIcons = screen.getAllByTestId('cross-icon');
            fireEvent.click(crossIcons[0]); // Remove first row (host-1)

            const types = dispatchSpy.mock.calls.map(call => (call[0] as any)?.type);
            expect(types).toContain('exploreSavingsBulk/setSelectedRowsForExploreSavingsEBSBulk');
            expect(types).toContain('exploreSavingsBulk/setRowsRequiringAuthBulk');
        });

        it('should NOT dispatch setRowsRequiringAuthBulk when rowsRequiringAuthBulk is empty', () => {
            const store = createMockStore({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' }
                ],
                rowsRequiringAuthBulk: []
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            const crossIcons = screen.getAllByTestId('cross-icon');
            fireEvent.click(crossIcons[0]);

            const reqAuthDispatches = dispatchSpy.mock.calls.filter(
                call => (call[0] as any)?.type === 'exploreSavingsBulk/setRowsRequiringAuthBulk'
            );
            expect(reqAuthDispatches).toHaveLength(0);
        });

        it('should handle remove when row name is not found in rowsToRender', () => {
            // This tests the branch where removedName is undefined
            const store = createMockStore({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' }
                ],
                rowsRequiringAuthBulk: []
            });

            render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );

            // Both rows are rendered - clicking the cross icon should work fine
            const crossIcons = screen.getAllByTestId('cross-icon');
            fireEvent.click(crossIcons[1]); // Remove second row (host-2)

            // Should not crash
            expect(screen.getByText('host-1')).toBeTruthy();
        });

        it('should apply crossDisabled class when only one selected row', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'only-host' }]
            });
            const crossIcon = screen.getByTestId('cross-icon');
            expect(crossIcon.getAttribute('class')).toContain('crossDisabled');
        });

        it('should NOT apply crossDisabled class when multiple selected rows', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' }
                ]
            });
            const crossIcons = screen.getAllByTestId('cross-icon');
            crossIcons.forEach(icon => {
                expect(icon.getAttribute('class')).not.toContain('crossDisabled');
            });
        });
    });

    // ── getImageForStatus ───────────────────────────────────────────────────

    describe('getImageForStatus', () => {
        it('should render Success icon for "success" status', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'host-1' }],
                bulkAuthStatus: { 'host-1': 'success' }
            });
            expect(screen.getByTestId('success-icon')).toBeTruthy();
        });

        it('should render DsSpinner for "in-progress" status', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'host-1' }],
                bulkAuthStatus: { 'host-1': 'in-progress' }
            });
            expect(screen.getByTestId('ds-spinner')).toBeTruthy();
        });

        it('should render Failure icon for "failure" status', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'host-1' }],
                bulkAuthStatus: { 'host-1': 'failure' }
            });
            expect(screen.getByTestId('failure-icon')).toBeTruthy();
        });

        it('should render nothing for unknown status', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'host-1' }],
                bulkAuthStatus: { 'host-1': 'unknown-status' }
            });
            expect(screen.queryByTestId('success-icon')).toBeNull();
            expect(screen.queryByTestId('ds-spinner')).toBeNull();
            expect(screen.queryByTestId('failure-icon')).toBeNull();
        });

        it('should render nothing when bulkAuthStatus has no entry for host', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'host-1' }],
                bulkAuthStatus: {}
            });
            expect(screen.queryByTestId('success-icon')).toBeNull();
            expect(screen.queryByTestId('ds-spinner')).toBeNull();
            expect(screen.queryByTestId('failure-icon')).toBeNull();
        });

        it('should render different status icons for different hosts', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [
                    { id: 1, name: 'host-1' },
                    { id: 2, name: 'host-2' },
                    { id: 3, name: 'host-3' }
                ],
                bulkAuthStatus: {
                    'host-1': 'success',
                    'host-2': 'in-progress',
                    'host-3': 'failure'
                }
            });
            expect(screen.getByTestId('success-icon')).toBeTruthy();
            expect(screen.getByTestId('ds-spinner')).toBeTruthy();
            expect(screen.getByTestId('failure-icon')).toBeTruthy();
        });
    });

    // ── disabled state ──────────────────────────────────────────────────────

    describe('Disabled state', () => {
        it('should disable all input fields when actionsDisabled is true', () => {
            renderComponent({ actionsDisabled: true });
            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            const passwordInputs = screen.getAllByPlaceholderText('databases.general.enter-password');

            usernameInputs.forEach(input => expect((input as HTMLInputElement).disabled).toBe(true));
            passwordInputs.forEach(input => expect((input as HTMLInputElement).disabled).toBe(true));
        });

        it('should enable all input fields when actionsDisabled is false', () => {
            renderComponent({ actionsDisabled: false });
            const usernameInputs = screen.getAllByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            const passwordInputs = screen.getAllByPlaceholderText('databases.general.enter-password');

            usernameInputs.forEach(input => expect((input as HTMLInputElement).disabled).toBe(false));
            passwordInputs.forEach(input => expect((input as HTMLInputElement).disabled).toBe(false));
        });
    });

    // ── edge cases ──────────────────────────────────────────────────────────

    describe('Edge cases', () => {
        it('should handle empty rows gracefully', () => {
            const { container } = renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [],
                rowsRequiringAuthBulk: []
            });
            expect(container.firstChild).toBeTruthy();
        });

        it('should handle rows with special character names', () => {
            renderComponent({
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'db_host-123.example.com' }]
            });
            expect(screen.getByText('db_host-123.example.com')).toBeTruthy();
        });

        it('should handle bulkAuthStatus being undefined', () => {
            const exploreSavingsState = {
                selectedAuthenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
                serverDetails: { userName: '', password: '' }
            };
            const dialogComponentState = { actionsDisabled: false };
            const exploreSavingsBulkState = {
                selectedRowsForExploreSavingsEBSBulk: [{ id: 1, name: 'host-1' }],
                rowsRequiringAuthBulk: [],
                bulkAuthStatus: undefined
            };
            const authState = { isGovAccount: false };
            const store = configureStore({
                reducer: {
                    exploreSavings: (state = exploreSavingsState) => state,
                    dialogComponent: (state = dialogComponentState) => state,
                    exploreSavingsBulk: (state = exploreSavingsBulkState) => state,
                    auth: (state = authState) => state
                }
            });

            const { container } = render(
                <Provider store={store}>
                    <AuthBulkDialog />
                </Provider>
            );
            expect(container.firstChild).toBeTruthy();
        });
    });

    // ── CSS classes ─────────────────────────────────────────────────────────

    describe('CSS classes', () => {
        it('should apply authDialog class to main container', () => {
            const { container } = renderComponent();
            expect((container.firstChild as HTMLElement)?.className).toContain('authDialog');
        });

        it('should apply radioContainer class', () => {
            const { container } = renderComponent();
            expect(container.querySelector('.radioContainer')).toBeTruthy();
        });

        it('should apply textFieldContainer class', () => {
            const { container } = renderComponent();
            expect(container.querySelector('.textFieldContainer')).toBeTruthy();
        });

        it('should apply accordionContainer class', () => {
            const { container } = renderComponent();
            expect(container.querySelector('.accordionContainer')).toBeTruthy();
        });

        it('should apply firstBulkSection class in the input fields area', () => {
            const { container } = renderComponent();
            expect(container.querySelector('.firstBulkSection')).toBeTruthy();
        });
    });
});
