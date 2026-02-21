import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PostgressHeader from './PostgressHeader';

const mockNavigate = vi.fn();
const mockPostBlueXPMessage = vi.fn();
const mockSetDialog = vi.fn();
const mockCloseDialog = vi.fn();
const mockSaveConfigData = vi.fn();
const mockLoadConfigDataExe = vi.fn();
const mockConfigListRefetch = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate
}));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant, Component, isDisabled }: any) => (
        <button
            data-testid={`btn-${children?.toString().replace(/\s+/g, '-').toLowerCase()}`}
            onClick={onClick}
            disabled={isDisabled}
        >
            {children}
        </button>
    ),
    Header: ({ children, title, closeButtonProps, style }: any) => (
        <div data-testid="header">
            <span data-testid="header-title">{title}</span>
            <button data-testid="header-close" onClick={closeButtonProps?.onClick}>
                X
            </button>
            {children}
        </div>
    ),
    Popover: ({ children, container, trigger }: any) => (
        <div data-testid="popover">
            <span data-testid="popover-content">{children}</span>
            {container}
        </div>
    ),
    useDialog: () => ({ setDialog: mockSetDialog, closeDialog: mockCloseDialog }),
    postBlueXPMessage: (...args: any[]) => mockPostBlueXPMessage(...args),
    BlueXPListeners: { navigate: 'navigate' }
}));

vi.mock('../../../utils/apiService', () => ({
    useGetConfigListQuery: () => ({ refetch: mockConfigListRefetch }),
    useLazyGetConfigDataQuery: () => [mockLoadConfigDataExe],
    useSaveConfigDataMutation: () => [mockSaveConfigData]
}));

vi.mock('../../../utils/appConfig', () => ({
    navigateToCanvas: vi.fn()
}));

vi.mock('../../../utils/consts', () => ({
    FROM_DIALOG: { HEADER_CROSS: 'HEADER_CROSS', LOAD_CONFIG: 'LOAD_CONFIG', SAVE_CONFIG: 'SAVE_CONFIG' },
    MAX_SAVED_CONFIG: 5,
    WIZARD_TYPE: { PGSQL: 'pgsql' }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        LOAD_CONFIG_PGSQL_HEADER: 'Load PostgreSQL configuration',
        SAVE_CONFIG_PGSQL_HEADER: 'Save PostgreSQL configuration',
        SAVE_CONFIG_PGSQL_CONTENT: 'Save your configuration for future use.',
        LOAD: 'Load',
        SAVE: 'Save',
        CANCEL: 'Cancel'
    },
    SELECT_CONFIG: {
        LOAD_CONFIG: 'Load configuration',
        SAVE_CONFIG: 'Save configuration',
        NO_SAVED_CONFIG_PGSQL: 'No saved PostgreSQL configurations',
        MAX_CONFIG_LIMIT: 'Maximum configuration limit reached'
    }
}));

vi.mock('../../../common/Dialog/DialogComponent', () => ({
    default: ({ header, content, primaryButton, callback }: any) => (
        <div data-testid="dialog-component">
            <span data-testid="dialog-header">{header}</span>
            <button data-testid="dialog-primary" onClick={callback}>
                {primaryButton}
            </button>
        </div>
    )
}));

vi.mock('../../CreateMsSql/SaveConfig/SaveConfig', () => ({
    default: ({ description }: any) => <div data-testid="save-config">{description}</div>
}));

vi.mock('../../CreateMsSql/LoadConfig/LoadConfig', () => ({
    default: ({ formType }: any) => <div data-testid="load-config">{formType}</div>
}));

vi.mock('../../CreateMsSql/Configuration/LoadConfiguration', () => ({
    LoadConfiguration: vi.fn(),
    SaveConfiguration: vi.fn(),
    resetChecksAfterLoad: vi.fn(),
    resetRefetchApiCheck: vi.fn()
}));

vi.mock('./PostgressHeader.module.scss', () => ({
    default: {
        'header-button-pgsql': 'header-button-pgsql',
        popover: 'popover',
        separator: 'separator',
        setLoadConfigWidth: 'setLoadConfigWidth'
    }
}));

vi.mock('lodash', () => ({
    uniq: (arr: any[]) => [...new Set(arr)]
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            msSqlAction: () => ({
                databaseHostEntryPoint: overrides.databaseHostEntryPoint ?? '',
                isLoadConfig: overrides.isLoadConfig ?? false,
                refetchApiCount: overrides.refetchApiCount ?? { isLoading: false, expected: [], ran: [] }
            }),
            auth: () => ({
                isWorkloadFactory: overrides.isWorkloadFactory ?? false
            }),
            mssql: () => ({
                getSavedConfigList: {
                    configData: overrides.configData ?? []
                }
            })
        }
    });

describe('PostgressHeader', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={makeStore()}>
                <PostgressHeader />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('renders header with title "Create new PostgreSQL Server"', () => {
        render(
            <Provider store={makeStore()}>
                <PostgressHeader />
            </Provider>
        );
        expect(screen.getByTestId('header-title').textContent).toBe('Create new PostgreSQL Server');
    });

    describe('Load configuration button', () => {
        it('renders active Load configuration button when pgsql configs exist', () => {
            render(
                <Provider store={makeStore({ configData: [{ databaseType: 'pgsql', id: '1' }] })}>
                    <PostgressHeader />
                </Provider>
            );
            expect(screen.getByTestId('btn-load-configuration')).toBeTruthy();
            expect(screen.getByTestId('btn-load-configuration').disabled).toBe(false);
        });

        it('renders disabled Load configuration in Popover when no pgsql configs', () => {
            render(
                <Provider store={makeStore({ configData: [] })}>
                    <PostgressHeader />
                </Provider>
            );
            expect(screen.getByTestId('popover-content').textContent).toContain('No saved PostgreSQL configurations');
        });

        it('opens load configuration dialog on click', () => {
            render(
                <Provider store={makeStore({ configData: [{ databaseType: 'pgsql', id: '1' }] })}>
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('btn-load-configuration'));
            expect(mockSetDialog).toHaveBeenCalled();
        });
    });

    describe('Save configuration button', () => {
        it('renders active Save configuration button when under max config limit', () => {
            render(
                <Provider store={makeStore({ configData: [{ id: '1' }, { id: '2' }] })}>
                    <PostgressHeader />
                </Provider>
            );
            expect(screen.getByTestId('btn-save-configuration')).toBeTruthy();
            expect(screen.getByTestId('btn-save-configuration').disabled).toBe(false);
        });

        it('renders disabled Save configuration in Popover when at max config limit', () => {
            render(
                <Provider
                    store={makeStore({ configData: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }] })}
                >
                    <PostgressHeader />
                </Provider>
            );
            const popoverContents = screen.getAllByTestId('popover-content');
            expect(popoverContents[1].textContent).toContain('Maximum configuration limit reached');
        });

        it('opens save configuration dialog on click', () => {
            render(
                <Provider store={makeStore({ configData: [] })}>
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('btn-save-configuration'));
            expect(mockSetDialog).toHaveBeenCalled();
        });
    });

    describe('Close button navigation', () => {
        it('opens save dialog on close when configData.length < MAX_SAVED_CONFIG', () => {
            render(
                <Provider store={makeStore({ configData: [{ id: '1' }] })}>
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('header-close'));
            expect(mockSetDialog).toHaveBeenCalled();
        });

        it('navigates without dialog when configData.length >= MAX_SAVED_CONFIG', () => {
            render(
                <Provider
                    store={makeStore({
                        configData: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
                        isWorkloadFactory: false,
                        databaseHostEntryPoint: ''
                    })}
                >
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('header-close'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ pathname: '../../../../../fsxhome' }) })
            );
        });

        it('navigates to inventory (WLF) on close when entryPoint is "inventory" and isWLF', () => {
            render(
                <Provider
                    store={makeStore({
                        configData: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
                        databaseHostEntryPoint: 'inventory',
                        isWorkloadFactory: true
                    })}
                >
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('header-close'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ pathname: '../../databases/inventory' }) })
            );
        });

        it('navigates to fsxdb inventory on close when entryPoint is "inventory" and not WLF', () => {
            render(
                <Provider
                    store={makeStore({
                        configData: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
                        databaseHostEntryPoint: 'inventory',
                        isWorkloadFactory: false
                    })}
                >
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('header-close'));
            expect(mockPostBlueXPMessage).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ pathname: '../../fsxdb/inventory' }) })
            );
        });

        it('navigates to /databases on close when entryPoint is "database" and WLF', () => {
            render(
                <Provider
                    store={makeStore({
                        configData: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
                        databaseHostEntryPoint: 'database',
                        isWorkloadFactory: true
                    })}
                >
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('header-close'));
            expect(mockNavigate).toHaveBeenCalledWith('/databases');
        });

        it('navigates to ../../fsxdb on close when entryPoint is "database" and not WLF', () => {
            render(
                <Provider
                    store={makeStore({
                        configData: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
                        databaseHostEntryPoint: 'database',
                        isWorkloadFactory: false
                    })}
                >
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('header-close'));
            expect(mockNavigate).toHaveBeenCalledWith('../../fsxdb');
        });

        it('calls navigateToCanvas on close when entryPoint is empty and WLF', async () => {
            const { navigateToCanvas } = await import('../../../utils/appConfig');
            render(
                <Provider
                    store={makeStore({
                        configData: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
                        databaseHostEntryPoint: '',
                        isWorkloadFactory: true
                    })}
                >
                    <PostgressHeader />
                </Provider>
            );
            fireEvent.click(screen.getByTestId('header-close'));
            expect(navigateToCanvas).toHaveBeenCalledWith('/');
        });
    });

    describe('useEffect — isLoadConfig + refetchApiCount', () => {
        it('calls resetChecksAfterLoad when isLoadConfig is true and expected is met', async () => {
            const { resetChecksAfterLoad } = await import('../../CreateMsSql/Configuration/LoadConfiguration');
            render(
                <Provider
                    store={makeStore({
                        isLoadConfig: true,
                        refetchApiCount: { isLoading: true, expected: ['region'], ran: ['region'] }
                    })}
                >
                    <PostgressHeader />
                </Provider>
            );
            expect(resetChecksAfterLoad).toHaveBeenCalled();
        });

        it('calls resetChecksAfterLoad when isLoadConfig is true and expected is empty', async () => {
            const { resetChecksAfterLoad } = await import('../../CreateMsSql/Configuration/LoadConfiguration');
            render(
                <Provider
                    store={makeStore({
                        isLoadConfig: true,
                        refetchApiCount: { isLoading: true, expected: [], ran: [] }
                    })}
                >
                    <PostgressHeader />
                </Provider>
            );
            expect(resetChecksAfterLoad).toHaveBeenCalled();
        });

        it('does NOT call resetChecksAfterLoad when isLoadConfig is false', async () => {
            const { resetChecksAfterLoad } = await import('../../CreateMsSql/Configuration/LoadConfiguration');
            vi.mocked(resetChecksAfterLoad).mockClear();
            render(
                <Provider store={makeStore({ isLoadConfig: false })}>
                    <PostgressHeader />
                </Provider>
            );
            expect(resetChecksAfterLoad).not.toHaveBeenCalled();
        });
    });

    describe('isConfig state from configData', () => {
        it('sets isConfig=true when configData has pgsql items', () => {
            render(
                <Provider store={makeStore({ configData: [{ databaseType: 'pgsql', id: '1' }] })}>
                    <PostgressHeader />
                </Provider>
            );
            // Active Load configuration button should be visible
            expect(screen.getByTestId('btn-load-configuration')).toBeTruthy();
        });

        it('sets isConfig=false when configData has no pgsql items', () => {
            render(
                <Provider store={makeStore({ configData: [{ databaseType: 'mssql', id: '1' }] })}>
                    <PostgressHeader />
                </Provider>
            );
            // Disabled popover with no config message
            expect(screen.getByTestId('popover-content').textContent).toContain('No saved PostgreSQL configurations');
        });

        it('sets isConfig=false when configData is null', () => {
            render(
                <Provider store={makeStore({ configData: null })}>
                    <PostgressHeader />
                </Provider>
            );
            expect(screen.getByTestId('popover-content').textContent).toContain('No saved PostgreSQL configurations');
        });
    });
});
