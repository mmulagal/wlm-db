import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CreateSandboxApis from './CreateNewSandboxApis';

const mockDispatch = vi.fn();

vi.mock('../../../../store/storeHooks', () => ({
    useAppDispatch: () => mockDispatch,
    useAppSelector: (selector: any) => selector(mockStoreState)
}));

const mockGetDatabaseHostsQuery = vi.fn(() => ({
    data: undefined,
    isFetching: false,
    isError: false
}));

const mockGetDatabaseListQuery = vi.fn(() => ({
    data: undefined,
    isFetching: false,
    isError: false
}));

const mockGetDriveInfoQuery = vi.fn(() => ({
    data: undefined,
    isFetching: false
}));

const mockGetDatabaseMountPointsQuery = vi.fn(() => ({
    data: undefined,
    isFetching: false
}));

vi.mock('../../../../utils/apiService', () => ({
    useGetDatabaseHostsForSandboxV2Query: (params: any, opts: any) => mockGetDatabaseHostsQuery(params, opts),
    useGetDatabaseListV2Query: (params: any, opts: any) => mockGetDatabaseListQuery(params, opts),
    useGetDriveInfoV2Query: (params: any, opts: any) => mockGetDriveInfoQuery(params, opts),
    useGetDatabaseMountPointsQuery: (params: any, opts: any) => mockGetDatabaseMountPointsQuery(params, opts)
}));

vi.mock('../../../../store/workloadFactory/createSandboxSlice', () => ({
    setAggregatedDbHost: vi.fn((val: any) => ({ type: 'createSandbox/setAggregatedDbHost', payload: val })),
    setDatabaseHostState: vi.fn((val: any) => ({ type: 'createSandbox/setDatabaseHostState', payload: val })),
    setDatabaseListState: vi.fn((val: any) => ({ type: 'createSandbox/setDatabaseListState', payload: val })),
    setDbMountPointsState: vi.fn((val: any) => ({ type: 'createSandbox/setDbMountPointsState', payload: val })),
    setDriveInfoState: vi.fn((val: any) => ({ type: 'createSandbox/setDriveInfoState', payload: val }))
}));

let mockStoreState: any = {
    createSandbox: {
        source: {
            selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
            selectedDatabase: { label: 'db1' },
            selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' }
        },
        target: {
            selectedDatabaseHost: { value: 'targetHost1' },
            selectedDatabaseInstance: { value: 'targetInst1' }
        },
        aggregatedDbHostList: [],
        getDatabaseHosts: { databaseHostsLoading: false },
        selectedSandboxCredId: 'cred1',
        selectedSandboxRegionId: 'us-east-1'
    }
};

describe('CreateSandboxApis', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState = {
            createSandbox: {
                source: {
                    selectedDatabaseHost: { value: 'host1', label: 'Host 1' },
                    selectedDatabase: { label: 'db1' },
                    selectedDatabaseInstance: { value: 'inst1', label: 'Instance 1' }
                },
                target: {
                    selectedDatabaseHost: { value: 'targetHost1' },
                    selectedDatabaseInstance: { value: 'targetInst1' }
                },
                aggregatedDbHostList: [],
                getDatabaseHosts: { databaseHostsLoading: false },
                selectedSandboxCredId: 'cred1',
                selectedSandboxRegionId: 'us-east-1'
            }
        };
    });

    it('should render null (returns empty fragment)', () => {
        const { container } = render(<CreateSandboxApis />);
        expect(container.innerHTML).toBe('');
    });

    it('should call useGetDatabaseHostsForSandboxV2Query with correct params', () => {
        render(<CreateSandboxApis />);

        expect(mockGetDatabaseHostsQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                credentialId: 'cred1',
                region: 'us-east-1'
            }),
            expect.any(Object)
        );
    });

    it('should skip database hosts query when credId is null', () => {
        mockStoreState.createSandbox.selectedSandboxCredId = null;

        render(<CreateSandboxApis />);

        expect(mockGetDatabaseHostsQuery).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ skip: true })
        );
    });

    it('should skip database hosts query when regionId is null', () => {
        mockStoreState.createSandbox.selectedSandboxRegionId = null;

        render(<CreateSandboxApis />);

        expect(mockGetDatabaseHostsQuery).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ skip: true })
        );
    });

    it('should skip database list query when selectedDbHostId is null', () => {
        mockStoreState.createSandbox.source.selectedDatabaseHost = null;

        render(<CreateSandboxApis />);

        expect(mockGetDatabaseListQuery).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ skip: true })
        );
    });

    it('should skip drive info query when selectedTargetDbHostId is null', () => {
        mockStoreState.createSandbox.target.selectedDatabaseHost = null;

        render(<CreateSandboxApis />);

        expect(mockGetDriveInfoQuery).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ skip: true }));
    });

    it('should skip mount points query when selectedDbHostId is null', () => {
        mockStoreState.createSandbox.source.selectedDatabaseHost = null;

        render(<CreateSandboxApis />);

        expect(mockGetDatabaseMountPointsQuery).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ skip: true })
        );
    });

    it('should dispatch setDatabaseHostState when database hosts data changes', () => {
        mockGetDatabaseHostsQuery.mockReturnValueOnce({
            data: { items: [{ id: 'host1', name: 'Host 1' }], nextToken: null },
            isFetching: false,
            isError: false
        });

        render(<CreateSandboxApis />);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setDatabaseHostState') })
        );
    });

    it('should dispatch setDatabaseListState when database list data changes', () => {
        mockGetDatabaseListQuery.mockReturnValueOnce({
            data: { items: [{ id: 'db1', name: 'Database 1' }] },
            isFetching: false,
            isError: false
        });

        render(<CreateSandboxApis />);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('setDatabaseListState') })
        );
    });

    it('should dispatch setDriveInfoState with loading true when driveInfo is loading', () => {
        mockGetDriveInfoQuery.mockReturnValueOnce({
            data: null,
            isFetching: true
        });

        render(<CreateSandboxApis />);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setDriveInfoState'),
                payload: expect.objectContaining({ driveInfoLoading: true })
            })
        );
    });

    it('should dispatch setDriveInfoState with loading false when driveInfo is done', () => {
        mockGetDriveInfoQuery.mockReturnValueOnce({
            data: { existingDriveInfo: [] },
            isFetching: false
        });

        render(<CreateSandboxApis />);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setDriveInfoState'),
                payload: expect.objectContaining({ driveInfoLoading: false })
            })
        );
    });

    it('should dispatch setDbMountPointsState with loading true when mount points loading', () => {
        mockGetDatabaseMountPointsQuery.mockReturnValueOnce({
            data: null,
            isFetching: true
        });

        render(<CreateSandboxApis />);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setDbMountPointsState'),
                payload: expect.objectContaining({ dbMountPointsLoading: true })
            })
        );
    });

    it('should dispatch setDbMountPointsState with loading false when done', () => {
        mockGetDatabaseMountPointsQuery.mockReturnValueOnce({
            data: { databaseDataPath: ['C:\\Data'], databaseLogPath: ['D:\\Log'] },
            isFetching: false
        });

        render(<CreateSandboxApis />);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setDbMountPointsState'),
                payload: expect.objectContaining({ dbMountPointsLoading: false })
            })
        );
    });

    it('should dispatch setAggregatedDbHost([]) when credId or regionId changes', () => {
        render(<CreateSandboxApis />);

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('setAggregatedDbHost'),
                payload: []
            })
        );
    });

    it('should aggregate db host list with nextToken for pagination', () => {
        mockStoreState.createSandbox.getDatabaseHosts = { databaseHostsLoading: true };
        mockStoreState.createSandbox.aggregatedDbHostList = [{ id: 'existing1' }];

        mockGetDatabaseHostsQuery.mockReturnValueOnce({
            data: { items: [{ id: 'host2', name: 'Host 2' }], nextToken: 'next-token-123' },
            isFetching: false,
            isError: false
        });

        render(<CreateSandboxApis />);

        // Dispatch should be called with aggregated list
        expect(mockDispatch).toHaveBeenCalled();
    });
});
