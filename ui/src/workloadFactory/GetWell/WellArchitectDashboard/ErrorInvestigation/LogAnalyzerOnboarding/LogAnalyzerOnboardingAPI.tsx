import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useGetLogAnalyzerPreReqMutation, useGetLogAnalyzerPricingMutation } from '../../../../../utils/apiService';
import { useAppSelector } from '../../../../../store/storeHooks';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../../utils/consts';
import {
    setEiRefreshPage,
    setLogAnalyzerPreReqData,
    setLogAnalyzerPreReqLoading,
    setLogAnalyzerPricingData,
    setLogAnalyzerPricingLoading
} from '../../../../../store/workloadFactory/agenticAISlice';
import { setLandingFromInnerPage } from '../../../../../store/workloadFactory/getWellOptimizeSlice';

const LogAnalyzerOnboardingAPI = () => {
    const dispatch = useDispatch();
    const {
        credIdFromJM,
        regionFromJM,
        landingFrom,
        landingFromInnerPage,
        selectedResourceId,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        visitedTabs
    } = useAppSelector(state => state.getWellOptimize);

    const { eiRefreshPage } = useAppSelector(state => state.agenticAI);

    const [getLogAnalyzerPreReqApi] = useGetLogAnalyzerPreReqMutation();
    const [getLogAnalyzerPricingApi] = useGetLogAnalyzerPricingMutation();

    const runInvestigationPreReqApi = async () => {
        try {
            dispatch(setLogAnalyzerPreReqLoading(true));
            const result: { data?: any; error?: any } = await getLogAnalyzerPreReqApi({
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                type: 'databaseHostId',
                typeId: selectedResourceId
            });
            if (result && !result?.error && result?.data?.items?.length > 0 && !result?.data?.items[0]?.errorMessage) {
                dispatch(setLogAnalyzerPreReqData(result?.data?.items[0]));
            } else {
                dispatch(setLogAnalyzerPreReqData(null));
            }
        } catch (error) {
            dispatch(setLogAnalyzerPreReqData(null));
        } finally {
            dispatch(setLogAnalyzerPreReqLoading(false));
        }
    };

    const runInvestigationPricingApi = async () => {
        try {
            dispatch(setLogAnalyzerPricingLoading(true));
            const result: { data?: any; error?: any } = await getLogAnalyzerPricingApi({
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
            });
            if (result && !result?.error) {
                dispatch(setLogAnalyzerPricingData(result?.data));
            } else {
                dispatch(setLogAnalyzerPricingData(null));
            }
        } catch (error) {
            dispatch(setLogAnalyzerPricingData(null));
        } finally {
            dispatch(setLogAnalyzerPricingLoading(false));
        }
    };

    useEffect(() => {
        // On page refresh, call the API to get data
        if (eiRefreshPage) {
            runInvestigationPreReqApi();
            runInvestigationPricingApi();
            dispatch(setEiRefreshPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eiRefreshPage]);

    useEffect(() => {
        // On page load, call the API to get data
        if (!landingFromInnerPage && !visitedTabs[WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION]) {
            runInvestigationPreReqApi();
            runInvestigationPricingApi();
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};

export default LogAnalyzerOnboardingAPI;
