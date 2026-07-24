import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { DBType, WELL_ARCHITECTED_TABS } from '../../../../utils/consts';
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
    setIsAssessmentAvailable,
    setLandingFromInnerPage,
    setOptimizePageLoading
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { setRefreshOracleWellArchitect, setOracleRefreshTimes } from '../../../../store/workloadFactory/oracleSlice';
import { getCurrentDateTime } from '../../../../utils/utilityFunctions';
import { updateAccountLevelAssessmentData } from '../../../GetWell/GetWellUtils';

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

    const { visitedTabs, refreshWellArchitect } = useAppSelector(state => state.oracleSlice);

    const [getOracleAssessmentDataApi] = useGetOracleAssessmentDataMutation();
    const [getOfflineOracleAssessmentData] = useLazyGetOfflineOracleAssessmentDataQuery();
    const [getUnregisteredOracleAssessmentData] = useLazyGetUnregisteredOracleAssessmentQuery();

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
            }
        } catch (error) {
            dispatch(setOptimizePageLoading(false));
            dispatch(setIsAssessmentAvailable(false));
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
     * Trigger unregistered assessment action
     */
    const viewUnregisteredResourceAction = () => {
        dispatch(setDriftAssessmentData({}));
        dispatch(setOptimizePageLoading(true));
        runUnregisteredAssessmentApi();
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
        // On page load, call the appropriate API based on isWad or isUnregistered
        if (!landingFromInnerPage && !visitedTabs[WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS]) {
            dispatch(setOracleRefreshTimes({ optimizeRefreshTime: getCurrentDateTime() }));
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
    }, [isWad, isUnregistered]);

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
