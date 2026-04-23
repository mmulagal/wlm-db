import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import {
    useGetOracleBulkStorageSavingsMutation,
    useGetOracleBulkViewCalculationsMutation,
    useGetOracleInstanceDataMutation
} from '../../../../utils/apiService';
import {
    resetOptimizedStorage,
    setDisableState,
    setSelectedHostDetails,
    setShowFirstTimeOptimize,
    setStorageSavingsLoading,
    setStorageSavingsResponse,
    setViewCalculationsApiResponse,
    setViewCalculationsLoading,
    setViewCalculationsResponse
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import {
    setTriggerBulkDataFetch,
    setSelectedRowsForExploreSavingsOracleEbsBulk
} from '../../../../store/workloadFactory/exploreSavingsBulkSlice';
import {
    SAVINGS_CALC_MODE,
    INSTANCE_API_FIELDS,
    MAX_CLONED_COPIES,
    MAX_MONTHLY_CHANGE_RATE
} from '../../../../utils/consts';
import { prepareStorageSavingsData, prepareViewCalcData } from '../../SavingsCalculator/savingsUtil';

const OracleEbsSavingsCalculatorApi = () => {
    const dispatch = useAppDispatch();
    const {
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        selectedCloneRefresh,
        monthlyChangeRate,
        selectedInstanceId,
        savingsCalculatorFrom,
        selectedExCredId,
        selectedExRegionId,
        showOptimizeMode,
        selectedDeploymentModel,
        selectedHostDetails,
        hasFetched
    } = useAppSelector(state => state.exploreSavings);

    const { selectedRowsForExploreSavingsOracleEbsBulk, triggerBulkDataFetch } = useAppSelector(
        state => state.exploreSavingsBulk
    );

    const [getOracleBulkStorageSavingsApi] = useGetOracleBulkStorageSavingsMutation();
    const [getOracleBulkViewCalculationsApi] = useGetOracleBulkViewCalculationsMutation();
    const [getOracleInstanceDataApi] = useGetOracleInstanceDataMutation();
    const resourceDetailsFetchedRef = useRef<string | null>(null);
    // Tracks whether this is the initial mount so useEffect #1 (parameter watcher)
    // skips its first run and does not duplicate the fetch already triggered by useEffect #2.
    const isMountedRef = useRef(false);

    const getCredAndRegionFromBulk = () => {
        const firstHost = selectedRowsForExploreSavingsOracleEbsBulk[0];
        return {
            credentialId: selectedExCredId || firstHost?.credentialId,
            regionId: selectedExRegionId || firstHost?.regionId
        };
    };

    const buildHostsFromBulkSelection = (): Array<{ ec2InstanceId: string }> =>
        selectedRowsForExploreSavingsOracleEbsBulk.reduce<Array<{ ec2InstanceId: string }>>((acc, host) => {
            const ec2InstanceId = host.ec2Details?.[0]?.id || host.ec2InstanceId;
            if (ec2InstanceId) {
                acc.push({ ec2InstanceId });
            }
            return acc;
        }, []);

    // Oracle EBS Storage Savings (unified for single and bulk)
    const getStorageSavingsData = async () => {
        if (!selectedRowsForExploreSavingsOracleEbsBulk.length) return;

        const hosts = buildHostsFromBulkSelection();
        if (hosts.length === 0) return;

        // Guard: Don't make API call if required parameters are missing
        if (!selectedSnapshotFrequency?.value || !selectedCloneRefresh?.value) {
            return;
        }

        const { credentialId, regionId } = getCredAndRegionFromBulk();

        const payload: any = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            clonedCopiesCount: numberOfClonedCopies,
            monthlyChangeRatePercentage: monthlyChangeRate,
            cloneRefreshFrequency: selectedCloneRefresh?.value,
            hosts
        };

        try {
            const result: any = await getOracleBulkStorageSavingsApi({
                credentialId,
                regionId,
                payload
            });
            if (result && !result?.error) {
                prepareStorageSavingsData(result?.data, dispatch);
                if (result?.data?.fsxOptimized && !showOptimizeMode?.showCalcMode && !hasFetched) {
                    dispatch(setShowFirstTimeOptimize(null));
                }
                dispatch(setStorageSavingsLoading(false));
                dispatch(setDisableState(false));
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

    // Oracle EBS View Calculations (unified for single and bulk)
    const getViewCalculationsData = async () => {
        if (!selectedRowsForExploreSavingsOracleEbsBulk.length) return;

        const hosts = buildHostsFromBulkSelection();
        if (hosts.length === 0) return;

        // Guard: Don't make API call if required parameters are missing
        if (!selectedSnapshotFrequency?.value || !selectedCloneRefresh?.value) {
            return;
        }

        const { credentialId, regionId } = getCredAndRegionFromBulk();

        const payload: any = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            clonedCopiesCount: numberOfClonedCopies,
            monthlyChangeRatePercentage: monthlyChangeRate,
            cloneRefreshFrequency: selectedCloneRefresh?.value,
            hosts
        };

        try {
            const result: any = await getOracleBulkViewCalculationsApi({
                credentialId,
                regionId,
                payload
            });
            if (result && !result?.error) {
                dispatch(setViewCalculationsApiResponse(result?.data));
                prepareViewCalcData(result?.data, dispatch, selectedDeploymentModel, monthlyChangeRate);
                dispatch(setViewCalculationsLoading(false));
            } else {
                dispatch(setViewCalculationsApiResponse(null));
                dispatch(setViewCalculationsResponse(null));
                dispatch(setViewCalculationsLoading(false));
            }
        } catch (error) {
            dispatch(setViewCalculationsApiResponse(null));
            dispatch(setViewCalculationsResponse(null));
            dispatch(setViewCalculationsLoading(false));
        }
    };

    // Fetch Oracle resource-details to get ebsResourceInfo & oracleEdition for selected hosts
    const fetchOracleResourceDetails = async () => {
        if (savingsCalculatorFrom !== SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) return;
        if (!selectedRowsForExploreSavingsOracleEbsBulk.length) return;

        const { credentialId, regionId } = getCredAndRegionFromBulk();
        if (!credentialId || !regionId) return;

        const instanceIds = selectedRowsForExploreSavingsOracleEbsBulk
            .map((host: any) => host?.ec2InstanceId || host?.ec2Details?.[0]?.id)
            .filter(Boolean)
            .join(',');

        if (!instanceIds) return;

        const cacheKey = `${credentialId}_${regionId}_${instanceIds}`;
        if (resourceDetailsFetchedRef.current === cacheKey) return;
        resourceDetailsFetchedRef.current = cacheKey;

        try {
            const result: any = await getOracleInstanceDataApi({
                credentialId,
                regionId,
                instances: instanceIds,
                fields: INSTANCE_API_FIELDS.UNMANAGED_DEFAULT.join(',')
            });

            if (result && !result?.error && result?.data?.items) {
                const itemsMap: Record<string, any> = {};
                result.data.items.forEach((item: any) => {
                    itemsMap[item.id] = item;
                });

                const updatedBulkRows = selectedRowsForExploreSavingsOracleEbsBulk.map((host: any) => {
                    const ec2Id = host?.ec2InstanceId || host?.ec2Details?.[0]?.id;
                    const apiData = itemsMap[ec2Id];
                    if (!apiData) return host;
                    return {
                        ...host,
                        ebsResourceInfo: apiData.ebsResourceInfo || host.ebsResourceInfo,
                        oracleEdition: apiData.oracleEdition || host.oracleEdition,
                        estimatedUsageCost: apiData.estimatedUsageCost || host.estimatedUsageCost,
                        loading: false
                    };
                });
                dispatch(setSelectedRowsForExploreSavingsOracleEbsBulk(updatedBulkRows));

                if (selectedHostDetails) {
                    const currentEc2Id = selectedHostDetails?.ec2InstanceId || selectedHostDetails?.ec2Details?.[0]?.id;
                    const currentApiData = itemsMap[currentEc2Id];
                    if (currentApiData) {
                        dispatch(
                            setSelectedHostDetails({
                                ...selectedHostDetails,
                                ebsResourceInfo: currentApiData.ebsResourceInfo || selectedHostDetails.ebsResourceInfo,
                                oracleEdition: currentApiData.oracleEdition || selectedHostDetails.oracleEdition,
                                estimatedUsageCost:
                                    currentApiData.estimatedUsageCost || selectedHostDetails.estimatedUsageCost,
                                loading: false
                            })
                        );
                    }
                }
            }
        } catch (error) {
            // Resource details fetch is supplementary; log but don't block the main flow
            // Clear per-host loading flags so the UI doesn't stay in a loading state
            const updatedBulkRows = selectedRowsForExploreSavingsOracleEbsBulk.map((host: unknown) => ({
                ...(host as Record<string, unknown>),
                loading: false
            }));
            dispatch(setSelectedRowsForExploreSavingsOracleEbsBulk(updatedBulkRows));

            if (selectedHostDetails) {
                dispatch(setSelectedHostDetails({ ...selectedHostDetails, loading: false }));
            }
        }
    };

    // Trigger API calls (unified for single and bulk)
    const triggerRefreshApi = () => {
        if (numberOfClonedCopies > MAX_CLONED_COPIES) return;
        if (monthlyChangeRate > MAX_MONTHLY_CHANGE_RATE) return;

        if (
            selectedRowsForExploreSavingsOracleEbsBulk.length > 0 &&
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS
        ) {
            dispatch(setStorageSavingsLoading(true));
            dispatch(setViewCalculationsLoading(true));
            getStorageSavingsData();
            getViewCalculationsData();
        }
    };

    /**
     * useEffect #1: Parameter Changes Watcher
     *
     * Purpose: Automatically recalculates savings when calculation parameters change.
     *
     * Skips the very first run (isMountedRef guard) to avoid duplicating the fetch
     * that useEffect #2 already performs on initial host selection. This also prevents
     * spurious calls when returning from the View Calculations page (component remount).
     *
     * Uses primitive `.value` dependencies instead of full option objects so that
     * re-dispatches of the same logical value (different object reference, same string)
     * from SavingsSelection do not trigger redundant API calls.
     */
    useEffect(() => {
        if (!isMountedRef.current) {
            isMountedRef.current = true;
            return;
        }
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS) {
            triggerRefreshApi();
        }
    }, [
        selectedSnapshotFrequency?.value,
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedCloneRefresh?.value,
        selectedInstanceId
    ]);

    /**
     * useEffect #2: Host Selection Watcher
     *
     * Purpose: Handles initial data fetch when host selection changes (single or bulk).
     * This is the authoritative trigger for the first API call after a host is selected.
     */
    useEffect(() => {
        if (
            triggerBulkDataFetch &&
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS &&
            selectedRowsForExploreSavingsOracleEbsBulk.length > 0
        ) {
            dispatch(setTriggerBulkDataFetch(false));
            fetchOracleResourceDetails();
            triggerRefreshApi();
        }
    }, [triggerBulkDataFetch, savingsCalculatorFrom, selectedRowsForExploreSavingsOracleEbsBulk]);

    return null;
};

export default OracleEbsSavingsCalculatorApi;
