import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Diagram from './Diagram';

vi.mock('@netapp/design-system', () => ({
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>,
    Typography: ({ children, variant, className }: any) => (
        <span data-testid="typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

vi.mock('../../../../assets/FCI_Darkmode.svg', () => ({
    ReactComponent: () => <svg data-testid="fci-dark-icon" />
}));

vi.mock('../../../../assets/FCI_lightMode.svg', () => ({
    ReactComponent: () => <svg data-testid="fci-light-icon" />
}));

vi.mock('../../../../assets/Standalone_darkmode.svg', () => ({
    ReactComponent: () => <svg data-testid="standalone-dark-icon" />
}));

vi.mock('../../../../assets/Standalone_lightMode.svg', () => ({
    ReactComponent: () => <svg data-testid="standalone-light-icon" />
}));

vi.mock('./Diagram.module.scss', () => ({
    default: {
        diagram: 'diagram',
        hideDiagram: 'hideDiagram',
        headSection: 'headSection',
        title: 'title',
        disabledColor: 'disabledColor',
        centerContainer: 'centerContainer'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        TOPOLOGY: 'Topology',
        NOT_AVAILABLE: 'N/A'
    }
}));

const createMockStore = (resourceState: any = {}, authState: any = {}) =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                resourceLoading: false,
                resourceDetails: {
                    topology: { serverInstallationMode: 'Standalone' }
                },
                ...resourceState
            }),
            auth: () => ({
                features: { active: { 'Platform.BlueXP/DarkTheme': false } },
                ...authState
            })
        }
    });

describe('Diagram', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render topology title', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.getByText('Topology')).toBeTruthy();
    });

    it('should show FlashingDotsLoader when loading', () => {
        const store = createMockStore({ resourceLoading: true });
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('should NOT show FlashingDotsLoader when not loading', () => {
        const store = createMockStore({ resourceLoading: false });
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('should show N/A text when serverInstallationMode is empty and not loading', () => {
        const store = createMockStore({
            resourceLoading: false,
            resourceDetails: { topology: { serverInstallationMode: '' } }
        });
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.getByText('N/A')).toBeTruthy();
    });

    it('should render FCI light mode diagram when mode is fci and not dark theme', () => {
        const store = createMockStore({
            resourceLoading: false,
            resourceDetails: { topology: { serverInstallationMode: 'FCI' } }
        });
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.getByTestId('fci-light-icon')).toBeTruthy();
    });

    it('should render FCI dark mode diagram when mode is fci and dark theme', () => {
        const store = createMockStore(
            {
                resourceLoading: false,
                resourceDetails: { topology: { serverInstallationMode: 'FCI' } }
            },
            { features: { active: { 'Platform.BlueXP/DarkTheme': true } } }
        );
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.getByTestId('fci-dark-icon')).toBeTruthy();
    });

    it('should render Standalone light mode when mode is standalone and not dark theme', () => {
        const store = createMockStore({
            resourceLoading: false,
            resourceDetails: { topology: { serverInstallationMode: 'Standalone' } }
        });
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.getByTestId('standalone-light-icon')).toBeTruthy();
    });

    it('should render Standalone dark mode when mode is standalone and dark theme', () => {
        const store = createMockStore(
            {
                resourceLoading: false,
                resourceDetails: { topology: { serverInstallationMode: 'Standalone' } }
            },
            { features: { active: { 'Platform.BlueXP/DarkTheme': true } } }
        );
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.getByTestId('standalone-dark-icon')).toBeTruthy();
    });

    it('should apply hideDiagram class when loading', () => {
        const store = createMockStore({ resourceLoading: true });
        const { container } = render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(container.querySelector('.hideDiagram')).toBeTruthy();
    });

    it('should apply hideDiagram class when serverInstallationMode is empty', () => {
        const store = createMockStore({
            resourceLoading: false,
            resourceDetails: { topology: { serverInstallationMode: '' } }
        });
        const { container } = render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(container.querySelector('.hideDiagram')).toBeTruthy();
    });

    it('should NOT apply hideDiagram class when loaded with valid mode', () => {
        const store = createMockStore({
            resourceLoading: false,
            resourceDetails: { topology: { serverInstallationMode: 'Standalone' } }
        });
        const { container } = render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(container.querySelector('.hideDiagram')).toBeNull();
    });

    it('should NOT render any diagram when mode is neither fci nor standalone', () => {
        const store = createMockStore({
            resourceLoading: false,
            resourceDetails: { topology: { serverInstallationMode: 'Unknown' } }
        });
        render(
            <Provider store={store}>
                <Diagram />
            </Provider>
        );
        expect(screen.queryByTestId('fci-light-icon')).toBeNull();
        expect(screen.queryByTestId('standalone-light-icon')).toBeNull();
    });
});
