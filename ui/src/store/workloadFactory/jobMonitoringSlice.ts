import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export const initialJobMonitoringState: any = {
    jobsList: [],
    jobsListLoading: false,
    timeInterval: 1, // last 1/7/14/30 days data
    downloadJobsLoading: null,
    downloadJobsList: [],
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
        setDownloadJobsLoading: (state, action: PayloadAction<any>) => {
            state.downloadJobsLoading = action.payload;
        },
        setDownloadJobsList: (state, action: PayloadAction<any>) => {
            state.downloadJobsList = action.payload;
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
    setDownloadJobsLoading,
    setDownloadJobsList,
    addInitialJMData
} = jobMonitoringSlice.actions;

export default jobMonitoringSlice;
