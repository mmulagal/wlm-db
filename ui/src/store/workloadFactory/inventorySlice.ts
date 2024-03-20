import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { DETECT_HOST_VAR, WLF_TABS } from '../../utils/consts';
import { initialColStateManagedHosts } from '../../utils/utilityFunctions';

const initialInventoryState: any = {
    selectedInventoryTab: WLF_TABS.MANAGED_HOSTS,
    selectedHeaderTab: WLF_TABS.DASHBOARD,
    detectManageUserName: '',
    detectManagePassword: '',
    detectOntapUsername: '',
    detectOntapPassword: '',
    detectHostRadio: DETECT_HOST_VAR.MOVE_TO_UNMANAGE,
    managedHostInitialColumns: initialColStateManagedHosts,
    unManagedHostInitialColumns: initialColStateManagedHosts,
    discoveredHosts: {
        discoveredHostData: null,
        discoverHostLoading: false,
        discoverHostError: null
    },
    unManagedHosts: [],
    unIdentifiableHosts: [],
    fsxCredentialStatusObj: null,
    fsxIdsList: [],
    isRefreshed: false,
    valuesNotFilled: false, // Detect host dialog fields check
    movedToUnmanagedHost: [], // Instances that is moved from Unidentifiable rows moved to unmanaged host in inventory
    movedToManagedHost: [], // Instances that is moved from Unidentifiable rows moved to managed host in inventory
    mssqlInstancesData: {}
};

const inventorySlice = createSlice({
    name: 'inventory',
    initialState: initialInventoryState,
    reducers: {
        setValuesForForm: (state, action: PayloadAction<any>) => {
            state.valuesNotFilled = action.payload;
        },
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
        },
        setDiscoveredHosts: (state, action: PayloadAction<any>) => {
            state.discoveredHosts = action.payload;
        },
        setUnManagedHosts: (state, action: PayloadAction<any>) => {
            state.unManagedHosts = action.payload;
        },
        setUnIdentifiableHosts: (state, action: PayloadAction<any>) => {
            state.unIdentifiableHosts = action.payload;
        },
        setFsxCredentialStatus: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusObj = action.payload;
        },
        setFsxIdsList: (state, action: PayloadAction<any>) => {
            state.fsxIdsList = action.payload;
        },
        setIsRefreshed: (state, action: PayloadAction<any>) => {
            state.isRefreshed = action.payload;
        },
        setMovedToUnmanagedHost: (state, action: PayloadAction<any>) => {
            state.movedToUnmanagedHost = action.payload;
        },
        setMovedToManagedHost: (state, action: PayloadAction<any>) => {
            state.movedToManagedHost = action.payload;
        },
        setMssqlInstancesData: (state, action: PayloadAction<any>) => {
            state.mssqlInstancesData = action.payload;
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
    setUnManagedHostColState,
    setDiscoveredHosts,
    setUnManagedHosts,
    setUnIdentifiableHosts,
    setFsxCredentialStatus,
    setFsxIdsList,
    setIsRefreshed,
    setValuesForForm,
    setMovedToUnmanagedHost,
    setMovedToManagedHost,
    setMssqlInstancesData
} = inventorySlice.actions;

export default inventorySlice;
