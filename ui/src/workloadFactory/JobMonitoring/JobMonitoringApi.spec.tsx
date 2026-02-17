import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import JobMonitoringApi from './JobMonitoringApi';

// Mock API service
const mockGetJobsListQuery = vi.fn();
const mockGetJobsSummaryDataQuery = vi.fn();
const mockGetJobsSummaryTimelineDataQuery = vi.fn();

vi.mock('../../utils/apiService', () => ({
    useGetJobsListQuery: (...args: any[]) => mockGetJobsListQuery(...args),
    useGetJobsSummaryDataQuery: (...args: any[]) => mockGetJobsSummaryDataQuery(...args),
    useGetJobsSummaryTimelineDataQuery: (...args: any[]) => mockGetJobsSummaryTimelineDataQuery(...args)
}));

// Mock utility functions
const mockJobStatusPercent = vi.fn(data => data);
const mockGroupByJobSummaryTimeline = vi.fn((data, interval) => data);

vi.mock('../../utils/utilityFunctions', () => ({
    groupByJobSummaryTimeline: (...args: any[]) => mockGroupByJobSummaryTimeline(...args),
    jobStatusPercent: (...args: any[]) => mockJobStatusPercent(...args)
}));

const createMockStore = (overrides = {}) => {
    const defaultState = {
        jobMonitoring: {
            jobsList: [],
            timeInterval: 1,
            fromTime: Date.now() - 86400000,
            toTime: Date.now(),
            ...overrides.jobMonitoring
        }
    };

    return configureStore({
        reducer: {
            jobMonitoring: (state = defaultState.jobMonitoring) => state
        }
    });
};

const TestComponent = () => {
    JobMonitoringApi();
    return <div>Test Component</div>;
};

describe('JobMonitoringApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockGetJobsListQuery.mockReturnValue({
            data: undefined,
            isFetching: false
        });

        mockGetJobsSummaryDataQuery.mockReturnValue({
            data: undefined,
            isFetching: false
        });

        mockGetJobsSummaryTimelineDataQuery.mockReturnValue({
            data: undefined,
            isFetching: false
        });

        mockJobStatusPercent.mockImplementation(data => data);
        mockGroupByJobSummaryTimeline.mockImplementation(data => data);
    });

    describe('Initial state and API skip logic', () => {
        it('should skip API calls initially', () => {
            const store = createMockStore();

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            expect(mockGetJobsListQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
            expect(mockGetJobsSummaryDataQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
            expect(mockGetJobsSummaryTimelineDataQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });

        it('should trigger API calls after timeout when fromTime is set', async () => {
            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(
                () => {
                    const { calls } = mockGetJobsListQuery.mock;
                    const hasSkipFalse = calls.some((call: any) => call[1]?.skip === false);
                    expect(hasSkipFalse).toBe(true);
                },
                { timeout: 100 }
            );
        });
    });

    describe('Jobs list API and pagination', () => {
        it('should handle jobs list data successfully', async () => {
            const mockJobsData = {
                items: [
                    { id: '1', name: 'Job 1', status: 'completed' },
                    { id: '2', name: 'Job 2', status: 'running' }
                ],
                nextToken: null
            };

            mockGetJobsListQuery.mockReturnValue({
                data: mockJobsData,
                isFetching: false
            });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJobsList')
                    })
                );
            });
        });

        it('should handle pagination with nextToken', async () => {
            const mockJobsData = {
                items: [{ id: '1', name: 'Job 1' }],
                nextToken: 'token123'
            };

            mockGetJobsListQuery.mockReturnValue({
                data: mockJobsData,
                isFetching: false
            });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                const setJobsListCalls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setJobsList')
                );
                expect(setJobsListCalls.length).toBeGreaterThan(0);
            });
        });

        it('should stop pagination when nextToken is same as lastToken', async () => {
            const mockJobsData = {
                items: [{ id: '1', name: 'Job 1' }],
                nextToken: 'sameToken'
            };

            mockGetJobsListQuery
                .mockReturnValueOnce({
                    data: { items: [], nextToken: 'sameToken' },
                    isFetching: false
                })
                .mockReturnValueOnce({
                    data: mockJobsData,
                    isFetching: false
                });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJobsListLoading')
                    })
                );
            });
        });

        it('should set loading to false when no nextToken', async () => {
            const mockJobsData = {
                items: [{ id: '1', name: 'Job 1' }],
                nextToken: null
            };

            mockGetJobsListQuery.mockReturnValue({
                data: mockJobsData,
                isFetching: false
            });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                const setJobsListLoadingCalls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setJobsListLoading')
                );
                expect(setJobsListLoadingCalls.length).toBeGreaterThan(0);
            });
        });

        it('should merge new jobs list with old list', async () => {
            const existingJobs = [{ id: '0', name: 'Job 0' }];
            const newJobs = [{ id: '1', name: 'Job 1' }];

            mockGetJobsListQuery.mockReturnValue({
                data: { items: newJobs, nextToken: null },
                isFetching: false
            });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: existingJobs,
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                const setJobsListCalls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setJobsList')
                );
                expect(setJobsListCalls.length).toBeGreaterThan(0);
            });
        });

        it('should set loading to true when jobs list is fetching', async () => {
            mockGetJobsListQuery.mockReturnValue({
                data: undefined,
                isFetching: true
            });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                const setJobsListLoadingCalls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setJobsListLoading')
                );
                expect(setJobsListLoadingCalls.some((call: any) => call[0].payload === true)).toBe(true);
            });
        });
    });

    describe('Jobs summary data', () => {
        it('should process jobs summary data with jobStatusPercent', async () => {
            const mockSummaryData = {
                completed: 10,
                failed: 5,
                running: 3
            };

            mockGetJobsSummaryDataQuery.mockReturnValue({
                data: mockSummaryData,
                isFetching: false
            });

            mockJobStatusPercent.mockReturnValue({
                completed: 10,
                failed: 5,
                running: 3,
                completedPercent: 55,
                failedPercent: 28,
                runningPercent: 17
            });

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(mockJobStatusPercent).toHaveBeenCalledWith(mockSummaryData);
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJmJobsSummary')
                    })
                );
            });
        });

        it('should handle empty jobs summary data', async () => {
            mockGetJobsSummaryDataQuery.mockReturnValue({
                data: undefined,
                isFetching: false
            });

            mockJobStatusPercent.mockReturnValue({});

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(mockJobStatusPercent).toHaveBeenCalledWith({});
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJmJobsSummary')
                    })
                );
            });
        });

        it('should set jobs summary loading state', async () => {
            mockGetJobsSummaryDataQuery.mockReturnValue({
                data: undefined,
                isFetching: true
            });

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJmJobsSummaryLoading'),
                        payload: true
                    })
                );
            });
        });
    });

    describe('Jobs summary timeline', () => {
        it('should process timeline data with groupByJobSummaryTimeline', async () => {
            const mockTimelineData = [
                { timestamp: Date.now(), completed: 5, failed: 1 },
                { timestamp: Date.now() - 3600000, completed: 3, failed: 0 }
            ];

            mockGetJobsSummaryTimelineDataQuery.mockReturnValue({
                data: mockTimelineData,
                isFetching: false
            });

            const groupedData = [{ period: '1h', data: mockTimelineData }];
            mockGroupByJobSummaryTimeline.mockReturnValue(groupedData);

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(mockGroupByJobSummaryTimeline).toHaveBeenCalledWith(mockTimelineData, 1);
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJobsSummaryTimeline')
                    })
                );
            });
        });

        it('should set empty timeline when loading', async () => {
            mockGetJobsSummaryTimelineDataQuery.mockReturnValue({
                data: undefined,
                isFetching: true
            });

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                const setTimelineCalls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setJobsSummaryTimeline')
                );
                expect(
                    setTimelineCalls.some((call: any) => Array.isArray(call[0].payload) && call[0].payload.length === 0)
                ).toBe(true);
            });
        });

        it('should set timeline loading state to true when fetching', async () => {
            mockGetJobsSummaryTimelineDataQuery.mockReturnValue({
                data: undefined,
                isFetching: true
            });

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJobsSummaryTimelineLoading'),
                        payload: true
                    })
                );
            });
        });

        it('should set timeline loading state to false when not fetching', async () => {
            mockGetJobsSummaryTimelineDataQuery.mockReturnValue({
                data: [],
                isFetching: false
            });

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJobsSummaryTimelineLoading'),
                        payload: false
                    })
                );
            });
        });

        it('should handle empty timeline data', async () => {
            mockGetJobsSummaryTimelineDataQuery.mockReturnValue({
                data: undefined,
                isFetching: false
            });

            mockGroupByJobSummaryTimeline.mockReturnValue([]);

            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(mockGroupByJobSummaryTimeline).toHaveBeenCalledWith([], 1);
            });
        });
    });

    describe('useEffect - fromTime changes', () => {
        it('should reset state and trigger API calls when fromTime changes', async () => {
            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            const { rerender } = render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            const newStore = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 172800000, // 2 days ago
                    toTime: Date.now()
                }
            });

            rerender(
                <Provider store={newStore}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJobsListLoading')
                    })
                );
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setJobsList')
                    })
                );
            });
        });

        it('should set jobs list loading to false on fromTime change', async () => {
            const store = createMockStore({
                jobMonitoring: {
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                const calls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setJobsListLoading')
                );
                expect(calls.some((call: any) => call[0].payload === false)).toBe(true);
            });
        });

        it('should reset jobs list to empty array on fromTime change', async () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [{ id: '1', name: 'Job 1' }],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                const calls = dispatchSpy.mock.calls.filter(
                    (call: any) => call[0].type && call[0].type.includes('setJobsList')
                );
                expect(calls.some((call: any) => Array.isArray(call[0].payload) && call[0].payload.length === 0)).toBe(
                    true
                );
            });
        });
    });

    describe('Edge cases', () => {
        it('should handle null jobsList', async () => {
            mockGetJobsListQuery.mockReturnValue({
                data: { items: [{ id: '1' }], nextToken: null },
                isFetching: false
            });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: null,
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalled();
            });
        });

        it('should handle missing items in API response', async () => {
            mockGetJobsListQuery.mockReturnValue({
                data: { nextToken: null },
                isFetching: false
            });

            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    timeInterval: 1,
                    fromTime: Date.now() - 86400000,
                    toTime: Date.now()
                }
            });

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            await waitFor(() => {
                expect(mockGetJobsListQuery).toHaveBeenCalled();
            });
        });

        it('should handle null/undefined fromTime, toTime, or timeInterval', () => {
            const store = createMockStore({
                jobMonitoring: {
                    jobsList: [],
                    timeInterval: null,
                    fromTime: null,
                    toTime: null
                }
            });

            render(
                <Provider store={store}>
                    <TestComponent />
                </Provider>
            );

            // Should skip API calls when required values are null
            expect(mockGetJobsListQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });
    });
});
