import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import MSSqlHeader from './MSSqlHeader';

const { mockSetDialog, mockCloseDialog, mockPostBlueXPMessage } = vi.hoisted(() => ({
    mockSetDialog: vi.fn(),
    mockCloseDialog: vi.fn(),
    mockPostBlueXPMessage: vi.fn()
}));

const mockSaveConfigData = vi.fn();
const mockLoadConfigDataExe = vi.fn();
const mockConfigListRefetch = vi.fn();

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual('@netapp/design-system');
    return {
        ...actual,
        useDialog: () => ({ setDialog: mockSetDialog, closeDialog: mockCloseDialog }),
        postBlueXPMessage: mockPostBlueXPMessage,
        Header: ({ children, closeButtonProps, title }: any) => (
            <div data-testid="header">
                <div data-testid="header-title">{title}</div>
                <button data-testid="close-button" onClick={closeButtonProps?.onClick}>
                    Close
                </button>
                {children}
            </div>
        ),
        Button: ({ children, onClick, variant, isDisabled, title }: any) => (
            <button data-testid={`button-${children}`} onClick={onClick} disabled={isDisabled} title={title}>
                {children}
            </button>
        ),
        Popover: ({ children, container }: any) => (
            <div data-testid="popover">
                {children}
                {container}
            </div>
        )
    };
});

vi.mock('../../../../utils/apiService', () => ({
    useSaveConfigDataMutation: vi.fn(() => [mockSaveConfigData]),
    useLazyGetConfigDataQuery: vi.fn(() => [mockLoadConfigDataExe]),
    useGetConfigListQuery: vi.fn(() => ({ refetch: mockConfigListRefetch }))
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content, primaryButton, callback }: any) => (
        <div data-testid="dialog">
            <div>{header}</div>
            <div>{content}</div>
            <button onClick={callback}>{primaryButton}</button>
        </div>
    )
}));

vi.mock('../../LoadConfig/LoadConfig', () => ({
    default: () => <div>LoadConfig</div>
}));

vi.mock('../../SaveConfig/SaveConfig', () => ({
    default: () => <div>SaveConfig</div>
}));

vi.mock('../../Configuration/LoadConfiguration.ts', () => ({
    LoadConfiguration: vi.fn(),
    SaveConfiguration: vi.fn(),
    resetChecksAfterLoad: vi.fn(),
    resetRefetchApiCheck: vi.fn()
}));

vi.mock('../../../../utils/appConfig', () => ({
    navigateToCanvas: vi.fn()
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssql: () => ({
                getSavedConfigList: { configData: [] },
                ...overrides.mssql
            }),
            msSqlAction: () => ({
                databaseHostEntryPoint: 'database',
                isLoadConfig: false,
                refetchApiCount: { isLoading: false, expected: [], ran: [] },
                ...overrides.msSqlAction
            }),
            auth: () => ({
                isWorkloadFactory: true,
                ...overrides.auth
            })
        }
    });

describe('MSSqlHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders header with title', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('header-title')).toBeTruthy();
    });

    it('renders Load Config button when config data exists', () => {
        const store = makeStore({
            mssql: {
                getSavedConfigList: {
                    configData: [{ databaseType: 'MSSQL', name: 'config1' }]
                }
            }
        });
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('button-Load configuration')).toBeTruthy();
    });

    it('disables Load Config button when no config data', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        const button = screen.getByTestId('button-Load configuration');
        expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('renders Save Config button', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('button-Save configuration')).toBeTruthy();
    });

    it('opens load config dialog when Load Config clicked', () => {
        const store = makeStore({
            mssql: {
                getSavedConfigList: {
                    configData: [{ databaseType: 'MSSQL', name: 'config1' }]
                }
            }
        });
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        const loadButton = screen.getByTestId('button-Load configuration');
        fireEvent.click(loadButton);
        expect(mockSetDialog).toHaveBeenCalled();
    });

    it('opens save config dialog when Save Config clicked', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        const saveButton = screen.getByTestId('button-Save configuration');
        fireEvent.click(saveButton);
        expect(mockSetDialog).toHaveBeenCalled();
    });

    it('shows popover when max config limit reached', () => {
        const configData = Array(100)
            .fill(null)
            .map((_, i) => ({ databaseType: 'MSSQL', name: `config${i}` }));
        const store = makeStore({
            mssql: { getSavedConfigList: { configData } }
        });
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('popover')).toBeTruthy();
    });

    it('handles close button click with save dialog', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        const closeButton = screen.getByTestId('close-button');
        fireEvent.click(closeButton);
        expect(mockSetDialog).toHaveBeenCalled();
    });

    it('filters PGSQL configs from config data', () => {
        const store = makeStore({
            mssql: {
                getSavedConfigList: {
                    configData: [
                        { databaseType: 'MSSQL', name: 'config1' },
                        { databaseType: 'PGSQL', name: 'config2' }
                    ]
                }
            }
        });
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MSSqlHeader />
                </BrowserRouter>
            </Provider>
        );
        const loadButton = screen.getByTestId('button-Load configuration');
        expect(loadButton.hasAttribute('disabled')).toBe(false);
    });
});
