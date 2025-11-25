import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
    useGetLogAnalyzerPreReqMutation,
    useGetLogAnalyzerPreReqOracleMutation
} from '../../../../../utils/apiService';
import { useAppSelector } from '../../../../../store/storeHooks';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../../utils/consts';
import {
    setEiRefreshPage,
    setLogAnalyzerPreReqData,
    setLogAnalyzerPreReqLoading
} from '../../../../../store/workloadFactory/agenticAISlice';
import { setLandingFromInnerPage } from '../../../../../store/workloadFactory/getWellOptimizeSlice';
import { runInvestigationPreReqApiCall } from '../ErrorInvestigationUtility';

const LogAnalyzerOnboardingAPI = ({ dbType }: { dbType: string }) => {
    const dispatch = useDispatch();
    const {
        credIdFromJM,
        regionFromJM,
        landingFrom,
        landingFromInnerPage,
        selectedResourceId,
        selectedDatabaseInstance,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        visitedTabs
    } = useAppSelector(state => state.getWellOptimize);

    const { eiRefreshPage } = useAppSelector(state => state.agenticAI);

    const [getLogAnalyzerPreReqApi] = useGetLogAnalyzerPreReqMutation();
    const [getLogAnalyzerPreReqOracleApi] = useGetLogAnalyzerPreReqOracleMutation();

    const runInvestigationPreReqApi = async () => {
        const commonParams = {
            credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
            regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
        };
        runInvestigationPreReqApiCall(
            dbType,
            commonParams,
            selectedResourceId,
            selectedDatabaseInstance,
            dispatch,
            getLogAnalyzerPreReqOracleApi,
            getLogAnalyzerPreReqApi
        );
    };

    useEffect(() => {
        // On page refresh, call the API to get data
        if (eiRefreshPage) {
            runInvestigationPreReqApi();
            // runInvestigationPricingApi(); // Commenting this as pricing data as not required for now
            dispatch(setEiRefreshPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eiRefreshPage]);

    useEffect(() => {
        // On page load, call the API to get data
        if (!landingFromInnerPage && !visitedTabs[WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION]) {
            runInvestigationPreReqApi();
            // runInvestigationPricingApi(); // Commenting this as pricing data as not required for now
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};

export default LogAnalyzerOnboardingAPI;
