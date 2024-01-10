import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export const initialJobMonitoringState: any = {
    jobsList: [],
    jobsListLoading: false,
    timeInterval: 1, // last 1/7/14/30 days data
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
        addInitialJMData: (state, action: PayloadAction<any>) => {
            return { ...state, ...action.payload };
        }
    }
});

export const {
    setJobsList,
    setJobsListLoading,
    setTimeInterval,
    addInitialJMData
} = jobMonitoringSlice.actions;

export default jobMonitoringSlice;
