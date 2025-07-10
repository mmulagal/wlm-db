import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { AgenticAIEntities, ErrorInvestigationGetApiResponse, TimeRange } from '../../utils/types/agenticAITypes';
import {
    eiErrorCodesOptions,
    eiSeverityOptionList,
    eiTimeOptions
} from '../../workloadFactory/GetWell/WellArchitectDashboard/ErrorInvestigation/ErrorInvestigationUtility';

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
    selectedInvestigationDate: null,
    investigationDatesLoading: false,
    investigationDates: [],
    errorInvestigation: {
        errorInvestigationData: [],
        errorInvestigationLoading: false
    },
    eiRefreshTimestamp: '',
    eiRefreshPage: false,
    noErrorsDetected: false,
    scanInProgress: false
};

const agenticAISlice = createSlice({
    name: 'agenticAI',
    initialState: initialSandboxState,
    reducers: {
        setSelectedInvestigationDate: (state, action: PayloadAction<any>) => {
            state.selectedInvestigationDate = action.payload;
        },
        setInvestigationDatesLoading: (state, action: PayloadAction<boolean>) => {
            state.investigationDatesLoading = action.payload;
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
        setInvestigationDateData: (
            state,
            action: PayloadAction<Array<{ id: string; reportCreationTime: string }> | []>
        ) => {
            state.investigationDates = action.payload;
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
        },
        setEiRefreshTimestamp: (state, action: PayloadAction<string>) => {
            state.eiRefreshTimestamp = action.payload;
        },
        setEiRefreshPage: (state, action: PayloadAction<boolean>) => {
            state.eiRefreshPage = action.payload;
        },
        resetEiData: (state, action: PayloadAction<any>) => {
            state.selectedInvestigationDate = null;
            state.errorInvestigation.errorInvestigationData = [];
            state.errorInvestigation.errorInvestigationLoading = false;
            state.investigationDatesLoading = false;
            state.investigationDates = [];
            state.selectedSeverity = eiSeverityOptionList?.top5;
            state.selectedTimeFrame = eiTimeOptions?.last24;
            state.selectedErrorCodes = eiErrorCodesOptions?.all;
            state.timeRange = {
                from: '01:00',
                fromPeriod: 'AM',
                to: '02:00',
                toPeriod: 'AM'
            };
            state.noData = false;
            state.noErrorsDetected = false;
        },
        setNoErrorsDetected: (state, action: PayloadAction<boolean>) => {
            state.noErrorsDetected = action.payload;
        },
        setScanInProgress: (state, action: PayloadAction<boolean>) => {
            state.scanInProgress = action.payload;
        }
    }
});

export const {
    setSelectedSeverity,
    setSelectedTimeFrame,
    setSelectedErrorCodes,
    updateTimeRangeField,
    setNoLogAnalyzerData,
    setSelectedInvestigationDate,
    setErrorInvestigationLoading,
    setErrorInvestigationData,
    setInvestigationDateData,
    resetEiFilters,
    setEiRefreshTimestamp,
    setEiRefreshPage,
    resetEiData,
    setNoErrorsDetected,
    setInvestigationDatesLoading,
    setScanInProgress
} = agenticAISlice.actions;

export default agenticAISlice;
