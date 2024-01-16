import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { jobMonitoringApi, useGetJobsListQuery } from "../../utils/apiService";
import { addInitialJMData, initialJobMonitoringState, setJobsList, setJobsListLoading } from "../../store/workloadFactory/jobMonitoringSlice";

const JobMonitoringApi = () => {
    const dispatch = useAppDispatch();

    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const timeInterval = useAppSelector(state => state.jobMonitoring.timeInterval);
    const downloadJobsLoading = useAppSelector(state => state.jobMonitoring.downloadJobsLoading);

    const [jobsCursor, setJobsCursor] = useState(null);
    const [time, setTime] = useState<{startTime: number, endTime: number} | null>(null);

    // skipApiCall to skip APi call when isActive is not true. Will make it true once API will be available.
    const [skipApiCall, setSkipApiCall] = useState(true);

    // Will Uncomment once API will be available
    useEffect(() => {
        if (downloadJobsLoading === true) {
            setSkipApiCall(true);
        } else {
            setSkipApiCall(true);
            setTimeout(() => {
                if (timeInterval) {
                    dispatch(jobMonitoringApi.util.resetApiState());
                    dispatch(addInitialJMData(initialJobMonitoringState));
                    const toDate = Date.now();
                    const fromDate = toDate - timeInterval * (3600 * 1000 * 24);
                    setTime({startTime: fromDate, endTime: toDate});
                    setSkipApiCall(false);
                }
            }, 0);
        }
    }, [timeInterval]);

    useEffect(() => {
        if (downloadJobsLoading === true) {
            setSkipApiCall(true);
        }
    }, [downloadJobsLoading]);

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
