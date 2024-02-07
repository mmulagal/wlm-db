import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import { addDatabaseHosts, addDatabaseHostsList, addDatabaseJobs } from '../../store/workloadFactory/databaseHomeSlice';
import { useGetDatabaseHostsQuery, useGetDatabaseJobsQuery } from '../../utils/apiService';
import { mergeDatabaseHostsData } from '../../utils/utilityFunctions';

const InventoryApis = () => {
    const dispatch = useAppDispatch();

    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsData } = useAppSelector(state => state.databaseHome.getDatabaseJobs);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);

    const [hostCursor, setHostCursor] = useState(null);
    const [jobsCursor, setJobsCursor] = useState(null);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);

    const {
        data: databaseHosts,
        isFetching: databaseHostsLoading,
        isError: databaseHostsError
    } = useGetDatabaseHostsQuery(
        {
            credentialId: headerSelectedCred?.data?.credentialsId,
            region: headerSelectedRegion?.label2,
            nextToken: hostCursor
        },
        { skip: skipApiCall }
    );

    const {
        data: databaseJobs,
        isFetching: databaseJobsLoading,
        isError: databaseJobsError
    } = useGetDatabaseJobsQuery(
        {
            credentialId: headerSelectedCred?.data?.credentialsId,
            region: headerSelectedRegion?.label2,
            nextToken: jobsCursor
        },
        { skip: skipApiCall }
    );

    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setSkipApiCall(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedCred, headerSelectedRegion]);

    useEffect(() => {
        if (databaseHostsError) {
            dispatch(addDatabaseHosts({ undefined, databaseHostsLoading, databaseHostsError }));
        } else {
            let oldList = databaseHostsData || [];
            let newList = databaseHosts?.items || [];
            dispatch(
                addDatabaseHosts({
                    databaseHostsData: [...oldList, ...newList],
                    databaseHostsLoading,
                    databaseHostsError
                })
            );
            setHostCursor(databaseHosts?.nextToken || null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHosts, databaseHostsLoading, databaseHostsError]);

    useEffect(() => {
        if (databaseJobsError) {
            dispatch(addDatabaseJobs({ undefined, databaseJobsLoading, databaseJobsError }));
        } else {
            let oldList = databaseJobsData || [];
            let newList = databaseJobs?.items || [];
            dispatch(
                addDatabaseJobs({ databaseJobsData: [...oldList, ...newList], databaseJobsLoading, databaseJobsError })
            );
            setJobsCursor(databaseJobs?.nextToken || null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseJobs, databaseJobsLoading, databaseJobsError]);

    // To merge database host and database jobs data
    useEffect(() => {
        const mergedData = mergeDatabaseHostsData(databaseHostsData, databaseJobsData);
        dispatch(addDatabaseHostsList(mergedData));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsData, databaseJobsData]);

    return <></>;
};

export default InventoryApis;
