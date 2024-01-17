import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export const initialJobMonitoringState: any = {
    jobsList: [], // Jobs list exclusing subtasks
    jobsListLoading: false, // Loading check for jobsList
    timeInterval: 1, // last 1/7/14/30 days data
    fromTime: null, // start date and time
    toTime: null, // End date and time
    downloadJobsLoading: false, // Laoding check for job monitoring download
    downloadJobsList: [], // Jobs list including subtasks data
    jmJobsSummary: {}, // Job distribution count data
    jmJobsSummaryLoading: false // Job summary API loading for job distribution
}

const jobMonitoringSlice = createSlice({
    name: 'jobMonitoring',
    initialState: initialJobMonitoringState,
    reducers: {
        setJobsListLoading: (state, action: PayloadAction<any>) => {
            state.jobsListLoading = action.payload;
        },
        setJobsList: (state, action: PayloadAction<any>) => {
            state.jobsList = action.payload;
        },
        setTimeInterval: (state, action: PayloadAction<any>) => {
            state.timeInterval = action.payload;
        },
        setFromTime: (state, action: PayloadAction<any>) => {
            state.fromTime = action.payload;
        },
        setToTime: (state, action: PayloadAction<any>) => {
            state.toTime = action.payload;
        },
        setDownloadJobsLoading: (state, action: PayloadAction<any>) => {
            state.downloadJobsLoading = action.payload;
        },
        setDownloadJobsList: (state, action: PayloadAction<any>) => {
            state.downloadJobsList = action.payload;
        },
        setJmJobsSummaryLoading: (state, action: PayloadAction<any>) => {
            state.jmJobsSummaryLoading = action.payload;
        },
        setJmJobsSummary: (state, action: PayloadAction<any>) => {
            state.jmJobsSummary = action.payload;
        },
        addInitialJMData: (state, action: PayloadAction<any>) => {
            return { ...state, ...action.payload };
        }
    }
});

export const {
    setJobsList,
    setJobsListLoading,
    setTimeInterval,
    setFromTime,
    setToTime,
    setDownloadJobsLoading,
    setDownloadJobsList,
    setJmJobsSummaryLoading,
    setJmJobsSummary,
    addInitialJMData
} = jobMonitoringSlice.actions;

export default jobMonitoringSlice;
