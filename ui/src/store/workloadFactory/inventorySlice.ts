import { PayloadAction, createSlice } from '@reduxjs/toolkit';

const initialInventoryState: any = {
    selectedInventoryTab: 'Managed Hosts',
    selectedHeaderTab: 'Dashboard',
    detectManageUserName: '',
    detectManagePassword: ''
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
        },
        setDetectManageUserName: (state, action: PayloadAction<any>) => {
            state.detectManageUserName = action.payload;
        },
        setDetectManagePassword: (state, action: PayloadAction<any>) => {
            state.detectManagePassword = action.payload;
        }
    }
});

export const { setSelectedInventoryTab, setSelectedHeaderTab, setDetectManageUserName, setDetectManagePassword } =
    inventorySlice.actions;

export default inventorySlice;
