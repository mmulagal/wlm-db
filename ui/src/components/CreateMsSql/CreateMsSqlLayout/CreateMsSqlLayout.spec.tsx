import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';

import CreateMsSqlLayout from './CreateMsSqlLayout';

vi.mock('../MSSqlServer/MSSqlServer', () => ({
    default: () => <div data-testid="mssql-server">MSSqlServer</div>
}));

vi.mock('./DeploymentTabs/DeploymentTabs', () => ({
    default: (props: any) => (
        <div data-testid="deployment-tabs">
            DeploymentTabs
            <button onClick={() => props.onTabChange('wizard')}>Switch to Wizard</button>
            <button onClick={() => props.onTabChange('chatbot')}>Switch to Chatbot</button>
        </div>
    )
}));

vi.mock('../Chatbot/Chatbot', () => ({
    default: () => <div data-testid="chatbot">Chatbot</div>
}));

vi.mock('../../../store/chatbot/chatbotSlice', () => ({
    setIsShow: (val: boolean) => ({ type: 'chatbot/setIsShow', payload: val }),
    setMovingFromChatbot: (val: boolean) => ({ type: 'chatbot/setMovingFromChatbot', payload: val })
}));

vi.mock('../../../store/mssql/mssqlFormSlice', () => ({
    setSelectConfig: (val: any) => ({ type: 'mssqlForm/setSelectConfig', payload: val })
}));

const makeStore = () =>
    configureStore({
        reducer: {
            chatbot: () => ({ isShow: false }),
            mssqlForm: () => ({ selectConfig: 'easyCreate' })
        }
    });

describe('CreateMsSqlLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setSelectedTab = vi.fn();

    it('renders MSSqlServer component', () => {
        const store = makeStore();
        render(
            <MemoryRouter>
                <Provider store={store}>
                    <CreateMsSqlLayout selectedTab="wizard" setSelectedTab={setSelectedTab} />
                </Provider>
            </MemoryRouter>
        );
        expect(screen.getByTestId('mssql-server')).toBeTruthy();
    });

    it('dispatches setIsShow(false) when selectedTab is wizard', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <MemoryRouter>
                <Provider store={store}>
                    <CreateMsSqlLayout selectedTab="wizard" setSelectedTab={setSelectedTab} />
                </Provider>
            </MemoryRouter>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'chatbot/setIsShow', payload: false })
        );
    });

    it('dispatches setIsShow(true) when selectedTab is chatbot', () => {
        const store = makeStore();
        const dispatchSpy = vi.spyOn(store, 'dispatch');
        render(
            <MemoryRouter>
                <Provider store={store}>
                    <CreateMsSqlLayout selectedTab="chatbot" setSelectedTab={setSelectedTab} />
                </Provider>
            </MemoryRouter>
        );
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'chatbot/setIsShow', payload: true }));
    });

    it('renders without crashing with wizard selectedTab', () => {
        const store = makeStore();
        const { container } = render(
            <MemoryRouter>
                <Provider store={store}>
                    <CreateMsSqlLayout selectedTab="wizard" setSelectedTab={setSelectedTab} />
                </Provider>
            </MemoryRouter>
        );
        expect(container).toBeDefined();
    });
});
