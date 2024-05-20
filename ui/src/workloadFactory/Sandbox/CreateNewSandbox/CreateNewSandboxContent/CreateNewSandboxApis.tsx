import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import {
    useGetDatabaseHostsQuery,
    useGetDatabaseListQuery,
    useGetDatabaseMountPointsQuery,
    useGetDriveInfoQuery
} from '../../../../utils/apiService';
import {
    setAggregatedDbHost,
    setDatabaseHostState,
    setDatabaseListState,
    setDbMountPointsState,
    setDriveInfoState
} from '../../../../store/workloadFactory/createSandboxSlice';

const CreateSandboxApis = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const { source, aggregatedDbHostList, getDatabaseHosts, target } = useAppSelector(state => state.createSandbox);

    const [credId, setCredId] = useState(null);
    const [regionId, setRegionId] = useState(null);
    const [selectedDbHostId, setSelectedDbHostId] = useState<any>(null);
    const [selectedDbName, setSelectedDbName] = useState<any>(null);
    const [selectedInstanceName, setSelectedInstanceName] = useState<any>(null);
    const [selectedTargetDbHostId, setSelectedTargetDbHostId] = useState<any>(null);
    const [databaseHostCursor, setDatabaseHostCursor] = useState(null);

    useEffect(() => {
        setCredId(headerSelectedCred?.data?.credentialsId);
        setRegionId(headerSelectedRegion?.label2);
        dispatch(setAggregatedDbHost([]));
    }, [headerSelectedCred, headerSelectedRegion]);

    useEffect(() => {
        setSelectedDbHostId(source?.selectedDatabaseHost?.value);
        setSelectedDbName(source?.selectedDatabase?.label);
        setSelectedInstanceName(source?.selectedDatabaseInstance?.value);
    }, [source]);

    useEffect(() => {
        setSelectedTargetDbHostId(target?.selectedDatabaseHost?.value);
    }, [target]);

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

    const { data: driveInfoList, isFetching: driveInfoListLoading } = useGetDriveInfoQuery(
        {
            credentialId: credId,
            region: regionId,
            id: selectedTargetDbHostId,
            forSandbox: true
        },
        { skip: !credId || !regionId || !selectedTargetDbHostId }
    );

    const { data: dbMountPointsData, isFetching: dbMountPointsLoading } = useGetDatabaseMountPointsQuery(
        {
            credentialId: credId,
            region: regionId,
            databaseHostId: selectedDbHostId,
            databaseName: selectedDbName,
            instanceName: selectedInstanceName
        },
        { skip: !credId || !regionId || !selectedDbHostId || !selectedDbName || !selectedInstanceName }
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

    useEffect(() => {
        if (!driveInfoListLoading) {
            dispatch(setDriveInfoState({ driveInfoData: driveInfoList, driveInfoLoading: false }));
        } else {
            dispatch(setDriveInfoState({ driveInfoData: null, driveInfoLoading: true }));
        }
    }, [driveInfoList, driveInfoListLoading]);

    useEffect(() => {
        if (!dbMountPointsLoading) {
            dispatch(setDbMountPointsState({ dbMountPointsData, dbMountPointsLoading: false }));
        } else {
            dispatch(setDbMountPointsState({ dbMountPointsData: null, dbMountPointsLoading: true }));
        }
    }, [dbMountPointsData, dbMountPointsLoading]);

    return <></>;
};

export default CreateSandboxApis;
