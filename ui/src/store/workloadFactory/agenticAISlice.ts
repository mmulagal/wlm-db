import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { AgenticAIEntities, ErrorInvestigationGetApiResponse, TimeRange } from '../../utils/types/agenticAITypes';

export const initialSandboxState: AgenticAIEntities = {
    selectedSeverity: '',
    selectedTimeFrame: '',
    selectedErrorCodes: '',
    timeRange: {
        from: '01:00',
        fromPeriod: 'AM',
        to: '02:00',
        toPeriod: 'AM'
    },
    noData: false,
    selectedDates: [],
    errorInvestigation: {
        errorInvestigationData: [],
        errorInvestigationLoading: false
    }
};

const agenticAISlice = createSlice({
    name: 'agenticAI',
    initialState: initialSandboxState,
    reducers: {
        setSelectedDates: (state, action: PayloadAction<any[]>) => {
            state.selectedDates = action.payload;
        },
        updateTimeRangeField: (state, action: PayloadAction<{ key: keyof TimeRange; value: string }>) => {
            state.timeRange[action.payload.key] = action.payload.value;
        },

        setSelectedSeverity: (state, action: PayloadAction<string>) => {
            state.selectedSeverity = action.payload;
        },
        setSelectedTimeFrame: (state, action: PayloadAction<string>) => {
            state.selectedTimeFrame = action.payload;
        },
        setSelectedErrorCodes: (state, action: PayloadAction<string>) => {
            state.selectedErrorCodes = action.payload;
        },
        setNoLogAnalyzerData: (state, action: PayloadAction<boolean>) => {
            state.noData = action.payload;
        },
        setErrorInvestigationLoading: (state, action: PayloadAction<boolean>) => {
            state.errorInvestigation.errorInvestigationLoading = action.payload;
        },
        // eslint-disable-next-line no-param-reassign
        setErrorInvestigationData: (state, action: PayloadAction<Array<ErrorInvestigationGetApiResponse> | []>) => {
            state.errorInvestigation.errorInvestigationData = action.payload;
        },
        resetEiFilters: (state, action: PayloadAction<any>) => {
            state.selectedTimeFrame = action.payload.selectedTimeFrame;
            state.selectedSeverity = action.payload.selectedSeverity;
            state.selectedErrorCodes = action.payload.selectedErrorCodes;
            state.timeRange = {
                from: '01:00',
                fromPeriod: 'AM',
                to: '02:00',
                toPeriod: 'AM'
            };
        }
    }
});

export const {
    setSelectedSeverity,
    setSelectedTimeFrame,
    setSelectedErrorCodes,
    updateTimeRangeField,
    setNoLogAnalyzerData,
    setSelectedDates,
    setErrorInvestigationLoading,
    setErrorInvestigationData,
    resetEiFilters
} = agenticAISlice.actions;

export default agenticAISlice;
