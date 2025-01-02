import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addAggregatedCosts,
    addAggregatedPgsqlCosts,
    addAggregatedPgsqlStorageSavings,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregateHostsCountData,
    addAggregatePgSqlHostsCountData,
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
import { WIZARD_TYPE } from '../../utils/consts';

const DatabaseHomeApis = () => {
    const dispatch = useAppDispatch();
    const databaseHostsDataV2 = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsData);
    const { databaseHostsData: pgsqlHostData } = useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { sandboxSavings } = useAppSelector(state => state.sandbox.getSandboxSavings);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const refreshTime = useAppSelector(state => state.headers.refreshTime);
    const refreshBlocked = useAppSelector(state => state.auth?.refreshBlocked);

    const [getJobsSummaryApi] = useLazyGetJobsSummaryQuery();

    const getJobsSummaryData = async () => {
        const endTime = Date.now();
        const startTime = endTime - 30 * (3600 * 1000 * 24);
        try {
            const result: any = await getJobsSummaryApi({
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
        if (refreshBlocked) {
            return;
        }
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
        if (refreshBlocked) {
            return;
        }
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

    // To have pgsql database hosts data in dashboard
    useEffect(() => {
        if (refreshBlocked) {
            return;
        }
        if (!pgsqlHostData) {
            return;
        }

        const aggrStorage = getManagedAggrStorageSavings(pgsqlHostData);
        dispatch(addAggregatedPgsqlStorageSavings(aggrStorage));

        const aggrCost = getManageAggrCost(pgsqlHostData);
        dispatch(addAggregatedPgsqlCosts(aggrCost));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pgsqlHostData]);

    // To have database hosts count data in dashboard - V2
    useEffect(() => {
        if (refreshBlocked) {
            return;
        }
        if (!databaseHostsDataV2) {
            return;
        }
        const hostStatusCount = getManagedHostCount(databaseHostsDataV2, dispatch);
        dispatch(addAggregateHostsCountData(hostStatusCount));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsDataV2, inventoryTableData]);

    // To have pgsql database hosts count data in dashboard
    useEffect(() => {
        if (refreshBlocked) {
            return;
        }
        if (!pgsqlHostData) {
            return;
        }
        const hostStatusCount = getManagedHostCount(pgsqlHostData, dispatch, WIZARD_TYPE.PGSQL);
        dispatch(addAggregatePgSqlHostsCountData(hostStatusCount));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pgsqlHostData, inventoryTableData]);

    return <></>;
};

export default DatabaseHomeApis;
