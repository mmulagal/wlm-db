import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../utils/consts';
import { useGetErrorInvestigationDataMutation } from '../../../../utils/apiService';
import { setLandingFromInnerPage } from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    setErrorInvestigationData,
    setErrorInvestigationLoading,
    setNoLogAnalyzerData
} from '../../../../store/workloadFactory/agenticAISlice';

const ErrorInvestigationApi = () => {
    const dispatch = useDispatch();
    const { credIdFromJM, regionFromJM, landingFrom, landingFromInnerPage } = useAppSelector(
        state => state.getWellOptimize
    );

    const {
        selectedResourceId,
        selectedDatabaseInstance,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        visitedTabs
    } = useAppSelector(state => state.getWellOptimize);

    const [errorInvestigationGetApi] = useGetErrorInvestigationDataMutation();

    const runErrorInvestigationApi = async () => {
        try {
            dispatch(setErrorInvestigationLoading(true));
            const result: { data?: any; error?: any } = await errorInvestigationGetApi({
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance
            });
            if (result && !result?.error && result?.data) {
                dispatch(setErrorInvestigationData(result.data?.remediationRecommendation));
                dispatch(setNoLogAnalyzerData(false));
            } else {
                dispatch(setErrorInvestigationData([]));
                dispatch(setNoLogAnalyzerData(true));
            }
        } catch (error) {
            dispatch(setNoLogAnalyzerData(true));
        } finally {
            dispatch(setErrorInvestigationLoading(false));
        }
    };

    const viewLogAction = async () => {
        setTimeout(() => {
            // Set the loading state to true
            dispatch(setErrorInvestigationLoading(true));
            // Call the API to get the error investigation details
            runErrorInvestigationApi();
        }, 10);
    };

    useEffect(() => {
        // On page load, call the API to get the error investigation details
        if (!landingFromInnerPage && !visitedTabs[WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION]) {
            viewLogAction();
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};

export default ErrorInvestigationApi;
