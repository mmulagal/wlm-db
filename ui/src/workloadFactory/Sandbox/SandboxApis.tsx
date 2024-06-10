import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    setAggregatedSandboxList,
    setSandboxListState,
    setSandboxSavingsState,
    updateConnectionInfo
} from '../../store/workloadFactory/sandboxSlice';
import { useGetConnectionInfoQuery, useGetSandboxListQuery, useGetSandboxSavingsQuery } from '../../utils/apiService';

const SandboxApis = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const { getSandboxList, aggregatedSandboxList, connectionInfo } = useAppSelector(state => state.sandbox);

    const { selectedDatabaseHostId, selectedSandboxName } = connectionInfo;

    const [credId, setCredId] = useState(null);
    const [regionId, setRegionId] = useState(null);
    const [sandboxCursor, setSandboxCursor] = useState(null);

    useEffect(() => {
        setCredId(headerSelectedCred?.data?.credentialsId);
        setRegionId(headerSelectedRegion?.label2);
        dispatch(setAggregatedSandboxList([]));
    }, [headerSelectedCred, headerSelectedRegion]);

    const {
        data: sandboxList,
        isFetching: sandboxListLoading,
        isError: sandboxListError
    } = useGetSandboxListQuery(
        {
            credentialId: credId,
            region: regionId,
            nextToken: sandboxCursor
        },
        { skip: !credId || !regionId || (aggregatedSandboxList.length && !sandboxCursor) }
    );

    const {
        data: sandboxSavings,
        isFetching: sandboxSavingsLoading,
        isError: sandboxSavingsError
    } = useGetSandboxSavingsQuery(
        {
            credentialId: credId,
            region: regionId
        },
        { skip: !credId || !regionId }
    );

    const {
        data: connectionInfoData,
        isFetching: fetchingConnectionInfo,
        isError: connectionInfoError
    } = useGetConnectionInfoQuery(
        {
            credentialsId: credId,
            regionId: regionId,
            databaseHostId: selectedDatabaseHostId,
            sandboxName: selectedSandboxName
        },
        {
            skip: !credId || !regionId || !selectedDatabaseHostId || !selectedSandboxName
        }
    );

    useEffect(() => {
        if (!sandboxListLoading && getSandboxList?.sandboxListLoading) {
            dispatch(
                setAggregatedSandboxList([
                    ...aggregatedSandboxList,
                    ...(sandboxList?.items?.filter((item: any) => !item?.error) || [])
                ])
            );
            setSandboxCursor(sandboxList?.nextToken || null);
        }
        dispatch(
            setSandboxListState({
                databaseHosts: sandboxList?.items,
                sandboxListLoading,
                sandboxListError
            })
        );
    }, [sandboxList, sandboxListLoading, sandboxListError]);

    useEffect(() => {
        dispatch(
            setSandboxSavingsState({
                sandboxSavings,
                sandboxSavingsLoading,
                sandboxSavingsError
            })
        );
    }, [sandboxSavings, sandboxSavingsLoading, sandboxSavingsError]);

    useEffect(() => {
        if (!fetchingConnectionInfo) {
            dispatch(
                updateConnectionInfo({
                    selectedDatabaseHostId,
                    selectedSandboxName,
                    connectionString: connectionInfoData,
                    isLoading: false
                })
            );
        } else {
            dispatch(
                updateConnectionInfo({
                    selectedDatabaseHostId,
                    selectedSandboxName,
                    connectionString: '',
                    isLoading: true
                })
            );
        }
    }, [connectionInfoData, fetchingConnectionInfo, connectionInfoError]);

    return <></>;
};

export default SandboxApis;
