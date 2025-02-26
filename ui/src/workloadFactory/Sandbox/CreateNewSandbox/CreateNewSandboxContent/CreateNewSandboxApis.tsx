import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import {
    useGetDatabaseHostsForSandboxV2Query,
    useGetDatabaseListV2Query,
    useGetDatabaseMountPointsQuery,
    useGetDriveInfoV2Query
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

    const { headerSelectedCredSandbox, headerSelectedRegionSandbox } = useAppSelector(state => state.headers);
    const { source, aggregatedDbHostList, getDatabaseHosts, target } = useAppSelector(state => state.createSandbox);

    const [credId, setCredId] = useState(null);
    const [regionId, setRegionId] = useState(null);
    const [selectedDbHostId, setSelectedDbHostId] = useState<any>(null);
    const [selectedDbName, setSelectedDbName] = useState<any>(null);
    const [selectedInstanceName, setSelectedInstanceName] = useState<any>(null);
    const [selectedInstanceId, setSelectedInstanceId] = useState<any>(null);
    const [selectedTargetDbHostId, setSelectedTargetDbHostId] = useState<any>(null);
    const [selectedTargetInstanceId, setSelectedTargetInstanceId] = useState<any>(null);
    const [databaseHostCursor, setDatabaseHostCursor] = useState(null);
    const [fetchedDatabases, setFetchedDatabases] = useState(false);

    useEffect(() => {
        setCredId(headerSelectedCredSandbox?.data?.credentialsId);
        setRegionId(headerSelectedRegionSandbox?.label2);
        dispatch(setAggregatedDbHost([]));
    }, [headerSelectedCredSandbox, headerSelectedRegionSandbox]);

    useEffect(() => {
        setSelectedDbHostId(source?.selectedDatabaseHost?.value);
        setSelectedDbName(source?.selectedDatabase?.label);
        setSelectedInstanceName(source?.selectedDatabaseInstance?.label);
        setSelectedInstanceId(source?.selectedDatabaseInstance?.value);
    }, [source]);

    useEffect(() => {
        setSelectedTargetDbHostId(target?.selectedDatabaseHost?.value);
        setSelectedTargetInstanceId(target?.selectedDatabaseInstance?.value);
    }, [target]);

    const {
        data: databaseHostsV2,
        isFetching: databaseHostsLoadingV2,
        isError: databaseHostsErrorV2
    } = useGetDatabaseHostsForSandboxV2Query(
        {
            credentialId: credId,
            region: regionId,
            nextToken: databaseHostCursor
        },
        { skip: !credId || !regionId || (aggregatedDbHostList.length && !databaseHostCursor) }
    );

    const {
        data: databaseListV2,
        isFetching: databaseListLoadingV2,
        isError: databaseListErrorV2
    } = useGetDatabaseListV2Query(
        {
            credentialId: credId,
            region: regionId,
            id: selectedDbHostId,
            sqlInstanceId: selectedInstanceId
        },
        { skip: !credId || !regionId || !selectedDbHostId || !selectedInstanceId }
    );

    const { data: driveInfoList, isFetching: driveInfoListLoading } = useGetDriveInfoV2Query(
        {
            credentialId: credId,
            region: regionId,
            id: selectedTargetDbHostId,
            instanceId: selectedTargetInstanceId,
            forSandbox: true
        },
        { skip: !credId || !regionId || !selectedTargetDbHostId || !selectedTargetInstanceId }
    );

    const { data: dbMountPointsData, isFetching: dbMountPointsLoading } = useGetDatabaseMountPointsQuery(
        {
            credentialId: credId,
            region: regionId,
            databaseHostId: selectedDbHostId,
            databaseName: selectedDbName,
            instanceId: selectedInstanceId
        },
        {
            skip:
                !credId || !regionId || !selectedDbHostId || !selectedDbName || !selectedInstanceId || !fetchedDatabases
        }
    );

    // for v2
    useEffect(() => {
        if (!databaseHostsLoadingV2 && getDatabaseHosts?.databaseHostsLoading) {
            dispatch(setAggregatedDbHost([...aggregatedDbHostList, ...(databaseHostsV2?.items || [])]));
            setDatabaseHostCursor(databaseHostsV2?.nextToken || null);
        }
        dispatch(
            setDatabaseHostState({
                databaseHosts: databaseHostsV2?.items,
                databaseHostsLoading: databaseHostsLoadingV2,
                databaseHostsError: databaseHostsErrorV2
            })
        );
    }, [databaseHostsV2, databaseHostsLoadingV2, databaseHostsErrorV2]);

    // for v2
    useEffect(() => {
        dispatch(
            setDatabaseListState({
                databaseListData: databaseListV2?.items,
                databaseListLoading: databaseListLoadingV2,
                databaseListError: databaseListErrorV2
            })
        );
        if (!databaseListLoadingV2) {
            setFetchedDatabases(true);
        }
    }, [databaseListV2, databaseListLoadingV2, databaseListErrorV2]);

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
