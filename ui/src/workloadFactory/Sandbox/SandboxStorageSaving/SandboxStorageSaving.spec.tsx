import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SandboxStorageSaving from './SandboxStorageSaving';

import useResize from '../../../common/hooks/useResize';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1500, height: 800 }))
}));

vi.mock('../../../assets/Savings.svg', () => ({
    ReactComponent: () => <svg data-testid="savings-icon" />
}));

vi.mock('../../../utils/utilityFunctions', () => ({
    formatSize: vi.fn(val => (val ? `${val} GB` : '0 GB'))
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className} style={style}>
            {children}
        </div>
    ),
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>
}));

vi.mock('./SandboxStorageSaving.module.scss', () => ({
    default: {
        sandboxStorageSaving: 'sandboxStorageSaving',
        largeContainer: 'largeContainer',
        smallContainer: 'smallContainer',
        firstSegment: 'firstSegment',
        setWidth: 'setWidth',
        leftSection: 'leftSection',
        rightSection: 'rightSection',
        progressBar: 'progressBar',
        progress: 'progress',
        leftCurveBar: 'leftCurveBar',
        rightCurveBar: 'rightCurveBar',
        separator: 'separator',
        secondSegment: 'secondSegment',
        secondRow: 'secondRow',
        bottomRow: 'bottomRow',
        square: 'square',
        loadingContainer: 'loadingContainer',
        consumedSaving: 'consumedSaving',
        valueContainer: 'valueContainer',
        setUnit: 'setUnit'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: {
        notAvailable: 'notAvailable',
        notAvailableInformation: 'notAvailableInformation'
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        SANDBOX_CONSUMED_STORAGE: 'Consumed Storage',
        SANDBOX_STORAGE_SAVINGS: 'Storage Savings',
        SAVINGS: 'Savings',
        SANDBOX_SAVINGS: 'Sandbox Savings',
        SANDBOX_CONSUMED_SAVING: 'Consumed Saving'
    }
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        sandbox: {
            getSandboxSavings: {
                sandboxSavingsLoading: false,
                sandboxSavings: {
                    sandboxSavingsPercentage: 40,
                    consumedStorage: 500,
                    savedStorage: 300
                },
                ...overrides.getSandboxSavings
            },
            ...overrides.sandbox
        },
        headers: {
            showNA: false,
            ...overrides.headers
        }
    };

    return configureStore({
        reducer: {
            sandbox: () => defaultState.sandbox,
            headers: () => defaultState.headers
        }
    });
};

describe('SandboxStorageSaving', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Large screen (width > 1428)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1500, height: 800 });
        });

        it('should render savings percentage', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            expect(screen.getByText('40%')).toBeTruthy();
        });

        it('should show <5% when percentage is less than 5', () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxSavings: {
                        sandboxSavingsLoading: false,
                        sandboxSavings: { sandboxSavingsPercentage: 3, consumedStorage: 100, savedStorage: 20 }
                    }
                }
            });

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            expect(screen.getByText('<5%')).toBeTruthy();
        });

        it('should show loading spinner when loading', () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxSavings: {
                        sandboxSavingsLoading: true,
                        sandboxSavings: null
                    }
                }
            });

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            expect(screen.getAllByTestId('flashing-dots-loader').length).toBeGreaterThan(0);
        });

        it('should render progress bar with correct width when not NA', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            expect(container.querySelector('.progressBar')).toBeTruthy();
        });

        it('should render gray progress bar when savings percentage is 0', () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxSavings: {
                        sandboxSavingsLoading: false,
                        sandboxSavings: { sandboxSavingsPercentage: 0, consumedStorage: 0, savedStorage: 0 }
                    }
                }
            });

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            expect(screen.getByText('<5%')).toBeTruthy();
        });

        it('should show NA state when showNA is true', () => {
            const store = createMockStore({ headers: { showNA: true } });

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            const naTexts = screen.getAllByText('databases.general.not-available');
            expect(naTexts.length).toBeGreaterThan(0);
        });

        it('should show wide screen text when width > 1872', () => {
            (useResize as any).mockReturnValue({ width: 1900, height: 800 });
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            expect(screen.getByText('Storage Savings')).toBeTruthy();
        });

        it('should show abbreviated savings text when width <= 1872', () => {
            (useResize as any).mockReturnValue({ width: 1500, height: 800 });
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            expect(screen.getByText('Savings')).toBeTruthy();
        });
    });

    describe('Small screen (width <= 1428)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1200, height: 800 });
        });

        it('should render small container', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            expect(container.querySelector('.smallContainer')).toBeTruthy();
        });

        it('should show loading spinner when loading in small screen', () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxSavings: {
                        sandboxSavingsLoading: true,
                        sandboxSavings: null
                    }
                }
            });

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            const loaders = screen.getAllByTestId('flashing-dots-loader');
            expect(loaders.length).toBeGreaterThan(0);
        });

        it('should show NA state in small container', () => {
            const store = createMockStore({ headers: { showNA: true } });

            render(
                <Provider store={store}>
                    <SandboxStorageSaving />
                </Provider>
            );

            const naTexts = screen.getAllByText('databases.general.not-available');
            expect(naTexts.length).toBeGreaterThan(0);
        });
    });
});
