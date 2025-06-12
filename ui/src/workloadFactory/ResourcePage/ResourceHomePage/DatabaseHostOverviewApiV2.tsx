import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { useLazyGetDatabaseListV2Query, useLazyGetResourceDetailsV2Query } from '../../../utils/apiService';
import {
    resetWorkloadFactoryResourceData,
    setDatabaseList,
    setDatabaseListLoading,
    setIsResourceRefresh,
    setResourceDetails,
    setResourceLoading
} from '../../../store/workloadFactory/workloadFactoryResourceSlice';

const DatabaseHostOverviewApiV2 = () => {
    const dispatch = useDispatch();
    const {
        selectedResourceId,
        selectedDatabaseInstance,
        isResourceRefresh,
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

    const [resourceDetailsApi] = useLazyGetResourceDetailsV2Query();
    const [databaseListApi] = useLazyGetDatabaseListV2Query();

    useEffect(() => {
        if (!visitedTabs.Overview) {
            viewResourceAction();
        }
    }, [visitedTabs]);

    useEffect(() => {
        if (isResourceRefresh) {
            viewResourceAction();
            dispatch(setIsResourceRefresh(false));
        }
    }, [isResourceRefresh]);

    const runResourceDetailsApi = async () => {
        try {
            const result: any = await resourceDetailsApi({
                credentialId: selectedResourceCredId || credIdFromJM, // || condition is for when coming from JM
                region: selectedResourceRegionId || regionFromJM, // || condition is for when coming from JM
                id: selectedResourceId || getWellResourceId, // || condition is for when coming from JM
                sqlInstanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance // || condition is for when coming from JM
            });
            if (result && !result?.error) {
                const resourceData = {
                    ...result?.data,
                    topology: {
                        ...result?.data?.databaseInstanceTopology,
                        ...result?.data?.nodeTopology
                    }
                };
                dispatch(setResourceDetails(resourceData));
                dispatch(setResourceLoading(false));
            } else {
                dispatch(setResourceLoading(false));
            }
        } catch (error) {
            dispatch(setResourceLoading(false));
        }
    };

    const runDatabaseDetailsApi = async () => {
        try {
            const result: any = await databaseListApi({
                credentialId: selectedResourceCredId || credIdFromJM, // || condition is for when coming from JM
                region: selectedResourceRegionId || regionFromJM, // || condition is for when coming from JM
                id: selectedResourceId || getWellResourceId, // || condition is for when coming from JM
                sqlInstanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance, // || condition is for when coming from JM
                fields: true
            });
            if (result && !result?.error) {
                dispatch(setDatabaseList(result?.data?.items || []));
                dispatch(setDatabaseListLoading(false));
            } else {
                dispatch(setDatabaseListLoading(false));
            }
        } catch (error) {
            dispatch(setDatabaseListLoading(false));
        }
    };

    const viewResourceAction = () => {
        dispatch(resetWorkloadFactoryResourceData());
        dispatch(setResourceLoading(true));
        dispatch(setDatabaseListLoading(true));
        runResourceDetailsApi();
        runDatabaseDetailsApi();
    };
};

export default DatabaseHostOverviewApiV2;
