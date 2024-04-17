import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import { useGetDatabaseHostsQuery, useGetDatabaseListQuery } from '../../../../utils/apiService';
import {
    setAggregatedDbHost,
    setDatabaseHostState,
    setDatabaseListState
} from '../../../../store/workloadFactory/createSandboxSlice';

const CreateSandboxApis = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const { source, aggregatedDbHostList, getDatabaseHosts } = useAppSelector(state => state.createSandbox);

    const [credId, setCredId] = useState(null);
    const [regionId, setRegionId] = useState(null);
    const [selectedDbHostId, setSelectedDbHostId] = useState<any>(null);
    const [databaseHostCursor, setDatabaseHostCursor] = useState(null);

    useEffect(() => {
        setCredId(headerSelectedCred?.data?.credentialsId);
        setRegionId(headerSelectedRegion?.label2);
        dispatch(setAggregatedDbHost([]));
    }, [headerSelectedCred, headerSelectedRegion]);

    useEffect(() => {
        setSelectedDbHostId(source?.selectedDatabaseHost?.value);
    }, [source]);

    const {
        data: databaseHosts,
        isFetching: databaseHostsLoading,
        isError: databaseHostsError
    } = useGetDatabaseHostsQuery(
        {
            credentialId: credId,
            region: regionId,
            nextToken: databaseHostCursor
        },
        { skip: !credId || !regionId || (aggregatedDbHostList.length && !databaseHostCursor) }
    );

    const {
        data: databaseList,
        isFetching: databaseListLoading,
        isError: databaseListError
    } = useGetDatabaseListQuery(
        {
            credentialId: credId,
            region: regionId,
            id: selectedDbHostId
        },
        { skip: !credId || !regionId || !selectedDbHostId }
    );

    useEffect(() => {
        if (!databaseHostsLoading && getDatabaseHosts?.databaseHostsLoading) {
            dispatch(setAggregatedDbHost([...aggregatedDbHostList, ...(databaseHosts?.items || [])]));
            setDatabaseHostCursor(databaseHosts?.nextToken || null);
        }
        dispatch(
            setDatabaseHostState({
                databaseHosts: databaseHosts?.items,
                databaseHostsLoading,
                databaseHostsError
            })
        );
    }, [databaseHosts, databaseHostsLoading, databaseHostsError]);

    useEffect(() => {
        dispatch(
            setDatabaseListState({
                databaseListData: databaseList?.items,
                databaseListLoading,
                databaseListError
            })
        );
    }, [databaseList, databaseListLoading, databaseListError]);

    return <></>;
};

export default CreateSandboxApis;
