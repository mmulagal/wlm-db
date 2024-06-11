import { useEffect, useState } from 'react';
import { setRefetchJobSummaryApi } from '../../store/mssql/msSqlActionSlice';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addAggregatedCosts,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregateHostsCountData,
    addDatabaseHostsList,
    addJobsSummary
} from '../../store/workloadFactory/databaseHomeSlice';
import { useGetJobsSummaryQuery } from '../../utils/apiService';
import {
    getAggrCost,
    getAggrProtection,
    getAggrStorageSavings,
    getHostStatusCount,
    jobStatusPercent,
    mergeDatabaseHostsData,
    resetDBHomePageState
} from '../../utils/utilityFunctions';

const DatabaseHomeApis = () => {
    const dispatch = useAppDispatch();

    const databaseHostsDataV1 = useAppSelector(state => state.inventory.getDatabaseHosts.databaseHostsData);
    const databaseHostsDataV2 = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsData);
    const isInventoryV2 = useAppSelector(state => state.auth.isInventoryV2);
    const { sandboxSavings } = useAppSelector(state => state.sandbox.getSandboxSavings);
    const refetchJobSummaryApi = useAppSelector(state => state.msSqlAction.refetchJobSummaryApi);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);
    const [time, setTime] = useState<{ startTime: number; endTime: number } | null>(null);

    useEffect(() => {
        const toDate = Date.now();
        const fromDate = toDate - 30 * (3600 * 1000 * 24);
        setTime({ startTime: fromDate, endTime: toDate });
    }, []);

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
        resetDBHomePageState(dispatch); // reset dahsboard state if cred and region is changed
        if (headerSelectedCred && headerSelectedRegion) {
            setTimeout(() => {
                setSkipApiCall(false);
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedCred, headerSelectedRegion]);

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

    // To have database hosts data in dashboard - V1 
    useEffect(() => {
        if (isInventoryV2) {
            return;
        };
        const mergedData = mergeDatabaseHostsData(databaseHostsDataV1);
        dispatch(addDatabaseHostsList(mergedData));

        const hostStatusCount = getHostStatusCount(mergedData);
        dispatch(addAggregateHostsCountData(hostStatusCount));

        const aggrProtection = getAggrProtection(mergedData);
        dispatch(addAggregatedProtectionDbCount(aggrProtection));

        const aggrStorage = getAggrStorageSavings(mergedData, sandboxSavings);
        dispatch(addAggregatedStorageSavings(aggrStorage));

        const aggrCost = getAggrCost(mergedData);
        dispatch(addAggregatedCosts(aggrCost));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsDataV1, sandboxSavings]);


    // To have database hosts data in dashboard - V2
    useEffect(() => {
        if (!isInventoryV2) {
            return;
        };
        // ToDo - use different functions here for V2 API response
        const mergedData = mergeDatabaseHostsData(databaseHostsDataV2);
        dispatch(addDatabaseHostsList(mergedData));

        const hostStatusCount = getHostStatusCount(mergedData);
        dispatch(addAggregateHostsCountData(hostStatusCount));

        const aggrProtection = getAggrProtection(mergedData);
        dispatch(addAggregatedProtectionDbCount(aggrProtection));

        const aggrStorage = getAggrStorageSavings(mergedData, sandboxSavings);
        dispatch(addAggregatedStorageSavings(aggrStorage));

        const aggrCost = getAggrCost(mergedData);
        dispatch(addAggregatedCosts(aggrCost));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsDataV2, sandboxSavings]);

    return <></>;
};

export default DatabaseHomeApis;
