import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { WELL_ARCHITECTED_TABS } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useGetOracleAssessmentDataMutation,
    useLazyGetOfflineOracleAssessmentDataQuery
} from '../../../../utils/apiService';
import { formatOracleWellArchitectedData, oracleCardData } from './OracleWellArchitectedUtils';
import {
    setCardData,
    setDriftAssessmentData,
    setGwSelectedRowFsxId,
    setIsAssessmentAvailable,
    setLandingFromInnerPage,
    setOptimizePageLoading
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { setRefreshOracleWellArchitect, setOracleRefreshTimes } from '../../../../store/workloadFactory/oracleSlice';
import { getCurrentDateTime } from '../../../../utils/utilityFunctions';
import { generateDynamicOracleStorageMockData } from '../../../GetWell/GetWellUtils';

const useOracleWellArchitectApi = () => {
    const dispatch = useDispatch();
    const { selectedResourceId, selectedDatabaseInstance, selectedResourceCredId, selectedResourceRegionId } =
        useAppSelector(state => state.workloadFactoryResource);

    const {
        credIdFromJM,
        regionFromJM,
        selectedResourceId: getWellResourceId,
        selectedDatabaseInstance: getWellSelectedDatabaseInstance,
        landingFromInnerPage,
        isWad
    } = useAppSelector(state => state.getWellOptimize);

    const { visitedTabs, refreshWellArchitect } = useAppSelector(state => state.oracleSlice);

    const [getOracleAssessmentDataApi] = useGetOracleAssessmentDataMutation();
    const [getOfflineOracleAssessmentData] = useLazyGetOfflineOracleAssessmentDataQuery();

    /**
     * Call the offline assessment API for WAD instances
     */
    const runOfflineAssessmentApi = async () => {
        try {
            dispatch(setOptimizePageLoading(true));
            dispatch(setCardData(oracleCardData));
            const result: { data?: any; error?: any } = await getOfflineOracleAssessmentData({
                databaseHostId: selectedResourceId || getWellResourceId,
                instanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance,
                credentialId: selectedResourceCredId || credIdFromJM || null,
                regionId: selectedResourceRegionId || regionFromJM || null
            });

            if (result && !result?.error && result?.data) {
                let assessmentData = {
                    ...result.data,
                    isWad: true
                };
                if (!assessmentData.storage) {
                    const dynamicMockData = generateDynamicOracleStorageMockData(assessmentData);
                    assessmentData = { ...assessmentData, ...dynamicMockData };
                }
                dispatch(setDriftAssessmentData(assessmentData));
                formatOracleWellArchitectedData(dispatch, assessmentData, false, true);
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
                dispatch(setGwSelectedRowFsxId(result?.data?.fileSystemId));
            } else {
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(false));
            }
        } catch (error) {
            dispatch(setOptimizePageLoading(false));
            dispatch(setIsAssessmentAvailable(false));
        }
    };

    /**
     * Call the regular assessment API for registered instances
     */
    const runAssessmentDetailsApi = async () => {
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
                if (!result.data.storage) {
                    const dynamicMockData = generateDynamicOracleStorageMockData(result.data);
                    result.data = { ...result.data, ...dynamicMockData };
                }
                dispatch(setDriftAssessmentData(result.data));
                formatOracleWellArchitectedData(dispatch, result.data, false, true);
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
                dispatch(setGwSelectedRowFsxId(result?.data?.fileSystemId));
            } else {
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(false));
            }
        } catch (error) {
            dispatch(setOptimizePageLoading(false));
            dispatch(setIsAssessmentAvailable(false));
        }
    };

    /**
     * Trigger WAD (offline) assessment action
     */
    const viewWadResourceAction = () => {
        dispatch(setDriftAssessmentData({}));
        dispatch(setOptimizePageLoading(true));
        runOfflineAssessmentApi();
    };

    /**
     * Trigger regular assessment action
     */
    const viewResourceAction = () => {
        dispatch(setDriftAssessmentData({}));
        dispatch(setOptimizePageLoading(true));
        runAssessmentDetailsApi();
    };

    useEffect(() => {
        // On page load, call the appropriate API based on isWad
        if (!landingFromInnerPage && !visitedTabs[WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS]) {
            dispatch(setOracleRefreshTimes({ optimizeRefreshTime: getCurrentDateTime() }));
            if (isWad) {
                viewWadResourceAction(); // WAD: Call offline assessment API
            } else {
                viewResourceAction(); // Normal: Call regular assessment API
            }
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWad]);

    useEffect(() => {
        // Handle Oracle-specific refresh
        if (refreshWellArchitect) {
            if (isWad) {
                viewWadResourceAction(); // WAD: Call offline assessment API
            } else {
                viewResourceAction(); // Normal: Call regular assessment API
            }
            dispatch(setRefreshOracleWellArchitect(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshWellArchitect, isWad]);
};

export default useOracleWellArchitectApi;
