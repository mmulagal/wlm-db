import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { useLazyGetInstanceTypesQuery } from '../../../utils/apiService';
import { addManualInstanceTypeList } from '../../../store/workloadFactory/exploreSavingsSlice';

const SavingsCalculatorManualApi = () => {
    const dispatch = useAppDispatch();

    const { headerSelectedCred, headerSelectedRegion } = useAppSelector(state => state.headers);

    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const [getInstanceTypes] = useLazyGetInstanceTypesQuery();

    useEffect(() => {
        getInstanceTypes({
            credentialsId: headerSelectedCred?.data?.credentialsId,
            regionId: headerSelectedRegion?.label2
        })
            .then(res => {
                dispatch(addManualInstanceTypeList(res?.data));
            })
            .catch(error => {
                console.log(error);
            });
    }, []);

    return <></>;
};

export default SavingsCalculatorManualApi;
