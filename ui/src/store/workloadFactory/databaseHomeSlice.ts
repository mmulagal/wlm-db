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
    aggregatedHostsCount: {
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
        awsBackupPercent: 0,
        fsxOntapSnapshotsDb: 0,
        fsxOntapSnapshotsPercent: 0,
        sqlServerBackupDb: 0,
        sqlServerBackupPercent: 0,
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
        }
    }
});

export const {
    addDatabaseHosts,
    addDatabaseJobs,
    addJobsSummary,
    addDatabaseHostsList,
    addAggregateHostsCountData,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregatedCosts
} = databaseHomeSlice.actions;

export default databaseHomeSlice;
