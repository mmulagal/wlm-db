import { PayloadAction, createSlice } from '@reduxjs/toolkit';
// cardDataDefault removed - using empty object for flat API
import { GetWellSliceInterface } from '../../utils/types/getWellTypes';
import { GENERAL } from '../../utils/appConstants';
import { DBType, WELL_ARCHITECTED_TABS } from '../../utils/consts';

const initialState: GetWellSliceInterface = {
    optimizePageLoading: null,
    driftAssessmentData: null,
    isAssessmentAvailable: false,
    selectedHostname: '',
    selectedResourceId: '',
    selectedDatabaseInstance: '',
    selectedDatabaseInstanceName: '',
    selectedGwInstanceCredId: '',
    selectedGwInstanceRegionId: '',
    selectedDatabaseStorageType: '',
    selectedDatabaseAoagStorageType: '',
    selectedRowFsxId: '',
    cardData: {},
    optimizationBreakDown: null,
    gwRefreshPage: false,
    gwRefreshTimestamp: '',
    gwTimestamp: '',
    optimizingData: {},
    optimizingInstanceData: false,
    selectedRecommendedInstance: null,
    selectedSnapshotPolicy: null,
    selectedSnapshot: null,
    selectedAWSBackup: {
        numberOfDays: 30,
        hour: '01',
        minute: '00'
    },
    credIdFromJM: '',
    regionFromJM: '',
    landingFrom: '',
    inProgressOptimizationData: {},
    inProgressResourceOptimizeData: {}, // To maintain the in progress data for resource optimization like clone database
    inProgressHostData: {},
    jobToInstanceMap: {},
    jobToInstanceMapForBulk: [],
    recommendedInstanceInBulk: {},
    landingFromInnerPage: false,
    isInnerPageOptimize: false,
    gwAdhocError: '',
    triggerAssessmentInProgress: false,
    selectedCloneTab: GENERAL.CLONE_MANAGEMENT_TAB1,
    cloneDashboardData: [], // Data stored for clone in inner page
    cloneIsOptimizedRows: {}, // To maintain optimized rows in clone assessment (resourceId + instanceId + cloneDatabasename)
    inProgressStateData: {},
    selectedWellArchitectTab: WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS,
    visitedTabs: {},
    innerPageDetails: {
        fsxId: '',
        ec2InstanceId: '',
        isInstanceStorageAsmManaged: false
    },
    configEngineType: DBType.MSSQL,
    isWad: false,
    isUnregistered: false,
    instanceStatus: '',
    hostManageReadiness: undefined,
    fsxLinkExists: undefined
};

const getWellOptimizeSlice = createSlice({
    name: 'getWellOptimize',
    initialState,
    reducers: {
        setSelectedConfigEngineType: (state, action: PayloadAction<any>) => {
            state.configEngineType = action.payload;
        },
        setFSXId: (state, action: PayloadAction<any>) => {
            state.innerPageDetails = action.payload;
        },

        setTabVisited: (state, action: PayloadAction<any>) => {
            state.visitedTabs[action.payload] = true;
        },
        resetVisitedTabs: state => {
            state.visitedTabs = {};
        },
        setSelectedWellArchitectTab: (state, action: PayloadAction<any>) => {
            state.selectedWellArchitectTab = action.payload;
        },

        setSelectedCloneTab: (state, action: PayloadAction<string>) => {
            state.selectedCloneTab = action.payload;
        },
        setSelectedSnapshot: (state, action: PayloadAction<any>) => {
            state.selectedSnapshot = action.payload;
        },
        setSelectedSnapshotPolicy: (state, action: PayloadAction<any>) => {
            state.selectedSnapshotPolicy = action.payload;
        },
        setSelectedAWSBackup: (state, action: PayloadAction<any>) => {
            state.selectedAWSBackup = action.payload;
        },
        setOptimizePageLoading: (state, action: PayloadAction<any>) => {
            state.optimizePageLoading = action.payload;
        },
        setDriftAssessmentData: (state, action: PayloadAction<any>) => {
            state.driftAssessmentData = action.payload;
        },
        setIsAssessmentAvailable: (state, action: PayloadAction<any>) => {
            state.isAssessmentAvailable = action.payload;
        },
        setGwHostname: (state, action: PayloadAction<any>) => {
            state.selectedHostname = action.payload;
        },
        setGwResourceId: (state, action: PayloadAction<any>) => {
            state.selectedResourceId = action.payload;
        },
        setGwSelectedRowFsxId: (state, action: PayloadAction<any>) => {
            state.selectedRowFsxId = action.payload;
        },
        setGwDatabaseInstance: (state, action: PayloadAction<any>) => {
            state.selectedDatabaseInstance = action.payload;
        },
        setGwDatabaseInstanceName: (state, action: PayloadAction<any>) => {
            state.selectedDatabaseInstanceName = action.payload;
        },
        setSelectedGwInstanceCredId: (state, action: PayloadAction<any>) => {
            state.selectedGwInstanceCredId = action.payload;
        },
        setSelectedGwInstanceRegionId: (state, action: PayloadAction<any>) => {
            state.selectedGwInstanceRegionId = action.payload;
        },
        setGwDatabaseStorageType: (state, action: PayloadAction<any>) => {
            state.selectedDatabaseStorageType = action.payload;
        },
        setGwDatabaseAoagStorageType: (state, action: PayloadAction<any>) => {
            state.selectedDatabaseAoagStorageType = action.payload;
        },
        setCardData: (state, action: PayloadAction<any>) => {
            state.cardData = action.payload;
        },
        setOptimizationBreakDown: (state, action: PayloadAction<any>) => {
            state.optimizationBreakDown = action.payload;
        },
        setGwRefreshPage: (state, action: PayloadAction<any>) => {
            state.gwRefreshPage = action.payload;
        },
        setGwTimestamp: (state, action: PayloadAction<any>) => {
            state.gwTimestamp = action.payload;
        },
        setGwRefreshTimestamp: (state, action: PayloadAction<any>) => {
            state.gwRefreshTimestamp = action.payload;
        },
        resetGwData: (state, action: PayloadAction<any>) => {
            state.optimizePageLoading = false;
            state.driftAssessmentData = null;
            state.isAssessmentAvailable = false;
            state.selectedHostname = '';
            state.selectedResourceId = '';
            state.selectedDatabaseInstance = '';
            state.selectedDatabaseInstanceName = '';
            state.selectedDatabaseStorageType = '';
            state.selectedDatabaseAoagStorageType = '';
            state.selectedRowFsxId = '';
            state.cardData = {};
            state.optimizationBreakDown = null;
            state.optimizingData = null;
            state.optimizingInstanceData = false;
            state.selectedSnapshotPolicy = null;
            state.selectedRecommendedInstance = null;
            state.recommendedInstanceInBulk = {};
            state.selectedGwInstanceCredId = '';
            state.selectedGwInstanceRegionId = '';
            state.gwRefreshTimestamp = '';
            state.gwTimestamp = '0';
            state.hostManageReadiness = undefined;
            state.fsxLinkExists = undefined;
            state.triggerAssessmentInProgress = false;
        },
        setOptimizingData: (state, action: PayloadAction<any>) => {
            state.optimizingData = action.payload;
        },
        setOptimizingInstanceData: (state, action: PayloadAction<any>) => {
            state.optimizingInstanceData = action.payload;
        },
        setSelectedRecommendedInstance: (state, action: PayloadAction<any>) => {
            state.selectedRecommendedInstance = action.payload;
        },
        setCredIdFromJM: (state, action: PayloadAction<any>) => {
            state.credIdFromJM = action.payload;
        },
        setRegionFromJM: (state, action: PayloadAction<any>) => {
            state.regionFromJM = action.payload;
        },
        setLandingFrom: (state, action: PayloadAction<any>) => {
            state.landingFrom = action.payload;
        },
        setInProgressOptimizationData: (state, action: PayloadAction<any>) => {
            state.inProgressOptimizationData = action.payload;
        },
        setInProgressResourceOptimizeData: (state, action: PayloadAction<any>) => {
            state.inProgressResourceOptimizeData = action.payload;
        },
        setInProgressHostData: (state, action: PayloadAction<any>) => {
            state.inProgressHostData = action.payload;
        },
        setJobToInstanceMap: (state, action: PayloadAction<any>) => {
            state.jobToInstanceMap = action.payload;
        },
        setJobToInstanceMapForBulk: (state, action: PayloadAction<any>) => {
            state.jobToInstanceMapForBulk = action.payload;
        },
        setRecommendedInstanceInBulk: (state, action: PayloadAction<any>) => {
            if (!state.recommendedInstanceInBulk[action.payload.type]) {
                state.recommendedInstanceInBulk[action.payload.type] = {};
            }
            state.recommendedInstanceInBulk[action.payload.type] = action.payload.value;
        },
        setGwPageLoadInstanceData: (state, action: PayloadAction<any>) => {
            state.selectedHostname = action.payload.hostname;
            state.selectedResourceId = action.payload.resourceId;
            state.selectedDatabaseInstance = action.payload.instanceId;
            state.selectedDatabaseInstanceName = action.payload.instanceName;
            state.selectedGwInstanceCredId = action.payload.credId;
            state.selectedGwInstanceRegionId = action.payload.regionId;
            state.selectedDatabaseStorageType = action.payload.storageType;
            state.selectedDatabaseAoagStorageType = action.payload.storageAoagType;
            state.isWad = action.payload.isWad || false;
            state.isUnregistered = action.payload.isUnregistered || false;
            state.instanceStatus = action.payload.instanceStatus || '';
            state.hostManageReadiness = action.payload.hostManageReadiness;
            state.fsxLinkExists = action.payload.fsxLinkExists;
            state.triggerAssessmentInProgress = false;
        },
        setFsxLinkExists: (state, action: PayloadAction<boolean | undefined>) => {
            state.fsxLinkExists = action.payload;
        },
        setLandingFromInnerPage: (state, action: PayloadAction<any>) => {
            state.landingFromInnerPage = action.payload;
        },
        setIsInnerPageOptimize: (state, action: PayloadAction<any>) => {
            state.isInnerPageOptimize = action.payload;
        },
        setGwAdhocError: (state, action: PayloadAction<any>) => {
            state.gwAdhocError = action.payload;
        },
        setTriggerAssessmentInProgress: (state, action: PayloadAction<boolean>) => {
            state.triggerAssessmentInProgress = action.payload;
        },
        setCloneDashboardData: (state, action: PayloadAction<any>) => {
            state.cloneDashboardData = action.payload;
        },
        setCloneIsOptimizedRows: (state, action: PayloadAction<any>) => {
            state.cloneIsOptimizedRows = action.payload;
        },
        setInProgressStateData: (state, action: PayloadAction<any>) => {
            state.inProgressStateData = action.payload;
        }
    }
});

export const {
    setFSXId,
    setSelectedConfigEngineType,
    setTabVisited,
    resetVisitedTabs,
    setSelectedWellArchitectTab,
    setSelectedCloneTab,
    setSelectedSnapshot,
    setSelectedSnapshotPolicy,
    setSelectedAWSBackup,
    setJobToInstanceMapForBulk,
    setLandingFrom,
    setCredIdFromJM,
    setRegionFromJM,
    setOptimizePageLoading,
    setDriftAssessmentData,
    setIsAssessmentAvailable,
    setGwHostname,
    setGwResourceId,
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setGwDatabaseStorageType,
    setGwDatabaseAoagStorageType,
    setCardData,
    setOptimizationBreakDown,
    setGwRefreshPage,
    setGwTimestamp,
    setGwRefreshTimestamp,
    resetGwData,
    setOptimizingData,
    setOptimizingInstanceData,
    setSelectedRecommendedInstance,
    setInProgressOptimizationData,
    setInProgressResourceOptimizeData,
    setInProgressHostData,
    setJobToInstanceMap,
    setRecommendedInstanceInBulk,
    setSelectedGwInstanceCredId,
    setSelectedGwInstanceRegionId,
    setGwPageLoadInstanceData,
    setFsxLinkExists,
    setLandingFromInnerPage,
    setGwSelectedRowFsxId,
    setIsInnerPageOptimize,
    setGwAdhocError,
    setTriggerAssessmentInProgress,
    setCloneDashboardData,
    setCloneIsOptimizedRows,
    setInProgressStateData
} = getWellOptimizeSlice.actions;

export default getWellOptimizeSlice;
