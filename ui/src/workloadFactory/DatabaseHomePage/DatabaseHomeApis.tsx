import { useEffect, useState } from "react";
import { setRefetchJobSummaryApi } from "../../store/mssql/msSqlActionSlice";
import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { 
    addAggregatedCosts,
    addAggregatedProtectionDbCount, 
    addAggregatedStorageSavings, 
    addAggregateHostsCountData, 
    addDatabaseHosts, 
    addDatabaseHostsList, 
    addDatabaseJobs, 
    addJobsSummary
} from "../../store/workloadFactory/databaseHomeSlice";
import { 
    useGetDatabaseHostsQuery, 
    useGetDatabaseJobsQuery, 
    useGetJobsSummaryQuery, 
    useGetStatusQuery
} from "../../utils/apiService";
import { 
    getAggrCost,
    getAggrProtection,
    getAggrStorageSavings,
    getHostStatusCount, 
    jobStatusPercent, 
    mergeDatabaseHostsData 
} from "../../utils/utilityFunctions";

const DatabaseHomeApis = () => {
    const dispatch = useAppDispatch();

    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsData } = useAppSelector(state => state.databaseHome.getDatabaseJobs);
    const refetchJobSummaryApi = useAppSelector(state => state.msSqlAction.refetchJobSummaryApi);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    
    const [hostCursor, setHostCursor] = useState(null);
    const [jobsCursor, setJobsCursor] = useState(null);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [time, setTime] = useState<{startTime: number, endTime: number} | null>(null);

    useEffect(() => {
        const toDate = Date.now();
        const fromDate = toDate - 30 * (3600 * 1000 * 24);
        setTime({startTime: fromDate, endTime: toDate});
    }, []);

    const {
        data: databaseHosts,
        isFetching: databaseHostsLoading,
        isError: databaseHostsError
    } = useGetDatabaseHostsQuery(
        {credentialId: headerSelectedCred?.data?.credentialsId, region: headerSelectedRegion?.label2, nextToken: hostCursor}, 
        {skip: skipApiCall}
    );

    const {
        data: databaseJobs,
        isFetching: databaseJobsLoading,
        isError: databaseJobsError
    } = useGetDatabaseJobsQuery(
        {credentialId: headerSelectedCred?.data?.credentialsId, region: headerSelectedRegion?.label2, nextToken: jobsCursor}, 
        {skip: skipApiCall}
    );

    const {
        data: jobsSummaryData,
        isFetching: jobsSummaryLoading,
        isError: jobsSummaryError,
        refetch: jobsSummaryRefetch
    } = useGetJobsSummaryQuery(
        {credentialId: headerSelectedCred?.data?.credentialsId, region: headerSelectedRegion?.label2, startTime: time?.startTime, endTime: time?.endTime}, 
        {skip: skipApiCall}
    );

    useEffect(() => {
        if(refetchJobSummaryApi) {
            dispatch(setRefetchJobSummaryApi(false));
            jobsSummaryRefetch();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchJobSummaryApi])

    useEffect(() => {
        if(headerSelectedCred && headerSelectedRegion) {
            setSkipApiCall(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedCred, headerSelectedRegion]);

    useEffect(() => {
        if(databaseHostsError) {
            dispatch(addDatabaseHosts({undefined, databaseHostsLoading, databaseHostsError}));
        } else {
            let oldList = databaseHostsData || [];
            let newList = databaseHosts?.items || [];
            dispatch(addDatabaseHosts({databaseHostsData: [...oldList, ...newList], databaseHostsLoading, databaseHostsError}));
                setHostCursor(databaseHosts?.nextToken || null);
        }  
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHosts, databaseHostsLoading, databaseHostsError]);

    useEffect(() => {
        if(databaseJobsError) {
            dispatch(addDatabaseJobs({undefined, databaseJobsLoading, databaseJobsError}));
        } else {
            let oldList = databaseJobsData || [];
            let newList = databaseJobs?.items || [];
            dispatch(addDatabaseJobs({databaseJobsData: [...oldList, ...newList], databaseJobsLoading, databaseJobsError}));
                setJobsCursor(databaseJobs?.nextToken || null);
        }  
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseJobs, databaseJobsLoading, databaseJobsError]);

    useEffect(() => {
        if(jobsSummaryError) {
            dispatch(addJobsSummary({undefined, jobsSummaryLoading, jobsSummaryError}));
        } else {
            dispatch(addJobsSummary({jobsSummaryData: jobStatusPercent(jobsSummaryData), jobsSummaryLoading, jobsSummaryError}));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobsSummaryData, jobsSummaryLoading, jobsSummaryError]);

    // To merge database host and database jobs data
    useEffect(() => {
        const mergedData = mergeDatabaseHostsData(databaseHostsData, databaseJobsData);
        dispatch(addDatabaseHostsList(mergedData));

        const hostStatusCount = getHostStatusCount(mergedData);
        dispatch(addAggregateHostsCountData(hostStatusCount));

        const aggrProtection = getAggrProtection(mergedData);
        dispatch(addAggregatedProtectionDbCount(aggrProtection));

        const aggrStorage = getAggrStorageSavings(mergedData);
        dispatch(addAggregatedStorageSavings(aggrStorage));

        const aggrCost = getAggrCost(mergedData);
        dispatch(addAggregatedCosts(aggrCost));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsData, databaseJobsData]);

    return <></>;
}

export default DatabaseHomeApis;
