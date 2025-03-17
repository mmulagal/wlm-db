import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { cardDataDefault } from '../../workloadFactory/GetWell/GetWellUtils';
import { GetWellSliceInterface } from '../../utils/types/getWellTypes';

const initialState: GetWellSliceInterface = {
    optimizePageLoading: false,
    driftAssessmentData: null,
    isAssessmentAvailable: false,
    selectedHostname: '',
    selectedResourceId: '',
    selectedDatabaseInstance: '',
    selectedDatabaseInstanceName: '',
    selectedGwInstanceCredId: '',
    selectedGwInstanceRegionId: '',
    selectedDatabaseStorageType: '',
    selectedRowFsxId: '',
    cardData: cardDataDefault,
    osConfigTableData: null,
    ontapConfigTableData: null,
    optimizationBreakDown: null,
    gwRefreshPage: false,
    gwTimestamp: '',
    optimizingData: {},
    optimizingInstanceData: false,
    selectedRecommendedInstance: null,
    selectedSnapshotPolicy: null,
    selectedSnapshot: null,
    selectedAWSBackup: {
        numberOfDays: 30,
        hour: 1,
        minute: 0
    },
    credIdFromJM: '',
    regionFromJM: '',
    landingFrom: '',
    inProgressOptimizationData: {},
    inProgressHostData: {},
    jobToInstanceMap: {},
    jobToInstanceMapForBulk: [],
    recommendedInstanceInBulk: {},
    landingFromInnerPage: false
};

const getWellOptimizeSlice = createSlice({
    name: 'getWellOptimize',
    initialState,
    reducers: {
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
        setCardData: (state, action: PayloadAction<any>) => {
            state.cardData = action.payload;
        },
        setOsConfigTableData: (state, action: PayloadAction<any>) => {
            state.osConfigTableData = action.payload;
        },
        setOntapConfigTableData: (state, action: PayloadAction<any>) => {
            state.ontapConfigTableData = action.payload;
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
        resetGwData: (state, action: PayloadAction<any>) => {
            state.optimizePageLoading = false;
            state.driftAssessmentData = null;
            state.isAssessmentAvailable = false;
            state.selectedHostname = '';
            state.selectedResourceId = '';
            state.selectedDatabaseInstance = '';
            state.selectedDatabaseInstanceName = '';
            state.selectedDatabaseStorageType = '';
            state.selectedRowFsxId = '';
            state.cardData = cardDataDefault;
            state.osConfigTableData = null;
            state.ontapConfigTableData = null;
            state.optimizationBreakDown = null;
            state.optimizingData = null;
            state.optimizingInstanceData = false;
            state.selectedSnapshotPolicy = null;
            state.selectedRecommendedInstance = null;
            state.recommendedInstanceInBulk = {};
            state.selectedGwInstanceCredId = '';
            state.selectedGwInstanceRegionId = '';
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
        },
        setLandingFromInnerPage: (state, action: PayloadAction<any>) => {
            state.landingFromInnerPage = action.payload;
        }
    }
});

export const {
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
    setCardData,
    setOsConfigTableData,
    setOntapConfigTableData,
    setOptimizationBreakDown,
    setGwRefreshPage,
    setGwTimestamp,
    resetGwData,
    setOptimizingData,
    setOptimizingInstanceData,
    setSelectedRecommendedInstance,
    setInProgressOptimizationData,
    setInProgressHostData,
    setJobToInstanceMap,
    setRecommendedInstanceInBulk,
    setSelectedGwInstanceCredId,
    setSelectedGwInstanceRegionId,
    setGwPageLoadInstanceData,
    setLandingFromInnerPage,
    setGwSelectedRowFsxId
} = getWellOptimizeSlice.actions;

export default getWellOptimizeSlice;
