import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SandboxDistributionDate from './SandboxDistributionDate';

import useResize from '../../../common/hooks/useResize';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../common/hooks/useResize', () => ({
    default: vi.fn(() => ({ width: 1500, height: 800 }))
}));

vi.mock('./SandboxChart/SandboxChart', () => ({
    default: ({ aggregatedSandboxList, loading }: any) => (
        <div data-testid="sandbox-chart" data-loading={loading} data-count={aggregatedSandboxList?.length}>
            SandboxChart
        </div>
    )
}));

vi.mock('../SandboxUtility', () => ({
    getSandboxDistributionByAge: vi.fn(() => ({
        '0-30': 5,
        '31-60': 3,
        '61+': 2
    }))
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className}>
            {children}
        </div>
    ),
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>
}));

vi.mock('./SandboxDistributionDate.module.scss', () => ({
    default: {
        sandboxDate: 'sandboxDate',
        headSection: 'headSection',
        title: 'title',
        mainSection: 'mainSection',
        rightSide: 'rightSide',
        individualRow: 'individualRow',
        square: 'square',
        days: 'days',
        separator: 'separator'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: {
        notAvailable: 'notAvailable'
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        SANDBOXES_DISTRIBUTION_BY_AGE: 'Sandboxes Distribution by Age',
        ONE_THIRTY_DAYS: '1-30 days',
        THIRTY_SIXTY_DAYS: '31-60 days',
        SIXTY_PLUS_DAYS: '61+ days',
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

describe('SandboxDistributionDate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useResize as any).mockReturnValue({ width: 1500, height: 800 });
    });

    describe('Rendering', () => {
        it('should render the title', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxDistributionDate />
                </Provider>
            );

            expect(screen.getByText('Sandboxes Distribution by Age')).toBeTruthy();
        });

        it('should render SandboxChart component', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxDistributionDate />
                </Provider>
            );

            expect(screen.getByTestId('sandbox-chart')).toBeTruthy();
        });

        it('should render FlashingDotsLoader when loading', () => {
            const store = createMockStore({
                sandbox: { getSandboxList: { sandboxListLoading: true }, aggregatedSandboxList: [] }
            });

            render(
                <Provider store={store}>
                    <SandboxDistributionDate />
                </Provider>
            );

            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
        });

        it('should NOT render FlashingDotsLoader when not loading', () => {
            const store = createMockStore({
                sandbox: { getSandboxList: { sandboxListLoading: false }, aggregatedSandboxList: [] }
            });

            render(
                <Provider store={store}>
                    <SandboxDistributionDate />
                </Provider>
            );

            expect(screen.queryByTestId('flashing-dots-loader')).toBeFalsy();
        });

        it('should render 1-30, 31-60 and 61+ day labels', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <SandboxDistributionDate />
                </Provider>
            );

            expect(screen.getByText('1-30 days')).toBeTruthy();
            expect(screen.getByText('31-60 days')).toBeTruthy();
            expect(screen.getByText('61+ days')).toBeTruthy();
        });

        it('should show sandbox counts when not NA and width > 1428', () => {
            const store = createMockStore({ headers: { showNA: false } });

            render(
                <Provider store={store}>
                    <SandboxDistributionDate />
                </Provider>
            );

            expect(screen.getByText('5 Sandboxes')).toBeTruthy();
            expect(screen.getByText('3 Sandboxes')).toBeTruthy();
            expect(screen.getByText('2 Sandboxes')).toBeTruthy();
        });

        it('should show count in parentheses when width <= 1428', () => {
            (useResize as any).mockReturnValue({ width: 1200, height: 800 });
            const store = createMockStore({ headers: { showNA: false } });

            render(
                <Provider store={store}>
                    <SandboxDistributionDate />
                </Provider>
            );

            expect(screen.getByText('(5)')).toBeTruthy();
            expect(screen.getByText('(3)')).toBeTruthy();
            expect(screen.getByText('(2)')).toBeTruthy();
        });

        it('should show NA text when showNA is true', () => {
            const store = createMockStore({ headers: { showNA: true } });

            render(
                <Provider store={store}>
                    <SandboxDistributionDate />
                </Provider>
            );

            const naTexts = screen.getAllByText('databases.general.not-available');
            expect(naTexts.length).toBeGreaterThan(0);
        });
    });
});
