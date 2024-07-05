import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    setAggregatedSandboxList,
    setAllSandboxList,
    setSandboxListState,
    setSandboxSavingsState
} from '../../store/workloadFactory/sandboxSlice';
import { useGetSandboxListQuery, useGetSandboxSavingsQuery } from '../../utils/apiService';

const SandboxApis = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const { getSandboxList, aggregatedSandboxList, allSandboxList } = useAppSelector(state => state.sandbox);
    const { isRefreshed } = useAppSelector(state => state.inventory);
    const { refreshBlocked } = useAppSelector(state => state?.auth);

    const [credId, setCredId] = useState(null);
    const [regionId, setRegionId] = useState(null);
    const [sandboxCursor, setSandboxCursor] = useState(null);

    useEffect(() => {
        if (!refreshBlocked) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
            dispatch(setAggregatedSandboxList([]));
            dispatch(setAllSandboxList([]));
        }
    }, [headerSelectedCred, headerSelectedRegion, isRefreshed, refreshBlocked]);

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
        { skip: !credId || !regionId || (allSandboxList.length && !sandboxCursor) || refreshBlocked }
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
        { skip: !credId || !regionId || refreshBlocked }
    );

    useEffect(() => {
        if (!sandboxListLoading && getSandboxList?.sandboxListLoading) {
            dispatch(
                setAggregatedSandboxList([
                    ...aggregatedSandboxList,
                    ...(sandboxList?.items?.filter((item: any) => !item?.error) || [])
                ])
            );
            dispatch(setAllSandboxList([...(allSandboxList || []), ...(sandboxList?.items || [])]));
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
