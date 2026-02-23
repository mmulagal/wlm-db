import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import DeploymentTabs from './DeploymentTabs';

// Mock SVGs
vi.mock('../../../../assets/wizard-icon.svg', () => ({ ReactComponent: () => <svg data-testid="wizard-icon" /> }));
vi.mock('../../../../assets/Wizard_Selected_light.svg', () => ({
    ReactComponent: () => <svg data-testid="wizard-selected-light" />
}));
vi.mock('../../../../assets/chatbot-tab-icon.svg', () => ({
    ReactComponent: () => <svg data-testid="chatbot-icon" />
}));
vi.mock('../../../../assets/ChatInLightModeNotSelected.svg', () => ({
    ReactComponent: () => <svg data-testid="chatbot-light-not-selected" />
}));
vi.mock('../../../../assets/ChatInDarkSelected.svg', () => ({
    ReactComponent: () => <svg data-testid="chatbot-dark-selected" />
}));
vi.mock('../../../../assets/ChatInDarkNotSelected.svg', () => ({
    ReactComponent: () => <svg data-testid="chatbot-dark-not-selected" />
}));
vi.mock('../../../../assets/WizardSelectedInLightMode.svg', () => ({
    ReactComponent: () => <svg data-testid="wizard-selected-light-mode" />
}));
vi.mock('../../../../assets/WizardUnSelectInLightMode.svg', () => ({
    ReactComponent: () => <svg data-testid="wizard-unselected-light-mode" />
}));

const makeStore = (isDarkTheme = false) =>
    configureStore({
        reducer: {
            auth: () => ({
                features: {
                    active: {
                        'Platform.BlueXP/DarkTheme': isDarkTheme
                    }
                }
            })
        }
    });

describe('DeploymentTabs', () => {
    const onTabChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders wizard and chatbot tabs', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="wizard" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByText('Database wizard')).toBeTruthy();
        expect(screen.getByText('Database chatbot')).toBeTruthy();
    });

    it('calls onTabChange with "chatbot" when chatbot tab is clicked', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="wizard" onTabChange={onTabChange} />
            </Provider>
        );
        fireEvent.click(screen.getByText('Database chatbot').closest('div')!);
        expect(onTabChange).toHaveBeenCalledWith('chatbot');
    });

    it('calls onTabChange with "wizard" when wizard tab is clicked', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="chatbot" onTabChange={onTabChange} />
            </Provider>
        );
        fireEvent.click(screen.getByText('Database wizard').closest('div')!);
        expect(onTabChange).toHaveBeenCalledWith('wizard');
    });

    it('shows dark theme wizard selected icon when isDarkTheme and wizard selected', () => {
        const store = makeStore(true);
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="wizard" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByTestId('wizard-selected-light')).toBeTruthy();
    });

    it('shows dark theme wizard unselected icon when isDarkTheme and chatbot selected', () => {
        const store = makeStore(true);
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="chatbot" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByTestId('wizard-icon')).toBeTruthy();
    });

    it('shows light theme wizard selected icon when not dark and wizard selected', () => {
        const store = makeStore(false);
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="wizard" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByTestId('wizard-selected-light-mode')).toBeTruthy();
    });

    it('shows light theme wizard unselected icon when not dark and chatbot selected', () => {
        const store = makeStore(false);
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="chatbot" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByTestId('wizard-unselected-light-mode')).toBeTruthy();
    });

    it('shows dark chatbot not selected icon when dark theme and wizard selected', () => {
        const store = makeStore(true);
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="wizard" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByTestId('chatbot-dark-not-selected')).toBeTruthy();
    });

    it('shows dark chatbot selected icon when dark theme and chatbot selected', () => {
        const store = makeStore(true);
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="chatbot" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByTestId('chatbot-dark-selected')).toBeTruthy();
    });

    it('shows chatbot icon in light theme when chatbot selected', () => {
        const store = makeStore(false);
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="chatbot" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByTestId('chatbot-icon')).toBeTruthy();
    });

    it('shows chatbot light mode not selected icon in light theme when wizard selected', () => {
        const store = makeStore(false);
        render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="wizard" onTabChange={onTabChange} />
            </Provider>
        );
        expect(screen.getByTestId('chatbot-light-not-selected')).toBeTruthy();
    });

    it('chatbot tab has correct id', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <DeploymentTabs selectedTab="wizard" onTabChange={onTabChange} />
            </Provider>
        );
        expect(container.querySelector('#chatbot-tab')).toBeTruthy();
    });
});
