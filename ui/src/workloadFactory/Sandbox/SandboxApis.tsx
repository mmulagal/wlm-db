import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    setAggregatedSandboxList,
    setSandboxListState,
    setSandboxSavingsState
} from '../../store/workloadFactory/sandboxSlice';
import { useGetSandboxListQuery, useGetSandboxSavingsQuery } from '../../utils/apiService';

const SandboxApis = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const { getSandboxList, aggregatedSandboxList } = useAppSelector(state => state.sandbox);

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
        { skip: !credId || !regionId }
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

    useEffect(() => {
        if (!sandboxListLoading && getSandboxList?.sandboxListLoading) {
            dispatch(setAggregatedSandboxList([...aggregatedSandboxList, ...(sandboxList?.items || [])]));
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

    return <></>;
};

export default SandboxApis;
