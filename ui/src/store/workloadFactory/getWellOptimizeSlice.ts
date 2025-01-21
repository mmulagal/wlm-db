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
    selectedDatabaseStorageType: '',
    cardData: cardDataDefault,
    osConfigTableData: null,
    ontapConfigTableData: null,
    optimizationBreakDown: null,
    gwRefreshPage: false,
    gwTimestamp: '',
    optimizingData: {},
    optimizingInstanceData: false,
    selectedRecommendedInstance: null,
    credIdFromJM: '',
    regionFromJM: '',
    landingFrom: '',
    inProgressOptimizationData: {},
    inProgressHostData: {},
    jobToInstanceMap: {},
    jobToInstanceMapForBulk: []
};

const getWellOptimizeSlice = createSlice({
    name: 'getWellOptimize',
    initialState,
    reducers: {
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
        setGwDatabaseInstance: (state, action: PayloadAction<any>) => {
            state.selectedDatabaseInstance = action.payload;
        },
        setGwDatabaseInstanceName: (state, action: PayloadAction<any>) => {
            state.selectedDatabaseInstanceName = action.payload;
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
            state.cardData = cardDataDefault;
            state.osConfigTableData = null;
            state.ontapConfigTableData = null;
            state.optimizationBreakDown = null;
            state.optimizingData = null;
            state.optimizingInstanceData = false;
            state.selectedRecommendedInstance = null;
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
        }
    }
});

export const {
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
    setJobToInstanceMap
} = getWellOptimizeSlice.actions;

export default getWellOptimizeSlice;
