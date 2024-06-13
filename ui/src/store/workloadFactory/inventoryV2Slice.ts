import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { InventorySliceData } from '../../utils/types/inventoryV2Types';

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
    fsxCredentialStatusObj: null
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
        }
    }
});

export const {
    setInventoryTableData,
    setInventoryChartData,
    setIsManagedHostListLoading,
    setIsDatabaseHostsLoading,
    setIsFullHostDataLoading,
    addDatabaseHostsDataV2,
    setIsDiscoveredHostData,
    setIsDiscoverHostLoading,
    setFsxCredentialStatus
} = inventoryV2Slice.actions;

export default inventoryV2Slice;
