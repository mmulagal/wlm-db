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
    aggregatedSandboxInstanceList: [],
    allSandboxList: [],
    allSandboxInstanceList: [],
    getSandboxSavings: {
        sandboxSavings: {
            consumedStorage: 0,
            savedStorage: 0,
            sandboxSavingsPercentage: 0
        },
        sandboxSavingsLoading: false,
        sandboxSavingsError: ''
    },
    connectionInfoLoading: false,
    splitEstimateLoading: false,
    rollbackSnapshotsLoading: false,
    rollbackSnapshotList: [],
    isRollbackSelected: false,
    selectedRollbackSnapshot: null,
    isRefreshedSandbox: false,
    isRefreshSandboxInstance: false,
    refreshSandboxInstanceTime: '',
    sandboxInstanceLoading: false,
    selectedSandboxRow: null
};

const sandboxSlice = createSlice({
    name: 'sandbox',
    initialState: initialSandboxState,
    reducers: {
        setSelectedSandboxRow: (state, action: PayloadAction<any>) => {
            state.selectedSandboxRow = action.payload;
        },
        setSandboxInstanceLoading: (state, action: PayloadAction<any>) => {
            state.sandboxInstanceLoading = action.payload;
        },
        setRefreshSandboxInstanceTime: (state, action: PayloadAction<any>) => {
            state.refreshSandboxInstanceTime = action.payload;
        },
        setSandboxListState: (state, action: PayloadAction<any>) => {
            state.getSandboxList = action.payload;
        },
        setAggregatedSandboxInstanceList: (state, action: PayloadAction<any>) => {
            state.aggregatedSandboxInstanceList = action.payload;
        },
        setAggregatedSandboxList: (state, action: PayloadAction<any>) => {
            state.aggregatedSandboxList = action.payload;
        },
        setAllSandboxInstanceList: (state, action: PayloadAction<any>) => {
            state.allSandboxInstanceList = action.payload;
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
        updateConnectionInfoLoading: (state, action: PayloadAction<any>) => {
            state.connectionInfoLoading = action.payload;
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
        },
        resetRefreshDialog: state => {
            state.rollbackSnapshotsLoading = false;
            state.rollbackSnapshotList = [];
            state.isRollbackSelected = false;
            state.selectedRollbackSnapshot = null;
        },
        setIsRefreshedSandbox: (state, action: PayloadAction<any>) => {
            state.isRefreshedSandbox = action.payload;
        },
        setIsRefreshedSandboxInstance: (state, action: PayloadAction<any>) => {
            state.isRefreshSandboxInstance = action.payload;
        }
    }
});

export const {
    setSelectedSandboxRow,
    setRefreshSandboxInstanceTime,
    setIsRefreshedSandboxInstance,
    setSandboxInstanceLoading,
    setAggregatedSandboxInstanceList,
    setSandboxListState,
    setAllSandboxInstanceList,
    setAggregatedSandboxList,
    setAllSandboxList,
    setSandboxSavingsState,
    setShowBanner,
    updateConnectionInfoLoading,
    updateSplitEstimateLoading,
    updateRollbackSnapshotsLoading,
    updateRollbackSnapshotList,
    updateIsRollbackSelected,
    updateSelectedRollbackSnapshot,
    resetRefreshDialog,
    setIsRefreshedSandbox
} = sandboxSlice.actions;

export default sandboxSlice;
