import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SandboxChart from './SandboxChart';

// Mock chart.js
vi.mock('chart.js', () => {
    const mockChart = vi.fn(() => ({
        destroy: vi.fn(),
        update: vi.fn()
    }));
    (mockChart as any).register = vi.fn();
    return {
        Chart: mockChart,
        registerables: []
    };
});

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../SandboxUtility', () => ({
    getSandboxDistributionByAge: vi.fn(() => ({
        '0-30': 3,
        '31-60': 2,
        '61+': 1
    }))
}));

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>,
    Typography: ({ children, variant, className, style }: any) => (
        <div data-testid="typography" data-variant={variant} className={className} style={style}>
            {children}
        </div>
    )
}));

vi.mock('./SandboxChart.module.scss', () => ({
    default: {
        sandboxChart: 'sandboxChart',
        'center-text': 'center-text',
        emptyCircle: 'emptyCircle'
    }
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        notAvailable: 'notAvailable'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        SANDBOXES: 'Sandboxes'
    }
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        headers: {
            showNA: false,
            ...overrides.headers
        }
    };

    return configureStore({
        reducer: {
            headers: () => defaultState.headers
        }
    });
};

describe('SandboxChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render count when not loading and not NA', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[{ id: '1' }, { id: '2' }]} loading={false} />
                </Provider>
            );

            expect(screen.getByText('2')).toBeTruthy();
        });

        it('should render "Sandboxes" label', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[]} loading={false} />
                </Provider>
            );

            expect(screen.getByText('Sandboxes')).toBeTruthy();
        });

        it('should show FlashingDotsLoader when loading', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[]} loading />
                </Provider>
            );

            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
        });

        it('should NOT show FlashingDotsLoader when not loading', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[]} loading={false} />
                </Provider>
            );

            expect(screen.queryByTestId('flashing-dots-loader')).toBeFalsy();
        });

        it('should show NA text when showNA is true', () => {
            const store = createMockStore({ headers: { showNA: true } });

            render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[]} loading={false} />
                </Provider>
            );

            expect(screen.getByText('databases.general.not-available')).toBeTruthy();
        });

        it('should NOT show count when showNA is true', () => {
            const store = createMockStore({ headers: { showNA: true } });

            render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[{ id: '1' }]} loading={false} />
                </Provider>
            );

            expect(screen.queryByText('1')).toBeFalsy();
        });

        it('should render emptyCircle when list is empty', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[]} loading={false} />
                </Provider>
            );

            expect(container.querySelector('.emptyCircle')).toBeTruthy();
        });

        it('should render emptyCircle when showNA is true', () => {
            const store = createMockStore({ headers: { showNA: true } });

            const { container } = render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[{ id: '1' }]} loading={false} />
                </Provider>
            );

            expect(container.querySelector('.emptyCircle')).toBeTruthy();
        });

        it('should render canvas when list has items and not NA', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[{ id: '1' }]} loading={false} />
                </Provider>
            );

            expect(container.querySelector('#chart-area')).toBeTruthy();
        });

        it('should NOT render canvas when list is empty', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <SandboxChart aggregatedSandboxList={[]} loading={false} />
                </Provider>
            );

            expect(container.querySelector('#chart-area')).toBeFalsy();
        });
    });
});
