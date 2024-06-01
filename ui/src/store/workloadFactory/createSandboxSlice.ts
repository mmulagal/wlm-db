import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CreateSandboxEntities } from '../../utils/types/sandBoxTypes';
import { GENERAL } from '../../utils/appConstants';

export const initialCreateSandboxState: CreateSandboxEntities = {
    getDatabaseHosts: {
        databaseHostsData: null,
        databaseHostsLoading: false,
        databaseHostsError: null
    },
    aggregatedDbHostList: [],
    getDatabaseList: {
        databaseListData: null,
        databaseListLoading: false,
        databaseListError: null
    },
    source: {
        selectedDatabaseHost: null,
        selectedDatabaseInstance: null,
        selectedDatabase: null
    },
    target: {
        selectedDatabaseHost: null,
        selectedDatabaseInstance: null,
        selectedDatabase: `sandbox_${Date.now()}`
    },
    getDriveInfo: {
        driveInfoLoading: false,
        driveInfoData: null
    },
    getDbMountPoints: {
        dbMountPointsData: null,
        dbMountPointsLoading: false
    },
    selectedMount: GENERAL.AUTO_ASSIGN_MOUNT_POINT,
    dataDriveMountPoint: null,
    logDriveMountPoint: null,
    selectedTag: 'Development',
    isTargetSelected: true,
    isSourceSelected: true,
    isCreateSandboxPressed: false,
    isMountPathAdded: true,
    isNA: false,
    showError: false,
    dataFilePath: '',
    logFilePath: ''
};

const createSandboxSlice = createSlice({
    name: 'createSandbox',
    initialState: initialCreateSandboxState,
    reducers: {
        setDatabaseHostState: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts = action.payload;
        },
        setAggregatedDbHost: (state, action: PayloadAction<any>) => {
            state.aggregatedDbHostList = action.payload;
        },
        setDatabaseListState: (state, action: PayloadAction<any>) => {
            state.getDatabaseList = action.payload;
        },
        setDriveInfoState: (state, action: PayloadAction<any>) => {
            state.getDriveInfo = action.payload;
        },
        setDbMountPointsState: (state, action: PayloadAction<any>) => {
            state.getDbMountPoints = action.payload;
        },
        setSourceDbHost: (state, action: PayloadAction<any>) => {
            state.source.selectedDatabaseHost = action.payload;
        },
        setSourceDbInstance: (state, action: PayloadAction<any>) => {
            state.source.selectedDatabaseInstance = action.payload;
        },
        setSourceDatabase: (state, action: PayloadAction<any>) => {
            state.source.selectedDatabase = action.payload;
        },
        setTargetDbHost: (state, action: PayloadAction<any>) => {
            state.target.selectedDatabaseHost = action.payload;
        },
        setTargetDbInstance: (state, action: PayloadAction<any>) => {
            state.target.selectedDatabaseInstance = action.payload;
        },
        setTargetDatabase: (state, action: PayloadAction<any>) => {
            state.target.selectedDatabase = action.payload;
        },
        setIsNa: (state, action: PayloadAction<any>) => {
            state.isNA = action.payload;
        },
        setIsSourceSelected: (state, action: PayloadAction<any>) => {
            state.isSourceSelected = action.payload;
        },
        setIsTargetSelected: (state, action: PayloadAction<any>) => {
            state.isTargetSelected = action.payload;
        },
        setIsMountPathAdded: (state, action: PayloadAction<any>) => {
            state.isMountPathAdded = action.payload;
        },
        setCreateSandboxPressed: (state, action: PayloadAction<any>) => {
            state.isCreateSandboxPressed = action.payload;
        },
        setSelectedTag: (state, action: PayloadAction<any>) => {
            state.selectedTag = action.payload;
        },
        setSelectedMount: (state, action: PayloadAction<any>) => {
            state.selectedMount = action.payload;
        },
        setDataDriveMountPoint: (state, action: PayloadAction<any>) => {
            state.dataDriveMountPoint = action.payload;
        },
        setLogDriveMountPoint: (state, action: PayloadAction<any>) => {
            state.logDriveMountPoint = action.payload;
        },
        setShowError: (state, action: PayloadAction<any>) => {
            state.showError = action.payload;
        },
        updateDataFilePath: (state, action: PayloadAction<any>) => {
            state.dataFilePath = action.payload;
        },
        updateLogFilePath: (state, action: PayloadAction<any>) => {
            state.logFilePath = action.payload;
        }
    }
});

export const {
    setDatabaseHostState,
    setDatabaseListState,
    setSourceDbHost,
    setSourceDbInstance,
    setSourceDatabase,
    setAggregatedDbHost,
    setTargetDbHost,
    setTargetDbInstance,
    setTargetDatabase,
    setIsSourceSelected,
    setIsTargetSelected,
    setDataDriveMountPoint,
    setLogDriveMountPoint,
    setSelectedTag,
    setSelectedMount,
    setCreateSandboxPressed,
    setIsMountPathAdded,
    setIsNa,
    setShowError,
    setDriveInfoState,
    setDbMountPointsState,
    updateDataFilePath,
    updateLogFilePath
} = createSandboxSlice.actions;

export default createSandboxSlice;
