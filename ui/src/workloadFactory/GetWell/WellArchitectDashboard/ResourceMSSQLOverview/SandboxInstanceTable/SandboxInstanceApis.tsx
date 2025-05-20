import { useEffect } from 'react';

import {
    setAggregatedSandboxInstanceList,
    setAllSandboxInstanceList,
    setIsRefreshedSandboxInstance,
    setRefreshSandboxInstanceTime,
    setSandboxInstanceLoading
} from '../../../../../store/workloadFactory/sandboxSlice';
import { useAppDispatch, useAppSelector } from '../../../../../store/storeHooks';
import { useLazyGetSandboxInstanceListQuery } from '../../../../../utils/apiService';
import { getCurrentDateTime } from '../../../../../utils/utilityFunctions';
import store from '../../../../../store/store';
import { addNotification, NOTIFICATION_TYPES } from '../../../../../store/notificationSlice';

const SandboxInstanceApis = () => {
    const dispatch = useAppDispatch();
    const { isRefreshSandboxInstance } = useAppSelector(state => state.sandbox);

    const {
        selectedResourceId,
        selectedDatabaseInstance,

        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);

    const {
        visitedTabs,
        credIdFromJM,
        regionFromJM,
        selectedResourceId: getWellResourceId,
        selectedDatabaseInstance: getWellSelectedDatabaseInstance
    } = useAppSelector(state => state.getWellOptimize);

    const [getSandboxInstanceList] = useLazyGetSandboxInstanceListQuery();

    useEffect(() => {
        if (!visitedTabs['Sandboxes']) {
            runApiDetails();
        }
    }, []);

    // Automatically fetch data when credentials or region changes
    useEffect(() => {
        if (isRefreshSandboxInstance) {
            dispatch(setAggregatedSandboxInstanceList([]));
            dispatch(setAllSandboxInstanceList([]));
            dispatch(setIsRefreshedSandboxInstance(false));

            runApiDetails(); // Initial API call
        }
    }, [isRefreshSandboxInstance]);

    // Function to call the API
    const runApiDetails = async (nextToken: string | null = null) => {
        dispatch(setSandboxInstanceLoading(true));
        try {
            const result = await getSandboxInstanceList({
                credentialId: selectedResourceCredId || credIdFromJM, //|| condition is for when coming from JM
                region: selectedResourceRegionId || regionFromJM, //|| condition is for when coming from JM
                databaseHostId: selectedResourceId || getWellResourceId, //|| condition is for when coming from JM
                databaseInstanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance, //|| condition is for when coming from JM
                nextToken: nextToken
            });

            if (result?.data) {
                const newItems = result.data.items?.filter((item: any) => !item?.error) || [];

                const state = store.getState();

                // Merging previous and new results
                dispatch(
                    setAggregatedSandboxInstanceList([...state.sandbox.aggregatedSandboxInstanceList, ...newItems])
                );
                dispatch(setAllSandboxInstanceList([...(state.sandbox.allSandboxInstanceList || []), ...newItems]));

                dispatch(setRefreshSandboxInstanceTime(getCurrentDateTime()));

                // Automatically call the API again if nextToken exists
                if (result.data.nextToken) {
                    runApiDetails(result.data.nextToken);
                }
            }
        } catch (error) {
            dispatch(
                addNotification({
                    type: NOTIFICATION_TYPES.ERROR,
                    message: error || 'Error fetching sandbox instance list'
                })
            );
        } finally {
            dispatch(setSandboxInstanceLoading(false));
        }
    };

    return <></>;
};

export default SandboxInstanceApis;
