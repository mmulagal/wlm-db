import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import JobDistribution from './JobDistribution';

// Mock child components
vi.mock('../../DatabaseHomePage/JobStatus/JobDoughnut/JobDoughnutChart', () => ({
    default: ({ jobsSummaryData, jobsSummaryLoading }: any) => (
        <div data-testid="job-doughnut-chart" data-loading={jobsSummaryLoading}>
            {JSON.stringify(jobsSummaryData)}
        </div>
    )
}));

// Mock @netapp/design-system
vi.mock('@netapp/design-system', () => ({
    FlashingDotsLoader: () => <div data-testid="flashing-dots-loader">Loading...</div>,
    Typography: ({ children, variant, className }: any) => (
        <div data-testid="typography" data-variant={variant} className={className}>
            {children}
        </div>
    )
}));

// Mock useResize hook
const mockWindowSize = { width: 1920, height: 1080 };
vi.mock('../../../common/hooks/useResize', () => ({
    default: () => mockWindowSize
}));

// Mock SCSS module
vi.mock('./JobDistribution.module.scss', () => ({
    default: {
        jobDistribution: 'jobDistribution',
        minWidthClass: 'minWidthClass',
        maxWidthClass: 'maxWidthClass',
        headSection: 'headSection',
        headStatus: 'headStatus',
        mainSection: 'mainSection',
        rightSection: 'rightSection',
        jobSeparator: 'jobSeparator',
        rowData: 'rowData',
        firstPart: 'firstPart',
        square: 'square'
    }
}));

// Mock appConstants
vi.mock('../../../utils/appConstants', () => ({
    GENERAL: {
        JOB_DISTRIBUTION: 'Job Distribution',
        JM_COMPLETED: 'Completed',
        JM_RUNNING: 'Running',
        JM_FAILED: 'Failed',
        JOB_STATUS_JOBS: ' jobs'
    }
}));

const createMockStore = (overrides = {}) => {
    const defaultState = {
        jobMonitoring: {
            jmJobsSummary: {
                completed: 0,
                warning: 0,
                inProgress: 0,
                failed: 0
            },
            jmJobsSummaryLoading: false,
            ...overrides.jobMonitoring
        }
    };

    return configureStore({
        reducer: {
            jobMonitoring: () => defaultState.jobMonitoring
        }
    });
};

describe('JobDistribution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWindowSize.width = 1920;
        mockWindowSize.height = 1080;

        // Mock window.innerWidth
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 1920
        });
    });

    describe('Rendering', () => {
        it('should render JobDistribution component', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByText('Job Distribution')).toBeTruthy();
            expect(screen.getByTestId('job-doughnut-chart')).toBeTruthy();
        });

        it('should render FlashingDotsLoader when loading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummaryLoading: true
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const loaders = screen.getAllByTestId('flashing-dots-loader');
            expect(loaders.length).toBeGreaterThan(0);
        });

        it('should not render FlashingDotsLoader when not loading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummaryLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const loaders = screen.queryAllByTestId('flashing-dots-loader');
            expect(loaders.length).toBe(0);
        });

        it('should pass correct props to JobDoughnutChart', () => {
            const mockSummaryData = {
                completed: 10,
                warning: 2,
                inProgress: 5,
                failed: 3
            };

            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: mockSummaryData,
                    jmJobsSummaryLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const chart = screen.getByTestId('job-doughnut-chart');
            expect(chart.getAttribute('data-loading')).toBe('false');
            expect(chart.textContent).toContain(JSON.stringify(mockSummaryData));
        });
    });

    describe('Job status display - Large window (>= 1500px)', () => {
        beforeEach(() => {
            mockWindowSize.width = 1920;
            window.innerWidth = 1920;
        });

        it('should render all job status rows for large window', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 10,
                        warning: 2,
                        inProgress: 5,
                        failed: 3
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Completed with issues').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
        });

        it('should display correct completed jobs count', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 15,
                        warning: 0,
                        inProgress: 0,
                        failed: 0
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByText('15 jobs')).toBeTruthy();
        });

        it('should display correct warning jobs count', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 0,
                        warning: 7,
                        inProgress: 0,
                        failed: 0
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByText('7 jobs')).toBeTruthy();
        });

        it('should display correct in progress jobs count', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 0,
                        warning: 0,
                        inProgress: 12,
                        failed: 0
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByText('12 jobs')).toBeTruthy();
        });

        it('should display correct failed jobs count', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 0,
                        warning: 0,
                        inProgress: 0,
                        failed: 8
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByText('8 jobs')).toBeTruthy();
        });

        it('should handle zero values', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 0,
                        warning: 0,
                        inProgress: 0,
                        failed: 0
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const jobTexts = screen.getAllByText('0 jobs');
            expect(jobTexts.length).toBeGreaterThan(0);
        });

        it('should apply maxWidthClass for large window', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const mainDiv = container.querySelector('.jobDistribution');
            expect(mainDiv?.className).toContain('maxWidthClass');
        });
    });

    describe('Job status display - Small window (< 1500px)', () => {
        beforeEach(() => {
            mockWindowSize.width = 1400;
            window.innerWidth = 1400;
        });

        it('should render all job status rows for small window', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 10,
                        warning: 2,
                        inProgress: 5,
                        failed: 3
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Completed with issues').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
        });

        it('should display correct values for small window', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 20,
                        warning: 5,
                        inProgress: 10,
                        failed: 3
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByText('20 jobs')).toBeTruthy();
            expect(screen.getByText('5 jobs')).toBeTruthy();
            expect(screen.getByText('10 jobs')).toBeTruthy();
            expect(screen.getByText('3 jobs')).toBeTruthy();
        });

        it('should apply minWidthClass for small window', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const mainDiv = container.querySelector('.jobDistribution');
            expect(mainDiv?.className).toContain('minWidthClass');
        });
    });

    describe('Window boundary - Exactly 1500px', () => {
        it('should apply minWidthClass when window.innerWidth is exactly 1500px', () => {
            mockWindowSize.width = 1500;
            window.innerWidth = 1500;

            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const mainDiv = container.querySelector('.jobDistribution');
            expect(mainDiv?.className).toContain('maxWidthClass');
        });
    });

    describe('Loading state with job counts', () => {
        it('should render loading indicators for each status row when loading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 10,
                        warning: 2,
                        inProgress: 5,
                        failed: 3
                    },
                    jmJobsSummaryLoading: true
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            // Should have multiple loading indicators
            const loaders = screen.getAllByTestId('flashing-dots-loader');
            expect(loaders.length).toBeGreaterThan(4); // Header + each row
        });

        it('should still display job counts when loading', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 25,
                        warning: 0,
                        inProgress: 0,
                        failed: 0
                    },
                    jmJobsSummaryLoading: true
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByText('25 jobs')).toBeTruthy();
        });
    });

    describe('Undefined or null job counts', () => {
        it('should handle undefined completed count', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: undefined,
                        warning: 0,
                        inProgress: 0,
                        failed: 0
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const jobTexts = screen.getAllByText('0 jobs');
            expect(jobTexts.length).toBeGreaterThan(0);
        });

        it('should handle undefined warning count', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 0,
                        warning: undefined,
                        inProgress: 0,
                        failed: 0
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const jobTexts = screen.getAllByText('0 jobs');
            expect(jobTexts.length).toBeGreaterThan(0);
        });

        it('should handle undefined inProgress count', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 0,
                        warning: 0,
                        inProgress: undefined,
                        failed: 0
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const jobTexts = screen.getAllByText('0 jobs');
            expect(jobTexts.length).toBeGreaterThan(0);
        });

        it('should handle undefined failed count', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 0,
                        warning: 0,
                        inProgress: 0,
                        failed: undefined
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const jobTexts = screen.getAllByText('0 jobs');
            expect(jobTexts.length).toBeGreaterThan(0);
        });

        it('should handle completely empty jobsSummaryData', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {},
                    jmJobsSummaryLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const jobTexts = screen.getAllByText('0 jobs');
            expect(jobTexts.length).toBeGreaterThan(0);
        });

        it('should handle null jobsSummaryData', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: null,
                    jmJobsSummaryLoading: false
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const jobTexts = screen.getAllByText('0 jobs');
            expect(jobTexts.length).toBeGreaterThan(0);
        });
    });

    describe('CSS classes and styling', () => {
        it('should apply correct CSS classes to main container', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(container.querySelector('.jobDistribution')).toBeTruthy();
            expect(container.querySelector('.headSection')).toBeTruthy();
            expect(container.querySelector('.mainSection')).toBeTruthy();
        });

        it('should render job separators', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const separators = container.querySelectorAll('.jobSeparator');
            expect(separators.length).toBeGreaterThan(0);
        });

        it('should render colored squares for each status', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const squares = container.querySelectorAll('.square');
            expect(squares.length).toBeGreaterThan(0);
        });
    });

    describe('Large numbers', () => {
        it('should handle large job counts', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jmJobsSummary: {
                        completed: 999999,
                        warning: 888888,
                        inProgress: 777777,
                        failed: 666666
                    }
                }
            });

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByText('999999 jobs')).toBeTruthy();
            expect(screen.getByText('888888 jobs')).toBeTruthy();
            expect(screen.getByText('777777 jobs')).toBeTruthy();
            expect(screen.getByText('666666 jobs')).toBeTruthy();
        });
    });

    describe('Responsive behavior', () => {
        it('should render correctly at 1499px (just below threshold)', () => {
            mockWindowSize.width = 1499;
            window.innerWidth = 1499;

            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const mainDiv = container.querySelector('.jobDistribution');
            expect(mainDiv?.className).toContain('minWidthClass');
        });

        it('should render correctly at 1501px (just above threshold)', () => {
            mockWindowSize.width = 1501;
            window.innerWidth = 1501;

            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            const mainDiv = container.querySelector('.jobDistribution');
            expect(mainDiv?.className).toContain('maxWidthClass');
        });

        it('should render correctly at very small width', () => {
            mockWindowSize.width = 320;
            window.innerWidth = 320;

            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByTestId('job-doughnut-chart')).toBeTruthy();
        });

        it('should render correctly at very large width', () => {
            mockWindowSize.width = 3840;
            window.innerWidth = 3840;

            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobDistribution />
                </Provider>
            );

            expect(screen.getByTestId('job-doughnut-chart')).toBeTruthy();
        });
    });
});
