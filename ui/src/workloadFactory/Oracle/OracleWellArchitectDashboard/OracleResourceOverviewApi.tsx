import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { useGetOracleOverviewDetailsMutation } from '../../../utils/apiService';

import { setOracleResourceDetails, setOracleResourceLoading } from '../../../store/workloadFactory/oracleSlice';

const OracleResourceOverviewApi = () => {
    const dispatch = useDispatch();
    const {
        selectedResourceId,
        selectedDatabaseInstance,

        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);

    const {
        credIdFromJM,
        regionFromJM,
        selectedResourceId: getWellResourceId,
        selectedDatabaseInstance: getWellSelectedDatabaseInstance
    } = useAppSelector(state => state.getWellOptimize);

    const { visitedTabs } = useAppSelector(state => state.oracleSlice);

    const [getOracleOverviewDetails] = useGetOracleOverviewDetailsMutation();

    useEffect(() => {
        if (!visitedTabs.Overview) {
            viewResourceAction();
        }
    }, [visitedTabs]);

    //To do enable when refresh enable

    // useEffect(() => {
    //     if (isResourceRefresh) {
    //         viewResourceAction();
    //         dispatch(setIsResourceRefresh(false));
    //     }
    // }, [isResourceRefresh]);

    const runResourceDetailsApi = async () => {
        try {
            const result: any = await getOracleOverviewDetails({
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
                dispatch(setOracleResourceDetails(resourceData));
                dispatch(setOracleResourceLoading(false));
            } else {
                dispatch(setOracleResourceLoading(false));
            }
        } catch (error) {
            dispatch(setOracleResourceLoading(false));
        }
    };

    const viewResourceAction = () => {
        dispatch(setOracleResourceDetails({}));
        dispatch(setOracleResourceLoading(true));
        runResourceDetailsApi();
    };
};

export default OracleResourceOverviewApi;
