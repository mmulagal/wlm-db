import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { useGetJobsListQuery } from "../../utils/apiService";
import { setJobsList, setJobsListLoading } from "../../store/workloadFactory/jobMonitoringSlice";

const JobMonitoringApi = () => {
    const dispatch = useAppDispatch();

    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const timeInterval = useAppSelector(state => state.jobMonitoring.timeInterval);
    const fromTime = useAppSelector(state => state.jobMonitoring.fromTime);
    const toTime = useAppSelector(state => state.jobMonitoring.toTime);

    const [jobsCursor, setJobsCursor] = useState(null);
    const [time, setTime] = useState<{startTime: number, endTime: number} | null>(null);

    // skipApiCall to skip APi call when isActive is not true. Will make it true once API will be available.
    const [skipApiCall, setSkipApiCall] = useState(false);

    // Will Uncomment once API will be available
    // useEffect(() => {
    //     setSkipApiCall(true);
    //     setTimeout(() => {
    //         if (timeInterval && fromTime && toTime) {
    //             dispatch(setJobsListLoading(false));
    //             dispatch(setJobsList([]));
    //             setTime({startTime: fromTime, endTime: toTime});
    //             setSkipApiCall(false);
    //         }
    //     }, 0);
    // }, [fromTime]);

    const {
        data: jmJobsList,
        isFetching: jmJobsListLoading,
    } = useGetJobsListQuery({nextToken: jobsCursor, startTime: time?.startTime, endTime: time?.endTime}, {skip: skipApiCall});

    useEffect(() => {
        let oldList = jobsList || [];
        let newList = jmJobsList?.items || [];
        let mergedList = [...oldList, ...newList]
        dispatch(setJobsList(mergedList));
        setJobsCursor(jmJobsList?.nextToken || null);
    }, [jmJobsList]);

    useEffect(() => {
        dispatch(setJobsListLoading(jmJobsListLoading));
    }, [jmJobsListLoading]);

}

export default JobMonitoringApi;
