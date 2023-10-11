import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DatabaseHostsEntities } from "../../utils/types/databaseHomeTypes";

const initialState: DatabaseHostsEntities = {
    getDatabaseHosts: {
        databaseHostsData: null,
        databaseHostsLoading: false,
        databaseHostsError: null
    },
    getDatabaseJobs: {
        databaseJobsData: null,
        databaseJobsLoading: false,
        databaseJobsError: null
    },
    getJobsSummary: {
        jobsSummaryData: null,
        jobsSummaryLoading: false,
        jobsSummaryError: null
    },
    databaseHostsList: null,
};

const databaseHomeSlice = createSlice({
    name: 'databaseHome',
    initialState,
    reducers: {
        addDatabaseHosts: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts = action.payload;
        },
        addDatabaseJobs: (state, action: PayloadAction<any>) => {
            state.getDatabaseJobs = action.payload;
        },
        addJobsSummary: (state, action: PayloadAction<any>) => {
            state.getJobsSummary = action.payload;
        },
        addDatabaseHostsList: (state, action: PayloadAction<any>) => {
            state.databaseHostsList = action.payload;
        },
    }
});

export const {
    addDatabaseHosts,
    addDatabaseJobs,
    addJobsSummary,
    addDatabaseHostsList
} = databaseHomeSlice.actions;

export default databaseHomeSlice;
