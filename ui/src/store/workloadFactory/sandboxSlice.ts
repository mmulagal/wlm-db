import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SandboxEntities } from '../../utils/types/sandBoxTypes';

export const initialSandboxState: SandboxEntities = {
    showBanner: window.localStorage.getItem('hideBanner') !== 'true',
    isNA: false,
    getSandboxList: {
        sandboxListData: [],
        sandboxListLoading: false,
        sandboxListError: ''
    },
    aggregatedSandboxList: [],
    allSandboxList: [],
    getSandboxSavings: {
        sandboxSavings: {
            consumedStorage: 0,
            savedStorage: 0,
            sandboxSavingsPercentage: 0
        },
        sandboxSavingsLoading: false,
        sandboxSavingsError: ''
    },
    connectionInfo: {
        selectedDatabaseHostId: null,
        selectedSandboxName: null,
        connectionString: null,
        isLoading: false
    },
    splitEstimateLoading: false,
    rollbackSnapshotsLoading: false,
    rollbackSnapshotList: [],
    isRollbackSelected: false,
    selectedRollbackSnapshot: null
};

const sandboxSlice = createSlice({
    name: 'sandbox',
    initialState: initialSandboxState,
    reducers: {
        setSandboxListState: (state, action: PayloadAction<any>) => {
            state.getSandboxList = action.payload;
        },
        setAggregatedSandboxList: (state, action: PayloadAction<any>) => {
            state.aggregatedSandboxList = action.payload;
        },
        setAllSandboxList: (state, action: PayloadAction<any>) => {
            state.allSandboxList = action.payload;
        },
        setSandboxSavingsState: (state, action: PayloadAction<any>) => {
            state.getSandboxSavings = action.payload;
        },
        setShowBanner: (state, action: PayloadAction<any>) => {
            state.showBanner = action.payload;
        },
        updateConnectionInfo: (state, action: PayloadAction<any>) => {
            state.connectionInfo = action.payload;
        },
        updateSplitEstimateLoading: (state, action: PayloadAction<any>) => {
            state.splitEstimateLoading = action.payload;
        },
        updateRollbackSnapshotsLoading: (state, action: PayloadAction<any>) => {
            state.rollbackSnapshotsLoading = action.payload;
        },
        updateRollbackSnapshotList: (state, action: PayloadAction<any>) => {
            state.rollbackSnapshotList = action.payload;
        },
        updateIsRollbackSelected: (state, action: PayloadAction<any>) => {
            state.isRollbackSelected = action.payload;
        },
        updateSelectedRollbackSnapshot: (state, action: PayloadAction<any>) => {
            state.selectedRollbackSnapshot = action.payload;
        }
    }
});

export const {
    setSandboxListState,
    setAggregatedSandboxList,
    setAllSandboxList,
    setSandboxSavingsState,
    setShowBanner,
    updateConnectionInfo,
    updateSplitEstimateLoading,
    updateRollbackSnapshotsLoading,
    updateRollbackSnapshotList,
    updateIsRollbackSelected,
    updateSelectedRollbackSnapshot
} = sandboxSlice.actions;

export default sandboxSlice;
