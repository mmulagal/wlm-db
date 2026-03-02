import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DBOverviewProtection from './DBOverviewProtection';
import useResize from '../../../../common/hooks/useResize';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant }: any) => (
        <span data-testid="ds-typography" data-variant={variant}>
            {children}
        </span>
    ),
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>,
    Typography: ({ children, variant, className }: any) => (
        <span data-testid="typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

vi.mock('../../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1900, height: 800 }))
}));

vi.mock('../../../DatabaseHomePage/MultiRingDoughnut/MultiRingDoughnut', () => ({
    default: ({ hostData }: any) => <div data-testid="multi-ring-doughnut">{JSON.stringify(hostData)}</div>
}));

vi.mock('../../../DatabaseHomePage/SquareComponent/SquareComponent', () => ({
    default: ({ value, text }: any) => (
        <div data-testid="square-component">
            {value} - {text}
        </div>
    )
}));

vi.mock('../../../../utils/utilityFunctions', () => ({
    getAggrProtection: vi.fn(() => ({ protectedDb: 3, unprotectedDb: 2 }))
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        DB_HOST_PROTECTION: 'DB Host Protection'
    }
}));

vi.mock('./DBOverviewProtection.module.scss', () => ({
    default: {
        dbOverviewProtection: 'dbOverviewProtection',
        dbOverviewProtectionSmallScreen: 'dbOverviewProtectionSmallScreen',
        headSection: 'headSection',
        title: 'title',
        mainContainer: 'mainContainer',
        chartContainer: 'chartContainer',
        protectionSeparator: 'protectionSeparator',
        textSection: 'textSection',
        dbHostSeparator: 'dbHostSeparator',
        textAreaSection: 'textAreaSection'
    }
}));

const createMockStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            workloadFactoryResource: () => ({
                databaseList: [],
                databaseListLoading: false,
                ...overrides
            })
        }
    });

describe('DBOverviewProtection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Large screen (width > 1800)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1900, height: 800 });
        });

        it('should render protection title', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            expect(screen.getByText('DB Host Protection')).toBeTruthy();
        });

        it('should render MultiRingDoughnut chart', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            expect(screen.getByTestId('multi-ring-doughnut')).toBeTruthy();
        });

        it('should render Protected SquareComponent', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            const squares = screen.getAllByTestId('square-component');
            expect(squares.some(s => s.textContent?.includes('Protected'))).toBe(true);
        });

        it('should render Unprotected SquareComponent', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            const squares = screen.getAllByTestId('square-component');
            expect(squares.some(s => s.textContent?.includes('Unprotected'))).toBe(true);
        });

        it('should show FlashingDotsLoader when databaseListLoading is true', () => {
            const store = createMockStore({ databaseListLoading: true });
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
        });

        it('should NOT show loader when databaseListLoading is false', () => {
            const store = createMockStore({ databaseListLoading: false });
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
        });

        it('should render db counts in square components', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            expect(screen.getByText('3 Databases - Protected')).toBeTruthy();
            expect(screen.getByText('2 Databases - Unprotected')).toBeTruthy();
        });
    });

    describe('Small screen (width <= 1800)', () => {
        beforeEach(() => {
            (useResize as any).mockReturnValue({ width: 1400, height: 800 });
        });

        it('should render small screen container', () => {
            const store = createMockStore();
            const { container } = render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            expect(container.querySelector('.dbOverviewProtectionSmallScreen')).toBeTruthy();
        });

        it('should render "Protection distribution" text on small screen', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            expect(screen.getByText('Protection distribution')).toBeTruthy();
        });

        it('should show loader on small screen when loading', () => {
            const store = createMockStore({ databaseListLoading: true });
            render(
                <Provider store={store}>
                    <DBOverviewProtection />
                </Provider>
            );
            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
        });
    });
});
