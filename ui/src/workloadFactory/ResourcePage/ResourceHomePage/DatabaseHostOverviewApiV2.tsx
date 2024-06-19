import { useAppSelector } from '../../../store/storeHooks';
import { useLazyGetDatabaseListV2Query, useLazyGetResourceDetailsV2Query } from '../../../utils/apiService';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
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
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const { selectedResourceId, selectedDatabaseInstance, isResourceRefresh } = useAppSelector(
        state => state.workloadFactoryResource
    );

    const [resourceDetailsApi] = useLazyGetResourceDetailsV2Query();
    const [databaseListApi] = useLazyGetDatabaseListV2Query();

    useEffect(() => {
        viewResourceAction();
    }, []);

    useEffect(() => {
        if (isResourceRefresh) {
            viewResourceAction();
            dispatch(setIsResourceRefresh(false));
        }
    }, [isResourceRefresh]);

    const runResourceDetailsApi = async () => {
        try {
            const result: any = await resourceDetailsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                region: headerSelectedRegion?.label2,
                id: selectedResourceId,
                sqlInstanceId: selectedDatabaseInstance
            });
            if (result && !result?.error) {
                let resourceData = { ...result?.data, topology: result?.data?.databaseInstanceTopology };
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
                credentialId: headerSelectedCred?.data?.credentialsId,
                region: headerSelectedRegion?.label2,
                id: selectedResourceId,
                sqlInstanceId: selectedDatabaseInstance
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

    return;
};

export default DatabaseHostOverviewApiV2;
