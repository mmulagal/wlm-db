import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DatabaseHostsEntities } from '../../utils/types/databaseHomeTypes';
import { WLF_TABS } from '../../utils/consts';

export const initialDBHomepageState: DatabaseHostsEntities = {
    selectedTab: WLF_TABS.OVERVIEW,
    getJobsSummary: {
        jobsSummaryData: null,
        jobsSummaryLoading: false,
        jobsSummaryError: null
    },
    databaseHostsList: null,
    aggregatedHostsCount: {
        totalDatabases: 0,
        totalHosts: 0,
        totalUpHosts: 0,
        totalInitializingHosts: 0,
        totalDownHosts: 0,
        totalFailedHosts: 0
    },
    aggregatedProtectionDbCount: {
        protectedDb: 0,
        unprotectedDb: 0,
        protectedPercent: 0,
        unprotectedPercent: 0,
        awsBackupDb: 0,
        fsxOntapSnapshotsDb: 0,
        sqlServerBackupDb: 0
    },
    aggregatedStorageSavings: {
        storageConsumes: '0',
        storageSavings: '0',
        storageSavingsPercent: 0
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
        requireBillingPerm: false
    }
};

const databaseHomeSlice = createSlice({
    name: 'databaseHome',
    initialState: initialDBHomepageState,
    reducers: {
        selectedTabSelection: (state, action: PayloadAction<any>) => {
            state.selectedTab = action.payload;
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
        },
        addInitialData: (state, action: PayloadAction<any>) => {
            return { ...state, ...action.payload };
        }
    }
});

export const {
    selectedTabSelection,
    addJobsSummary,
    addDatabaseHostsList,
    addAggregateHostsCountData,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregatedCosts,
    addInitialData
} = databaseHomeSlice.actions;

export default databaseHomeSlice;
