import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../store/storeHooks';
import { useEffect } from 'react';
import { setDriftAssessmentData, setOptimizePageLoading } from '../../store/workloadFactory/getWellOptimizeSlice';
import { useGetMssqlAssessmentDataMutation } from '../../utils/apiService';
import { formatGetWellData } from './GetWellUtils';
import { AssessmentResponseInterface } from '../../utils/types/getWellTypes';

const GetWellApi = () => {
    const dispatch = useDispatch();
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const { selectedResourceId, selectedDatabaseInstance } = useAppSelector(state => state.getWellOptimize);

    const [assessmentDetailsApi] = useGetMssqlAssessmentDataMutation();

    useEffect(() => {
        viewOptimizeAction();
    }, []);

    const runAssessmentDetailsApi = async () => {
        try {
            dispatch(setOptimizePageLoading(true));
            const result: { data?: AssessmentResponseInterface, error?: any} = await assessmentDetailsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance
            });
            if (result && !result?.error && result?.data) {
                dispatch(setDriftAssessmentData(result.data));
                formatGetWellData(result.data, dispatch);
                dispatch(setOptimizePageLoading(false));
            } else {
                dispatch(setOptimizePageLoading(false));
            }
        } catch (error) {
            dispatch(setOptimizePageLoading(false));
        }
    };

    const viewOptimizeAction = () => {
        dispatch(setOptimizePageLoading(true));
        runAssessmentDetailsApi();
    };

    return;
};

export default GetWellApi;
