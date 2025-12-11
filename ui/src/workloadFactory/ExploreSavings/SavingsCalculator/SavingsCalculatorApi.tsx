import { useEffect } from 'react';
import { isEqual } from 'lodash';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetMssqlInstanceDataV2Mutation,
    useGetOnPremCalculationsMutation,
    useGetStorageSavingsMutation,
    useGetViewCalculationsMutation,
    useGetBulkStorageSavingsMutation,
    useGetBulkViewCalculationsMutation,
    useLazyGetRegionsWithoutCredQuery
} from '../../../utils/apiService';
import {
    addOnPremRegionsList,
    resetOptimizedStorage,
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
    setShowFirstTimeOptimize,
    setSnapshotLoading,
    setStorageSavingsLoading,
    setStorageSavingsOnPremLoading,
    setStorageSavingsOnPremResponse,
    setStorageSavingsResponse,
    setViewCalculationsApiResponse,
    setViewCalculationsLoading,
    setViewCalculationsResponse,
    setInstanceDataUpdatedTrigger
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { setTriggerBulkDataFetch } from '../../../store/workloadFactory/exploreSavingsBulkSlice';
import store from '../../../store/store';
import { setMssqlInstancesData as setMssqlInstancesDataV2 } from '../../../store/workloadFactory/inventoryV2Slice';
import { formatStorageSavingsRecommendedData, formatViewCalcData, setESInstanceData } from '../ExploreSavingsUtils';
import { GENERAL } from '../../../utils/appConstants';
import {
    EBS_PROTECTED_OPTIONS,
    GIB_IN_BYTE,
    INSTANCE_API_FIELDS,
    MAX_CLONED_COPIES,
    MAX_MONTHLY_CHANGE_RATE,
    NETWORK_PERFORMANCE_OPTIONS,
    SAVINGS_CALC_MODE,
    SNAPSHOT_FREQUENCY
} from '../../../utils/consts';
import { addInstanceIdToGetPerf, addInstanceIdToGetInstance, uniqueHostRow } from '../../InventoryV2/InventoryUtilsV2';
import { checkIfEbsProtected, prepareStorageSavingsData, prepareViewCalcData } from './savingsUtil';

interface ONPREM_PAYLOAD {
    regionCode?: string;
    sqlInstanceData?: Array<{
        sqlInstanceId?: string;
        noOfVcpusInUse?: number;
        memory?: string;
        networkPerformance?: string;
        totalIops?: string;
        totalThroughput?: string;
    }>;
    snapshotInfo?: {
        snapshotFrequency?: string;
        clonedCopiesCount?: number;
        monthlyChangeRatePercentage?: number;
    };
    totalPrimaryHostStorage?: number;
    totalSecondaryHostStorage?: number;
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
        requestedPayload,
        requestedRegion,
        onPremNetworkPerformance,
        onPremStorageAndComputeInfo,
        selectedExCredId,
        selectedExRegionId,
        showOptimizeMode,
        instanceDataUpdatedTrigger
    } = useAppSelector(state => state.exploreSavings);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const { ebsTCOAction, selectedRowsForExploreSavingsEBSBulk, triggerBulkDataFetch } = useAppSelector(
        state => state.exploreSavingsBulk
    );
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const mssqlInstancesData = useAppSelector(state => state.inventoryV2.mssqlInstancesData);

    const [getStorageSavingsApi] = useGetStorageSavingsMutation();
    const [getViewCalculationsApi] = useGetViewCalculationsMutation();
    const [getBulkStorageSavingsApi] = useGetBulkStorageSavingsMutation();
    const [getBulkViewCalculationsApi] = useGetBulkViewCalculationsMutation();
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
        const selectedRow = unManagedHostFormatedList.filter(
            (item: any) =>
                uniqueHostRow(item?.id, item?.credentialId, item?.regionId) ===
                uniqueHostRow(selectedInstanceId, selectedExCredId, selectedExRegionId)
        );
        if (selectedRow && selectedRow?.length > 0) {
            if (
                selectedRow[0]?.serverInstallationMode === GENERAL.AOAG &&
                selectedRow[0]?.clusterNodeDetails &&
                selectedRow[0]?.clusterNodeDetails?.length === 2
            ) {
                const partnerInstanceRow = selectedRow[0]?.clusterNodeDetails?.filter(
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
            dispatch(setSelectedHostDetails(selectedRow[0]));
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

        if (onPremStorageAndComputeInfo) {
            const computeInfo: any = [];
            Object.keys(onPremStorageAndComputeInfo).forEach(key => {
                const value = onPremStorageAndComputeInfo[key];
                computeInfo.push({
                    sqlInstanceId: value?.sqlInstanceId,
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
                payload
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
                credentialId: selectedExCredId,
                regionId: selectedExRegionId,
                instanceId: selectedInstanceId,
                payload,
                type:
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
                        ? 'ebs'
                        : 'fsxw'
            });
            if (result && !result?.error) {
                prepareStorageSavingsData(result?.data, dispatch);
                if (result?.data?.fsxOptimized && !showOptimizeMode?.showCalcMode) {
                    dispatch(setShowFirstTimeOptimize(null));
                }
                dispatch(setStorageSavingsLoading(false));
            } else {
                dispatch(setStorageSavingsLoading(false));
                dispatch(setStorageSavingsResponse(null));
                dispatch(resetOptimizedStorage());
            }
        } catch (error) {
            dispatch(setStorageSavingsResponse(null));
            dispatch(setStorageSavingsLoading(false));
            dispatch(resetOptimizedStorage());
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
                credentialId: selectedExCredId,
                regionId: selectedExRegionId,
                instanceId: selectedInstanceId,
                payload,
                type:
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
                        ? 'ebs'
                        : 'fsxw'
            });
            if (result && !result?.error) {
                prepareViewCalcData(result?.data, dispatch, selectedDeploymentModel, monthlyChangeRate);
                dispatch(setViewCalculationsApiResponse(result?.data));
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

    const getBulkStorageSavingsData = async () => {
        if (ebsTCOAction !== 'bulk' || !selectedRowsForExploreSavingsEBSBulk.length) return;

        // Extract all instance IDs from selected hosts and build hosts array with monthlySqlByolCost
        const hosts: Array<{ ec2InstanceId: string; monthlySqlByolCost: number | null }> = [];
        selectedRowsForExploreSavingsEBSBulk.forEach((host: any) => {
            if (host.ec2Details && host.ec2Details.length > 0) {
                // for aoag picking first node instance id only and standalone will have one
                const ec2InstanceId = host.ec2Details[0].id;
                const byolCost = host.monthlySqlByolCost;
                hosts.push({
                    ec2InstanceId,
                    monthlySqlByolCost: byolCost ? Number(byolCost) : null
                });
            }
        });

        if (hosts.length === 0) {
            return;
        }

        let payload: any = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            clonedCopiesCount: numberOfClonedCopies,
            monthlyChangeRatePercentage: monthlyChangeRate,
            hosts
        };

        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            payload = {
                ...payload,
                cloneRefreshFrequency: selectedCloneRefresh?.value
            };
        }

        try {
            const result: any = await getBulkStorageSavingsApi({
                credentialId: selectedExCredId,
                regionId: selectedExRegionId,
                payload
            });
            if (result && !result?.error) {
                prepareStorageSavingsData(result?.data, dispatch);
                if (result?.data?.fsxOptimized && !showOptimizeMode?.showCalcMode) {
                    dispatch(setShowFirstTimeOptimize(null));
                }
                dispatch(setStorageSavingsLoading(false));
            } else {
                dispatch(setStorageSavingsLoading(false));
                dispatch(setStorageSavingsResponse(null));
                dispatch(resetOptimizedStorage());
            }
        } catch (error) {
            dispatch(setStorageSavingsResponse(null));
            dispatch(setStorageSavingsLoading(false));
            dispatch(resetOptimizedStorage());
        }
    };

    const getBulkViewCalculationsData = async () => {
        if (ebsTCOAction !== 'bulk' || !selectedRowsForExploreSavingsEBSBulk.length) return;

        // Extract all instance IDs from selected hosts and build hosts array with monthlySqlByolCost
        const hosts: Array<{ ec2InstanceId: string; monthlySqlByolCost: number | null }> = [];
        selectedRowsForExploreSavingsEBSBulk.forEach((host: any) => {
            if (host.ec2Details && host.ec2Details.length > 0) {
                // for aoag picking first node instance id only and standalone will have one
                const ec2InstanceId = host.ec2Details[0].id;
                const byolCost = host.monthlySqlByolCost;
                hosts.push({
                    ec2InstanceId,
                    monthlySqlByolCost: byolCost ? Number(byolCost) : null
                });
            }
        });

        if (hosts.length === 0) {
            return;
        }

        let payload: any = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            clonedCopiesCount: numberOfClonedCopies,
            monthlyChangeRatePercentage: monthlyChangeRate,
            hosts
        };

        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            payload = {
                ...payload,
                cloneRefreshFrequency: selectedCloneRefresh?.value
            };
        }

        try {
            const result: any = await getBulkViewCalculationsApi({
                credentialId: selectedExCredId,
                regionId: selectedExRegionId,
                payload
            });
            if (result && !result?.error) {
                prepareViewCalcData(result?.data, dispatch, selectedDeploymentModel, monthlyChangeRate);
                dispatch(setViewCalculationsApiResponse(result?.data));
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
        const hasBasicRequirements =
            selectedSnapshotFrequency &&
            numberOfClonedCopies &&
            numberOfClonedCopies <= MAX_CLONED_COPIES &&
            monthlyChangeRate &&
            Number(monthlyChangeRate) <= MAX_MONTHLY_CHANGE_RATE;
        const hasSingleInstanceRequirements =
            selectedInstanceId &&
            ((savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && selectedCloneRefresh) ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW);
        const hasBulkRequirements =
            ebsTCOAction === 'bulk' &&
            selectedRowsForExploreSavingsEBSBulk.length > 0 &&
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS &&
            selectedCloneRefresh;

        if (hasBasicRequirements && (hasSingleInstanceRequirements || hasBulkRequirements)) {
            dispatch(setStorageSavingsLoading(true));
            dispatch(setViewCalculationsLoading(true));

            // Use bulk APIs if it's bulk mode for AUTO_EBS
            if (
                savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS &&
                ebsTCOAction === 'bulk' &&
                selectedRowsForExploreSavingsEBSBulk.length > 0
            ) {
                getBulkStorageSavingsData();
                getBulkViewCalculationsData();
            } else {
                getStorageSavingsData();
                getViewCalculationsData();
            }
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
            // If selected snapshot frequency has some value than trigger TCO APIs else call instance api to get protection.
            if (selectedHostDetails && Object.keys(selectedHostDetails).length !== 0) {
                // Check if instance API has already been called for this host
                const uniqueHostId = uniqueHostRow(
                    selectedHostDetails?.ec2InstanceId,
                    selectedHostDetails?.credentialId,
                    selectedHostDetails?.regionId
                );
                const hasInstanceApiData = mssqlInstancesData && mssqlInstancesData[uniqueHostId];

                if (hasInstanceApiData || selectedSnapshotFrequency) {
                    // Instance API was already called, check protection data and trigger TCO APIs
                    const isProtectionData = checkIfEbsProtected();
                    if (isProtectionData !== '' || selectedSnapshotFrequency) {
                        dispatch(setDisableState(false));
                        triggerRefreshApi();
                    }
                } else {
                    // Instance API not called yet, call the instance api with all the fields including protection
                    dispatch(setSelectedSnapshotFrequency(SNAPSHOT_FREQUENCY[1]));
                    // Call instance API
                    dispatch(setSnapshotLoading(true));
                    addInstanceIdToGetInstance(selectedHostDetails, dispatch);
                    triggerRefreshApi();
                    dispatch(setSnapshotLoading(false));
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
        monthlyBYOLCost,
        ebsTCOAction
    ]);

    // Separate useEffect for triggerBulkDataFetch
    // This is used in bulk mode to trigger API calls when BYOL values change per host
    useEffect(() => {
        if (triggerBulkDataFetch) {
            // Reset the flag
            dispatch(setTriggerBulkDataFetch(false));

            // Then trigger the API calls
            if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
                if (selectedHostDetails && Object.keys(selectedHostDetails).length !== 0) {
                    // Check if instance API has already been called for this host
                    const uniqueHostId = uniqueHostRow(
                        selectedHostDetails?.ec2InstanceId,
                        selectedHostDetails?.credentialId,
                        selectedHostDetails?.regionId
                    );
                    const hasInstanceApiData = mssqlInstancesData && mssqlInstancesData[uniqueHostId];

                    if (hasInstanceApiData || selectedSnapshotFrequency) {
                        // Instance API was already called, check protection data and trigger TCO APIs
                        const isProtectionData = checkIfEbsProtected();
                        if (isProtectionData !== '' || selectedSnapshotFrequency) {
                            dispatch(setDisableState(false));
                            triggerRefreshApi();
                        }
                    } else {
                        // Instance API not called yet, call the instance api with all the fields including protection
                        dispatch(setSelectedSnapshotFrequency(SNAPSHOT_FREQUENCY[1]));
                        dispatch(setSnapshotLoading(true));
                        addInstanceIdToGetInstance(selectedHostDetails, dispatch);
                        triggerRefreshApi();
                        dispatch(setSnapshotLoading(false));
                    }
                }
            } else if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) {
                dispatch(setSnapshotLoading(false));
                dispatch(setDisableState(false));
                triggerRefreshApi();
            }
        }
    }, [triggerBulkDataFetch]);

    useEffect(() => {
        if (savingsCalculatorRefresh) {
            if (!isDemoMode && selectedPartnerInstanceId) {
                dispatch(setSelectedPartnerHostDetails(null));
                dispatch(setGetPartnerHostDetailsLoading(true));
                // getMssqlDataForPartnerNode();
            }
            dispatch(setSelectedHostDetails(null));
            // getMssqlData();
            triggerRefreshApi();
        }
        dispatch(setSavingsCalculatorRefresh(false));
    }, [savingsCalculatorRefresh]);

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance.
    const getMssqlData = async () => {
        const state = store.getState();
        const mssqlInstancesDataV2 = state.inventoryV2.mssqlInstancesData;
        const mssqlInstancesDataLoad: any = {};
        mssqlInstancesDataLoad[uniqueHostRow(selectedInstanceId, selectedExCredId, selectedExRegionId)] = {
            loading: true,
            data: null,
            error: null
        };
        dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataLoad }));

        try {
            let result: any;
            result = await getMssqlInstanceDataApiV2({
                credentialId: selectedExCredId,
                regionId: selectedExRegionId,
                instances: selectedInstanceId,
                fields: INSTANCE_API_FIELDS.UNMANAGED_DEFAULT.join(','),
                nextToken: ''
            });

            if (result && !result?.error) {
                const mssqlInstancesDataRes: any = {};
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
                const mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[uniqueHostRow(selectedInstanceId, selectedExCredId, selectedExRegionId)] = {
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message,
                    isManagedHost: false
                };
                dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            const mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[uniqueHostRow(selectedInstanceId, selectedExCredId, selectedExRegionId)] = {
                loading: false,
                data: null,
                error,
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
                credentialId: selectedExCredId,
                regionId: selectedExRegionId,
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
    }, [selectedExCredId, selectedExRegionId]);

    useEffect(() => {
        // This is to call OnPrem Savings calculator API when user changes the values in the Savings calculator page
        const newPayload = createOnPremPayload();
        const comparedPayloadValues =
            isEqual(newPayload, requestedPayload) &&
            selectedOnPremRegion?.data?.regionCode === requestedRegion?.data?.regionCode;
        if (
            !comparedPayloadValues &&
            selectedOnPremHostId &&
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM &&
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
                getStorageSavingsOnPremData(newPayload);
            }, 1);
        }
    }, [
        selectedOnPremHostId,
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        monthlyChangeRate,
        onPremStorageAndComputeInfo,
        selectedOnPremRegion,
        onPremNetworkPerformance
    ]);

    // Update selectedHostDetails when instance API data is received
    // This useEffect listens to the trigger flag that gets set when instance API completes
    useEffect(() => {
        if (instanceDataUpdatedTrigger && savingsCalculatorFrom !== SAVINGS_CALC_MODE.ONPREM) {
            // Find the updated row in unManagedHostFormatedList
            const selectedRow = unManagedHostFormatedList.find(
                (item: any) =>
                    uniqueHostRow(item?.id, item?.credentialId, item?.regionId) === instanceDataUpdatedTrigger
            );

            // If we found the row, update selectedHostDetails and reset the trigger
            if (selectedRow) {
                setESInstanceData(selectedRow, dispatch);
                dispatch(setSelectedHostDetails(selectedRow));
                // Reset the trigger after successful update
                dispatch(setInstanceDataUpdatedTrigger(null));
            }
        }
    }, [instanceDataUpdatedTrigger, unManagedHostFormatedList]);

    return <></>;
};

export default SavingsCalculatorApi;
