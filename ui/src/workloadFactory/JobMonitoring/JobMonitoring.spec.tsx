import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import JobMonitoring from './JobMonitoring';

// Mock JobMonitoringApi
vi.mock('./JobMonitoringApi', () => ({
    default: vi.fn(() => null)
}));

// Mock child components
vi.mock('./JobMonitoringTable/JobMonitoringTable', () => ({
    default: () => <div data-testid="job-monitoring-table">JobMonitoringTable</div>
}));

vi.mock('./JobDistribution/JobDistribution', () => ({
    default: () => <div data-testid="job-distribution">JobDistribution</div>
}));

vi.mock('../DatabaseHomePage/LineChart/LineChart', () => ({
    default: ({ startColor, endColor, selectedTimeFrame, timelineData }: any) => (
        <div
            data-testid="line-chart"
            data-start-color={startColor}
            data-end-color={endColor}
            data-timeframe={selectedTimeFrame}
        >
            LineChart
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

// Mock SCSS module
vi.mock('./JobMonitoring.module.scss', () => ({
    default: {
        jobMonitoring: 'jobMonitoring',
        chartContainer: 'chartContainer',
        chartSection: 'chartSection',
        overtimeJobs: 'overtimeJobs',
        headSection: 'headSection',
        title: 'title',
        mainSection: 'mainSection',
        tableSection: 'tableSection'
    }
}));

// Mock appConstants
vi.mock('../../utils/appConstants', () => ({
    GENERAL: {
        JOBS_STATUS_OVER_TIME: 'Jobs Status Over Time'
    }
}));

const createMockStore = (overrides = {}) => {
    const defaultState = {
        jobMonitoring: {
            jobsSummaryTimeline: [],
            jobsSummaryTimelineLoading: false,
            fromTime: Date.now() - 86400000,
            toTime: Date.now(),
            timeInterval: 1
        },
        headers: {
            refreshTimeJobMonitor: 0
        },
        auth: {
            isDemoMode: false
        },
        ...overrides
    };

    return configureStore({
        reducer: {
            jobMonitoring: () => defaultState.jobMonitoring,
            headers: () => defaultState.headers,
            auth: () => defaultState.auth
        }
    });
};

describe('JobMonitoring', () => {
    let mockSetDropdownValue: any;
    let mockGenerateSelectFieldOptions: any;
    let mockDropDownValue: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSetDropdownValue = vi.fn();
        mockGenerateSelectFieldOptions = [
            { value: 1, label: '1 Day' },
            { value: 7, label: '7 Days' }
        ];
        mockDropDownValue = { value: 1, label: '1 Day' };
    });

    describe('Rendering', () => {
        it('should render JobMonitoring component with all child components', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            expect(screen.getByTestId('job-distribution')).toBeTruthy();
            expect(screen.getByTestId('line-chart')).toBeTruthy();
            expect(screen.getByTestId('job-monitoring-table')).toBeTruthy();
        });

        it('should render Jobs Status Over Time heading', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            expect(screen.getByText('Jobs Status Over Time')).toBeTruthy();
        });

        it('should render FlashingDotsLoader when timelineLoading is true', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsSummaryTimeline: [],
                    jobsSummaryTimelineLoading: true,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now(),
                    timeInterval: 1
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
        });

        it('should not render FlashingDotsLoader when timelineLoading is false', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            expect(screen.queryByTestId('flashing-dots-loader')).toBeFalsy();
        });

        it('should pass correct props to LineChart', () => {
            const timelineData = [{ time: 1234567890, value: 10 }];
            const store = createMockStore({
                jobMonitoring: {
                    jobsSummaryTimeline: timelineData,
                    jobsSummaryTimelineLoading: false,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now(),
                    timeInterval: 1
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            const lineChart = screen.getByTestId('line-chart');
            expect(lineChart.getAttribute('data-start-color')).toBe('#A815F3');
            expect(lineChart.getAttribute('data-end-color')).toBe('rgba(168, 21, 243, 0.00)');
            expect(lineChart.getAttribute('data-timeframe')).toBe('1');
        });
    });

    describe('useEffect - refreshTimeJobMonitor', () => {
        it('should call setDropdownValue with first option when not in demo mode', async () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: false
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                expect(mockSetDropdownValue).toHaveBeenCalledWith(mockGenerateSelectFieldOptions[0]);
            });
        });

        it('should call setDropdownValue with second option when in demo mode', async () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: true
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                expect(mockSetDropdownValue).toHaveBeenCalledWith(mockGenerateSelectFieldOptions[1]);
            });
        });

        it('should dispatch setTimeInterval with 1 day when not in demo mode', async () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: false
                }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setTimeInterval')
                    })
                );
            });
        });

        it('should dispatch setTimeInterval with 7 days when in demo mode', async () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: true
                }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setTimeInterval')
                    })
                );
            });
        });

        it('should dispatch setFromTime and setToTime actions', async () => {
            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setFromTime')
                    })
                );
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setToTime')
                    })
                );
            });
        });

        it('should re-run effect when refreshTimeJobMonitor changes', async () => {
            const store = createMockStore({
                headers: {
                    refreshTimeJobMonitor: 0
                }
            });

            const { rerender } = render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            expect(mockSetDropdownValue).toHaveBeenCalledTimes(1);

            const newStore = createMockStore({
                headers: {
                    refreshTimeJobMonitor: 1
                }
            });

            rerender(
                <Provider store={newStore}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                expect(mockSetDropdownValue).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('dispatchTimeInterval function', () => {
        it('should calculate correct time range for 1 day', async () => {
            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');
            const now = Date.now();

            // Mock Date.now to return a fixed timestamp
            vi.spyOn(Date, 'now').mockReturnValue(now);

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                const setFromTimeCalls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setFromTime')
                );
                const setToTimeCalls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setToTime')
                );

                expect(setFromTimeCalls.length).toBeGreaterThan(0);
                expect(setToTimeCalls.length).toBeGreaterThan(0);
            });

            vi.restoreAllMocks();
        });

        it('should calculate correct time range for 7 days in demo mode', async () => {
            const store = createMockStore({
                auth: {
                    isDemoMode: true
                }
            });
            const dispatchSpy = vi.spyOn(store, 'dispatch');
            const now = Date.now();

            vi.spyOn(Date, 'now').mockReturnValue(now);

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                const setTimeIntervalCalls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setTimeInterval')
                );
                expect(setTimeIntervalCalls.length).toBeGreaterThan(0);
            });

            vi.restoreAllMocks();
        });
    });

    describe('Edge cases', () => {
        it('should handle empty timelineData', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsSummaryTimeline: [],
                    jobsSummaryTimelineLoading: false,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now(),
                    timeInterval: 1
                }
            });

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            expect(screen.getByTestId('line-chart')).toBeTruthy();
        });

        it('should handle null dropDownValue', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={null}
                    />
                </Provider>
            );

            expect(screen.getByTestId('job-monitoring-table')).toBeTruthy();
        });

        it('should handle empty generateSelectFieldOptions', async () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={[]}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            await waitFor(() => {
                expect(mockSetDropdownValue).toHaveBeenCalled();
            });
        });
    });

    describe('CSS classes', () => {
        it('should apply correct CSS classes to main container', () => {
            const store = createMockStore();

            const { container } = render(
                <Provider store={store}>
                    <JobMonitoring
                        setDropdownValue={mockSetDropdownValue}
                        generateSelectFieldOptions={mockGenerateSelectFieldOptions}
                        dropDownValue={mockDropDownValue}
                    />
                </Provider>
            );

            expect(container.querySelector('.jobMonitoring')).toBeTruthy();
            expect(container.querySelector('.chartContainer')).toBeTruthy();
            expect(container.querySelector('.tableSection')).toBeTruthy();
        });
    });
});
