import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { jobMonitoringApi, useGetJobsListQuery } from "../../utils/apiService";
import { addInitialJMData, initialJobMonitoringState, setJobsList, setJobsListLoading } from "../../store/workloadFactory/jobMonitoringSlice";


const JobMonitoringApi = () => {
    const dispatch = useAppDispatch();

    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const timeInterval = useAppSelector(state => state.jobMonitoring.timeInterval);
    const [jobsCursor, setJobsCursor] = useState(null);

    const {
        data: jmJobsList,
        isFetching: jmJobsListLoading,
        refetch: jmJobsRefetch
    } = useGetJobsListQuery({nextToken: jobsCursor});

    useEffect(() => {
        dispatch(jobMonitoringApi.util.resetApiState());
        dispatch(setJobsList([]));
        jmJobsRefetch();
    }, [timeInterval]);

    useEffect(() => {
        let oldList = jobsList || [];
        let newList = jmJobsList?.jobs || [];
        let mergedList = [...oldList, ...newList]
        dispatch(setJobsList(mergedList));
        setJobsCursor(jmJobsList?.nextToken);
    }, [jmJobsList]);

    useEffect(() => {
        dispatch(setJobsListLoading(jmJobsListLoading));
    }, [jmJobsListLoading])

    

}

export default JobMonitoringApi;
