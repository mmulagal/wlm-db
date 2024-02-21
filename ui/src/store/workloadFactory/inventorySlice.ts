import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { WLF_TABS } from '../../utils/consts';
import { initialColStateManagedHosts } from '../../utils/utilityFunctions';

const initialInventoryState: any = {
    selectedInventoryTab: WLF_TABS.MANAGED_HOSTS,
    selectedHeaderTab: WLF_TABS.DASHBOARD,
    detectManageUserName: '',
    detectManagePassword: '',
    detectOntapUsername: '',
    detectOntapPassword: '',
    detectHostRadio: 'Yes, Manage host via workload factory',
    managedHostInitialColumns: initialColStateManagedHosts,
    unManagedHostInitialColumns: initialColStateManagedHosts
};

const inventorySlice = createSlice({
    name: 'inventory',
    initialState: initialInventoryState,
    reducers: {
        setManagedHostColState: (state, action: PayloadAction<any>) => {
            state.managedHostInitialColumns = action.payload;
        },
        setUnManagedHostColState: (state, action: PayloadAction<any>) => {
            state.unManagedHostInitialColumns = action.payload;
        },
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
        },
        setDetectONTAPUserName: (state, action: PayloadAction<any>) => {
            state.detectOntapUsername = action.payload;
        },
        setDetectONTAPPassword: (state, action: PayloadAction<any>) => {
            state.detectOntapPassword = action.payload;
        },
        setRadioValueDetect: (state, action: PayloadAction<any>) => {
            state.detectHostRadio = action.payload;
        }
    }
});

export const {
    setSelectedInventoryTab,
    setSelectedHeaderTab,
    setDetectManageUserName,
    setDetectManagePassword,
    setDetectONTAPUserName,
    setDetectONTAPPassword,
    setRadioValueDetect,
    setManagedHostColState,
    setUnManagedHostColState
} = inventorySlice.actions;

export default inventorySlice;
