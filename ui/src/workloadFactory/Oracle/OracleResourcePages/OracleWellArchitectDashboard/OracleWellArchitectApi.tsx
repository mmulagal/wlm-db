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
    setLandingFromInnerPage,
    setOptimizePageLoading
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { setRefreshOracleWellArchitect, setOracleRefreshTimes } from '../../../../store/workloadFactory/oracleSlice';
import { getCurrentDateTime } from '../../../../utils/utilityFunctions';

const useOracleWellArchitectApi = () => {
    const dispatch = useDispatch();
    const { selectedResourceId, selectedDatabaseInstance, selectedResourceCredId, selectedResourceRegionId } =
        useAppSelector(state => state.workloadFactoryResource);

    const {
        credIdFromJM,
        regionFromJM,
        selectedResourceId: getWellResourceId,
        selectedDatabaseInstance: getWellSelectedDatabaseInstance,
        landingFromInnerPage
    } = useAppSelector(state => state.getWellOptimize);

    const { visitedTabs, refreshWellArchitect } = useAppSelector(state => state.oracleSlice);

    const [getOracleAssessmentDataApi] = useGetOracleAssessmentDataMutation();

    const runAssessmentDetailsApi = async (isRefresh: boolean = false) => {
        try {
            dispatch(setOptimizePageLoading(true));
            dispatch(setCardData(oracleCardData));
            const result = await getOracleAssessmentDataApi({
                credentialId: selectedResourceCredId || credIdFromJM,
                regionId: selectedResourceRegionId || regionFromJM,
                databaseHostId: selectedResourceId || getWellResourceId,
                instanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance
            });

            if (result && !result?.error && result?.data) {
                dispatch(setDriftAssessmentData(result.data));
                formatOracleWellArchitectedData(dispatch, result.data, false, isRefresh);
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

    const viewResourceAction = (isRefresh: boolean = false) => {
        dispatch(setDriftAssessmentData({}));
        dispatch(setOptimizePageLoading(true));
        runAssessmentDetailsApi(isRefresh);
    };

    useEffect(() => {
        // On page load, call the API to get the assessment details and set initial refresh time
        if (!landingFromInnerPage && !visitedTabs[WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS]) {
            dispatch(setOracleRefreshTimes({ optimizeRefreshTime: getCurrentDateTime() }));
            viewResourceAction(false); // isRefresh = false for initial load
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Handle Oracle-specific refresh
        if (refreshWellArchitect) {
            viewResourceAction(true); // isRefresh = true
            dispatch(setRefreshOracleWellArchitect(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshWellArchitect]);
};

export default useOracleWellArchitectApi;
