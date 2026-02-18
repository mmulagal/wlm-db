import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SourceInformation from './SourceInformation';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('../assets/Source.svg', () => ({
    ReactComponent: () => <svg data-testid="source-icon" />
}));

vi.mock('../assets/Sandbox.svg', () => ({
    ReactComponent: () => <svg data-testid="sandbox-icon" />
}));

// Mock the relative paths from SourceInformation.tsx
vi.mock('../../../assets/Source.svg', () => ({
    ReactComponent: () => <svg data-testid="source-icon" />
}));

vi.mock('../../../assets/Sandbox.svg', () => ({
    ReactComponent: () => <svg data-testid="sandbox-icon" />
}));

vi.mock('../SandboxUtility', () => ({
    getUniqueSourceDatabasesCount: vi.fn(() => 5)
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className, style }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className} style={style}>
            {children}
        </div>
    ),
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>
}));

vi.mock('./SourceInformation.module.scss', () => ({
    default: {
        sourceInformation: 'sourceInformation',
        wrapperContainer: 'wrapperContainer',
        insideContainer: 'insideContainer',
        loadingContainer: 'loadingContainer'
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
        SANDBOX_SOURCE_DATABASES: 'Source Databases',
        SANDBOXES: 'Sandboxes'
    }
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        sandbox: {
            getSandboxList: { sandboxListLoading: false },
            aggregatedSandboxList: [],
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

describe('SourceInformation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render source database count when not loading and not NA', () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxList: { sandboxListLoading: false },
                    aggregatedSandboxList: [{ id: '1' }, { id: '2' }, { id: '3' }]
                }
            });

            render(
                <Provider store={store}>
                    <SourceInformation />
                </Provider>
            );

            expect(screen.getByText('5')).toBeTruthy(); // mocked getUniqueSourceDatabasesCount returns 5
        });

        it('should render sandbox count when not loading and not NA', () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxList: { sandboxListLoading: false },
                    aggregatedSandboxList: [{ id: '1' }, { id: '2' }, { id: '3' }]
                }
            });

            render(
                <Provider store={store}>
                    <SourceInformation />
                </Provider>
            );

            expect(screen.getByText('3')).toBeTruthy();
        });

        it('should render FlashingDotsLoader when loading', () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxList: { sandboxListLoading: true },
                    aggregatedSandboxList: []
                }
            });

            render(
                <Provider store={store}>
                    <SourceInformation />
                </Provider>
            );

            const loaders = screen.getAllByTestId('flashing-dots-loader');
            expect(loaders.length).toBeGreaterThan(0);
        });

        it('should NOT render count when loading is true', async () => {
            const { getUniqueSourceDatabasesCount } = await import('../SandboxUtility');
            (getUniqueSourceDatabasesCount as any).mockReturnValue(5);

            const store = createMockStore({
                sandbox: {
                    getSandboxList: { sandboxListLoading: true },
                    aggregatedSandboxList: []
                }
            });

            render(
                <Provider store={store}>
                    <SourceInformation />
                </Provider>
            );

            // The count should not be shown when loading
            expect(screen.queryByText('5')).toBeFalsy();
        });

        it('should show "not-available" text when showNA is true', () => {
            const store = createMockStore({
                headers: { showNA: true }
            });

            render(
                <Provider store={store}>
                    <SourceInformation />
                </Provider>
            );

            const naTexts = screen.getAllByText('databases.general.not-available');
            expect(naTexts.length).toBeGreaterThan(0);
        });

        it('should NOT show "not-available" text when showNA is false', () => {
            const store = createMockStore({
                headers: { showNA: false }
            });

            render(
                <Provider store={store}>
                    <SourceInformation />
                </Provider>
            );

            expect(screen.queryByText('databases.general.not-available')).toBeFalsy();
        });

        it('should render Source Databases and Sandboxes labels', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SourceInformation />
                </Provider>
            );

            expect(screen.getByText('Source Databases')).toBeTruthy();
            expect(screen.getByText('Sandboxes')).toBeTruthy();
        });
    });
});
