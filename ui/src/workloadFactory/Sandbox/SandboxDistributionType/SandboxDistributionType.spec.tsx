import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SandboxDistributionType from './SandboxDistributionType';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../assets/Dev.svg', () => ({ ReactComponent: () => <svg data-testid="dev-icon" /> }));
vi.mock('../../../assets/Other.svg', () => ({ ReactComponent: () => <svg data-testid="other-icon" /> }));
vi.mock('../../../assets/Analytics.svg', () => ({ ReactComponent: () => <svg data-testid="analytics-icon" /> }));
vi.mock('../../../assets/Integration.svg', () => ({ ReactComponent: () => <svg data-testid="integration-icon" /> }));
vi.mock('../../../assets/QA.svg', () => ({ ReactComponent: () => <svg data-testid="qa-icon" /> }));
vi.mock('../../../assets/Testing.svg', () => ({ ReactComponent: () => <svg data-testid="testing-icon" /> }));

vi.mock('../../../common/ProgressBar/ProgressBar', () => ({
    default: ({ max, value, color }: any) => (
        <div data-testid="progress-bar" data-max={max} data-value={value} data-color={color} />
    )
}));

vi.mock('../SandboxUtility', () => ({
    getSandboxDistributionByTag: vi.fn(() => ({
        Development: 4,
        Training: 2,
        QA: 3,
        Analytics: 1,
        Integration: 2,
        Other: 0
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

vi.mock('./SandboxDistributionType.module.scss', () => ({
    default: {
        sandboxType: 'sandboxType',
        headSection: 'headSection',
        title: 'title',
        mainSection: 'mainSection',
        leftSide: 'leftSide',
        rightSide: 'rightSide',
        singleSection: 'singleSection',
        QASvg: 'QASvg',
        valueSection: 'valueSection',
        topRow: 'topRow',
        name: 'name',
        value: 'value',
        progressStyle: 'progressStyle'
    }
}));

vi.mock('../../../utils/CommonStyles.module.scss', () => ({
    default: {
        circleSVG: 'circleSVG',
        notAvailable: 'notAvailable'
    }
}));

vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        DISTRIBUTION_BY_TAG: 'Distribution by Tag',
        DEVELOPMENT: 'Development',
        QA: 'QA',
        INTEGRATION: 'Integration',
        TRAINING: 'Training',
        ANALYTICS: 'Analytics',
        SANDBOX_OTHER: 'Other'
    }
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        sandbox: {
            aggregatedSandboxList: [],
            getSandboxList: { sandboxListLoading: false },
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

describe('SandboxDistributionType', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render the title', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );
            expect(screen.getByText('Distribution by Tag')).toBeTruthy();
        });

        it('should render all tag categories', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );

            expect(screen.getByText('Development')).toBeTruthy();
            expect(screen.getByText('QA')).toBeTruthy();
            expect(screen.getByText('Integration')).toBeTruthy();
            expect(screen.getByText('Training')).toBeTruthy();
            expect(screen.getByText('Analytics')).toBeTruthy();
            expect(screen.getByText('Other')).toBeTruthy();
        });

        it('should render FlashingDotsLoader when loading', () => {
            const store = createMockStore({
                sandbox: { aggregatedSandboxList: [], getSandboxList: { sandboxListLoading: true } }
            });

            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );
            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
        });

        it('should NOT render FlashingDotsLoader when not loading', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );
            expect(screen.queryByTestId('flashing-dots-loader')).toBeFalsy();
        });

        it('should show distribution counts when not NA', () => {
            const store = createMockStore({ headers: { showNA: false } });
            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );

            expect(screen.getByText('4')).toBeTruthy(); // Development
            expect(screen.getByText('3')).toBeTruthy(); // QA
            expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Training and Integration both have 2
        });

        it('should show NA text when showNA is true', () => {
            const store = createMockStore({ headers: { showNA: true } });
            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );

            const naTexts = screen.getAllByText('databases.general.not-available');
            expect(naTexts.length).toBeGreaterThan(0);
        });

        it('should NOT show distribution counts when showNA is true', () => {
            const store = createMockStore({ headers: { showNA: true } });
            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );

            expect(screen.queryByText('4')).toBeFalsy();
        });

        it('should render progress bars', () => {
            const store = createMockStore();
            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );

            const progressBars = screen.getAllByTestId('progress-bar');
            expect(progressBars.length).toBe(6);
        });

        it('should set progress bar value to 0 when loading', () => {
            const store = createMockStore({
                sandbox: { aggregatedSandboxList: [{ id: '1' }], getSandboxList: { sandboxListLoading: true } }
            });

            render(
                <Provider store={store}>
                    <SandboxDistributionType />
                </Provider>
            );

            const progressBars = screen.getAllByTestId('progress-bar');
            progressBars.forEach(bar => {
                expect(bar.getAttribute('data-value')).toBe('0');
            });
        });
    });
});
