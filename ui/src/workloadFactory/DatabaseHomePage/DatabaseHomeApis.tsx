import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { addDatabaseHosts, addDatabaseHostsList, addDatabaseJobs, addJobsSummary } from "../../store/workloadFactory/databaseHomeSlice";
import { 
    useGetDatabaseHostsQuery, 
    useGetDatabaseJobsQuery, 
    useGetJobsSummaryQuery 
} from "../../utils/apiService";
import { mergeDatabaseHostsData } from "../../utils/utilityFunctions";

const DatabaseHomeApis = () => {
    const dispatch = useAppDispatch();

    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsData } = useAppSelector(state => state.databaseHome.getDatabaseJobs);
    
    const [hostCursor, setHostCursor] = useState(null);
    const [jobsCursor, setJobsCursor] = useState(null);

    const {
        data: databaseHosts,
        isFetching: databaseHostsLoading,
        isError: databaseHostsError
    } = useGetDatabaseHostsQuery({nextToken: hostCursor});

    const {
        data: databaseJobs,
        isFetching: databaseJobsLoading,
        isError: databaseJobsError
    } = useGetDatabaseJobsQuery({nextToken: jobsCursor});

    const {
        data: jobsSummaryData,
        isFetching: jobsSummaryLoading,
        isError: jobsSummaryError
    } = useGetJobsSummaryQuery('');

    useEffect(() => {
        if(databaseHostsError) {
            dispatch(addDatabaseHosts({undefined, databaseHostsLoading, databaseHostsError}));
        } else {
            let oldList = databaseHostsData || [];
            let newList = databaseHosts?.items || [];
            dispatch(addDatabaseHosts({databaseHostsData: [...oldList, ...newList], databaseHostsLoading, databaseHostsError}));
            if (databaseHosts?.nextToken) {
                setHostCursor(databaseHosts?.nextToken);
            }
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
            if (databaseJobs?.nextToken) {
                setJobsCursor(databaseJobs?.nextToken);
            }
        }  
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseJobs, databaseJobsLoading, databaseJobsError]);

    useEffect(() => {
        if(jobsSummaryError) {
            dispatch(addJobsSummary({undefined, jobsSummaryLoading, jobsSummaryError}));
        } else {
            dispatch(addJobsSummary({jobsSummaryData, jobsSummaryLoading, jobsSummaryError}));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobsSummaryData, jobsSummaryLoading, jobsSummaryError]);

    // To merge database host and database jobs data
    useEffect(() => {
        const mergedData = mergeDatabaseHostsData(databaseHostsData, databaseJobsData);
        dispatch(addDatabaseHostsList(mergedData));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsData, databaseJobsData]);

    return;
}

export default DatabaseHomeApis;
