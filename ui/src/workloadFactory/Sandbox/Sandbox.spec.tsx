import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Sandbox from './Sandbox';

// Mock SandboxApis
vi.mock('./SandboxApis', () => ({
    default: vi.fn(() => null)
}));

// Mock child components
vi.mock('./SandboxHeader/SandboxHeader', () => ({
    default: () => <div data-testid="sandbox-header">SandboxHeader</div>
}));

vi.mock('./SourceInformation/SourceInformation', () => ({
    default: () => <div data-testid="source-information">SourceInformation</div>
}));

vi.mock('./SandboxStorageSaving/SandboxStorageSaving', () => ({
    default: () => <div data-testid="sandbox-storage-saving">SandboxStorageSaving</div>
}));

vi.mock('./SandboxDistributionDate/SandboxDistributionDate', () => ({
    default: () => <div data-testid="sandbox-distribution-date">SandboxDistributionDate</div>
}));

vi.mock('./SandboxDistributionType/SandboxDistributionType', () => ({
    default: () => <div data-testid="sandbox-distribution-type">SandboxDistributionType</div>
}));

vi.mock('./SandboxTable/SandboxTable', () => ({
    default: () => <div data-testid="sandbox-table">SandboxTable</div>
}));

vi.mock('@netapp/design-system', () => ({
    Spinner: ({ isLarge }: any) => (
        <div data-testid="spinner" data-large={isLarge}>
            Spinner
        </div>
    )
}));

vi.mock('./Sandbox.module.scss', () => ({
    default: {
        sandbox: 'sandbox',
        loaderOverlay: 'loaderOverlay',
        spinnerPlacement: 'spinnerPlacement',
        sandboxSecondLevel: 'sandboxSecondLevel'
    }
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        sandbox: {
            showBanner: false,
            connectionInfoLoading: false,
            splitEstimateLoading: false,
            ...overrides.sandbox
        }
    };

    return configureStore({
        reducer: {
            sandbox: () => defaultState.sandbox
        }
    });
};

describe('Sandbox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render all child components', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <Sandbox />
                </Provider>
            );

            expect(screen.getByTestId('source-information')).toBeTruthy();
            expect(screen.getByTestId('sandbox-storage-saving')).toBeTruthy();
            expect(screen.getByTestId('sandbox-distribution-date')).toBeTruthy();
            expect(screen.getByTestId('sandbox-distribution-type')).toBeTruthy();
            expect(screen.getByTestId('sandbox-table')).toBeTruthy();
        });

        it('should NOT render SandboxHeader when showBanner is false', () => {
            const store = createMockStore({ sandbox: { showBanner: false } });

            render(
                <Provider store={store}>
                    <Sandbox />
                </Provider>
            );

            expect(screen.queryByTestId('sandbox-header')).toBeFalsy();
        });

        it('should render SandboxHeader when showBanner is true', () => {
            const store = createMockStore({ sandbox: { showBanner: true } });

            render(
                <Provider store={store}>
                    <Sandbox />
                </Provider>
            );

            expect(screen.getByTestId('sandbox-header')).toBeTruthy();
        });

        it('should NOT render Spinner when connectionInfoLoading and splitEstimateLoading are both false', () => {
            const store = createMockStore({
                sandbox: { connectionInfoLoading: false, splitEstimateLoading: false }
            });

            render(
                <Provider store={store}>
                    <Sandbox />
                </Provider>
            );

            expect(screen.queryByTestId('spinner')).toBeFalsy();
        });

        it('should render Spinner when connectionInfoLoading is true', () => {
            const store = createMockStore({
                sandbox: { connectionInfoLoading: true, splitEstimateLoading: false }
            });

            render(
                <Provider store={store}>
                    <Sandbox />
                </Provider>
            );

            expect(screen.getByTestId('spinner')).toBeTruthy();
        });

        it('should render Spinner when splitEstimateLoading is true', () => {
            const store = createMockStore({
                sandbox: { connectionInfoLoading: false, splitEstimateLoading: true }
            });

            render(
                <Provider store={store}>
                    <Sandbox />
                </Provider>
            );

            expect(screen.getByTestId('spinner')).toBeTruthy();
        });

        it('should render Spinner with isLarge when loading', () => {
            const store = createMockStore({
                sandbox: { connectionInfoLoading: true, splitEstimateLoading: false }
            });

            render(
                <Provider store={store}>
                    <Sandbox />
                </Provider>
            );

            const spinner = screen.getByTestId('spinner');
            expect(spinner.getAttribute('data-large')).toBe('true');
        });
    });

    describe('Layout', () => {
        it('should render two sandboxSecondLevel sections', () => {
            const store = createMockStore();
            const { container } = render(
                <Provider store={store}>
                    <Sandbox />
                </Provider>
            );
            const secondLevelSections = container.querySelectorAll('.sandboxSecondLevel');
            expect(secondLevelSections.length).toBe(2);
        });
    });
});
