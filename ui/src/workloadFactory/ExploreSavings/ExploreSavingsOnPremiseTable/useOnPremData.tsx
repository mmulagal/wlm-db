import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useGetOnPremSavingsMutation } from '../../../utils/apiService';
import { setOnPremiseData, setOnPremiseDataLoading } from '../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { SQL_DEPLOYMENT_MODE } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';

export const useOnPremData = () => {
    const dispatch = useDispatch();
    const onPremiseData = useAppSelector(state => state.exploreSavings.onPremiseData);
    const [getOnPremSavings] = useGetOnPremSavingsMutation();

    const [error, setError] = useState<string | null>(null);

    // Ref to handle conditional refresh
    const isUploadRef = useRef(false);

    const fetchOnPremData = async (forceRefresh = false) => {
        if (!forceRefresh && onPremiseData && !isUploadRef.current) return;

        setError(null); // Reset error state
        dispatch(setOnPremiseData(null));
        dispatch(setOnPremiseDataLoading(true));

        try {
            const apiResult = await getOnPremSavings({}); // Unwrap the API result for cleaner error handling
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

    return { onPremiseData, fetchOnPremData, error };
};
