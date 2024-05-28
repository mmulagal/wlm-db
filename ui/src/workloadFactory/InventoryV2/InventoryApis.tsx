import { useEffect } from 'react';
import { useAppDispatch } from '../../store/storeHooks';
import { setInventoryTableData } from '../../store/workloadFactory/inventoryV2Slice';
import InventoryTableData from './InventoryTableData.json';

const InventoryApisV2 = () => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(setInventoryTableData(InventoryTableData));
    }, []);
};

export default InventoryApisV2;
