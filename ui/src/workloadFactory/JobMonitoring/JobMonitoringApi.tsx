import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { useGetJobsListQuery } from "../../utils/apiService";
import { setJobsList, setJobsListLoading } from "../../store/workloadFactory/jobMonitoringSlice";


const JobMonitoringApi = () => {
    const dispatch = useAppDispatch();

    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const [jobsCursor, setJobsCursor] = useState(null);

    const {
        data: jmJobsList,
        isFetching: jmJobsListLoading,
    } = useGetJobsListQuery({nextToken: jobsCursor});

    useEffect(() => {
        let oldList = jobsList || [];
        let newList = jmJobsList?.jobs || [];
        let mergedList = [...oldList, ...newList]
        dispatch(setJobsList(mergedList));
        setJobsCursor(jmJobsList?.nextToken);
    }, [jmJobsList]);

    useEffect(() => {
        dispatch(setJobsListLoading(jmJobsListLoading));
    }, [jmJobsListLoading]);

}

export default JobMonitoringApi;
