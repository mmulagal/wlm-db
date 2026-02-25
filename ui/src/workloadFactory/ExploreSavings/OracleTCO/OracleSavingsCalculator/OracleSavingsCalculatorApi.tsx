import { useEffect } from 'react';
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
    resetSavingsApiState,
    setRequestedPayload,
    setRequestedRegion
} from '../../../../store/workloadFactory/exploreSavingsSlice';
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
    const dispatch = useAppDispatch();
    const {
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        monthlyChangeRate,
        savingsCalculatorFrom,
        selectedOnPremHostDetails,
        selectedOnPremRegion,
        onPremNetworkPerformance,
        onPremStorageAndComputeInfo,
        requestedPayload,
        requestedRegion
    } = useAppSelector(state => state.exploreSavings);
    const { selectedDeploymentModel } = useAppSelector(state => state.exploreSavings);

    const [getOracleOnPremCalculationsApi] = useGetOracleOnPremCalculationsMutation();
    const [getRegionsWithoutCred] = useLazyGetRegionsWithoutCredQuery();

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

    const createOracleOnPremPayload = (): OracleOnPremPayload => {
        const payload: OracleOnPremPayload = {
            snapshotInfo: {
                snapshotFrequency: selectedSnapshotFrequency?.value || 'daily',
                clonedCopiesCount: numberOfClonedCopies || 1,
                monthlyChangeRatePercentage: monthlyChangeRate || 3
            },
            resources: []
        };

        if (selectedOnPremRegion?.data?.regionCode) {
            payload.regionCode = selectedOnPremRegion?.data?.regionCode;
        }

        const databaseData: Array<{
            databaseId?: string;
            noOfVcpusInUse?: number;
            memory?: number;
            networkPerformance?: string;
            totalIops?: number | string;
            totalThroughput?: number | string;
            totalStorage?: number;
        }> = [];

        if (onPremStorageAndComputeInfo && selectedOnPremHostDetails?.resourceId) {
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
                    databaseData.push(instanceEntry);
                }
            });
        }

        if (databaseData.length === 0 && selectedOnPremHostDetails) {
            databaseData.push({
                databaseId: selectedOnPremHostDetails?.databaseId,
                noOfVcpusInUse: selectedOnPremHostDetails?.noOfVcpusInUse || 0,
                memory: selectedOnPremHostDetails?.Memory ? Number(selectedOnPremHostDetails?.Memory) * GIB_IN_BYTE : 0,
                networkPerformance:
                    onPremNetworkPerformance?.value || selectedOnPremHostDetails?.networkPerformance || 'upTo10',
                totalIops: selectedOnPremHostDetails?.totalIops || 0,
                totalThroughput: selectedOnPremHostDetails?.totalThroughput || 0,
                totalStorage: Number(selectedOnPremHostDetails?.totalStorage || 0) * GIB_IN_BYTE
            });
        }

        if (databaseData.length > 0 && selectedOnPremHostDetails?.resourceId) {
            payload.resources!.push({
                resourceId: selectedOnPremHostDetails.resourceId,
                databaseData
            });
        }

        return payload;
    };

    const getOracleOnPremData = async () => {
        const payload = createOracleOnPremPayload();

        if (!payload.resources || payload.resources.length === 0) {
            return;
        }

        try {
            dispatch(setStorageSavingsLoading(true));
            dispatch(setViewCalculationsLoading(true));
            dispatch(setDisableState(true));

            const result = await getOracleOnPremCalculationsApi({ payload });

            if (result && !('error' in result)) {
                const responseData = result?.data;
                if (responseData) {
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
                    dispatch(setDisableState(false));
                }
            } else {
                dispatch(resetSavingsApiState());
            }
            dispatch(setStorageSavingsLoading(false));
            dispatch(setViewCalculationsLoading(false));
        } catch (error) {
            dispatch(resetSavingsApiState());
        }
    };

    // Trigger API calls when relevant state changes — mirrors MSSQL on-prem pattern
    useEffect(() => {
        if (savingsCalculatorFrom !== SAVINGS_CALC_MODE.ORACLE_ONPREM) {
            return;
        }

        if (!selectedOnPremHostDetails?.resourceId || !selectedOnPremRegion?.data?.regionCode) {
            return;
        }

        const newPayload = createOracleOnPremPayload();
        const comparedPayloadValues =
            isEqual(newPayload, requestedPayload) &&
            selectedOnPremRegion?.data?.regionCode === requestedRegion?.data?.regionCode;

        if (
            !comparedPayloadValues &&
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
            dispatch(setViewCalculationsLoading(true));
            dispatch(setStorageSavingsLoading(true));
            setTimeout(() => {
                getOracleOnPremData();
            }, 1);
        }
    }, [
        savingsCalculatorFrom,
        selectedOnPremHostDetails,
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
