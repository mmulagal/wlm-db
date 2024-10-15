import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { cardDataDefault } from '../../workloadFactory/GetWell/GetWellUtils';
import { GetWellSliceInterface } from '../../utils/types/getWellTypes';

const initialState: GetWellSliceInterface = {
    optimizePageLoading: false,
    driftAssessmentData: null,
    selectedHostname: '',
    selectedResourceId: '',
    selectedDatabaseInstance: '',
    selectedDatabaseInstanceName: '',
    cardData: cardDataDefault,
    osConfigTableData: null,
    ontapConfigTableData: null,
    optimizationBreakDown: null
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
        resetGwData: (state, action: PayloadAction<any>) => {
            state.optimizePageLoading = false;
            state.driftAssessmentData = null;
            state.selectedHostname = '';
            state.selectedResourceId = '';
            state.selectedDatabaseInstance = '';
            state.selectedDatabaseInstanceName = '';
            state.cardData = cardDataDefault;
            state.osConfigTableData = null;
            state.ontapConfigTableData = null;
            state.optimizationBreakDown = null;
        }
    }
});

export const {
    setOptimizePageLoading,
    setDriftAssessmentData,
    setGwHostname,
    setGwResourceId,
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setCardData,
    setOsConfigTableData,
    setOntapConfigTableData,
    setOptimizationBreakDown,
    resetGwData
} = getWellOptimizeSlice.actions;

export default getWellOptimizeSlice;
