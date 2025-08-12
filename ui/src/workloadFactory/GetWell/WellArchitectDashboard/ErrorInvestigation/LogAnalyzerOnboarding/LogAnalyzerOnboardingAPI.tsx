import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useGetLogAnalyzerPreReqMutation, useGetLogAnalyzerPricingMutation } from '../../../../../utils/apiService';
import { useAppSelector } from '../../../../../store/storeHooks';
import { WLF_TABS } from '../../../../../utils/consts';
import {
    setLogAnalyzerPreReqData,
    setLogAnalyzerPreReqLoading,
    setLogAnalyzerPricingData,
    setLogAnalyzerPricingLoading
} from '../../../../../store/workloadFactory/agenticAISlice';

const LogAnalyzerOnboardingAPI = () => {
    const dispatch = useDispatch();
    const { credIdFromJM, regionFromJM, landingFrom } = useAppSelector(state => state.getWellOptimize);

    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);

    const [getLogAnalyzerPreReqApi] = useGetLogAnalyzerPreReqMutation();
    const [getLogAnalyzerPricingApi] = useGetLogAnalyzerPricingMutation();

    const runInvestigationPreReqApi = async () => {
        try {
            dispatch(setLogAnalyzerPreReqLoading(true));
            const result: { data?: any; error?: any } = await getLogAnalyzerPreReqApi({
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId
            });
            if (result && !result?.error) {
                dispatch(setLogAnalyzerPreReqData(result?.data));
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
        runInvestigationPreReqApi();
        runInvestigationPricingApi();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};

export default LogAnalyzerOnboardingAPI;
