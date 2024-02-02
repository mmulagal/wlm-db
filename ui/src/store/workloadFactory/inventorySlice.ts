import { PayloadAction, createSlice } from "@reduxjs/toolkit";

const initialInventoryState: any = {
    selectedInventoryTab: 'Managed Hosts'
};

const inventorySlice = createSlice({
    name: 'inventory',
    initialState: initialInventoryState,
    reducers: {
        setSelectedInventoryTab : (state, action: PayloadAction<any>) => {
            state.selectedInventoryTab = action.payload;
        }
    }
});

export const {
    setSelectedInventoryTab
} = inventorySlice.actions;

export default inventorySlice;