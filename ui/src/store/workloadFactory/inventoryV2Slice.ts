import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { InventorySliceData } from '../../utils/types/inventoryV2Types';
import { DETECT_HOST_VAR } from '../../utils/consts';

const initialInventoryV2State: InventorySliceData = {
    inventoryTableData: null,
    inventoryChartData: null,
    isManagedHostListLoading: false,
    getDatabaseHosts: {
        databaseHostsData: null, // To fetch database-hosts API data
        databaseHostsLoading: false, // To check if partial database-hosts api is running
        fullHostDataLoading: false // To check if full database-hosts api is running
    },
    discoveredHosts: {
        discoveredHostData: null,
        discoverHostLoading: false
    },
    fsxCredentialStatusObj: null,
    fsxCredentialStatusLoading: false,
    mssqlInstancesData: null,
    inProgressInstances: new Set(),
    manageHostSelectedRows: [],
    valuesNotFilled: false, // Detect host dialog fields check
    detectHostRadio: DETECT_HOST_VAR.MOVE_TO_MANAGE,
    detectManageUserName: '',
    detectManagePassword: '',
    detectOntapUsername: '',
    detectOntapPassword: '',
    detectedInstanceId: '',
    inventoryExpandedRowHostData: null,
    resetManagedData: false
};

const inventoryV2Slice = createSlice({
    name: 'inventoryV2',
    initialState: initialInventoryV2State,
    reducers: {
        setInventoryExpandedRowHostData: (state, action: PayloadAction<any>) => {
            state.inventoryExpandedRowHostData = action.payload;
        },
        setValuesForForm: (state, action: PayloadAction<any>) => {
            state.valuesNotFilled = action.payload;
        },
        setInventoryTableData: (state, action: PayloadAction<any>) => {
            state.inventoryTableData = action.payload;
        },
        setInventoryChartData: (state, action: PayloadAction<any>) => {
            state.inventoryChartData = action.payload;
        },
        setIsManagedHostListLoading: (state, action: PayloadAction<any>) => {
            state.isManagedHostListLoading = action.payload;
        },
        setIsDatabaseHostsLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.databaseHostsLoading = action.payload;
        },
        setIsFullHostDataLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.fullHostDataLoading = action.payload;
        },
        addDatabaseHostsDataV2: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.databaseHostsData = action.payload;
        },
        setIsDiscoveredHostData: (state, action: PayloadAction<any>) => {
            state.discoveredHosts.discoveredHostData = action.payload;
        },
        setIsDiscoverHostLoading: (state, action: PayloadAction<any>) => {
            state.discoveredHosts.discoverHostLoading = action.payload;
        },
        setFsxCredentialStatus: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusObj = action.payload;
        },
        setFsxCredentialStatusLoading: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusLoading = action.payload;
        },
        setMssqlInstancesData: (state, action: PayloadAction<any>) => {
            state.mssqlInstancesData = action.payload;
        },
        setInProgressInstances: (state, action: PayloadAction<any>) => {
            state.inProgressInstances = action.payload;
        },
        setManageHostSelectedRows: (state, action: PayloadAction<any>) => {
            state.manageHostSelectedRows = action.payload;
        },
        setRadioValueDetect: (state, action: PayloadAction<any>) => {
            state.detectHostRadio = action.payload;
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
        setDetectedInstanceId: (state, action: PayloadAction<any>) => {
            state.detectedInstanceId = action.payload;
        },
        setResetManagedData: (state, action: PayloadAction<any>) => {
            state.resetManagedData = action.payload;
        }
    }
});

export const {
    setValuesForForm,
    setInventoryExpandedRowHostData,
    setInventoryTableData,
    setInventoryChartData,
    setIsManagedHostListLoading,
    setIsDatabaseHostsLoading,
    setIsFullHostDataLoading,
    addDatabaseHostsDataV2,
    setIsDiscoveredHostData,
    setIsDiscoverHostLoading,
    setFsxCredentialStatus,
    setFsxCredentialStatusLoading,
    setMssqlInstancesData,
    setInProgressInstances,
    setManageHostSelectedRows,
    setRadioValueDetect,
    setDetectManageUserName,
    setDetectManagePassword,
    setDetectONTAPUserName,
    setDetectONTAPPassword,
    setDetectedInstanceId,
    setResetManagedData
} = inventoryV2Slice.actions;

export default inventoryV2Slice;
