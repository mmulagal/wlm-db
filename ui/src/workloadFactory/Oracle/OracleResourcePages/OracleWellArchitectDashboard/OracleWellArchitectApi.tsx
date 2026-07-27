import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { DBType } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useGetOracleAssessmentDataMutation,
    useLazyGetOfflineOracleAssessmentDataQuery,
    useLazyGetUnregisteredOracleAssessmentQuery
} from '../../../../utils/apiService';
import { formatOracleWellArchitectedData } from './OracleWellArchitectedUtils';
import {
    setCardData,
    setDriftAssessmentData,
    setGwSelectedRowFsxId,
    setGwRefreshTimestamp,
    setGwTimestamp,
    setIsAssessmentAvailable,
    setLandingFromInnerPage,
    setOptimizePageLoading
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { setRefreshOracleWellArchitect } from '../../../../store/workloadFactory/oracleSlice';
import { updateAccountLevelAssessmentData, resetGwValuesOnRefresh } from '../../../GetWell/GetWellUtils';

const useOracleWellArchitectApi = () => {
    const dispatch = useDispatch();
    const accountId = useAppSelector(state => state.auth.accountId);
    const { selectedResourceId, selectedDatabaseInstance, selectedResourceCredId, selectedResourceRegionId } =
        useAppSelector(state => state.workloadFactoryResource);

    const {
        credIdFromJM,
        regionFromJM,
        selectedResourceId: getWellResourceId,
        selectedDatabaseInstance: getWellSelectedDatabaseInstance,
        landingFromInnerPage,
        isWad,
        isUnregistered
    } = useAppSelector(state => state.getWellOptimize);

    const { refreshWellArchitect } = useAppSelector(state => state.oracleSlice);

    const [getOracleAssessmentDataApi] = useGetOracleAssessmentDataMutation();
    const [getOfflineOracleAssessmentData] = useLazyGetOfflineOracleAssessmentDataQuery();
    const [getUnregisteredOracleAssessmentData] = useLazyGetUnregisteredOracleAssessmentQuery();

    const clearAssessmentTimestamps = () => {
        dispatch(setGwRefreshTimestamp(''));
        dispatch(setGwTimestamp('0'));
    };

    /**
     * Call the offline assessment API for WAD instances
     */
    const runOfflineAssessmentApi = async () => {
        try {
            dispatch(setOptimizePageLoading(true));
            dispatch(setCardData({}));
            const result: { data?: any; error?: any } = await getOfflineOracleAssessmentData({
                databaseHostId: selectedResourceId || getWellResourceId,
                instanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance,
                credentialId: selectedResourceCredId || credIdFromJM || null,
                regionId: selectedResourceRegionId || regionFromJM || null
            });

            if (result && !result?.error && result?.data) {
                const assessmentData = {
                    ...result.data,
                    isWad: true
                };
                dispatch(setDriftAssessmentData(assessmentData));
                formatOracleWellArchitectedData(dispatch, assessmentData, false, true);
                updateAccountLevelAssessmentData(
                    dispatch,
                    assessmentData,
                    {
                        databaseHostId: selectedResourceId || getWellResourceId,
                        databaseInstanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance,
                        credentialId: selectedResourceCredId || credIdFromJM || '',
                        regionId: selectedResourceRegionId || regionFromJM || ''
                    },
                    DBType.ORACLE
                );
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
                // WAD (offline) assessments use flat API structure with metadata.fileSystemId
                dispatch(setGwSelectedRowFsxId(result?.data?.metadata?.fileSystemId));
            } else {
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(false));
                clearAssessmentTimestamps();
            }
        } catch (error) {
            dispatch(setOptimizePageLoading(false));
            dispatch(setIsAssessmentAvailable(false));
            clearAssessmentTimestamps();
        }
    };

    /**
     * Call the regular assessment API for registered instances
     */
    const runAssessmentDetailsApi = async () => {
        try {
            dispatch(setOptimizePageLoading(true));
            dispatch(setCardData({})); // Clear any previous data to prevent showing stale cards
            const result = await getOracleAssessmentDataApi({
                credentialId: selectedResourceCredId || credIdFromJM,
                regionId: selectedResourceRegionId || regionFromJM,
                databaseHostId: selectedResourceId || getWellResourceId,
                instanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance
            });

            if (result && !result?.error && result?.data) {
                dispatch(setDriftAssessmentData(result.data));
                formatOracleWellArchitectedData(dispatch, result.data, false, true);
                updateAccountLevelAssessmentData(
                    dispatch,
                    result.data,
                    {
                        databaseHostId: selectedResourceId || getWellResourceId,
                        databaseInstanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance,
                        credentialId: selectedResourceCredId || credIdFromJM,
                        regionId: selectedResourceRegionId || regionFromJM
                    },
                    DBType.ORACLE
                );
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
                // Flat API v2 uses metadata.fileSystemId, nested API uses top-level fileSystemId
                dispatch(setGwSelectedRowFsxId(result?.data?.metadata?.fileSystemId));
            } else {
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(false));
                clearAssessmentTimestamps();
            }
        } catch (error) {
            dispatch(setOptimizePageLoading(false));
            dispatch(setIsAssessmentAvailable(false));
            clearAssessmentTimestamps();
        }
    };

    /**
     * Call the offline assessment API for unregistered instances using ec2InstanceId
     */
    const runUnregisteredAssessmentApi = async () => {
        try {
            dispatch(setOptimizePageLoading(true));
            dispatch(setCardData({}));
            const result: { data?: any; error?: any } = await getUnregisteredOracleAssessmentData({
                accountId,
                ec2InstanceId: selectedResourceId || getWellResourceId, // For unregistered, resourceId is the ec2InstanceId
                instanceName: selectedDatabaseInstance || getWellSelectedDatabaseInstance, // For unregistered, this is the instanceName
                region: selectedResourceRegionId || regionFromJM || null,
                credentialId: selectedResourceCredId || credIdFromJM || null
            });

            if (result && !result?.error && result?.data) {
                const assessmentData = {
                    ...result.data,
                    isUnregistered: true
                };
                dispatch(setDriftAssessmentData(assessmentData));
                formatOracleWellArchitectedData(dispatch, assessmentData, false, true);
                updateAccountLevelAssessmentData(
                    dispatch,
                    assessmentData,
                    {
                        databaseHostId: selectedResourceId || getWellResourceId,
                        databaseInstanceId: selectedDatabaseInstance || getWellSelectedDatabaseInstance,
                        credentialId: selectedResourceCredId || credIdFromJM || '',
                        regionId: selectedResourceRegionId || regionFromJM || ''
                    },
                    DBType.ORACLE
                );
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(true));
                dispatch(setGwSelectedRowFsxId(result?.data?.metadata?.fileSystemId));
            } else {
                dispatch(setOptimizePageLoading(false));
                dispatch(setIsAssessmentAvailable(false));
                clearAssessmentTimestamps();
            }
        } catch (error) {
            dispatch(setOptimizePageLoading(false));
            dispatch(setIsAssessmentAvailable(false));
            clearAssessmentTimestamps();
        }
    };

    /**
     * Trigger WAD (offline) assessment action
     */
    const viewWadResourceAction = () => {
        resetGwValuesOnRefresh(dispatch);
        dispatch(setOptimizePageLoading(true));
        runOfflineAssessmentApi();
    };

    /**
     * Trigger unregistered assessment action
     */
    const viewUnregisteredResourceAction = () => {
        resetGwValuesOnRefresh(dispatch);
        dispatch(setOptimizePageLoading(true));
        runUnregisteredAssessmentApi();
    };

    /**
     * Trigger regular assessment action
     */
    const viewResourceAction = () => {
        resetGwValuesOnRefresh(dispatch);
        dispatch(setOptimizePageLoading(true));
        runAssessmentDetailsApi();
    };

    useEffect(() => {
        // On page load or instance change, call the appropriate API based on isWad or isUnregistered
        if (!landingFromInnerPage) {
            if (isUnregistered) {
                viewUnregisteredResourceAction(); // Unregistered: Call offline assessment with ec2InstanceId
            } else if (isWad) {
                viewWadResourceAction(); // WAD: Call offline assessment API
            } else {
                viewResourceAction(); // Normal: Call regular assessment API
            }
        } else {
            dispatch(setLandingFromInnerPage(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWad, isUnregistered, getWellResourceId, getWellSelectedDatabaseInstance]);

    useEffect(() => {
        // Handle Oracle-specific refresh
        if (refreshWellArchitect) {
            if (isUnregistered) {
                viewUnregisteredResourceAction(); // Unregistered: Call offline assessment with ec2InstanceId
            } else if (isWad) {
                viewWadResourceAction(); // WAD: Call offline assessment API
            } else {
                viewResourceAction(); // Normal: Call regular assessment API
            }
            dispatch(setRefreshOracleWellArchitect(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshWellArchitect, isWad, isUnregistered]);
};

export default useOracleWellArchitectApi;
