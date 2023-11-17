import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DatabaseHostsEntities } from "../../utils/types/databaseHomeTypes";

export const initialDBHomepageState: DatabaseHostsEntities = {
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
    getStatus: {
        statusData: null,
        statusLoading: false,
        statusError: null
    },
    databaseHostsList: null,
    aggregatedHostsCount: {
        totalDatabases: 0,
        totalHosts: 0,
        totalUpHosts: 0,
        totalInitializingHosts: 0,
        totalDownHosts: 0,
        totalFailedHosts: 0,
    },
    aggregatedProtectionDbCount: {
        protectedDb: 0,
        unprotectedDb: 0,
        protectedPercent: 0,
        unprotectedPercent: 0,
        awsBackupDb: 0,
        fsxOntapSnapshotsDb: 0,
        sqlServerBackupDb: 0,
    },
    aggregatedStorageSavings: {
        storageConsumes: '0',
        storageSavings: '0',
        storageSavingsPercent: 0,
    },
    aggregatedCosts: {
        storageCost: 0,
        computeCost: 0,
        connectivityCost: 0,
        otherCost: 0,
        totalCost: 0,
        storageCostPercent: 0,
        computeCostPercent: 0,
        connectivityCostPercent: 0,
        otherCostPercent: 0,
    }
};

const databaseHomeSlice = createSlice({
    name: 'databaseHome',
    initialState: initialDBHomepageState,
    reducers: {
        addDatabaseHosts: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts = action.payload;
        },
        addDatabaseHostsLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.databaseHostsLoading = action.payload;
        },
        addDatabaseJobs: (state, action: PayloadAction<any>) => {
            state.getDatabaseJobs = action.payload;
        },
        addDatabaseJobsLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseJobs.databaseJobsLoading = action.payload;
        },
        addJobsSummary: (state, action: PayloadAction<any>) => {
            state.getJobsSummary = action.payload;
        },
        addJobsSummaryLoading: (state, action: PayloadAction<any>) => {
            state.getJobsSummary.jobsSummaryLoading = action.payload;
        },
        addStatus: (state, action: PayloadAction<any>) => {
            state.getStatus = action.payload;
        },
        addStatusLoading: (state, action: PayloadAction<any>) => {
            state.getStatus.statusLoading = action.payload;
        },
        addDatabaseHostsList: (state, action: PayloadAction<any>) => {
            state.databaseHostsList = action.payload;
        },
        addAggregateHostsCountData: (state, action: PayloadAction<any>) => {
            state.aggregatedHostsCount = action.payload;
        },
        addAggregatedProtectionDbCount: (state, action: PayloadAction<any>) => {
            state.aggregatedProtectionDbCount = action.payload;
        },
        addAggregatedStorageSavings: (state, action: PayloadAction<any>) => {
            state.aggregatedStorageSavings = action.payload;
        },
        addAggregatedCosts: (state, action: PayloadAction<any>) => {
            state.aggregatedCosts = action.payload;
        },
        addInitialData: (state, action: PayloadAction<any>) => {
            return { ...state, ...action.payload };
        }
    }
});

export const {
    addDatabaseHosts,
    addDatabaseHostsLoading,
    addDatabaseJobs,
    addDatabaseJobsLoading,
    addJobsSummary,
    addJobsSummaryLoading,
    addStatus,
    addStatusLoading,
    addDatabaseHostsList,
    addAggregateHostsCountData,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregatedCosts, 
    addInitialData
} = databaseHomeSlice.actions;

export default databaseHomeSlice;
