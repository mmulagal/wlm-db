import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetMssqlInstanceDataV2Mutation,
    useGetOnPremCalculationsMutation,
    useGetStorageSavingsMutation,
    useGetViewCalculationsMutation,
    useLazyGetRegionsWithoutCredQuery
} from '../../../utils/apiService';
import {
    addOnPremRegionsList,
    setDisableState,
    setGetPartnerHostDetailsLoading,
    setOnPremRegionsLoading,
    setRequestedPayload,
    setRequestedRegion,
    setSavingsCalculatorRefresh,
    setSelectedHostDetails,
    setSelectedPartnerHostDetails,
    setSelectedPartnerInstanceId,
    setSelectedSnapshotFrequency,
    setSnapshotLoading,
    setStorageSavingsLoading,
    setStorageSavingsOnPremLoading,
    setStorageSavingsOnPremResponse,
    setStorageSavingsResponse,
    setViewCalculationsApiResponse,
    setViewCalculationsLoading,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import store from '../../../store/store';
import { setMssqlInstancesData as setMssqlInstancesDataV2 } from '../../../store/workloadFactory/inventoryV2Slice';
import { formatStorageSavingsRecommendedData, formatViewCalcData, setESInstanceData } from '../ExploreSavingsUtils';
import { GENERAL } from '../../../utils/appConstants';
import {
    EBS_PROTECTED_OPTIONS,
    GIB_IN_BYTE,
    INSTANCE_API_FIELDS,
    NETWORK_PERFORMANCE_OPTIONS,
    SAVINGS_CALC_MODE,
    SNAPSHOT_FREQUENCY
} from '../../../utils/consts';
import { addInstanceIdToGetPerf } from '../../InventoryV2/InventoryUtilsV2';
import { checkIfEbsProtected } from './savingsUtil';
import { isEqual } from 'lodash';

interface NODE_USAGE_INTERFACE {
    storage: number;
    iops: number;
    throughput: number;
}

interface ONPREM_PAYLOAD {
    regionCode?: string;
    sqlInstanceData?: Array<{
        sqlInstanceId?: string;
        noOfVcpusInUse?: number;
        memory?: string;
        networkPerformance?: string;
        iops?: string;
        throughput?: string;
    }>;
    snapshotInfo?: {
        snapshotFrequency?: string;
        clonedCopiesCount?: number;
        monthlyChangeRatePercentage?: number;
    };
}

const SavingsCalculatorApi = () => {
    const dispatch = useAppDispatch();
    const {
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        selectedCloneRefresh,
        monthlyChangeRate,
        selectedInstanceId,
        savingsCalculatorRefresh,
        selectedDeploymentModel,
        selectedPartnerInstanceId,
        monthlyBYOLCost,
        savingsCalculatorFrom,
        selectedHostDetails,
        selectedOnPremHostId,
        selectedOnPremRegion,
        selectedOnPremHostDetails,
        computeInformation,
        storagePerformance,
        requestedPayload,
        requestedRegion
    } = useAppSelector(state => state.exploreSavings);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const [getStorageSavingsApi] = useGetStorageSavingsMutation();
    const [getViewCalculationsApi] = useGetViewCalculationsMutation();
    const [getMssqlInstanceDataApiV2] = useGetMssqlInstanceDataV2Mutation();
    const [getStorageSavingsOnPremDataApi] = useGetOnPremCalculationsMutation();

    const [getRegionsWithoutCred] = useLazyGetRegionsWithoutCredQuery();

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
            dispatch(setOnPremRegionsLoading(true));
            getRegionsWithoutCred({})
                .then((res: any) => {
                    dispatch(addOnPremRegionsList(res?.data));
                    dispatch(setOnPremRegionsLoading(false));
                })
                .catch((error: any) => {
                    dispatch(setOnPremRegionsLoading(false));
                });
        }
    }, [savingsCalculatorFrom]);

    useEffect(() => {
        const selectedRow = unManagedHostFormatedList.filter((item: any) => item?.id === selectedInstanceId);
        if (selectedRow && selectedRow?.length > 0) {
            if (
                selectedRow[0]?.serverInstallationMode === GENERAL.AOAG &&
                selectedRow[0]?.clusterNodeDetails &&
                selectedRow[0]?.clusterNodeDetails?.length === 2
            ) {
                let partnerInstanceRow = selectedRow[0]?.clusterNodeDetails?.filter(
                    (perRow: any) => perRow?.ec2InstanceId !== selectedInstanceId
                );
                if (
                    partnerInstanceRow?.[0]?.ec2InstanceId &&
                    partnerInstanceRow[0].ec2InstanceId !== selectedPartnerInstanceId
                ) {
                    dispatch(setSelectedPartnerInstanceId(partnerInstanceRow[0].ec2InstanceId));
                }
            }
            setESInstanceData(selectedRow[0], dispatch);
            // dispatch(setSelectedHostDetails(selectedRow[0]));
        } else {
            dispatch(setSelectedHostDetails({}));
        }
    }, [unManagedHostFormatedList, selectedInstanceId]);

    const createOnPremPayload = () => {
        // To create payload for OnPrem Savings calculator API call
        let payload: ONPREM_PAYLOAD = {
            snapshotInfo: {
                snapshotFrequency: selectedSnapshotFrequency?.value || 'daily',
                clonedCopiesCount: numberOfClonedCopies || 1,
                monthlyChangeRatePercentage: monthlyChangeRate || 3
            }
        };

        if (selectedOnPremRegion?.data?.regionCode) {
            payload = {
                ...payload,
                regionCode: selectedOnPremRegion?.data?.regionCode
            };
        }

        let primaryData: NODE_USAGE_INTERFACE = {
            storage: storagePerformance?.primaryData?.totalStorageAmount
                ? Number(storagePerformance?.primaryData?.totalStorageAmount) * GIB_IN_BYTE
                : 0,
            iops: storagePerformance?.primaryData?.iops,
            throughput: storagePerformance?.primaryData?.throughput
        };
        let secondaryData: NODE_USAGE_INTERFACE = {
            storage: storagePerformance?.secondaryData?.totalStorageAmount
                ? Number(storagePerformance?.secondaryData?.totalStorageAmount) * GIB_IN_BYTE
                : 0,
            iops: storagePerformance?.secondaryData?.iops,
            throughput: storagePerformance?.secondaryData?.throughput
        };

        if (storagePerformance) {
            let primaryNodes = 0;
            let secondaryNodes = 0;
            if (selectedOnPremHostDetails?.deploymentModel === GENERAL.AOAG) {
                primaryNodes = selectedOnPremHostDetails?.sqlServerInstances?.filter(
                    (instance: any) => !instance?.isReadReplica
                ).length;
                secondaryNodes = selectedOnPremHostDetails?.sqlServerInstances?.filter(
                    (instance: any) => instance?.isReadReplica
                ).length;
            } else {
                primaryNodes = selectedOnPremHostDetails?.sqlServerInstances?.length;
            }

            primaryData = {
                ...primaryData,
                storage: primaryData?.storage / primaryNodes,
                iops: primaryData?.iops / primaryNodes,
                throughput: primaryData?.throughput / primaryNodes
            };

            if (selectedOnPremHostDetails?.deploymentModel === GENERAL.AOAG) {
                secondaryData = {
                    ...secondaryData,
                    storage: secondaryData?.storage / secondaryNodes,
                    iops: secondaryData?.iops / secondaryNodes,
                    throughput: secondaryData?.throughput / secondaryNodes
                };
            }
        }

        if (computeInformation) {
            let computeInfo: any = [];
            Object.keys(computeInformation).forEach(key => {
                const value = computeInformation[key];
                let perInst = selectedOnPremHostDetails?.sqlServerInstances?.find(
                    (inst: any) => inst?.sqlInstanceName === key
                );
                let perInstanceNodeUsage: any = {};
                if (selectedOnPremHostDetails?.deploymentModel === GENERAL.AOAG && perInst?.isReadReplica) {
                    perInstanceNodeUsage = secondaryData;
                } else {
                    perInstanceNodeUsage = primaryData;
                }
                if (perInst) {
                    computeInfo.push({
                        sqlInstanceId: perInst?.sqlInstanceId,
                        noOfVcpusInUse: value?.noOfVcpusInUse,
                        memory: value?.memory ? Number(value?.memory) * GIB_IN_BYTE : 0,
                        networkPerformance:
                            NETWORK_PERFORMANCE_OPTIONS?.[value?.networkPerformance?.value || ''] || 'upTo10',
                        iops: perInstanceNodeUsage?.iops,
                        throughput: perInstanceNodeUsage?.throughput,
                        totalStorage: perInstanceNodeUsage?.storage
                    });
                }
            });
            if (computeInfo) {
                payload = {
                    ...payload,
                    sqlInstanceData: computeInfo
                };
            }
        }

        return payload;
    };

    const getStorageSavingsOnPremData = async (payload: any) => {
        try {
            // On Prem savings calculator API call
            dispatch(setDisableState(false));
            const result: any = await getStorageSavingsOnPremDataApi({
                databaseHostId: selectedOnPremHostId,
                payload: payload
            });
            if (result && !result?.error) {
                // Store full API response
                dispatch(setStorageSavingsOnPremResponse(result?.data));

                // Based on the response, format the savings calculator page data and store it in the store
                dispatch(setStorageSavingsResponse(formatStorageSavingsRecommendedData(result?.data?.storageSavings)));

                // Based on the response, format the view calculations page data and store it in the store
                dispatch(setViewCalculationsApiResponse(result?.data?.calculations));
                dispatch(
                    setViewCalculationsResponse(
                        formatViewCalcData(result?.data?.calculations, selectedDeploymentModel, monthlyChangeRate)
                    )
                );
                // Set loading to false
                dispatch(setDisableState(false));
                dispatch(setStorageSavingsOnPremLoading(false));
                dispatch(setStorageSavingsLoading(false));
                dispatch(setViewCalculationsLoading(false));
            } else {
                dispatch(setDisableState(true));
                dispatch(setStorageSavingsOnPremLoading(false));
                dispatch(setStorageSavingsOnPremResponse(null));
                dispatch(setStorageSavingsLoading(false));
                dispatch(setViewCalculationsLoading(false));
            }
        } catch (error) {
            dispatch(setDisableState(true));
            dispatch(setStorageSavingsOnPremResponse(null));
            dispatch(setStorageSavingsOnPremLoading(false));
            dispatch(setStorageSavingsLoading(false));
            dispatch(setViewCalculationsLoading(false));
        }
    };

    const getStorageSavingsData = async () => {
        let payload: any = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            clonedCopiesCount: numberOfClonedCopies,
            monthlyChangeRatePercentage: monthlyChangeRate
        };
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            payload = {
                ...payload,
                cloneRefreshFrequency: selectedCloneRefresh?.value
            };
        }
        if (monthlyBYOLCost) {
            payload = {
                ...payload,
                monthlySqlByolCost: Number(monthlyBYOLCost)
            };
        }
        try {
            const result: any = await getStorageSavingsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instanceId: selectedInstanceId,
                payload: payload,
                type:
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
                        ? 'ebs'
                        : 'fsxw'
            });
            if (result && !result?.error) {
                dispatch(setStorageSavingsResponse(formatStorageSavingsRecommendedData(result?.data)));
                dispatch(setStorageSavingsLoading(false));
            } else {
                dispatch(setStorageSavingsLoading(false));
                dispatch(setStorageSavingsResponse(null));
            }
        } catch (error) {
            dispatch(setStorageSavingsResponse(null));
            dispatch(setStorageSavingsLoading(false));
        }
    };

    const getViewCalculationsData = async () => {
        let payload: any = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            clonedCopiesCount: numberOfClonedCopies,
            monthlyChangeRatePercentage: monthlyChangeRate
        };
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            payload = {
                ...payload,
                cloneRefreshFrequency: selectedCloneRefresh?.value
            };
        }
        if (monthlyBYOLCost) {
            payload = {
                ...payload,
                monthlySqlByolCost: Number(monthlyBYOLCost)
            };
        }
        try {
            const result: any = await getViewCalculationsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instanceId: selectedInstanceId,
                payload: payload,
                type:
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
                        ? 'ebs'
                        : 'fsxw'
            });
            if (result && !result?.error) {
                dispatch(setViewCalculationsApiResponse(result?.data));
                dispatch(
                    setViewCalculationsResponse(
                        formatViewCalcData(result?.data, selectedDeploymentModel, monthlyChangeRate)
                    )
                );
                dispatch(setViewCalculationsLoading(false));
            } else {
                dispatch(setViewCalculationsLoading(false));
                dispatch(setViewCalculationsResponse(null));
            }
        } catch (error) {
            dispatch(setViewCalculationsResponse(null));
            dispatch(setViewCalculationsLoading(false));
        }
    };

    const triggerRefreshApi = () => {
        if (
            selectedSnapshotFrequency &&
            numberOfClonedCopies &&
            monthlyChangeRate &&
            selectedInstanceId &&
            ((savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && selectedCloneRefresh) ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW)
        ) {
            dispatch(setStorageSavingsLoading(true));
            dispatch(setViewCalculationsLoading(true));
            getStorageSavingsData();
            getViewCalculationsData();
        }
    };

    useEffect(() => {
        // If the selected instance is EBS protected, set the snapshot frequency to daily. It is only for EBS Automatic mode.
        if (
            selectedHostDetails &&
            Object.keys(selectedHostDetails).length !== 0 &&
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
        ) {
            const isProtectionData: any = checkIfEbsProtected();
            if (isProtectionData === EBS_PROTECTED_OPTIONS.PROTECTED) {
                dispatch(setSnapshotLoading(false));
                dispatch(setSelectedSnapshotFrequency(SNAPSHOT_FREQUENCY[2]));
            } else if (isProtectionData === EBS_PROTECTED_OPTIONS.UNPROTECTED) {
                dispatch(setSnapshotLoading(false));
                dispatch(setSelectedSnapshotFrequency(SNAPSHOT_FREQUENCY[0]));
            } else if (isProtectionData === EBS_PROTECTED_OPTIONS.UNKNOWN) {
                dispatch(setSnapshotLoading(false));
                dispatch(setSelectedSnapshotFrequency(SNAPSHOT_FREQUENCY[1]));
            }
        }
    }, [selectedHostDetails]);

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            // If selected snapshot frequency has some value than trigger TCO APIs else call instance api ti get protection.
            if (selectedHostDetails && Object.keys(selectedHostDetails).length !== 0) {
                const isProtectionData = checkIfEbsProtected();
                if (isProtectionData !== '' || selectedSnapshotFrequency) {
                    dispatch(setDisableState(false));
                    triggerRefreshApi();
                } else {
                    dispatch(setSnapshotLoading(true));
                    // This is similar to expand row in inventory. It will call instance API to get protection data.
                    addInstanceIdToGetPerf(selectedHostDetails, dispatch);
                }
            }
        } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) {
            dispatch(setSnapshotLoading(false));
            dispatch(setDisableState(false));
            triggerRefreshApi();
        }
    }, [
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        selectedCloneRefresh,
        monthlyChangeRate,
        selectedInstanceId,
        monthlyBYOLCost
    ]);

    useEffect(() => {
        if (savingsCalculatorRefresh) {
            if (!isDemoMode && selectedPartnerInstanceId) {
                dispatch(setSelectedPartnerHostDetails(null));
                dispatch(setGetPartnerHostDetailsLoading(true));
                getMssqlDataForPartnerNode();
            }
            dispatch(setSelectedHostDetails(null));
            getMssqlData();
            triggerRefreshApi();
        }
        dispatch(setSavingsCalculatorRefresh(false));
    }, [savingsCalculatorRefresh]);

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance.
    const getMssqlData = async () => {
        const state = store.getState();
        const mssqlInstancesDataV2 = state.inventoryV2.mssqlInstancesData;
        let mssqlInstancesDataLoad: any = {};
        mssqlInstancesDataLoad[selectedInstanceId] = {
            loading: true,
            data: null,
            error: null
        };
        dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataLoad }));

        try {
            let result: any;
            result = await getMssqlInstanceDataApiV2({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instances: selectedInstanceId,
                fields: INSTANCE_API_FIELDS.UNMANAGED_DEFAULT.join(','),
                nextToken: ''
            });

            if (result && !result?.error) {
                let mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (mssqlInstancesDataV2[host?.id]) {
                        mssqlInstancesDataRes[host?.id] = {
                            loading: false,
                            data: host,
                            error: host?.errors,
                            isManagedHost: false
                        };
                    }
                });
                dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataRes }));
            } else {
                let mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[selectedInstanceId] = {
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message,
                    isManagedHost: false
                };
                dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[selectedInstanceId] = {
                loading: false,
                data: null,
                error: error,
                isManagedHost: false
            };
            dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataErr }));
        }
    };

    // This function is to call API2 for partner node
    const getMssqlDataForPartnerNode = async () => {
        dispatch(setGetPartnerHostDetailsLoading(true));
        try {
            let result: any;
            result = await getMssqlInstanceDataApiV2({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instances: selectedPartnerInstanceId,
                fields: INSTANCE_API_FIELDS.UNMANAGED_DEFAULT.join(','),
                nextToken: ''
            });

            if (result && !result?.error) {
                dispatch(setSelectedPartnerHostDetails(result?.data?.items?.[0]));
                dispatch(setGetPartnerHostDetailsLoading(false));
            } else {
                dispatch(setSelectedPartnerHostDetails(null));
                dispatch(setGetPartnerHostDetailsLoading(false));
            }
        } catch (error) {
            dispatch(setSelectedPartnerHostDetails(null));
            dispatch(setGetPartnerHostDetailsLoading(false));
        }
    };

    useEffect(() => {
        dispatch(setStorageSavingsResponse({}));
        dispatch(setStorageSavingsLoading(false));
    }, [headerSelectedCred, headerSelectedRegion]);

    useEffect(() => {
        // This is to call OnPrem Savings calculator API when user changes the values in the Savings calculator page
        let newPayload = createOnPremPayload();
        const comparedPayloadValues =
            isEqual(newPayload, requestedPayload) &&
            selectedOnPremRegion?.data?.regionCode === requestedRegion?.data?.regionCode;
        if (
            !comparedPayloadValues &&
            selectedOnPremHostId &&
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM &&
            selectedSnapshotFrequency &&
            numberOfClonedCopies &&
            monthlyChangeRate &&
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
                getStorageSavingsOnPremData(newPayload);
            }, 1);
        }
    }, [
        selectedOnPremHostId,
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        monthlyChangeRate,
        computeInformation,
        storagePerformance,
        selectedOnPremRegion
    ]);

    return <></>;
};

export default SavingsCalculatorApi;
