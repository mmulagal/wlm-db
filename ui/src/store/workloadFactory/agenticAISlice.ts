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
    selectedErrorTags: ['Storage', 'Compute', 'Network', 'Security'],
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
    scanInProgress: {},
    logAnalyzerState: '',
    logAnalyzerPreReq: {
        data: null,
        loading: false
    },
    logAnalyzerPricing: {
        data: null,
        loading: false
    },
    agenticRegisterFlowChecks: {
        data: null,
        loading: false
    },
    selectedErrorInvestigationRow: null,
    selectedViewInvestigationRow: null
};

const agenticAISlice = createSlice({
    name: 'agenticAI',
    initialState: initialSandboxState,
    reducers: {
        setSelectedErrorTags: (state, action: PayloadAction<string[]>) => {
            state.selectedErrorTags = action.payload;
        },
        setSelectedViewErrorInvestigationRow: (state, action: PayloadAction<any>) => {
            state.selectedViewInvestigationRow = action.payload;
        },
        setSelectedErrorInvestigationRow: (state, action: PayloadAction<any>) => {
            state.selectedErrorInvestigationRow = action.payload;
        },
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
        setInvestigationDateData: (state, action: PayloadAction<Array<{ id: string; creationTime: string }> | []>) => {
            state.investigationDates = action.payload;
        },
        resetEiFilters: (state, action: PayloadAction<any>) => {
            state.selectedTimeFrame = action.payload.selectedTimeFrame;
            state.selectedSeverity = action.payload.selectedSeverity;
            state.selectedErrorCodes = action.payload.selectedErrorCodes;
            state.selectedErrorTags = action.payload.selectedErrorTags;
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
            state.logAnalyzerPreReq.data = null;
            state.logAnalyzerPricing.data = null;
        },
        setNoErrorsDetected: (state, action: PayloadAction<boolean>) => {
            state.noErrorsDetected = action.payload;
        },
        setScanInProgress: (state, action: PayloadAction<any>) => {
            state.scanInProgress = action.payload;
        },
        setLogAnalyzerState: (state, action: PayloadAction<string>) => {
            state.logAnalyzerState = action.payload;
        },
        setLogAnalyzerPreReqData: (state, action: PayloadAction<any>) => {
            state.logAnalyzerPreReq.data = action.payload;
        },
        setLogAnalyzerPreReqLoading: (state, action: PayloadAction<boolean>) => {
            state.logAnalyzerPreReq.loading = action.payload;
        },
        setLogAnalyzerPricingData: (state, action: PayloadAction<any>) => {
            state.logAnalyzerPricing.data = action.payload;
        },
        setLogAnalyzerPricingLoading: (state, action: PayloadAction<boolean>) => {
            state.logAnalyzerPricing.loading = action.payload;
        },
        setAgenticRegisterFlowData: (state, action: PayloadAction<any>) => {
            state.agenticRegisterFlowChecks.data = action.payload;
        },
        setAgenticRegisterFlowLoading: (state, action: PayloadAction<boolean>) => {
            state.agenticRegisterFlowChecks.loading = action.payload;
        },
        resetAgenticPreCheckData: state => {
            state.agenticRegisterFlowChecks.data = null;
            state.agenticRegisterFlowChecks.loading = false;
        }
    }
});

export const {
    setSelectedErrorTags,
    setSelectedViewErrorInvestigationRow,
    setSelectedErrorInvestigationRow,
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
    setScanInProgress,
    setLogAnalyzerState,
    setLogAnalyzerPreReqData,
    setLogAnalyzerPreReqLoading,
    setLogAnalyzerPricingData,
    setLogAnalyzerPricingLoading,
    setAgenticRegisterFlowData,
    setAgenticRegisterFlowLoading,
    resetAgenticPreCheckData
} = agenticAISlice.actions;

export default agenticAISlice;
