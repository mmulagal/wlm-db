import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../store/storeHooks';
import { useEffect } from 'react';
import {
    setDriftAssessmentData,
    setOptimizePageLoading,
    setGwRefreshPage,
    setIsAssessmentAvailable,
    resetGwData
} from '../../store/workloadFactory/getWellOptimizeSlice';
import { useGetMssqlAssessmentDataMutation } from '../../utils/apiService';
import { formatGetWellData, resetGwValuesOnRefresh } from './GetWellUtils';
import { AssessmentResponseInterface } from '../../utils/types/getWellTypes';

const GetWellApi = () => {
    const dispatch = useDispatch();
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const { selectedResourceId, selectedDatabaseInstance, gwRefreshPage } = useAppSelector(
        state => state.getWellOptimize
    );

    const [assessmentDetailsApi] = useGetMssqlAssessmentDataMutation();

    useEffect(() => {
        // On page load, call the API to get the assessment details
        viewOptimizeAction();
    }, []);

    const runAssessmentDetailsApi = async () => {
        // Call the API to get the assessment details
        try {
            dispatch(setOptimizePageLoading(true));
            const result: { data?: any; error?: any } = await assessmentDetailsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance
            });
            if (result && !result?.error && result?.data) {
                dispatch(setDriftAssessmentData(result.data));
                formatGetWellData(result.data, dispatch);
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
            } else {
                dispatch(setIsAssessmentAvailable(false));
                dispatch(setOptimizePageLoading(false));
            }
        } catch (error) {
            dispatch(setIsAssessmentAvailable(false));
            dispatch(setOptimizePageLoading(false));
        }
    };

    const viewOptimizeAction = () => {
        resetGwValuesOnRefresh(dispatch);
        setTimeout(() => {
            // Set the loading state to true
            dispatch(setOptimizePageLoading(true));
            // Call the API to get the assessment details
            runAssessmentDetailsApi();
        }, 10);
    };

    useEffect(() => {
        // On page refresh, call the API to get the assessment details
        if (gwRefreshPage) {
            viewOptimizeAction();
            dispatch(setGwRefreshPage(false));
        }
    }, [gwRefreshPage]);

    return;
};

export default GetWellApi;
