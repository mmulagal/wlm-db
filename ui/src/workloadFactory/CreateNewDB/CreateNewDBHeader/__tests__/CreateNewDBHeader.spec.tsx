import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import CreateNewUserHeader from '../CreateNewDBHeader';
import createNewUserSlice from '../../../../store/workloadFactory/createNewDBSlice';
import authSlice from '../../../../store/authSlice';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

// Mock design system
vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => (
        <span data-testid={`typography-${variant}`} className={className}>
            {children}
        </span>
    ),
    Header: ({ title, closeButtonProps }: any) => (
        <div data-testid="header">
            <div data-testid="header-title">{title}</div>
            <button data-testid="close-button" onClick={closeButtonProps?.onClick}>
                Close
            </button>
        </div>
    )
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        CREATE_USER_DB_TITLE: 'Create user database',
        DB_CREATE_HOST: 'Host:'
    }
}));

vi.mock('../../../../utils/consts', () => ({
    FORM_TO_WLF_NAVIGATE_INVENTORY: '../databases/inventory',
    FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY: '../fsxdb/inventory'
}));

vi.mock('../CreateNewDBHeader.module.scss', () => ({
    default: {
        createNewUserHeader: 'createNewUserHeader',
        leftSideStyle: 'leftSideStyle',
        separator: 'separator',
        hostName: 'hostName'
    }
}));

describe('CreateNewUserHeader', () => {
    const createMockStore = (authOverrides = {}, createNewUserOverrides = {}) =>
        configureStore({
            reducer: {
                [createNewUserSlice.name]: createNewUserSlice.reducer,
                [authSlice.name]: authSlice.reducer
            } as any,
            preloadedState: {
                createNewUser: {
                    dbHostName: 'test-host',
                    ...createNewUserOverrides
                },
                auth: {
                    isWorkloadFactory: true,
                    isDemoMode: false,
                    resourceId: 'res-001',
                    ...authOverrides
                }
            } as any
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the header component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        expect(screen.getByTestId('header')).toBeTruthy();
    });

    it('should render the title text', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        expect(screen.getByText('Create user database')).toBeTruthy();
    });

    it('should render the host name from the store', () => {
        const store = createMockStore({}, { dbHostName: 'my-db-host' });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        // "Host: my-db-host" is rendered as split text nodes inside a single span
        expect(screen.getByTestId('typography-Semibold_14').textContent).toContain('my-db-host');
    });

    it('should render DB_CREATE_HOST label', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        // "Host:" and the hostname are separate text nodes inside the typography span
        expect(screen.getByTestId('typography-Semibold_14').textContent).toContain('Host:');
    });

    it('should navigate to WLF inventory on close button click when isWorkloadFactory is true', () => {
        const store = createMockStore({ isWorkloadFactory: true });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByTestId('close-button'));
        expect(mockNavigate).toHaveBeenCalledWith('../databases/inventory');
    });

    it('should navigate to BlueXP inventory on close button click when isWorkloadFactory is false', () => {
        const store = createMockStore({ isWorkloadFactory: false });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByTestId('close-button'));
        expect(mockNavigate).toHaveBeenCalledWith('../fsxdb/inventory');
    });

    it('should dispatch updateRefreshBlocked(true) on close', () => {
        const store = createMockStore({ isWorkloadFactory: true });
        // Spy must be set up BEFORE render so the component picks up the wrapped dispatch
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        fireEvent.click(screen.getByTestId('close-button'));
        expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should render with empty host name', () => {
        const store = createMockStore({}, { dbHostName: '' });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        expect(screen.getByTestId('header')).toBeTruthy();
    });

    it('should render with a long host name', () => {
        const longHostName = 'a'.repeat(100);
        const store = createMockStore({}, { dbHostName: longHostName });
        render(
            <Provider store={store}>
                <MemoryRouter>
                    <CreateNewUserHeader />
                </MemoryRouter>
            </Provider>
        );
        // Long host name is a separate text node inside the typography span
        expect(screen.getByTestId('typography-Semibold_14').textContent).toContain(longHostName);
    });
});
