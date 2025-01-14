import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useGetOnPremSavingsMutation } from '../../../utils/apiService';
import { setOnPremiseData } from '../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';

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

        try {
            const apiResult = await getOnPremSavings({}); // Unwrap the API result for cleaner error handling
            let result: any = [];
            apiResult?.data?.items?.map((perRow: any) => {
                const rowData = {
                    ...perRow,
                    onPremNode: perRow?.onPremisesNode[0],
                    totalInstance: perRow?.sqlServerInstances?.length,
                    nameForSorting: perRow?.databaseHostName?.toLowerCase()
                };
                result.push(rowData);
            });

            dispatch(setOnPremiseData(result)); // Save to Redux store
        } catch (err) {
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
