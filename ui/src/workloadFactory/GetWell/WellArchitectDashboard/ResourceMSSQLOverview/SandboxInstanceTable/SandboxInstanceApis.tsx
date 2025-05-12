import { useEffect } from 'react';

import {
    setAggregatedSandboxInstanceList,
    setAllSandboxInstanceList,
    setIsRefreshedSandboxInstance,
    setRefreshSandboxInstanceTime,
    setSandboxInstanceListState
} from '../../../../../store/workloadFactory/sandboxSlice';
import { useAppDispatch, useAppSelector } from '../../../../../store/storeHooks';
import { useLazyGetSandboxInstanceListQuery } from '../../../../../utils/apiService';
import { getCurrentDateTime } from '../../../../../utils/utilityFunctions';
import store from '../../../../../store/store';

const SandboxInstanceApis = () => {
    const dispatch = useAppDispatch();
    const { isRefreshSandboxInstance } = useAppSelector(state => state.sandbox);

    const {
        selectedResourceId,
        selectedDatabaseInstance,

        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);

    const { visitedTabs } = useAppSelector(state => state.getWellOptimize);

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
        try {
            const result = await getSandboxInstanceList({
                credentialId: selectedResourceCredId,
                region: selectedResourceRegionId,
                databaseHostId: selectedResourceId,
                databaseInstanceId: selectedDatabaseInstance,
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

                dispatch(
                    setSandboxInstanceListState({
                        databaseHosts: result.data.items,
                        sandboxListLoading: false,
                        sandboxListError: false
                    })
                );

                // Automatically call the API again if nextToken exists
                if (result.data.nextToken) {
                    runApiDetails(result.data.nextToken);
                }
            }
        } catch (error) {
            console.error('Error fetching sandbox list:', error);
            dispatch(
                setSandboxInstanceListState({
                    databaseHosts: [],
                    sandboxListLoading: false,
                    sandboxListError: true
                })
            );
        }
    };

    return <></>;
};

export default SandboxInstanceApis;
