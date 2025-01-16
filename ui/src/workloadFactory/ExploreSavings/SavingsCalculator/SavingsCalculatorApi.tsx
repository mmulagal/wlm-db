import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetMssqlInstanceDataMutation,
    useGetMssqlInstanceDataV2Mutation,
    useGetOnPremCalculationsMutation,
    useGetStorageSavingsMutation,
    useGetViewCalculationsMutation,
    useLazyGetRegionsWithoutCredQuery
} from '../../../utils/apiService';
import {
    addManualRegionsList,
    addOnPremRegionsList,
    setDisableState,
    setGetPartnerHostDetailsLoading,
    setManualRegionsLoading,
    setOnPremFirstLoad,
    setOnPremRegionsLoading,
    setRequestedPayload,
    setRequestedRegion,
    setSavingsCalculatorRefresh,
    setSelectedHostDetails,
    setSelectedOnPremHostDetails,
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
    INSTANCE_API_FIELDS,
    SAVINGS_CALC_MODE,
    SNAPSHOT_FREQUENCY
} from '../../../utils/consts';
import { addInstanceIdToGetPerf } from '../../InventoryV2/InventoryUtilsV2';
import { checkIfEbsProtected } from './savingsUtil';
import { isEqual } from 'lodash';

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
        onPremFirstLoad,
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
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataMutation();
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
        let payload: any = {
            snapshotInfo: {
                snapshotFrequency: selectedSnapshotFrequency?.value || 'daily',
                clonedCopiesCount: numberOfClonedCopies || 1,
                monthlyChangeRatePercentage: monthlyChangeRate || 3
            }
        };

        if (!onPremFirstLoad) {
            payload = {
                ...payload,
                regionCode: selectedOnPremRegion?.data?.regionCode
            };
            let computeInfo: any = [];
            Object.keys(computeInformation).forEach(key => {
                const value = computeInformation[key];
                let perInst = selectedOnPremHostDetails?.sqlInstances?.find((inst: any) => inst?.sqlInstanceId === key);
                computeInfo.push({
                    sqlInstanceId: perInst?.sqlInstanceId,
                    sqlInstanceName: key,
                    noOfDatabases: perInst?.noOfDatabases,
                    sqlEdition: perInst?.sqlEdition,
                    noOfVcpusInUse: value?.noOfVcpusInUse,
                    memory: value?.memory,
                    networkPerformance: value?.networkPerformance
                });
            });

            payload = {
                ...payload,
                sqlInstances: computeInfo
            };

            let storagePerf: any = [];
            storagePerf.push({
                nodeType: 'primary',
                dataIops: storagePerformance?.primaryData?.iops,
                logIops: storagePerformance?.primaryLog?.iops,
                dataTotalStorage: storagePerformance?.primaryData?.totalStorageAmount,
                logTotalStorage: storagePerformance?.primaryLog?.totalStorageAmount,
                dataThroughput: storagePerformance?.primaryData?.throughput,
                logThroughput: storagePerformance?.primaryLog?.throughput
            });
            storagePerf.push({
                nodeType: 'secondary',
                dataIops: storagePerformance?.secondaryData?.iops,
                logIops: storagePerformance?.secondaryLog?.iops,
                dataTotalStorage: storagePerformance?.secondaryData?.totalStorageAmount,
                logTotalStorage: storagePerformance?.secondaryLog?.totalStorageAmount,
                dataThroughput: storagePerformance?.secondaryData?.throughput,
                logThroughput: storagePerformance?.secondaryLog?.throughput
            });

            payload = {
                ...payload,
                nodeUsage: storagePerf
            };
        }
        return payload;
    };

    const getStorageSavingsOnPremData = async (payload: any) => {
        try {
            // let payload = createOnPremPayload();
            dispatch(setDisableState(false));
            const result: any = await getStorageSavingsOnPremDataApi({
                databaseHostId: selectedOnPremHostId,
                payload: payload
            });
            if (result && !result?.error) {
                dispatch(setStorageSavingsOnPremResponse(result?.data));
                if (onPremFirstLoad) {
                    dispatch(
                        setSelectedOnPremHostDetails({
                            ...selectedOnPremHostDetails,
                            nodeUsage: result?.data?.nodeUsage,
                            sqlInstances: result?.data?.sqlInstances
                        })
                    );
                }
                dispatch(setStorageSavingsResponse(formatStorageSavingsRecommendedData(result?.data?.storageSavings)));
                dispatch(setViewCalculationsApiResponse(result?.data?.calculations));
                dispatch(
                    setViewCalculationsResponse(
                        formatViewCalcData(result?.data?.calculations, selectedDeploymentModel, monthlyChangeRate)
                    )
                );
                dispatch(setStorageSavingsOnPremLoading(false));
                dispatch(setOnPremFirstLoad(false));
                dispatch(setStorageSavingsLoading(false));
                dispatch(setViewCalculationsLoading(false));
            } else {
                dispatch(setStorageSavingsOnPremLoading(false));
                dispatch(setStorageSavingsOnPremResponse(null));
                dispatch(setOnPremFirstLoad(false));
                dispatch(setStorageSavingsLoading(false));
                dispatch(setViewCalculationsLoading(false));
            }
        } catch (error) {
            dispatch(setStorageSavingsOnPremResponse(null));
            dispatch(setStorageSavingsOnPremLoading(false));
            dispatch(setOnPremFirstLoad(false));
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
        let newPayload = createOnPremPayload();
        const comparedPayloadValues =
            isEqual(newPayload, requestedPayload) &&
            selectedOnPremRegion?.data?.regionCode === requestedRegion?.data?.regionCode;
        if (!comparedPayloadValues && selectedOnPremHostId && savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM) {
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
    }, [selectedOnPremHostId]);

    useEffect(() => {
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
            selectedOnPremRegion &&
            !onPremFirstLoad
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
