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
import { useGetMssqlAssessmentDataMutation, useLazyGetOfflineMssqlAssessmentDataQuery } from '../../utils/apiService';
import {
    formatGetWellData,
    formatGetWellDataFlat,
    resetGwValuesOnRefresh,
    storageMockData,
    updateAccountLevelAssessmentData
} from './GetWellUtils';
import { WELL_ARCHITECTED_TABS, WLF_TABS } from '../../utils/consts';

const GetWellApi = () => {
    const dispatch = useDispatch();
    const { credIdFromJM, regionFromJM, landingFrom, landingFromInnerPage, isWad } = useAppSelector(
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
    const [getOfflineMssqlAssessmentData] = useLazyGetOfflineMssqlAssessmentDataQuery();

    useEffect(() => {
        // On page load, call the appropriate API based on isWad
        if (!landingFromInnerPage && !visitedTabs[WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS]) {
            if (isWad) {
                viewWadOptimizeAction(false); // WAD: Call offline assessment API
            } else {
                viewOptimizeAction(false); // Normal: Call regular assessment API
            }
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWad]);

    /**
     * Call the offline assessment API for WAD instances
     */
    const runOfflineAssessmentApi = async (isRefresh: boolean = false) => {
        try {
            dispatch(setOptimizePageLoading(true));
            const result: { data?: any; error?: any } = await getOfflineMssqlAssessmentData({
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance,
                credentialId: selectedGwInstanceCredId || null,
                regionId: selectedGwInstanceRegionId || null
            });
            if (result && !result?.error && result?.data) {
                // Offline assessments now return flat structure (with assessments array)
                const isFlatStructure = result.data.assessments && Array.isArray(result.data.assessments);

                let assessmentData = result.data;

                if (isFlatStructure) {
                    // New flat structure - use formatGetWellDataFlat
                    dispatch(setDriftAssessmentData(assessmentData));
                    formatGetWellDataFlat(dispatch, assessmentData, false, isRefresh);
                    dispatch(setGwSelectedRowFsxId(assessmentData.metadata?.fileSystemId));
                } else {
                    // Old nested structure (backward compatibility)
                    if (!assessmentData.storage) {
                        assessmentData = { ...assessmentData, ...storageMockData };
                    }
                    dispatch(setDriftAssessmentData(assessmentData));
                    formatGetWellData(dispatch, assessmentData, false, isRefresh);
                    dispatch(setGwSelectedRowFsxId(assessmentData?.fileSystemId));
                }

                updateAccountLevelAssessmentData(dispatch, assessmentData, {
                    databaseHostId: selectedResourceId,
                    databaseInstanceId: selectedDatabaseInstance,
                    credentialId: selectedGwInstanceCredId || '',
                    regionId: selectedGwInstanceRegionId || ''
                });
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

    /**
     * Call the regular assessment API for registered instances
     */
    const runAssessmentDetailsApi = async (isRefresh: boolean = false) => {
        try {
            dispatch(setOptimizePageLoading(true));
            const result: { data?: any; error?: any } = await assessmentDetailsApi({
                credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM,
                databaseHostId: selectedResourceId,
                instanceId: selectedDatabaseInstance
            });
            if (result && !result?.error && result?.data) {
                // Check if response is flat structure (has assessments array)
                const isFlatStructure = result.data.assessments && Array.isArray(result.data.assessments);

                if (isFlatStructure) {
                    // New flat structure
                    dispatch(setDriftAssessmentData(result.data));
                    formatGetWellDataFlat(dispatch, result.data, false, isRefresh);
                    dispatch(setGwSelectedRowFsxId(result.data.metadata?.fileSystemId));
                } else {
                    // Old nested structure (backward compatibility)
                    if (!result.data.storage) {
                        result.data = { ...result.data, ...storageMockData };
                    }
                    dispatch(setDriftAssessmentData(result.data));
                    formatGetWellData(dispatch, result.data, false, isRefresh);
                    dispatch(setGwSelectedRowFsxId(result?.data?.fileSystemId));
                }

                updateAccountLevelAssessmentData(dispatch, result.data, {
                    databaseHostId: selectedResourceId,
                    databaseInstanceId: selectedDatabaseInstance,
                    credentialId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceCredId : credIdFromJM,
                    regionId: landingFrom === WLF_TABS.INVENTORY ? selectedGwInstanceRegionId : regionFromJM
                });
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

    /**
     * Trigger WAD (offline) assessment action
     */
    const viewWadOptimizeAction = (isRefresh: boolean = false) => {
        resetGwValuesOnRefresh(dispatch);
        setTimeout(() => {
            dispatch(setOptimizePageLoading(true));
            runOfflineAssessmentApi(isRefresh);
        }, 10);
    };

    /**
     * Trigger regular assessment action
     */
    const viewOptimizeAction = (isRefresh: boolean = false) => {
        resetGwValuesOnRefresh(dispatch);
        setTimeout(() => {
            dispatch(setOptimizePageLoading(true));
            runAssessmentDetailsApi(isRefresh);
        }, 10);
    };

    useEffect(() => {
        // On page refresh, call the appropriate API
        if (gwRefreshPage) {
            if (isWad) {
                viewWadOptimizeAction(true); // WAD: Call offline assessment API
            } else {
                viewOptimizeAction(true); // Normal: Call regular assessment API
            }
            dispatch(setGwRefreshPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gwRefreshPage, isWad]);
};

export default GetWellApi;
