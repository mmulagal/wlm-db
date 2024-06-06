import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetMssqlInstanceDataMutation,
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
import storageSavingsJson from '../storageSavings.json';
import viewCalculationJson from '../viewCalculations.json';
import store from '../../../store/store';
import { setMssqlInstancesData } from '../../../store/workloadFactory/inventorySlice';
import { formatViewCalcData, setESInstanceData } from '../ExploreSavingsUtils';
import { SQL_DEPLOYMENT_MODE } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';

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

    const [getStorageSavingsApi] = useGetStorageSavingsMutation();
    const [getViewCalculationsApi] = useGetViewCalculationsMutation();
    const [getMssqlInstanceDataApi] = useGetMssqlInstanceDataMutation();

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
                    if (!isDemoMode) {
                        dispatch(setGetPartnerHostDetailsLoading(true));
                    }
                }
            }
            setESInstanceData(selectedRow[0], isDemoMode, selectedDeploymentModel, dispatch);
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

        // else {
        //     // Demo mode code will be removed once actual demo API starts returning data
        //     if (selectedDeploymentModel?.toLowerCase() === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
        //         dispatch(setStorageSavingsResponse(storageSavingsJson['standalone']));
        //         dispatch(setViewCalculationsResponse(viewCalculationJson['standalone']));
        //     } else {
        //         dispatch(setStorageSavingsResponse(storageSavingsJson['aoag']));
        //         dispatch(setViewCalculationsResponse(viewCalculationJson['aoag']));
        //     }
        // }
    };

    useEffect(() => {
        triggerRefreshApi();
    }, [selectedSnapshotFrequency, numberOfClonedCopies, selectedCloneRefresh, monthlyChangeRate, selectedInstanceId]);

    useEffect(() => {
        if (savingsCalculatorRefresh) {
            if (!isDemoMode && selectedPartnerInstanceId) {
                getMssqlDataForPartnerNode();
            }
            getMssqlData();
            triggerRefreshApi();
        }
        dispatch(setSavingsCalculatorRefresh(false));
    }, [savingsCalculatorRefresh]);

    // This function is to call API2 that will return unmanaged per instance full data like SS, cost, proection, performance.
    const getMssqlData = async () => {
        const state = store.getState();
        const mssqlInstancesData = state.inventory.mssqlInstancesData;
        let mssqlInstancesDataLoad: any = {};
        mssqlInstancesDataLoad[selectedInstanceId] = {
            loading: true,
            data: null,
            error: null
        };
        dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataLoad }));
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instances: selectedInstanceId,
                nextToken: ''
            });

            if (result && !result?.error) {
                let mssqlInstancesDataRes: any = {};
                result?.data?.items?.map((host: any) => {
                    if (mssqlInstancesData[host?.id]) {
                        mssqlInstancesDataRes[host?.id] = {
                            loading: false,
                            data: host,
                            error: host?.errors
                        };
                    }
                });
                dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataRes }));
            } else {
                let mssqlInstancesDataErr: any = {};
                mssqlInstancesDataErr[selectedInstanceId] = {
                    loading: false,
                    data: null,
                    error: result?.error?.data?.message
                };
                dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataErr }));
            }
        } catch (error) {
            let mssqlInstancesDataErr: any = {};
            mssqlInstancesDataErr[selectedInstanceId] = {
                loading: false,
                data: null,
                error: error
            };
            dispatch(setMssqlInstancesData({ ...mssqlInstancesData, ...mssqlInstancesDataErr }));
        }
    };

    // This function is to call API2 for partner node
    const getMssqlDataForPartnerNode = async () => {
        dispatch(setGetPartnerHostDetailsLoading(true));
        try {
            const result: any = await getMssqlInstanceDataApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instances: selectedPartnerInstanceId,
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
        if (!isDemoMode) {
            if (selectedPartnerInstanceId && headerSelectedCred?.data?.credentialsId && headerSelectedRegion?.label2) {
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
