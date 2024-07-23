import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../../utils/consts';
import SavingsCalculatorManualApi from './SavingsCalculatorManualAPI';

const RedirectComponent = () => {
    const dispatch = useDispatch();

    SavingsCalculatorManualApi();

    useEffect(() => {
        dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
    }, []);
    return <></>;
};

export default RedirectComponent;
