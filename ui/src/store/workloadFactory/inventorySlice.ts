import { PayloadAction, createSlice } from '@reduxjs/toolkit';

const initialInventoryState: any = {
    selectedInventoryTab: 'Managed Hosts',

    selectedHeaderTab: 'Dashboard'
};

const inventorySlice = createSlice({
    name: 'inventory',
    initialState: initialInventoryState,
    reducers: {
        setSelectedInventoryTab: (state, action: PayloadAction<any>) => {
            state.selectedInventoryTab = action.payload;
        },

        setSelectedHeaderTab: (state, action: PayloadAction<any>) => {
            state.selectedHeaderTab = action.payload;
        }
    }
});

export const { setSelectedInventoryTab, setSelectedHeaderTab } = inventorySlice.actions;

export default inventorySlice;
