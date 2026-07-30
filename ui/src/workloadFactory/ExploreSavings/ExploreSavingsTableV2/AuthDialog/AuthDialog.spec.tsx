import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AuthDialog from './AuthDialog';
import { AUTHENTICATION_TYPE } from '../../../../utils/consts';

// Mock react-i18next – `tFn` can be overridden per-test
let tFn: (key: string) => string | null = (key: string) => key;

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => tFn(key)
    })
}));

// Mock SCSS module
vi.mock('./AuthDialog.module.scss', () => ({
    default: new Proxy(
        {},
        {
            get: (_target, prop) => String(prop)
        }
    )
}));

// Mock SVG
vi.mock('../../../../assets/ic_copy.svg', () => ({
    ReactComponent: (props: any) => <svg data-testid="copy-icon" {...props} />
}));

// Mock CopyToClipboard component
vi.mock('../../../../common/CopyToClipboard/copyToClipboard', () => ({
    default: ({ value, iconProvided }: any) => (
        <div data-testid="copy-to-clipboard" data-value={value}>
            {iconProvided}
        </div>
    )
}));

// Mock AccordionCard components to always render children (no collapse)
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

// Mock @netapp/design-system Popover
vi.mock('@netapp/design-system', () => ({
    Popover: ({ children, container }: any) => (
        <div data-testid="popover">
            <span>{children}</span>
            <span>{container}</span>
        </div>
    )
}));

// Mock @tlveng/wlm-ds components to ensure events fire properly
vi.mock('@tlveng/wlm-ds', () => ({
    DsRadioButton: ({ id, title, isSelected, onClick }: any) => (
        <button data-testid={id} title={title} aria-pressed={isSelected} onClick={onClick}>
            {title}
        </button>
    ),
    DsTextField: ({ title, value, onChange, onBlur, isDisabled, isPassword, placeholder, message, className }: any) => (
        <div data-testid={`text-field-${title}`}>
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
    )
}));

// ─── helpers ────────────────────────────────────────────────────────────────────

const createMockStore = (
    selectedAuthenticationType: string | null | undefined = AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
    userName = '',
    password = '',
    actionsDisabled = false
) =>
    configureStore({
        reducer: {
            exploreSavings: () => ({
                selectedAuthenticationType,
                serverDetails: { userName, password }
            }),
            dialogComponent: () => ({ actionsDisabled }),
            auth: () => ({ isGovAccount: false })
        }
    });

const renderComponent = (
    databaseHostName = 'test-db-host',
    selectedAuthenticationType: string | null | undefined = AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
    userName = '',
    password = '',
    actionsDisabled = false
) => {
    const store = createMockStore(selectedAuthenticationType, userName, password, actionsDisabled);
    return {
        store,
        ...render(
            <Provider store={store}>
                <AuthDialog databaseHostName={databaseHostName} />
            </Provider>
        )
    };
};

// ─── tests ──────────────────────────────────────────────────────────────────────

describe('AuthDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tFn = (key: string) => key; // reset to default
    });

    // ── rendering ───────────────────────────────────────────────────────────

    describe('Rendering', () => {
        it('should render the auth heading with the database host name', () => {
            renderComponent('my-db-host');
            expect(screen.getByText('databases.explore-savings.auth-heading')).toBeTruthy();
            expect(screen.getByText('my-db-host')).toBeTruthy();
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

        it('should apply the dbName class to the host name span', () => {
            const { container } = renderComponent('my-host');
            const hostSpan = container.querySelector('.dbName');
            expect(hostSpan).toBeTruthy();
            expect(hostSpan?.textContent).toBe('my-host');
        });
    });

    // ── useEffect – default auth type ───────────────────────────────────────

    describe('useEffect – default auth type', () => {
        it('should dispatch setSelectedAuthenticationType on mount when not set', () => {
            const store = createMockStore(null);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthDialog databaseHostName="test-db" />
                </Provider>
            );

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                })
            );
        });

        it('should NOT dispatch when selectedAuthenticationType is already set', () => {
            const store = createMockStore(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthDialog databaseHostName="test-db" />
                </Provider>
            );

            expect(dispatchSpy).not.toHaveBeenCalled();
        });
    });

    // ── radio button interactions ───────────────────────────────────────────

    describe('Authentication type radio buttons', () => {
        it('should mark SQL Server authentication as selected when it is the current type', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            const sqlBtn = screen.getByTestId('select-sql-authentication');
            expect(sqlBtn.getAttribute('aria-pressed')).toBe('true');
        });

        it('should mark Windows authentication as selected when it is the current type', () => {
            renderComponent('db', AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION);
            const winBtn = screen.getByTestId('select-windows-authentication');
            expect(winBtn.getAttribute('aria-pressed')).toBe('true');
        });

        it('should dispatch auth type change + reset when SQL auth radio is clicked', () => {
            const store = createMockStore(AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthDialog databaseHostName="test-db" />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('select-sql-authentication'));

            // setSelectedAuthenticationType + resetServerDetailsCredentials
            expect(dispatchSpy).toHaveBeenCalledTimes(2);
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                })
            );
        });

        it('should dispatch auth type change + reset when Windows auth radio is clicked', () => {
            const store = createMockStore(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthDialog databaseHostName="test-db" />
                </Provider>
            );

            fireEvent.click(screen.getByTestId('select-windows-authentication'));

            expect(dispatchSpy).toHaveBeenCalledTimes(2);
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION
                })
            );
        });
    });

    // ── input fields – SQL Server auth ──────────────────────────────────────

    describe('Input fields – SQL Server authentication', () => {
        it('should render username field with SQL Server label', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            expect(screen.getByText('databases.register-flow.detect-mssql-username')).toBeTruthy();
        });

        it('should render password field with SQL Server label', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            expect(screen.getByText('databases.register-flow.detect-mssql-password')).toBeTruthy();
        });

        it('should render SQL Server username placeholder', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            expect(
                screen.getByPlaceholderText('databases.general.enter databases.register-flow.detect-mssql-username')
            ).toBeTruthy();
        });

        it('should render enter-password placeholder on password field', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            expect(screen.getByPlaceholderText('databases.general.enter-password')).toBeTruthy();
        });

        it('should display existing username value from store', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, 'admin');
            const input = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            ) as HTMLInputElement;
            expect(input.value).toBe('admin');
        });

        it('should display existing password value from store', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', 'secret');
            const input = screen.getByPlaceholderText('databases.general.enter-password') as HTMLInputElement;
            expect(input.value).toBe('secret');
        });

        it('should dispatch setCredentials with userName on username change', () => {
            const store = createMockStore(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthDialog databaseHostName="db" />
                </Provider>
            );

            const input = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.change(input, { target: { value: 'newuser' } });

            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ payload: { userName: 'newuser' } }));
        });

        it('should dispatch setCredentials with password on password change', () => {
            const store = createMockStore(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <AuthDialog databaseHostName="db" />
                </Provider>
            );

            const input = screen.getByPlaceholderText('databases.general.enter-password');
            fireEvent.change(input, { target: { value: 'newpass' } });

            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ payload: { password: 'newpass' } }));
        });

        it('should render password field as type password', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION);
            const input = screen.getByPlaceholderText('databases.general.enter-password') as HTMLInputElement;
            expect(input.type).toBe('password');
        });
    });

    // ── input fields – Windows auth ─────────────────────────────────────────

    describe('Input fields – Windows authentication', () => {
        it('should render username field with Windows label', () => {
            renderComponent('db', AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION);
            expect(screen.getByText('databases.register-flow.detect-windows-username')).toBeTruthy();
        });

        it('should render password field with Windows label', () => {
            renderComponent('db', AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION);
            expect(screen.getByText('databases.register-flow.detect-windows-password')).toBeTruthy();
        });

        it('should render Windows username placeholder', () => {
            renderComponent('db', AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION);
            expect(screen.getByPlaceholderText('databases.register-flow.detect-windows-username')).toBeTruthy();
        });
    });

    // ── validation – error messages (covers lines 70-75 and 101-106) ────────

    describe('Validation – error messages', () => {
        it('should NOT show username error before blur', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '');
            expect(screen.queryAllByTestId('field-error')).toHaveLength(0);
        });

        it('should NOT show password error before blur', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', '');
            expect(screen.queryAllByTestId('field-error')).toHaveLength(0);
        });

        it('should show username error after blur when username is empty', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', 'pass');

            const usernameInput = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.blur(usernameInput);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].textContent).toBe('databases.general.action-required');
        });

        it('should show password error after blur when password is empty', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, 'user', '');

            const passwordInput = screen.getByPlaceholderText('databases.general.enter-password');
            fireEvent.blur(passwordInput);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].textContent).toBe('databases.general.action-required');
        });

        it('should show both errors when both fields are blurred while empty', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', '');

            const usernameInput = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            const passwordInput = screen.getByPlaceholderText('databases.general.enter-password');

            fireEvent.blur(usernameInput);
            fireEvent.blur(passwordInput);

            const errors = screen.getAllByTestId('field-error');
            expect(errors).toHaveLength(2);
        });

        it('should NOT show username error when username has a value', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, 'admin', '');

            const usernameInput = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.blur(usernameInput);

            // Only password should get error (if blurred)
            expect(screen.queryAllByTestId('field-error')).toHaveLength(0);
        });

        it('should NOT show password error when password has a value', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', 'secret');

            const passwordInput = screen.getByPlaceholderText('databases.general.enter-password');
            fireEvent.blur(passwordInput);

            // No password error since password is non-empty
            expect(screen.queryAllByTestId('field-error')).toHaveLength(0);
        });

        it('should fall back to empty string for username error when t() returns null', () => {
            // Make t return null for the action-required key to cover the `|| ""` branch
            tFn = (key: string) => (key === 'databases.general.action-required' ? null : key) as any;

            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', 'pass');

            const usernameInput = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.blur(usernameInput);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            // The fallback empty string is used
            expect(errors[0].textContent).toBe('');
        });

        it('should fall back to empty string for password error when t() returns null', () => {
            tFn = (key: string) => (key === 'databases.general.action-required' ? null : key) as any;

            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, 'user', '');

            const passwordInput = screen.getByPlaceholderText('databases.general.enter-password');
            fireEvent.blur(passwordInput);

            const errors = screen.getAllByTestId('field-error');
            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors[0].textContent).toBe('');
        });

        it('should reset touched states when auth type changes', () => {
            const store = createMockStore(AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', '');

            const { rerender } = render(
                <Provider store={store}>
                    <AuthDialog databaseHostName="db" />
                </Provider>
            );

            // Blur username to trigger touched state
            const usernameInput = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            );
            fireEvent.blur(usernameInput);
            expect(screen.getAllByTestId('field-error').length).toBeGreaterThanOrEqual(1);

            // Switch auth type → handleAuthTypeChange resets touched flags
            fireEvent.click(screen.getByTestId('select-windows-authentication'));

            // Re-render with Windows auth
            const newStore = createMockStore(AUTHENTICATION_TYPE.WINDOWS_AUTHENTICATION, '', '');
            rerender(
                <Provider store={newStore}>
                    <AuthDialog databaseHostName="db" />
                </Provider>
            );

            // Error should be gone because touched flags were reset
            expect(screen.queryAllByTestId('field-error')).toHaveLength(0);
        });
    });

    // ── disabled state ──────────────────────────────────────────────────────

    describe('Disabled state', () => {
        it('should disable both input fields when actionsDisabled is true', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', '', true);

            const usernameInput = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            ) as HTMLInputElement;
            const passwordInput = screen.getByPlaceholderText('databases.general.enter-password') as HTMLInputElement;

            expect(usernameInput.disabled).toBe(true);
            expect(passwordInput.disabled).toBe(true);
        });

        it('should enable both input fields when actionsDisabled is false', () => {
            renderComponent('db', AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION, '', '', false);

            const usernameInput = screen.getByPlaceholderText(
                'databases.general.enter databases.register-flow.detect-mssql-username'
            ) as HTMLInputElement;
            const passwordInput = screen.getByPlaceholderText('databases.general.enter-password') as HTMLInputElement;

            expect(usernameInput.disabled).toBe(false);
            expect(passwordInput.disabled).toBe(false);
        });
    });

    // ── edge cases ──────────────────────────────────────────────────────────

    describe('Edge cases', () => {
        it('should handle empty databaseHostName', () => {
            const { container } = renderComponent('');
            expect(container.firstChild).toBeTruthy();
        });

        it('should handle special characters in databaseHostName', () => {
            renderComponent('db_host-123.example.com');
            expect(screen.getByText('db_host-123.example.com')).toBeTruthy();
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
    });
});
