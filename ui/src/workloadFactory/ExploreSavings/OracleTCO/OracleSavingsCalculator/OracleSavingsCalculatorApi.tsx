import { useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import { useGetOracleOnPremCalculationsMutation } from '../../../../utils/apiService';
import {
    setStorageSavingsResponse,
    setStorageSavingsLoading,
    setViewCalculationsApiResponse,
    setViewCalculationsResponse,
    setViewCalculationsLoading,
    setDisableState,
    setOnPremBulkLoadingState,
    setStorageSavingsOnPremResponse,
    setStorageSavingsOnPremLoading,
    setRequestedPayload,
    setRequestedRegion
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { setTriggerBulkDataFetch } from '../../../../store/workloadFactory/exploreSavingsBulkSlice';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import { formatStorageSavingsRecommendedData, formatViewCalcData } from '../../ExploreSavingsUtils';
import {
    GIB_IN_BYTE,
    MAX_CLONED_COPIES,
    MAX_MONTHLY_CHANGE_RATE,
    NETWORK_PERFORMANCE_OPTIONS,
    SAVINGS_CALC_MODE
} from '../../../../utils/consts';

interface OracleOnPremPayload {
    regionCode?: string;
    resources?: Array<{
        resourceId: string;
        databaseData: Array<{
            databaseId?: string;
            noOfVcpusInUse?: number;
            memory?: number;
            networkPerformance?: string;
            totalIops?: number | string;
            totalThroughput?: number | string;
            totalStorage?: number;
        }>;
    }>;
    snapshotInfo?: {
        snapshotFrequency?: string;
        clonedCopiesCount?: number;
        monthlyChangeRatePercentage?: number;
    };
}

const OracleSavingsCalculatorApi = () => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const {
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        monthlyChangeRate,
        savingsCalculatorFrom,
        selectedOnPremHostDetails,
        selectedOnPremRegion,
        selectedOnPremHostId,
        onPremNetworkPerformance,
        onPremStorageAndComputeInfo,
        selectedDeploymentModel,
        requestedPayload,
        requestedRegion
    } = useAppSelector(state => state.exploreSavings);

    const { selectedRowsForExploreSavingsOracleOnPremBulk, triggerBulkDataFetch } = useAppSelector(
        state => state.exploreSavingsBulk
    );

    const [getOracleOnPremCalculationsApi] = useGetOracleOnPremCalculationsMutation();

    const createOracleOnPremPayload = (): OracleOnPremPayload => {
        const hostsToProcess =
            selectedRowsForExploreSavingsOracleOnPremBulk && selectedRowsForExploreSavingsOracleOnPremBulk.length > 0
                ? selectedRowsForExploreSavingsOracleOnPremBulk
                : selectedOnPremHostDetails?.resourceId
                ? [selectedOnPremHostDetails]
                : [];

        const payload: OracleOnPremPayload = {
            snapshotInfo: {
                snapshotFrequency: selectedSnapshotFrequency?.value || 'daily',
                clonedCopiesCount: numberOfClonedCopies || 3,
                monthlyChangeRatePercentage: monthlyChangeRate || 10
            },
            resources: []
        };

        if (selectedOnPremRegion?.data?.regionCode) {
            payload.regionCode = selectedOnPremRegion?.data?.regionCode;
        }

        hostsToProcess.forEach((host: any) => {
            const databaseData: Array<{
                databaseId?: string;
                noOfVcpusInUse?: number;
                memory?: number;
                networkPerformance?: string;
                totalIops?: number | string;
                totalThroughput?: number | string;
                totalStorage?: number;
            }> = [];
            if (onPremStorageAndComputeInfo) {
                Object.keys(onPremStorageAndComputeInfo).forEach(key => {
                    if (key.startsWith(`${host.resourceId}_`)) {
                        const value = onPremStorageAndComputeInfo[key];
                        databaseData.push({
                            databaseId: value?.databaseId,
                            noOfVcpusInUse: value?.noOfVcpusInUse || 0,
                            memory: value?.memory ? Number(value?.memory) * GIB_IN_BYTE : 0,
                            networkPerformance:
                                (onPremNetworkPerformance?.value
                                    ? NETWORK_PERFORMANCE_OPTIONS?.[onPremNetworkPerformance?.value || '']
                                    : value?.networkPerformance) || 'upTo10',
                            totalIops: value?.totalIops || 0,
                            totalThroughput: value?.totalThroughput || 0,
                            totalStorage: Number(value?.totalStorage || 0) * GIB_IN_BYTE
                        });
                    }
                });
            }

            if (databaseData.length > 0) {
                payload.resources!.push({
                    resourceId: host.resourceId,
                    databaseData
                });
            }
        });

        return payload;
    };

    const getOracleOnPremSavingsData = async () => {
        const payload = createOracleOnPremPayload();

        if (!payload.resources || payload.resources.length === 0) {
            return;
        }

        // Filter out resources with no database data
        payload.resources = payload.resources.filter(r => r.databaseData && r.databaseData.length > 0);

        try {
            dispatch(setOnPremBulkLoadingState('start'));

            const result = await getOracleOnPremCalculationsApi({ payload });
            const hasErrors = (result as any)?.error;

            if (hasErrors) {
                dispatch(setOnPremBulkLoadingState('error'));
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: t('databases.explore-savings.oracle-savings-error')
                    })
                );
                return;
            }

            const responseData = (result as any)?.data;
            if (responseData) {
                dispatch(setStorageSavingsOnPremResponse(responseData));
                dispatch(
                    setStorageSavingsResponse(
                        formatStorageSavingsRecommendedData(responseData.storageSavings || responseData)
                    )
                );
                dispatch(setViewCalculationsApiResponse(responseData.calculations || responseData));
                dispatch(
                    setViewCalculationsResponse(
                        formatViewCalcData(
                            responseData.calculations || responseData,
                            selectedDeploymentModel,
                            monthlyChangeRate
                        )
                    )
                );
            }

            dispatch(setOnPremBulkLoadingState('success'));
        } catch (error) {
            dispatch(setOnPremBulkLoadingState('error'));
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: t('databases.explore-savings.oracle-savings-unexpected-error')
                })
            );
        }
    };

    // Re-fetch when triggerBulkDataFetch is set (e.g., after host add/remove)
    useEffect(() => {
        if (triggerBulkDataFetch && savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM) {
            dispatch(setTriggerBulkDataFetch(false));

            const hasHosts =
                (selectedRowsForExploreSavingsOracleOnPremBulk &&
                    selectedRowsForExploreSavingsOracleOnPremBulk.length > 0) ||
                selectedOnPremHostId;

            if (hasHosts) {
                dispatch(setDisableState(false));
                // Reset requestedPayload to force the main useEffect to re-trigger API call
                dispatch(setRequestedPayload(null));
            }
        }
    }, [triggerBulkDataFetch]);

    // Trigger API calls when relevant state changes
    useEffect(() => {
        if (savingsCalculatorFrom !== SAVINGS_CALC_MODE.ORACLE_ONPREM) {
            return;
        }

        const newPayload = createOracleOnPremPayload();
        const comparedPayloadValues =
            isEqual(newPayload, requestedPayload) &&
            selectedOnPremRegion?.data?.regionCode === requestedRegion?.data?.regionCode;

        const hasHosts =
            selectedOnPremHostId ||
            (selectedRowsForExploreSavingsOracleOnPremBulk && selectedRowsForExploreSavingsOracleOnPremBulk.length > 0);

        if (
            !comparedPayloadValues &&
            hasHosts &&
            selectedSnapshotFrequency &&
            numberOfClonedCopies &&
            numberOfClonedCopies <= MAX_CLONED_COPIES &&
            monthlyChangeRate &&
            Number(monthlyChangeRate) <= MAX_MONTHLY_CHANGE_RATE &&
            selectedOnPremRegion
        ) {
            dispatch(setRequestedPayload(newPayload));
            dispatch(setRequestedRegion(selectedOnPremRegion));
            dispatch(setStorageSavingsResponse({}));
            dispatch(setStorageSavingsLoading(true));
            dispatch(setViewCalculationsApiResponse({}));
            dispatch(setViewCalculationsLoading(true));
            dispatch(setStorageSavingsOnPremLoading(true));
            setTimeout(() => {
                getOracleOnPremSavingsData();
            }, 1);
        }
    }, [
        savingsCalculatorFrom,
        selectedOnPremHostId,
        selectedRowsForExploreSavingsOracleOnPremBulk,
        selectedOnPremRegion?.data?.regionCode,
        selectedSnapshotFrequency?.value,
        numberOfClonedCopies,
        monthlyChangeRate,
        onPremNetworkPerformance?.value,
        onPremStorageAndComputeInfo,
        selectedDeploymentModel
    ]);

    return <></>;
};

export default OracleSavingsCalculatorApi;
