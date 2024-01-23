import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { useGetJobsListQuery, useGetJobsSummaryDataQuery, useGetJobsSummaryTimelineDataQuery } from "../../utils/apiService";
import { 
    setJmJobsSummary, 
    setJmJobsSummaryLoading, 
    setJobsList, 
    setJobsListLoading, 
    setJobsSummaryTimeline, 
    setJobsSummaryTimelineLoading 
} from "../../store/workloadFactory/jobMonitoringSlice";
import { groupByJobSummaryTimeline, jobStatusPercent } from "../../utils/utilityFunctions";

const JobMonitoringApi = () => {
    const dispatch = useAppDispatch();

    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const timeInterval = useAppSelector(state => state.jobMonitoring.timeInterval);
    const fromTime = useAppSelector(state => state.jobMonitoring.fromTime);
    const toTime = useAppSelector(state => state.jobMonitoring.toTime);

    const [jobsCursor, setJobsCursor] = useState(null);
    const [time, setTime] = useState<{startTime: number, endTime: number} | null>(null);
    const [intervalType, setIntervalType] = useState('hour');
    const [frequency, setFrequency] = useState(1);

    const [skipApiCall, setSkipApiCall] = useState(true);

    useEffect(() => {
        setSkipApiCall(true);
        setTimeout(() => {
            if (timeInterval && fromTime && toTime) {
                dispatch(setJobsListLoading(false));
                dispatch(setJobsList([]));
                setTime({startTime: fromTime, endTime: toTime});
                setSkipApiCall(false);
            }
        }, 0);

        // settting interval type
        if (timeInterval === 1) {
            setIntervalType('hour');
            setFrequency(4);
        } else {
            setIntervalType('day');
            setFrequency(1);
        }
    }, [fromTime]);

    const {
        data: jmJobsList,
        isFetching: jmJobsListLoading,
    } = useGetJobsListQuery({nextToken: jobsCursor, startTime: time?.startTime, endTime: time?.endTime}, {skip: skipApiCall});

    const {
        data: jmJobsSummary,
        isFetching: jmJobsSummaryLoading,
    } = useGetJobsSummaryDataQuery({startTime: time?.startTime, endTime: time?.endTime}, {skip: skipApiCall});

    const {
        data: jobsSummaryTimeline,
        isFetching: jobsSummaryTimelineLoading,
    } = useGetJobsSummaryTimelineDataQuery(
        {startTime: time?.startTime, endTime: time?.endTime, intervalType: intervalType, frequency: frequency}, 
        {skip: skipApiCall}
        );

    useEffect(() => {
        dispatch(setJobsListLoading(jmJobsListLoading));
        if (!jmJobsListLoading) {
            let oldList = jobsList || [];
            let newList = jmJobsList?.items || [];
            let mergedList = [...oldList, ...newList]
            dispatch(setJobsList(mergedList));
            setJobsCursor(jmJobsList?.nextToken || null);
        }
    }, [jmJobsList, jmJobsListLoading]);

    useEffect(() => {
        const data = jobStatusPercent(jmJobsSummary || {}) ;
        dispatch(setJmJobsSummary(data));
    }, [jmJobsSummary]);

    useEffect(() => {
        dispatch(setJmJobsSummaryLoading(jmJobsSummaryLoading));
    }, [jmJobsSummaryLoading]);

    useEffect(() => {
        dispatch(setJobsSummaryTimelineLoading(jobsSummaryTimelineLoading));
        if (jobsSummaryTimelineLoading) {
            dispatch(setJobsSummaryTimeline([]));
        } else {
            const data = groupByJobSummaryTimeline(jobsSummaryTimeline || [], timeInterval) ;
            dispatch(setJobsSummaryTimeline(data));
        }
    }, [jobsSummaryTimeline, jobsSummaryTimelineLoading]);

}

export default JobMonitoringApi;
