import { useEffect, useState } from 'react';
import { setRefetchJobSummaryApi } from '../../store/mssql/msSqlActionSlice';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addAggregatedCosts,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregateHostsCountData,
    addDatabaseHosts,
    addDatabaseHostsList,
    addJobsSummary
} from '../../store/workloadFactory/databaseHomeSlice';
import { useGetDatabaseHostsQuery, useGetJobsSummaryQuery } from '../../utils/apiService';
import {
    getAggrCost,
    getAggrProtection,
    getAggrStorageSavings,
    getHostStatusCount,
    jobStatusPercent,
    mergeDatabaseHostsData
} from '../../utils/utilityFunctions';

const DatabaseHomeApis = () => {
    const dispatch = useAppDispatch();

    const { databaseHostsData } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const refetchJobSummaryApi = useAppSelector(state => state.msSqlAction.refetchJobSummaryApi);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);

    const [hostCursor, setHostCursor] = useState(null);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [time, setTime] = useState<{ startTime: number; endTime: number } | null>(null);

    const [credId, setCredId] = useState(headerSelectedCred?.data?.credentialsId || '');
    const [regionId, setRegionId] = useState(headerSelectedRegion?.label2 || '');

    useEffect(() => {
        const toDate = Date.now();
        const fromDate = toDate - 30 * (3600 * 1000 * 24);
        setTime({ startTime: fromDate, endTime: toDate });
    }, []);

    const {
        data: databaseHosts,
        isFetching: databaseHostsLoading,
        isError: databaseHostsError
    } = useGetDatabaseHostsQuery(
        {
            credentialId: credId,
            region: regionId,
            nextToken: hostCursor
        },
        { skip: skipApiCall }
    );

    const {
        data: jobsSummaryData,
        isFetching: jobsSummaryLoading,
        isError: jobsSummaryError,
        refetch: jobsSummaryRefetch
    } = useGetJobsSummaryQuery(
        {
            credentialId: headerSelectedCred?.data?.credentialsId,
            region: headerSelectedRegion?.label2,
            startTime: time?.startTime,
            endTime: time?.endTime
        },
        { skip: skipApiCall }
    );

    useEffect(() => {
        if (refetchJobSummaryApi) {
            dispatch(setRefetchJobSummaryApi(false));
            jobsSummaryRefetch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchJobSummaryApi]);

    useEffect(() => {
        if (headerSelectedCred && headerSelectedRegion) {
            setCredId(headerSelectedCred?.data?.credentialsId);
            setRegionId(headerSelectedRegion?.label2);
            setTimeout(() => {
                setSkipApiCall(false);
            }, 0);
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
        if (jobsSummaryError) {
            dispatch(addJobsSummary({ undefined, jobsSummaryLoading, jobsSummaryError }));
        } else {
            dispatch(
                addJobsSummary({
                    jobsSummaryData: jobStatusPercent(jobsSummaryData),
                    jobsSummaryLoading,
                    jobsSummaryError
                })
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobsSummaryData, jobsSummaryLoading, jobsSummaryError]);

    // To merge database host and database jobs data
    useEffect(() => {
        const mergedData = mergeDatabaseHostsData(databaseHostsData);
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
    }, [databaseHostsData]);

    return <></>;
};

export default DatabaseHomeApis;
