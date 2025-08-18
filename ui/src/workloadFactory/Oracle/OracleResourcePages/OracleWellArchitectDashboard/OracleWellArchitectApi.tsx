import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { WELL_ARCHITECTED_TABS } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import { useGetOracleAssessmentDataMutation } from '../../../../utils/apiService';
import { formatOracleWellArchitectedData, oracleCardData } from './OracleWellArchitectedUtils';
import {
    setCardData,
    setDriftAssessmentData,
    setIsAssessmentAvailable,
    setOptimizePageLoading
} from '../../../../store/workloadFactory/getWellOptimizeSlice';

const useOracleWellArchitectApi = () => {
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

    const [getOracleAssessmentDataApi] = useGetOracleAssessmentDataMutation();

    const runAssessmentDetailsApi = async () => {
        try {
            dispatch(setOptimizePageLoading(true));
            dispatch(setCardData(oracleCardData));
            const result: any = await getOracleAssessmentDataApi({
                credentialId: selectedResourceCredId || credIdFromJM,
                regionId: selectedResourceRegionId || regionFromJM,
                databaseHostId: selectedResourceId || getWellResourceId,
                instanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance
            });

            if (result && !result?.error && result?.data) {
                dispatch(setDriftAssessmentData(result.data));
                formatOracleWellArchitectedData(dispatch, result.data);
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
            } else {
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(false));
            }
        } catch (error) {
            dispatch(setOptimizePageLoading(false));
            dispatch(setIsAssessmentAvailable(false));
        }
    };

    const viewResourceAction = () => {
        dispatch(setDriftAssessmentData({}));
        dispatch(setOptimizePageLoading(true));
        runAssessmentDetailsApi();
    };

    useEffect(() => {
        if (!visitedTabs[WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS]) {
            viewResourceAction();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitedTabs]);
};

export default useOracleWellArchitectApi;
