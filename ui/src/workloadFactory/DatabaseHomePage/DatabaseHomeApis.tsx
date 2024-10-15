import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addAggregatedCosts,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregateHostsCountData,
    addJobsSummary,
    addJobsSummaryLoading
} from '../../store/workloadFactory/databaseHomeSlice';
import { useLazyGetJobsSummaryQuery } from '../../utils/apiService';
import { jobStatusPercent, resetDBHomePageState } from '../../utils/utilityFunctions';
import {
    getManageAggrCost,
    getManagedAggrProtection,
    getManagedAggrStorageSavings,
    getManagedHostCount
} from './DatabaseHomeUtils';

const DatabaseHomeApis = () => {
    const dispatch = useAppDispatch();
    const databaseHostsDataV2 = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsData);
    const { sandboxSavings } = useAppSelector(state => state.sandbox.getSandboxSavings);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const refreshTime = useAppSelector(state => state.headers.refreshTime);

    const [getJobsSummaryApi] = useLazyGetJobsSummaryQuery();

    const getJobsSummaryData = async () => {
        const endTime = Date.now();
        const startTime = endTime - 30 * (3600 * 1000 * 24);
        try {
            const result: any = await getJobsSummaryApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                region: headerSelectedRegion?.label2,
                startTime: startTime,
                endTime: endTime
            });

            if (result && !result?.error) {
                dispatch(
                    addJobsSummary({
                        jobsSummaryData: jobStatusPercent(result?.data),
                        jobsSummaryLoading: false,
                        jobsSummaryError: undefined
                    })
                );
            } else {
                dispatch(
                    addJobsSummary({
                        jobsSummaryData: undefined,
                        jobsSummaryLoading: false,
                        jobsSummaryError: undefined
                    })
                );
            }
        } catch (error) {
            dispatch(
                addJobsSummary({ jobsSummaryData: undefined, jobsSummaryLoading: false, jobsSummaryError: undefined })
            );
        }
    };

    useEffect(() => {
        resetDBHomePageState(dispatch); // reset dahsboard state if cred and region is changed
        if (headerSelectedCred && headerSelectedRegion && refreshTime) {
            dispatch(addJobsSummaryLoading(true));
            setTimeout(() => {
                getJobsSummaryData();
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [headerSelectedCred, headerSelectedRegion, refreshTime]);

    // To have database hosts data in dashboard - V2
    useEffect(() => {
        if (!databaseHostsDataV2) {
            return;
        }

        const aggrProtection = getManagedAggrProtection(databaseHostsDataV2);
        dispatch(addAggregatedProtectionDbCount(aggrProtection));

        const aggrStorage = getManagedAggrStorageSavings(databaseHostsDataV2, sandboxSavings);
        dispatch(addAggregatedStorageSavings(aggrStorage));

        const aggrCost = getManageAggrCost(databaseHostsDataV2);
        dispatch(addAggregatedCosts(aggrCost));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsDataV2, sandboxSavings]);

    // To have database hosts count data in dashboard - V2
    useEffect(() => {
        if (!databaseHostsDataV2) {
            return;
        }
        const hostStatusCount = getManagedHostCount(databaseHostsDataV2, dispatch);
        dispatch(addAggregateHostsCountData(hostStatusCount));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsDataV2, inventoryTableData]);

    return <></>;
};

export default DatabaseHomeApis;
