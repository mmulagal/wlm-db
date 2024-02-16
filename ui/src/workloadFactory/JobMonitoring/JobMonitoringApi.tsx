import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    useGetJobsListQuery,
    useGetJobsSummaryDataQuery,
    useGetJobsSummaryTimelineDataQuery
} from '../../utils/apiService';
import {
    setJmJobsSummary,
    setJmJobsSummaryLoading,
    setJobsList,
    setJobsListLoading,
    setJobsSummaryTimeline,
    setJobsSummaryTimelineLoading
} from '../../store/workloadFactory/jobMonitoringSlice';
import { groupByJobSummaryTimeline, jobStatusPercent } from '../../utils/utilityFunctions';

const JobMonitoringApi = () => {
    const dispatch = useAppDispatch();

    const jobsList = useAppSelector(state => state.jobMonitoring.jobsList);
    const timeInterval = useAppSelector(state => state.jobMonitoring.timeInterval);
    const fromTime = useAppSelector(state => state.jobMonitoring.fromTime);
    const toTime = useAppSelector(state => state.jobMonitoring.toTime);
    const refreshTime = useAppSelector(state => state.headers.refreshTime);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);

    const [jobsCursor, setJobsCursor] = useState(null);
    const [time, setTime] = useState<{ startTime: number; endTime: number } | null>(null);

    const [skipJobListApiCall, setSkipJobListApiCall] = useState(true);
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');

    useEffect(() => {
        setSkipApiCall(true);
        setSkipJobListApiCall(true);
        if (headerSelectedCred && headerSelectedRegion) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
        }
        setTimeout(() => {
            if (timeInterval && fromTime && toTime && headerSelectedCred && headerSelectedRegion) {
                dispatch(setJobsListLoading(false));
                dispatch(setJobsList([]));
                setTime({ startTime: fromTime, endTime: toTime });
                setSkipApiCall(false);
                setSkipJobListApiCall(false);
            }
        }, 0);
    }, [fromTime, refreshTime, headerSelectedCred, headerSelectedRegion]);

    const { data: jmJobsList, isFetching: jmJobsListLoading } = useGetJobsListQuery(
        {
            credentialId: credId,
            region: regionId,
            nextToken: jobsCursor,
            startTime: time?.startTime,
            endTime: time?.endTime
        },
        { skip: skipJobListApiCall }
    );

    const { data: jmJobsSummary, isFetching: jmJobsSummaryLoading } = useGetJobsSummaryDataQuery(
        {
            credentialId: credId,
            region: regionId,
            startTime: time?.startTime,
            endTime: time?.endTime
        },
        { skip: skipApiCall }
    );

    const { data: jobsSummaryTimeline, isFetching: jobsSummaryTimelineLoading } = useGetJobsSummaryTimelineDataQuery(
        {
            credentialId: credId,
            region: regionId,
            startTime: time?.startTime,
            endTime: time?.endTime
        },
        { skip: skipApiCall }
    );

    useEffect(() => {
        dispatch(setJobsListLoading(jmJobsListLoading));
        if (!jmJobsListLoading) {
            let oldList = jobsList || [];
            let newList = jmJobsList?.items || [];
            let mergedList = [...oldList, ...newList];
            dispatch(setJobsList(mergedList));
            setJobsCursor(jmJobsList?.nextToken || null);
            if (!jmJobsList?.nextToken) {
                setSkipJobListApiCall(true);
            }
        }
    }, [jmJobsList, jmJobsListLoading]);

    useEffect(() => {
        const data = jobStatusPercent(jmJobsSummary || {});
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
            const data = groupByJobSummaryTimeline(jobsSummaryTimeline || [], timeInterval);
            dispatch(setJobsSummaryTimeline(data));
        }
    }, [jobsSummaryTimeline, jobsSummaryTimelineLoading]);
};

export default JobMonitoringApi;
