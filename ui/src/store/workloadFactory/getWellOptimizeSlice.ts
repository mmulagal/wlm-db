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
    cardData: cardDataDefault,
    osConfigTableData: null,
    ontapConfigTableData: null,
    optimizationBreakDown: null,
    gwRefreshPage: false,
    gwTimestamp: '',
    optimizingData: {},
    optimizingInstanceData: false
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
            state.cardData = cardDataDefault;
            state.osConfigTableData = null;
            state.ontapConfigTableData = null;
            state.optimizationBreakDown = null;
            state.optimizingData = null;
            state.optimizingInstanceData = false;
        },
        setOptimizingData: (state, action: PayloadAction<any>) => {
            state.optimizingData = action.payload;
        },
        setOptimizingInstanceData: (state, action: PayloadAction<any>) => {
            state.optimizingInstanceData = action.payload;
        }
    }
});

export const {
    setOptimizePageLoading,
    setDriftAssessmentData,
    setIsAssessmentAvailable,
    setGwHostname,
    setGwResourceId,
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setCardData,
    setOsConfigTableData,
    setOntapConfigTableData,
    setOptimizationBreakDown,
    setGwRefreshPage,
    setGwTimestamp,
    resetGwData,
    setOptimizingData,
    setOptimizingInstanceData
} = getWellOptimizeSlice.actions;

export default getWellOptimizeSlice;
