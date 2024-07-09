import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetMssqlInstanceDataMutation,
    useGetMssqlInstanceDataV2Mutation,
    useGetStorageSavingsMutation,
    useGetViewCalculationsMutation
} from '../../../utils/apiService';
import {
    setGetPartnerHostDetailsLoading,
    setSavingsCalculatorRefresh,
    setSelectedHostDetails,
    setSelectedPartnerHostDetails,
    setSelectedPartnerInstanceId,
    setStorageSavingsLoading,
    setStorageSavingsResponse,
    setViewCalculationsLoading,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import store from '../../../store/store';
import { setMssqlInstancesData as setMssqlInstancesDataV1 } from '../../../store/workloadFactory/inventorySlice';
import { setMssqlInstancesData as setMssqlInstancesDataV2 } from '../../../store/workloadFactory/inventoryV2Slice';
import { formatViewCalcData, setESInstanceData } from '../ExploreSavingsUtils';
import { GENERAL } from '../../../utils/appConstants';
import { INSTANCE_API_FIELDS } from '../../../utils/consts';

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
        selectedPartnerInstanceId
    } = useAppSelector(state => state.exploreSavings);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const isInventoryV2 = useAppSelector(state => state.auth.isInventoryV2);

    const [getStorageSavingsApi] = useGetStorageSavingsMutation();
    const [getViewCalculationsApi] = useGetViewCalculationsMutation();
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataMutation();
    const [getMssqlInstanceDataApiV2] = useGetMssqlInstanceDataV2Mutation();

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
                    if (!isDemoMode && !isInventoryV2) {
                        dispatch(setGetPartnerHostDetailsLoading(true));
                    }
                }
            }
            setESInstanceData(selectedRow[0], dispatch);
            // dispatch(setSelectedHostDetails(selectedRow[0]));
        } else {
            dispatch(setSelectedHostDetails({}));
        }
    }, [unManagedHostFormatedList, selectedInstanceId]);

    const getStorageSavingsData = async () => {
        const payload = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            clonedCopiesCount: numberOfClonedCopies,
            cloneRefreshFrequency: selectedCloneRefresh?.value,
            monthlyChangeRatePercentage: monthlyChangeRate
        };
        try {
            const result: any = await getStorageSavingsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instanceId: selectedInstanceId,
                payload: payload
            });
            if (result && !result?.error) {
                dispatch(setStorageSavingsResponse(result?.data));
                dispatch(setStorageSavingsLoading(false));
            } else {
                dispatch(setStorageSavingsLoading(false));
            }
        } catch (error) {
            dispatch(setStorageSavingsResponse({}));
            dispatch(setStorageSavingsLoading(false));
        }
    };

    const getViewCalculationsData = async () => {
        const payload = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            clonedCopiesCount: numberOfClonedCopies,
            cloneRefreshFrequency: selectedCloneRefresh?.value,
            monthlyChangeRatePercentage: monthlyChangeRate
        };
        try {
            const result: any = await getViewCalculationsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instanceId: selectedInstanceId,
                payload: payload
            });
            if (result && !result?.error) {
                dispatch(setViewCalculationsResponse(formatViewCalcData(result?.data, selectedDeploymentModel)));
                dispatch(setViewCalculationsLoading(false));
            } else {
                dispatch(setViewCalculationsLoading(false));
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
            selectedCloneRefresh &&
            monthlyChangeRate &&
            selectedInstanceId
        ) {
            dispatch(setStorageSavingsLoading(true));
            dispatch(setViewCalculationsLoading(true));
            getStorageSavingsData();
            getViewCalculationsData();
        }
    };

    useEffect(() => {
        triggerRefreshApi();
    }, [selectedSnapshotFrequency, numberOfClonedCopies, selectedCloneRefresh, monthlyChangeRate, selectedInstanceId]);

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
        const mssqlInstancesDataV1 = state.inventory.mssqlInstancesData;
        const mssqlInstancesDataV2 = state.inventoryV2.mssqlInstancesData;
        let mssqlInstancesDataLoad: any = {};
        mssqlInstancesDataLoad[selectedInstanceId] = {
            loading: true,
            data: null,
            error: null
        };
        if (isInventoryV2) {
            dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataLoad }));
        } else {
            dispatch(setMssqlInstancesDataV1({ ...mssqlInstancesDataV1, ...mssqlInstancesDataLoad }));
        }

        try {
            let result: any;
            if (isInventoryV2) {
                result = await getMssqlInstanceDataApiV2({
                    credentialId: headerSelectedCred?.data?.credentialsId,
                    regionId: headerSelectedRegion?.label2,
                    instances: selectedInstanceId,
                    fields: INSTANCE_API_FIELDS.UNMANAGED_DEFAULT.join(','),
                    nextToken: ''
                });
            } else {
                result = await getMssqlInstanceDataApi({
                    credentialId: headerSelectedCred?.data?.credentialsId,
                    regionId: headerSelectedRegion?.label2,
                    instances: selectedInstanceId,
                    nextToken: ''
                });
            }

            if (result && !result?.error) {
                let mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (isInventoryV2) {
                        if (mssqlInstancesDataV2[host?.id]) {
                            mssqlInstancesDataRes[host?.id] = {
                                loading: false,
                                data: host,
                                error: host?.errors,
                                isManagedHost: false
                            };
                        }
                    } else {
                        if (mssqlInstancesDataV1[host?.id]) {
                            mssqlInstancesDataRes[host?.id] = {
                                loading: false,
                                data: host,
                                error: host?.errors,
                                isManagedHost: false
                            };
                        }
                    }
                });
                if (isInventoryV2) {
                    dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataRes }));
                } else {
                    dispatch(setMssqlInstancesDataV1({ ...mssqlInstancesDataV1, ...mssqlInstancesDataRes }));
                }
            } else {
                let mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[selectedInstanceId] = {
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message,
                    isManagedHost: false
                };
                if (isInventoryV2) {
                    dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataErr }));
                } else {
                    dispatch(setMssqlInstancesDataV1({ ...mssqlInstancesDataV1, ...mssqlInstancesDataErr }));
                }
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[selectedInstanceId] = {
                loading: false,
                data: null,
                error: error,
                isManagedHost: false
            };
            if (isInventoryV2) {
                dispatch(setMssqlInstancesDataV2({ ...mssqlInstancesDataV2, ...mssqlInstancesDataErr }));
            } else {
                dispatch(setMssqlInstancesDataV1({ ...mssqlInstancesDataV1, ...mssqlInstancesDataErr }));
            }
        }
    };

    // This function is to call API2 for partner node
    const getMssqlDataForPartnerNode = async () => {
        dispatch(setGetPartnerHostDetailsLoading(true));
        try {
            let result: any;
            if (isInventoryV2) {
                result = await getMssqlInstanceDataApiV2({
                    credentialId: headerSelectedCred?.data?.credentialsId,
                    regionId: headerSelectedRegion?.label2,
                    instances: selectedPartnerInstanceId,
                    fields: INSTANCE_API_FIELDS.UNMANAGED_DEFAULT.join(','),
                    nextToken: ''
                });
            } else {
                result = await getMssqlInstanceDataApi({
                    credentialId: headerSelectedCred?.data?.credentialsId,
                    regionId: headerSelectedRegion?.label2,
                    instances: selectedPartnerInstanceId,
                    nextToken: ''
                });
            }

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
        if (!isDemoMode) {
            if (
                selectedPartnerInstanceId &&
                !isInventoryV2 &&
                headerSelectedCred?.data?.credentialsId &&
                headerSelectedRegion?.label2
            ) {
                getMssqlDataForPartnerNode();
            }
        }
    }, [selectedPartnerInstanceId]);

    useEffect(() => {
        dispatch(setStorageSavingsResponse({}));
        dispatch(setStorageSavingsLoading(false));
    }, [headerSelectedCred, headerSelectedRegion]);

    return <></>;
};

export default SavingsCalculatorApi;
