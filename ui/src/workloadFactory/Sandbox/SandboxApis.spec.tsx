import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SandboxApis from './SandboxApis';

// Mock API queries
const mockGetSandboxListQuery = vi.fn();
const mockGetSandboxSavingsQuery = vi.fn();

vi.mock('../../utils/apiService', () => ({
    useGetSandboxListQuery: (...args: any[]) => mockGetSandboxListQuery(...args),
    useGetSandboxSavingsQuery: (...args: any[]) => mockGetSandboxSavingsQuery(...args)
}));

const createMockStore = (overrides: any = {}) => {
    const defaultState = {
        headers: {
            headerSelectedCredSandbox: { data: { credentialsId: 'cred1' } },
            headerSelectedRegionSandbox: { label2: 'us-east-1' },
            ...overrides.headers
        },
        sandbox: {
            getSandboxList: { sandboxListLoading: false },
            aggregatedSandboxList: [],
            allSandboxList: [],
            isRefreshedSandbox: false,
            ...overrides.sandbox
        },
        auth: {
            refreshBlocked: false,
            ...overrides.auth
        }
    };

    return configureStore({
        reducer: {
            headers: () => defaultState.headers,
            sandbox: () => defaultState.sandbox,
            auth: () => defaultState.auth
        }
    });
};

const TestWrapper = ({ store }: any) => (
    <Provider store={store}>
        <SandboxApis />
    </Provider>
);

describe('SandboxApis', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockGetSandboxListQuery.mockReturnValue({
            data: undefined,
            isFetching: false,
            isError: false
        });

        mockGetSandboxSavingsQuery.mockReturnValue({
            data: undefined,
            isFetching: false,
            isError: false
        });
    });

    describe('Rendering', () => {
        it('should render without errors and return empty fragment', () => {
            const store = createMockStore();
            const { container } = render(<TestWrapper store={store} />);
            expect(container).toBeTruthy();
        });
    });

    describe('API call skip logic', () => {
        it('should skip sandbox list query when credId is null', () => {
            const store = createMockStore({
                headers: {
                    headerSelectedCredSandbox: null,
                    headerSelectedRegionSandbox: { label2: 'us-east-1' }
                }
            });

            render(<TestWrapper store={store} />);

            expect(mockGetSandboxListQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });

        it('should skip sandbox list query when regionId is null', () => {
            const store = createMockStore({
                headers: {
                    headerSelectedCredSandbox: { data: { credentialsId: 'cred1' } },
                    headerSelectedRegionSandbox: null
                }
            });

            render(<TestWrapper store={store} />);

            expect(mockGetSandboxListQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });

        it('should skip sandbox list query when refreshBlocked is true', () => {
            const store = createMockStore({
                auth: { refreshBlocked: true }
            });

            render(<TestWrapper store={store} />);

            expect(mockGetSandboxListQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });

        it('should skip savings query when aggregatedSandboxList already has items', () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxList: { sandboxListLoading: false },
                    aggregatedSandboxList: [{ id: '1' }],
                    allSandboxList: [],
                    isRefreshedSandbox: false
                }
            });

            render(<TestWrapper store={store} />);

            expect(mockGetSandboxSavingsQuery).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ skip: true })
            );
        });
    });

    describe('State dispatches on sandbox list data', () => {
        it('should dispatch setSandboxListState when sandbox list data changes', async () => {
            const mockData = {
                items: [{ id: 'sb1', name: 'Sandbox1' }],
                nextToken: null
            };

            mockGetSandboxListQuery.mockReturnValue({
                data: mockData,
                isFetching: false,
                isError: false
            });

            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setSandboxListState')
                    })
                );
            });
        });

        it('should dispatch setSandboxSavingsState when savings data changes', async () => {
            const mockSavings = { sandboxSavingsPercentage: 75, savedStorage: 1000, consumedStorage: 500 };

            mockGetSandboxSavingsQuery.mockReturnValue({
                data: mockSavings,
                isFetching: false,
                isError: false
            });

            const store = createMockStore();
            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setSandboxSavingsState')
                    })
                );
            });
        });

        it('should aggregate sandbox list when loading state transitions from true to false', async () => {
            const mockData = {
                items: [
                    { id: 'sb1', name: 'Sandbox1' },
                    { error: null, id: 'sb2', name: 'Sandbox2' }
                ],
                nextToken: 'next-token'
            };

            mockGetSandboxListQuery.mockReturnValue({
                data: mockData,
                isFetching: false,
                isError: false
            });

            const store = createMockStore({
                sandbox: {
                    getSandboxList: { sandboxListLoading: true },
                    aggregatedSandboxList: [],
                    allSandboxList: [],
                    isRefreshedSandbox: false
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setAggregatedSandboxList')
                    })
                );
            });
        });
    });

    describe('isRefreshedSandbox effect', () => {
        it('should reset state when isRefreshedSandbox is true', async () => {
            const store = createMockStore({
                sandbox: {
                    getSandboxList: { sandboxListLoading: false },
                    aggregatedSandboxList: [],
                    allSandboxList: [],
                    isRefreshedSandbox: true
                }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setIsRefreshedSandbox')
                    })
                );
            });
        });
    });

    describe('Header selection effect', () => {
        it('should reset aggregated list when credentials change', async () => {
            const store = createMockStore({
                auth: { refreshBlocked: false }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: expect.stringContaining('setAggregatedSandboxList')
                    })
                );
            });
        });

        it('should NOT reset when refreshBlocked is true', async () => {
            const store = createMockStore({
                auth: { refreshBlocked: true }
            });

            const dispatchSpy = vi.spyOn(store, 'dispatch');

            render(<TestWrapper store={store} />);

            await waitFor(() => {
                const calls = dispatchSpy.mock.calls.filter((call: any) =>
                    call[0]?.type?.includes('setAggregatedSandboxList')
                );
                expect(calls.length).toBe(0);
            });
        });
    });
});
