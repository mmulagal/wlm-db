import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../store/storeHooks';
import {
    setDriftAssessmentData,
    setOptimizePageLoading,
    setGwRefreshPage,
    setIsAssessmentAvailable,
    setLandingFromInnerPage,
    setGwSelectedRowFsxId,
    setGwRefreshTimestamp,
    setGwTimestamp
} from '../../store/workloadFactory/getWellOptimizeSlice';
import {
    useGetMssqlAssessmentDataMutation,
    useLazyGetOfflineMssqlAssessmentDataQuery,
    useLazyGetUnregisteredMssqlAssessmentQuery
} from '../../utils/apiService';
import {
    formatGetWellDataFlat,
    resetGwValuesOnRefresh,
    syncUnregisteredAssessmentToInventory,
    updateAccountLevelAssessmentData
} from './GetWellUtils';
import { hasAssessmentTimestamp } from '../WellArchitectedTab/assessmentFormatUtils';
import { WLF_TABS } from '../../utils/consts';

const GetWellApi = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const accountId = useAppSelector(state => state.auth.accountId);
    const { credIdFromJM, regionFromJM, landingFrom, landingFromInnerPage, isWad, isUnregistered } = useAppSelector(
        state => state.getWellOptimize
    );

    const {
        selectedResourceId,
        selectedDatabaseInstance,
        gwRefreshPage,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId
    } = useAppSelector(state => state.getWellOptimize);

    const [assessmentDetailsApi] = useGetMssqlAssessmentDataMutation();
    const [getOfflineMssqlAssessmentData] = useLazyGetOfflineMssqlAssessmentDataQuery();
    const [getUnregisteredMssqlAssessmentData] = useLazyGetUnregisteredMssqlAssessmentQuery();

    const clearAssessmentTimestamps = () => {
        dispatch(setGwRefreshTimestamp(''));
        dispatch(setGwTimestamp('0'));
    };

    useEffect(() => {
        // On page load or instance change, call the appropriate API based on isWad or isUnregistered
        if (!landingFromInnerPage) {
            if (isUnregistered) {
                viewUnregisteredOptimizeAction(false); // Unregistered: Call offline assessment with ec2InstanceId
            } else if (isWad) {
                viewWadOptimizeAction(false); // WAD: Call offline assessment API
            } else {
                viewOptimizeAction(false); // Normal: Call regular assessment API
            }
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWad, isUnregistered, selectedResourceId, selectedDatabaseInstance]);

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
                const assessmentData = { ...result.data, isWad: true };

                dispatch(setDriftAssessmentData(assessmentData));
                formatGetWellDataFlat(dispatch, assessmentData, false, isRefresh, false, t);
                dispatch(setGwSelectedRowFsxId(assessmentData.metadata?.fileSystemId));

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
                clearAssessmentTimestamps();
                dispatch(setOptimizePageLoading(false));
            }
        } catch (error) {
            dispatch(setIsAssessmentAvailable(false));
            clearAssessmentTimestamps();
            dispatch(setOptimizePageLoading(false));
        }
    };

    /**
     * Call the offline assessment API for unregistered instances using ec2InstanceId
     */
    const runUnregisteredAssessmentApi = async (isRefresh: boolean = false) => {
        try {
            dispatch(setOptimizePageLoading(true));
            const result: { data?: any; error?: any } = await getUnregisteredMssqlAssessmentData({
                accountId,
                ec2InstanceId: selectedResourceId, // For unregistered, resourceId is the ec2InstanceId
                instanceName: selectedDatabaseInstance, // For unregistered, this is the instanceName
                region: selectedGwInstanceRegionId || null,
                credentialId: selectedGwInstanceCredId || null
            });
            // A resource with no completed assessment (e.g. offline collection never ran) comes back
            // as a "successful" response with no lastAssessmentTimestamp. Treat that like no data so the
            // inventory row isn't synced into a permanent "In progress" state.
            if (result && !result?.error && result?.data && hasAssessmentTimestamp(result.data)) {
                const assessmentData = result.data;

                dispatch(setDriftAssessmentData(assessmentData));
                formatGetWellDataFlat(dispatch, assessmentData, false, isRefresh, false, t);
                dispatch(setGwSelectedRowFsxId(assessmentData.metadata?.fileSystemId));

                syncUnregisteredAssessmentToInventory(dispatch, assessmentData, {
                    ec2InstanceId: selectedResourceId,
                    instanceName: selectedDatabaseInstance,
                    credentialId: selectedGwInstanceCredId || '',
                    regionId: selectedGwInstanceRegionId || ''
                });
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
            } else {
                dispatch(setIsAssessmentAvailable(false));
                clearAssessmentTimestamps();
                dispatch(setOptimizePageLoading(false));
            }
        } catch (error) {
            dispatch(setIsAssessmentAvailable(false));
            clearAssessmentTimestamps();
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
                dispatch(setDriftAssessmentData(result.data));
                formatGetWellDataFlat(dispatch, result.data, false, isRefresh, false, t);
                dispatch(setGwSelectedRowFsxId(result.data.metadata?.fileSystemId));

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
                clearAssessmentTimestamps();
                dispatch(setOptimizePageLoading(false));
            }
        } catch (error) {
            dispatch(setIsAssessmentAvailable(false));
            clearAssessmentTimestamps();
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
     * Trigger unregistered assessment action
     */
    const viewUnregisteredOptimizeAction = (isRefresh: boolean = false) => {
        resetGwValuesOnRefresh(dispatch);
        setTimeout(() => {
            dispatch(setOptimizePageLoading(true));
            runUnregisteredAssessmentApi(isRefresh);
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
            if (isUnregistered) {
                viewUnregisteredOptimizeAction(true); // Unregistered: Call offline assessment with ec2InstanceId
            } else if (isWad) {
                viewWadOptimizeAction(true); // WAD: Call offline assessment API
            } else {
                viewOptimizeAction(true); // Normal: Call regular assessment API
            }
            dispatch(setGwRefreshPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gwRefreshPage, isWad, isUnregistered]);
};

export default GetWellApi;
