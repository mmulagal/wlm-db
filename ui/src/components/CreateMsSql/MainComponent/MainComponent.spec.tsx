import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import MainComponent from './MainComponent';

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual('@netapp/design-system');
    return {
        ...actual,
        StepLayout: ({ children, className }: any) => <div className={className}>{children}</div>,
        WizardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
        WizardFooter: ({ children }: any) => <div>{children}</div>,
        Spinner: ({ isLarge }: any) => <div data-testid="spinner">Spinner{isLarge && ' Large'}</div>
    };
});

vi.mock('../MSSqlServer/MSSqlHeader/MSSqlHeader', () => ({
    default: () => <div data-testid="mssql-header">MSSqlHeader</div>
}));

vi.mock('../MSSqlServer/MSSqlFooter/MSSqlFooter', () => ({
    default: () => <div data-testid="mssql-footer">MSSqlFooter</div>
}));

vi.mock('../CreateMsSqlLayout/CreateMsSqlLayout', () => ({
    default: ({ selectedTab, setSelectedTab }: any) => <div data-testid="create-mssql-layout">CreateMsSqlLayout</div>
}));

vi.mock('../MSSqlServer/MSSqlServer', () => ({
    default: () => <div data-testid="mssql-server">MSSqlServer</div>
}));

vi.mock('../CodeBox/CodeBox', () => ({
    default: () => <div data-testid="codebox">CodeBox</div>
}));

vi.mock('../MSSqlServer/MssqlApis', () => ({
    default: vi.fn(() => null)
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            msSqlAction: () => ({
                isLoading: false,
                ...overrides.msSqlAction
            })
        }
    });

describe('MainComponent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <BrowserRouter>
                    <MainComponent />
                </BrowserRouter>
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders MSSqlHeader', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MainComponent />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('mssql-header')).toBeTruthy();
    });

    it('renders CreateMsSqlLayout when showChatbot is true', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MainComponent />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('create-mssql-layout')).toBeTruthy();
    });

    it('renders CodeBox when showChatbot is true', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MainComponent />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('codebox')).toBeTruthy();
    });

    it('renders MSSqlFooter when selectedTab is wizard', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MainComponent />
                </BrowserRouter>
            </Provider>
        );
        expect(screen.getByTestId('mssql-footer')).toBeTruthy();
    });

    it('shows loading spinner when isLoading is true', () => {
        const store = makeStore({ msSqlAction: { isLoading: true } });
        render(
            <Provider store={store}>
                <BrowserRouter>
                    <MainComponent />
                </BrowserRouter>
            </Provider>
        );
        const spinners = screen.getAllByTestId('spinner');
        expect(spinners.length).toBeGreaterThan(0);
    });

    it('renders main container', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <BrowserRouter>
                    <MainComponent />
                </BrowserRouter>
            </Provider>
        );
        const mainContainers = container.querySelectorAll('[class*="mainContainer"]');
        expect(mainContainers.length).toBeGreaterThan(0);
    });
});
