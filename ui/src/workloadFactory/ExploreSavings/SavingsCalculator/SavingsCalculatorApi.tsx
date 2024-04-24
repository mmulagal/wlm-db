import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { useGetStorageSavingsMutation } from '../../../utils/apiService';
import {
    setSelectedHostDetails,
    setStorageSavingsLoading,
    setStorageSavingsResponse
} from '../../../store/workloadFactory/exploreSavingsSlice';

const SavingsCalculatorApi = () => {
    const dispatch = useAppDispatch();
    const selectedSnapshotFrequency = useAppSelector(state => state.exploreSavings.selectedSnapshotFrequency);
    const numberOfClonedCopies = useAppSelector(state => state.exploreSavings.numberOfClonedCopies);
    const selectedCloneRefresh = useAppSelector(state => state.exploreSavings.selectedCloneRefresh);
    const monthlyChangeRate = useAppSelector(state => state.exploreSavings.monthlyChangeRate);
    const selectedHostDetails = useAppSelector(state => state.exploreSavings.selectedHostDetails);
    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const selectedInstanceId = useAppSelector(state => state.exploreSavings.selectedInstanceId);

    const [getStorageSavingsApi] = useGetStorageSavingsMutation();

    const getStorageSavingsData = async (instanceId: string) => {
        const payload = {
            snapshotFrequency: selectedSnapshotFrequency?.value,
            numberOfClonedCopies: numberOfClonedCopies,
            selectedCloneRefresh: selectedCloneRefresh?.value,
            monthlyChangeRate: monthlyChangeRate
        };
        try {
            const result: any = await getStorageSavingsApi({
                credentialId: headerSelectedCred?.data?.credentialsId,
                regionId: headerSelectedRegion?.label2,
                instanceId: instanceId,
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

    useEffect(() => {
        if (selectedSnapshotFrequency && numberOfClonedCopies && selectedCloneRefresh && monthlyChangeRate) {
            dispatch(setStorageSavingsLoading(true));
            getStorageSavingsData(selectedHostDetails?.id);
        }
    }, [selectedSnapshotFrequency, numberOfClonedCopies, selectedCloneRefresh, monthlyChangeRate]);

    useEffect(() => {
        dispatch(setStorageSavingsResponse({}));
        dispatch(setStorageSavingsLoading(false));
    }, [headerSelectedCred, headerSelectedRegion]);

    useEffect(() => {
        const selectedRow = unManagedHostFormatedList.filter((item: any) => item?.id === selectedInstanceId);
        if (selectedRow) {
            dispatch(setSelectedHostDetails(selectedRow[0]));
        } else {
            dispatch(setSelectedHostDetails({}));
        }
    }, [unManagedHostFormatedList, selectedInstanceId]);

    return <></>;
};

export default SavingsCalculatorApi;
