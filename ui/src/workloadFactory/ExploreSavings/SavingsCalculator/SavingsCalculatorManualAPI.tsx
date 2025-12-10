import { useEffect } from 'react';
import { isEqual } from 'lodash';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetManualStorageSavingsMutation,
    useGetManualViewCalculationsMutation,
    useLazyGetInstanceTypesWithoutCredQuery,
    useLazyGetRegionsWithoutCredQuery
} from '../../../utils/apiService';
import {
    addManualInstanceTypeList,
    addManualRegionsList,
    setDisableState,
    setInstanceLoading,
    setRegionChangeInstanceLoading,
    setManualRegionsLoading,
    setRequestedPayload,
    setRequestedRegion,
    setStorageSavingsLoading,
    setStorageSavingsResponse,
    setViewCalculationsApiResponse,
    setViewCalculationsLoading,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { formatStorageSavingsRecommendedData, formatViewCalcData } from '../ExploreSavingsUtils';
import { generateManualStorageSavingsPayload } from './savingsUtil';
import { MAX_CLONED_COPIES, MAX_MONTHLY_CHANGE_RATE, SAVINGS_CALC_MODE } from '../../../utils/consts';

const SavingsCalculatorManualApi = () => {
    const dispatch = useAppDispatch();

    const {
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedManualDeploymentModel,
        selectedManualRegion,
        selectedManualServerEdition,
        selectedSecondaryManualInstanceType,
        selectedManualInstanceType,
        monthlyBYOLCost,
        manualMonthlyDescription,
        manualSecondaryMachineDescription,
        manualTCOVolumeTypes,
        volumeFilledStatus,
        manualTCOVolumeTypes2,
        savingsCalculatorFrom,
        requestedPayload,
        selectedSnapshotFrequency,
        selectedManualDeploymentType,
        selectedManualStorageType,
        manualStorageCapacity,
        selectedManualFSXIOPS,
        selectedManualFSXThroughput,
        selectedManualStorageCapacityUnit,
        requestedRegion
    } = useAppSelector(state => state.exploreSavings);

    const instanceTypeLoading = useAppSelector(state => state.exploreSavings.regionChangeInstanceLoading);

    const [getInstanceTypes] = useLazyGetInstanceTypesWithoutCredQuery();
    const [getRegionsWithoutCred] = useLazyGetRegionsWithoutCredQuery();

    const [getManualStorageSavingsApi] = useGetManualStorageSavingsMutation();
    const [getManualViewCalculationsApi] = useGetManualViewCalculationsMutation();

    useEffect(() => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
        ) {
            dispatch(setManualRegionsLoading(true));
            getRegionsWithoutCred({})
                .then(res => {
                    dispatch(addManualRegionsList(res?.data));
                    dispatch(setManualRegionsLoading(false));
                })
                .catch(error => {
                    dispatch(setManualRegionsLoading(false));
                });
        }
    }, [savingsCalculatorFrom]);

    useEffect(() => {
        if (
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) &&
            selectedManualRegion
        ) {
            dispatch(setInstanceLoading(true));
            getInstanceTypes({
                region: selectedManualRegion?.data?.regionCode
            })
                .then(res => {
                    dispatch(addManualInstanceTypeList(res?.data));
                    dispatch(setInstanceLoading(false));
                    dispatch(setRegionChangeInstanceLoading(false));
                })
                .catch(error => {
                    dispatch(setInstanceLoading(false));
                    dispatch(setRegionChangeInstanceLoading(false));
                });
        }
    }, [savingsCalculatorFrom, selectedManualRegion]);

    const getManualStorageSavingsData = async () => {
        const payload = generateManualStorageSavingsPayload();

        try {
            const result = await getManualStorageSavingsApi({
                regionId: selectedManualRegion?.data?.regionCode,
                payload,
                type:
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
                        ? 'ebs'
                        : 'fsxw'
            });
            dispatch(setStorageSavingsLoading(false));
            dispatch(setStorageSavingsResponse(formatStorageSavingsRecommendedData(result?.data)));
        } catch (error) {
            dispatch(setStorageSavingsLoading(false));
        }
    };

    const getManualViewCalculationsData = async () => {
        const payload = generateManualStorageSavingsPayload();
        try {
            const result = await getManualViewCalculationsApi({
                regionId: selectedManualRegion?.data?.regionCode,
                payload,
                type:
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS
                        ? 'ebs'
                        : 'fsxw'
            });
            dispatch(setViewCalculationsApiResponse(result?.data));
            dispatch(
                setViewCalculationsResponse(
                    formatViewCalcData(result?.data, selectedManualDeploymentModel?.label, monthlyChangeRate)
                )
            );
            dispatch(setViewCalculationsLoading(false));
        } catch (error) {
            dispatch(setViewCalculationsLoading(false));
        }
    };

    const triggerManualStorageAPI = () => {
        dispatch(setStorageSavingsLoading(true));
        dispatch(setViewCalculationsLoading(true));
        getManualStorageSavingsData();
        getManualViewCalculationsData();
    };

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS) {
            const payload = generateManualStorageSavingsPayload();
            const comparedPayloadValues =
                isEqual(payload, requestedPayload) &&
                selectedManualRegion?.data?.regionCode === requestedRegion?.data?.regionCode;

            if (
                !comparedPayloadValues &&
                !instanceTypeLoading &&
                selectedManualRegion &&
                numberOfClonedCopies &&
                numberOfClonedCopies <= MAX_CLONED_COPIES &&
                monthlyChangeRate &&
                Number(monthlyChangeRate) <= MAX_MONTHLY_CHANGE_RATE &&
                volumeFilledStatus &&
                selectedManualInstanceType &&
                payload?.ec2Instances[0]?.volumes.length
            ) {
                dispatch(setDisableState(false));
                dispatch(setRequestedPayload(payload));
                dispatch(setRequestedRegion(selectedManualRegion));
                triggerManualStorageAPI();
            }
        }
    }, [
        savingsCalculatorFrom,
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedManualDeploymentModel,
        selectedManualRegion,
        selectedManualServerEdition,
        selectedManualInstanceType,
        monthlyBYOLCost,
        manualMonthlyDescription,
        manualSecondaryMachineDescription,
        selectedSecondaryManualInstanceType,
        manualTCOVolumeTypes,
        volumeFilledStatus,
        manualTCOVolumeTypes2,
        instanceTypeLoading
    ]);

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) {
            const payload = generateManualStorageSavingsPayload();
            const comparedPayloadValues =
                isEqual(payload, requestedPayload) &&
                selectedManualRegion?.data?.regionCode === requestedRegion?.data?.regionCode;

            const storageCapCHeck = () => {
                if (
                    Number(manualStorageCapacity) < 1 ||
                    (selectedManualStorageCapacityUnit.label === 'TiB' && Number(manualStorageCapacity) > 64)
                ) {
                    return false;
                }
                return true;
            };

            const checkValidation = () => {
                if (
                    numberOfClonedCopies <= MAX_CLONED_COPIES &&
                    numberOfClonedCopies > 0 &&
                    Number(monthlyChangeRate) <= MAX_MONTHLY_CHANGE_RATE &&
                    Number(monthlyChangeRate) > 0 &&
                    Number(selectedManualFSXIOPS) > 96 &&
                    Number(selectedManualFSXIOPS) < 400000 &&
                    Number(selectedManualFSXThroughput) > 8 &&
                    Number(selectedManualFSXThroughput) < 12288 &&
                    storageCapCHeck()
                ) {
                    return true;
                }
                return false;
            };

            if (!comparedPayloadValues && selectedManualRegion && checkValidation() && selectedManualInstanceType) {
                dispatch(setDisableState(false));
                dispatch(setRequestedPayload(payload));
                dispatch(setRequestedRegion(selectedManualRegion));
                triggerManualStorageAPI();
            }
        }
    }, [
        savingsCalculatorFrom,
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedManualDeploymentModel,
        selectedManualRegion,
        selectedManualServerEdition,
        selectedManualInstanceType,
        monthlyBYOLCost,
        selectedSnapshotFrequency,
        selectedManualDeploymentType,
        selectedManualStorageType,
        manualStorageCapacity,
        selectedManualFSXIOPS,
        selectedManualFSXThroughput,
        selectedManualStorageCapacityUnit
    ]);

    return <></>;
};

export default SavingsCalculatorManualApi;
