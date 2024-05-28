import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { InventorySliceData } from "../../utils/types/inventoryV2Types";

const initialInventoryV2State: InventorySliceData = {
    inventoryTableData: null,
    inventoryChartData: null
};

const inventoryV2Slice = createSlice({
    name: 'inventoryV2',
    initialState: initialInventoryV2State,
    reducers: {
        setInventoryTableData: (state, action: PayloadAction<any>) => {
            state.inventoryTableData = action.payload;
        },
        setInventoryChartData: (state, action: PayloadAction<any>) => {
            state.inventoryChartData = action.payload;
        },
    }
});

export const {
    setInventoryTableData,
    setInventoryChartData
} = inventoryV2Slice.actions;

export default inventoryV2Slice;
