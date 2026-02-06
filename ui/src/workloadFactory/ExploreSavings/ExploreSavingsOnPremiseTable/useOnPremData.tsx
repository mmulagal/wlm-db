import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useGetOnPremSavingsMutation } from '../../../utils/apiService';
import {
    setOnPremiseData,
    setOnPremiseDataLoading,
    setOnPremiseOracleData,
    setOnPremiseOracleDataLoading
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { SQL_DEPLOYMENT_MODE } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';

export const useOnPremData = () => {
    const dispatch = useDispatch();
    const onPremiseData = useAppSelector(state => state.exploreSavings.onPremiseData);
    const onPremiseOracleData = useAppSelector(state => state.exploreSavings.onPremiseOracleData);
    const [getOnPremSavings] = useGetOnPremSavingsMutation();

    const [error, setError] = useState<string | null>(null);

    // Ref to handle conditional refresh
    const isUploadRef = useRef(false);
    const isOracleUploadRef = useRef(false);

    const fetchOnPremData = async (forceRefresh = false) => {
        if (!forceRefresh && onPremiseData && !isUploadRef.current) return;

        setError(null); // Reset error state
        dispatch(setOnPremiseData(null));
        dispatch(setOnPremiseDataLoading(true));

        try {
            const apiResult = await getOnPremSavings({ type: 'mssql' }); // Unwrap the API result for cleaner error handling
            const result: any = [];
            apiResult?.data?.items?.map((perRow: any) => {
                let perInstallationMode: string = '';
                if (perRow?.deploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE) {
                    perInstallationMode = GENERAL.FAILOVER_CLUSTER_INSTANCES;
                } else if (perRow?.deploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.AOAG) {
                    perInstallationMode = GENERAL.AOAG;
                } else if (perRow?.deploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
                    perInstallationMode = GENERAL.STANDALONE;
                }
                const perRowInstance = perRow?.sqlServerInstances?.filter(
                    (perInstance: any) => !perInstance?.errorMessage
                );
                const uniqueId = `id${Math.random().toString(16).slice(2)}`;
                const rowData = {
                    ...perRow,
                    id: uniqueId, // Add id field for table selection
                    sqlServerInstances: perRowInstance,
                    deploymentModel: perInstallationMode,
                    onPremNode: perRow?.onPremisesNodes[0],
                    totalInstance: perRowInstance?.length,
                    instanceNameList:
                        perRowInstance?.map((detail: { sqlInstanceName: string }) => detail?.sqlInstanceName) || [],
                    nameForSorting: perRow?.resourceName?.toLowerCase(),
                    uniqueId
                };
                result.push(rowData);
            });

            dispatch(setOnPremiseData(result)); // Save to Redux store
            dispatch(setOnPremiseDataLoading(false));
        } catch (err) {
            dispatch(setOnPremiseData([]));
            dispatch(setOnPremiseDataLoading(false));
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: 'Error fetching data'
                })
            );
        } finally {
            isUploadRef.current = false;
        }
    };

    const fetchOracleOnPremData = async (forceRefresh = false) => {
        if (!forceRefresh && onPremiseOracleData && !isOracleUploadRef.current) return;

        setError(null); // Reset error state
        dispatch(setOnPremiseOracleData(null));
        dispatch(setOnPremiseOracleDataLoading(true));

        try {
            const apiResult = await getOnPremSavings({ type: 'oracle' });
            const result: any = [];
            apiResult?.data?.items?.map((perRow: any) => {
                const uniqueId = `id${Math.random().toString(16).slice(2)}`;
                const rowData = {
                    ...perRow,
                    id: uniqueId,
                    nameForSorting: perRow?.resourceName?.toLowerCase(),
                    databaseNameList:
                        perRow?.oracleDatabases?.map((detail: { databaseName: string }) => detail?.databaseName) || [],
                    deploymentModel:
                        perRow?.oracleDatabases?.length > 0 ? perRow?.oracleDatabases[0]?.deploymentModel : '',
                    onPremNode: perRow?.onPremisesNodes[0],
                    uniqueId
                };
                result.push(rowData);
            });

            dispatch(setOnPremiseOracleData(result));
            dispatch(setOnPremiseOracleDataLoading(false));
        } catch (err) {
            dispatch(setOnPremiseOracleData([]));
            dispatch(setOnPremiseOracleDataLoading(false));
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: 'Error fetching data'
                })
            );
        } finally {
            isOracleUploadRef.current = false;
        }
    };

    return { onPremiseData, fetchOnPremData, onPremiseOracleData, fetchOracleOnPremData, error };
};
