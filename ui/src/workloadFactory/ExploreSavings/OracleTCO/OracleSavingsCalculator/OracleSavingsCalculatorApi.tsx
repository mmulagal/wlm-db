import { useEffect, useRef } from 'react';
import isEqual from 'lodash/isEqual';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import {
    useGetOracleOnPremCalculationsMutation,
    useLazyGetRegionsWithoutCredQuery
} from '../../../../utils/apiService';
import {
    addOnPremRegionsList,
    setOnPremRegionsLoading,
    setStorageSavingsLoading,
    setStorageSavingsResponse,
    setViewCalculationsApiResponse,
    setViewCalculationsLoading,
    setViewCalculationsResponse,
    setDisableState,
    resetSavingsApiState
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { formatStorageSavingsRecommendedData, formatViewCalcData } from '../../ExploreSavingsUtils';
import { GIB_IN_BYTE, NETWORK_PERFORMANCE_OPTIONS, SAVINGS_CALC_MODE } from '../../../../utils/consts';

interface OracleOnPremPayload {
    regionCode?: string;
    resources?: Array<{
        resourceId: string;
        monthlySqlByolCost?: number;
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
    const dispatch = useAppDispatch();
    const {
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        monthlyChangeRate,
        savingsCalculatorFrom,
        selectedOnPremHostDetails,
        selectedOnPremRegion,
        onPremNetworkPerformance,
        onPremStorageAndComputeInfo
    } = useAppSelector(state => state.exploreSavings);
    const { selectedDeploymentModel } = useAppSelector(state => state.exploreSavings);

    const [getOracleOnPremCalculationsApi] = useGetOracleOnPremCalculationsMutation();
    const [getRegionsWithoutCred] = useLazyGetRegionsWithoutCredQuery();
    const previousPayloadRef = useRef<OracleOnPremPayload | null>(null);

    // Load regions for Oracle on-prem
    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM) {
            dispatch(setOnPremRegionsLoading(true));
            getRegionsWithoutCred({})
                .then((res: any) => {
                    dispatch(addOnPremRegionsList(res?.data));
                    dispatch(setOnPremRegionsLoading(false));
                })
                .catch(() => {
                    dispatch(setOnPremRegionsLoading(false));
                });
        }
    }, [savingsCalculatorFrom, dispatch, getRegionsWithoutCred]);

    // Trigger API calls when relevant state changes
    useEffect(() => {
        const fetchData = async () => {
            if (savingsCalculatorFrom !== SAVINGS_CALC_MODE.ORACLE_ONPREM) {
                return;
            }

            // Only call API when we have required data
            if (selectedOnPremHostDetails?.resourceId && selectedOnPremRegion?.data?.regionCode) {
                // Inline API call logic to avoid circular dependencies
                const payload: OracleOnPremPayload = {
                    regionCode: selectedOnPremRegion?.data?.regionCode,
                    snapshotInfo: {
                        snapshotFrequency: selectedSnapshotFrequency?.value || 'daily',
                        clonedCopiesCount: numberOfClonedCopies || 1,
                        monthlyChangeRatePercentage: monthlyChangeRate || 3
                    },
                    resources: []
                };

                // Build Oracle instance data
                const databaseData: Array<{
                    databaseId?: string;
                    noOfVcpusInUse?: number;
                    memory?: number;
                    networkPerformance?: string;
                    totalIops?: number | string;
                    totalThroughput?: number | string;
                    totalStorage?: number;
                }> = [];
                let monthlySqlByolCost: number | undefined;

                if (onPremStorageAndComputeInfo) {
                    Object.keys(onPremStorageAndComputeInfo).forEach(key => {
                        if (key.startsWith(`${selectedOnPremHostDetails.resourceId}_`)) {
                            const value = onPremStorageAndComputeInfo[key];
                            const instanceEntry: any = {
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
                            };
                            if (value?.monthlyOracleCost && monthlySqlByolCost === undefined) {
                                monthlySqlByolCost = Number(value.monthlyOracleCost);
                            }
                            databaseData.push(instanceEntry);
                        }
                    });
                }

                // If no oracle storage info, use host details directly
                if (databaseData.length === 0 && selectedOnPremHostDetails) {
                    databaseData.push({
                        databaseId: selectedOnPremHostDetails?.databaseId,
                        noOfVcpusInUse: selectedOnPremHostDetails?.noOfVcpusInUse || 0,
                        memory: selectedOnPremHostDetails?.Memory
                            ? Number(selectedOnPremHostDetails?.Memory) * GIB_IN_BYTE
                            : 0,
                        networkPerformance:
                            onPremNetworkPerformance?.value ||
                            selectedOnPremHostDetails?.networkPerformance ||
                            'upTo10',
                        totalIops: selectedOnPremHostDetails?.totalIops || 0,
                        totalThroughput: selectedOnPremHostDetails?.totalThroughput || 0,
                        totalStorage: Number(selectedOnPremHostDetails?.totalStorage || 0) * GIB_IN_BYTE
                    });
                }

                if (databaseData.length > 0) {
                    payload.resources!.push({
                        resourceId: selectedOnPremHostDetails.resourceId,
                        ...(monthlySqlByolCost !== undefined && { monthlySqlByolCost }),
                        databaseData
                    });
                }

                if (!payload.resources || payload.resources.length === 0) {
                    dispatch(setDisableState(true));
                    return;
                }

                // Skip API call if payload hasn't changed (prevents duplicate calls on accordion expand)
                if (isEqual(payload, previousPayloadRef.current)) {
                    return;
                }

                // Single API call that returns both storageSavings and calculations
                try {
                    dispatch(setStorageSavingsLoading(true));
                    dispatch(setViewCalculationsLoading(true));
                    dispatch(setDisableState(true));

                    const result = await getOracleOnPremCalculationsApi({ payload });

                    if (result && !('error' in result)) {
                        const responseData = result?.data;
                        if (responseData) {
                            // Process storage savings
                            dispatch(
                                setStorageSavingsResponse(
                                    formatStorageSavingsRecommendedData(responseData.storageSavings || responseData)
                                )
                            );
                            // Process view calculations
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
                            dispatch(setDisableState(false));
                        }
                        // Only mark payload as processed after a successful response
                        previousPayloadRef.current = payload;
                    } else {
                        previousPayloadRef.current = null;
                        dispatch(resetSavingsApiState());
                    }
                    dispatch(setStorageSavingsLoading(false));
                    dispatch(setViewCalculationsLoading(false));
                } catch (error) {
                    previousPayloadRef.current = null;
                    dispatch(resetSavingsApiState());
                }
            }
        };

        fetchData();
    }, [
        savingsCalculatorFrom,
        selectedOnPremHostDetails,
        selectedOnPremRegion?.data?.regionCode,
        selectedSnapshotFrequency?.value,
        numberOfClonedCopies,
        monthlyChangeRate,
        onPremNetworkPerformance?.value,
        onPremStorageAndComputeInfo,
        selectedDeploymentModel,
        dispatch,
        getOracleOnPremCalculationsApi
    ]);

    return null;
};

export default OracleSavingsCalculatorApi;
