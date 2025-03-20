import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import {
    addAggregatedCosts,
    addAggregatedPgsqlStorageSavings,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregateHostsCountData,
    addAggregatePgSqlHostsCountData,
    setPotentialSavingsValues
} from '../../store/workloadFactory/databaseHomeSlice';
import {
    getManageAggrCost,
    getManagedAggrProtection,
    getManagedAggrStorageSavings,
    getManagedHostCount,
    getPotentialSavingsValues
} from './DatabaseHomeUtils';
import { WIZARD_TYPE } from '../../utils/consts';

const DatabaseHomeApis = () => {
    const dispatch = useAppDispatch();
    const databaseHostsDataV2 = useAppSelector(state => state.inventoryV2.getDatabaseHosts.databaseHostsData);
    const { databaseHostsData: pgsqlHostData } = useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const inventoryTableData = useAppSelector(state => state.inventoryV2.inventoryTableData);
    const potentialSavingsHostData = useAppSelector(state => state.inventoryV2.potentialSavingsHostData);
    const refreshBlocked = useAppSelector(state => state.auth?.refreshBlocked);
    const dashSandboxSavingsData = useAppSelector(state => state.inventoryV2.dashSandboxSavings.data);

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

        const aggrStorage = getManagedAggrStorageSavings(databaseHostsDataV2, dashSandboxSavingsData);
        dispatch(addAggregatedStorageSavings(aggrStorage));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseHostsDataV2, dashSandboxSavingsData]);

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

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pgsqlHostData]);

    // To have pgsql and mssql database hosts estimated cost in dashboard
    useEffect(() => {
        if (refreshBlocked) {
            return;
        }

        let mergedData = {
            ...(databaseHostsDataV2 || {}),
            ...(pgsqlHostData || {})
        };

        const aggrCost = getManageAggrCost(mergedData);
        dispatch(addAggregatedCosts(aggrCost));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pgsqlHostData, databaseHostsDataV2]);

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

    useEffect(() => {
        if (refreshBlocked) {
            return;
        }
        if (!potentialSavingsHostData) {
            return;
        }
        // potentialSavingsHostData is stored in inventoryV2 slice.
        // Here we are getting the values from it and storing it in databaseHome slice.
        // This is to show data on dashboard potential card UI.
        const potentialSavingsValues = getPotentialSavingsValues(potentialSavingsHostData);
        dispatch(setPotentialSavingsValues(potentialSavingsValues));
    }, [potentialSavingsHostData]);

    return <></>;
};

export default DatabaseHomeApis;
