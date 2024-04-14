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
    detectHostRadio: DETECT_HOST_VAR.MOVE_TO_MANAGE,
    managedHostInitialColumns: initialColStateManagedHosts,
    unManagedHostInitialColumns: initialColStateManagedHosts,
    getDatabaseHosts: {
        databaseHostsData: null, // To fetch database-hosts API data
        databaseHostsLoading: false, // To check if partial database-hosts api is running
        fullHostDataLoading: false, // To check if full database-hosts api is running
    },
    discoveredHosts: {
        discoveredHostData: null,
        discoverHostLoading: false,
        discoverHostError: null
    },
    movedManagedHosts: [],
    unManagedHosts: [],
    unIdentifiableHosts: [],
    fsxCredentialStatusObj: null,
    fsxIdsList: [],
    isRefreshed: false,
    valuesNotFilled: false, // Detect host dialog fields check
    movedToUnmanagedHost: [], // Instances that is moved from Unidentifiable rows moved to unmanaged host in inventory
    movedToManagedHost: [], // Instances that is moved from Unidentifiable rows moved to managed host in inventory
    mssqlInstancesData: {},
    isManagedHostListLoading: false
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
        addDatabaseHostsData: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.databaseHostsData = action.payload;
        },
        addDatabaseHostsLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.databaseHostsLoading = action.payload;
        },
        setIsFullHostDataLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.isFullHostDataLoading = action.payload;
        },
        setDiscoveredHosts: (state, action: PayloadAction<any>) => {
            state.discoveredHosts = action.payload;
        },
        setMovedManagedHosts: (state, action: PayloadAction<any>) => {
            state.movedManagedHosts = action.payload;
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
        },
        setIsManagedHostListLoading: (state, action: PayloadAction<any>) => {
            state.isManagedHostListLoading = action.payload;
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
    setMovedManagedHosts,
    setUnManagedHosts,
    setUnIdentifiableHosts,
    setFsxCredentialStatus,
    setFsxIdsList,
    setIsRefreshed,
    setValuesForForm,
    setMovedToUnmanagedHost,
    setMovedToManagedHost,
    setMssqlInstancesData,
    setIsManagedHostListLoading,
    addDatabaseHostsData,
    addDatabaseHostsLoading,
    setIsFullHostDataLoading
} = inventorySlice.actions;

export default inventorySlice;
