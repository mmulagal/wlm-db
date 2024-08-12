import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetManualStorageSavingsMutation,
    useGetManualViewCalculationsMutation,
    useLazyGetInstanceTypesQuery
} from '../../../utils/apiService';
import {
    addManualInstanceTypeList,
    setDisableState,
    setInstanceLoading,
    setRequestedPayload,
    setStorageSavingsLoading,
    setStorageSavingsResponse,
    setViewCalculationsApiResponse,
    setViewCalculationsLoading,
    setViewCalculationsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';
import { formatStorageSavingsRecommendedData, formatViewCalcData } from '../ExploreSavingsUtils';
import { generateManualStorageSavingsPayload } from './savingsUtil';
import { SAVINGS_CALC_MODE } from '../../../utils/consts';

const _ = require('lodash');

const SavingsCalculatorManualApi = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);

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
        requestedPayload
    } = useAppSelector(state => state.exploreSavings);

    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const [getInstanceTypes] = useLazyGetInstanceTypesQuery();

    const [getManualStorageSavingsApi] = useGetManualStorageSavingsMutation();
    const [getManualViewCalculationsApi] = useGetManualViewCalculationsMutation();

    useEffect(() => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW
        ) {
            dispatch(setInstanceLoading(true));
            getInstanceTypes({
                credentialId: headerSelectedCred?.data?.credentialsId,
                region: headerSelectedRegion?.label2
            })
                .then(res => {
                    dispatch(addManualInstanceTypeList(res?.data));
                    dispatch(setInstanceLoading(false));
                })
                .catch(error => {
                    dispatch(setInstanceLoading(false));
                });
        }
    }, [savingsCalculatorFrom]);

    const getManualStorageSavingsData = async () => {
        const payload = generateManualStorageSavingsPayload();

        try {
            const result = await getManualStorageSavingsApi({
                regionId: selectedManualRegion?.data?.regionCode,
                payload: payload
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
                payload: payload
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
            const comparedPayloadValues = _.isEqual(payload, requestedPayload);

            if (
                !comparedPayloadValues &&
                selectedManualRegion &&
                numberOfClonedCopies &&
                monthlyChangeRate &&
                volumeFilledStatus &&
                selectedManualInstanceType &&
                payload?.ec2Instances[0]?.volumes.length
            ) {
                dispatch(setDisableState(false));
                dispatch(setRequestedPayload(payload));
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
        manualTCOVolumeTypes2
    ]);

    return <></>;
};

export default SavingsCalculatorManualApi;
