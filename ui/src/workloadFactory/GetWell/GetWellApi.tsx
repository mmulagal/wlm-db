import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { useAppSelector } from '../../store/storeHooks';
import {
    setDriftAssessmentData,
    setOptimizePageLoading,
    setGwRefreshPage,
    setIsAssessmentAvailable,
    setLandingFromInnerPage,
    setGwSelectedRowFsxId
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { useGetMssqlAssessmentDataMutation } from '../../utils/apiService';
import { formatGetWellData, resetGwValuesOnRefresh, storageMockData } from './GetWellUtils';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../utils/consts';

const GetWellApi = () => {
    const dispatch = useDispatch();
    const { credIdFromJM, regionFromJM, landingFrom, landingFromInnerPage } = useAppSelector(
        state => state.getWellOptimize
    );

    const {
        selectedResourceId,
        selectedDatabaseInstance,
        gwRefreshPage,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        visitedTabs
    } = useAppSelector(state => state.getWellOptimize);

    const [assessmentDetailsApi] = useGetMssqlAssessmentDataMutation();

    useEffect(() => {
        // On page load, call the API to get the assessment details
        if (!landingFromInnerPage && !visitedTabs[WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS]) {
            viewOptimizeAction(false); // isRefresh = false for initial load
        } else {
            dispatch(setLandingFromInnerPage(false));
        }

        // if (!visitedTabs[WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS]) {
        //     viewOptimizeAction();
        // }
    }, []);

    const runAssessmentDetailsApi = async (isRefresh: boolean = false) => {
        // Call the API to get the assessment details
        try {
            dispatch(setOptimizePageLoading(true));
            const result: { data?: any; error?: any } = await assessmentDetailsApi({
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance
            });
            if (result && !result?.error && result?.data) {
                if (!result.data.storage) {
                    result.data = { ...result.data, ...storageMockData };
                }
                dispatch(setDriftAssessmentData(result.data));
                formatGetWellData(dispatch, result.data, false, isRefresh);
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
                dispatch(setGwSelectedRowFsxId(result?.data?.fileSystemId));
            } else {
                dispatch(setIsAssessmentAvailable(false));
                dispatch(setOptimizePageLoading(false));
            }
        } catch (error) {
            dispatch(setIsAssessmentAvailable(false));
            dispatch(setOptimizePageLoading(false));
        }
    };

    const viewOptimizeAction = (isRefresh: boolean = false) => {
        resetGwValuesOnRefresh(dispatch);
        setTimeout(() => {
            // Set the loading state to true
            dispatch(setOptimizePageLoading(true));
            // Call the API to get the assessment details
            runAssessmentDetailsApi(isRefresh);
        }, 10);
    };

    useEffect(() => {
        // On page refresh, call the API to get the assessment details
        if (gwRefreshPage) {
            viewOptimizeAction(true); // isRefresh = true
            dispatch(setGwRefreshPage(false));
        }
    }, [gwRefreshPage]);
};

export default GetWellApi;
