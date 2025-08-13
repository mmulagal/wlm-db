import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { useGetOracleOverviewDetailsMutation } from '../../../../utils/apiService';

import { setOracleResourceDetails, setOracleResourceLoading } from '../../../../store/workloadFactory/oracleSlice';

const useOracleResourceOverview = () => {
    const dispatch = useDispatch();
    const { selectedResourceId, selectedDatabaseInstance, selectedResourceCredId, selectedResourceRegionId } =
        useAppSelector(state => state.workloadFactoryResource);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitedTabs]);

    // To do enable when refresh enable

    // useEffect(() => {
    //     if (isResourceRefresh) {
    //         viewResourceAction();
    //         dispatch(setIsResourceRefresh(false));
    //     }
    // }, [isResourceRefresh]);

    const runResourceDetailsApi = async () => {
        try {
            const result: any = await getOracleOverviewDetails({
                credentialId: selectedResourceCredId || credIdFromJM,
                region: selectedResourceRegionId || regionFromJM,
                id: selectedResourceId || getWellResourceId,
                sqlInstanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance
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
            }
            dispatch(setOracleResourceLoading(false));
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

export default useOracleResourceOverview;
