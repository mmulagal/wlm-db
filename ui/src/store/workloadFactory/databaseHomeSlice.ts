import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DatabaseHostsEntities } from '../../utils/types/databaseHomeTypes';
import { WLF_TABS } from '../../utils/consts';

export const initialDBHomepageState: DatabaseHostsEntities = {
    selectedTab: WLF_TABS.OVERVIEW,
    aggregatedHostsCount: {
        totalDatabases: 0,
        totalHosts: 0,
        totalUpHosts: 0,
        totalInitializingHosts: 0,
        totalDownHosts: 0,
        totalFailedHosts: 0,
        totalInstances: 0,
        managedDatabases: 0,
        managedInstances: 0
    },
    aggregatedPgSqlHostsCount: {
        totalDatabases: 0,
        totalHosts: 0,
        totalUpHosts: 0,
        totalInitializingHosts: 0,
        totalDownHosts: 0,
        totalFailedHosts: 0,
        totalInstances: 0,
        managedDatabases: 0,
        managedInstances: 0
    },
    aggregatedOracleHostsCount: {
        totalDatabases: 0,
        totalHosts: 0,
        totalUpHosts: 0,
        totalInitializingHosts: 0,
        totalDownHosts: 0,
        totalFailedHosts: 0,
        totalInstances: 0,
        managedDatabases: 0,
        managedInstances: 0
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
    aggregatedPgsqlStorageSavings: {
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
    },
    selectedConfig: '',
    selectedConfigSummary: {
        optimizationScore: '',
        optimizedInstances: 0,
        notOptimizedInstances: 0,
        severity: '',
        configState: '',
        totalInstances: 0,
        tooltipText: '',
        dismissedInstances: 0
    },
    selectedAssessmentRow: null,
    sandboxAgeRange: {
        from: '',
        range: ''
    },
    selectedRowsForOptimize: [],
    selectedRowsForDismiss: [],
    selectedRowsForOptimizeInnerPage: [],
    enableFilter: true,
    potentialSavingsValues: {
        loading: false,
        ebsCost: 0,
        fsxwCost: 0,
        fsxnCost: 0,
        fsxnCostForEbsHost: 0,
        fsxnCostForFsxwHost: 0,
        savings: 0,
        savingsPercent: 0,
        noSavings: false
    },
    dismissPageLanding: ''
};

const databaseHomeSlice = createSlice({
    name: 'databaseHome',
    initialState: initialDBHomepageState,
    reducers: {
        setDismissPageLanding: (state, action: PayloadAction<any>) => {
            state.dismissPageLanding = action.payload;
        },
        setSelectedRowsForOptimizeInnerPage: (state, action: PayloadAction<any>) => {
            state.selectedRowsForOptimizeInnerPage = action.payload;
        },
        setSelectedRowsForDismiss: (state, action: PayloadAction<any>) => {
            state.selectedRowsForDismiss = action.payload;
        },
        setEnableFilter: (state, action: PayloadAction<any>) => {
            state.enableFilter = action.payload;
        },
        setSelectedRowsForOptimize: (state, action: PayloadAction<any>) => {
            state.selectedRowsForOptimize = action.payload;
        },
        setSelectedConfig: (state, action: PayloadAction<any>) => {
            state.selectedConfig = action.payload;
        },
        setSelectedConfigSummary: (state, action: PayloadAction<any>) => {
            state.selectedConfigSummary = action.payload;
        },
        selectedTabSelection: (state, action: PayloadAction<any>) => {
            state.selectedTab = action.payload;
        },
        addAggregateHostsCountData: (state, action: PayloadAction<any>) => {
            state.aggregatedHostsCount = action.payload;
        },
        addAggregatePgSqlHostsCountData: (state, action: PayloadAction<any>) => {
            state.aggregatedPgSqlHostsCount = action.payload;
        },
        addAggregatedOracleHostsCount: (state, action: PayloadAction<any>) => {
            state.aggregatedOracleHostsCount = action.payload;
        },
        addAggregatedProtectionDbCount: (state, action: PayloadAction<any>) => {
            state.aggregatedProtectionDbCount = action.payload;
        },
        addAggregatedStorageSavings: (state, action: PayloadAction<any>) => {
            state.aggregatedStorageSavings = action.payload;
        },
        addAggregatedPgsqlStorageSavings: (state, action: PayloadAction<any>) => {
            state.aggregatedPgsqlStorageSavings = action.payload;
        },
        addAggregatedCosts: (state, action: PayloadAction<any>) => {
            state.aggregatedCosts = action.payload;
        },
        addInitialData: (state, action: PayloadAction<any>) => ({ ...state, ...action.payload }),
        setSelectedAssessmentRow: (state, action: PayloadAction<any>) => {
            state.selectedAssessmentRow = action.payload;
        },
        setSandboxAgeRange: (state, action: PayloadAction<any>) => {
            state.sandboxAgeRange = action.payload;
        },
        setPotentialSavingsValues: (state, action: PayloadAction<any>) => {
            state.potentialSavingsValues = action.payload;
        }
    }
});

export const {
    setDismissPageLanding,
    setSelectedRowsForOptimizeInnerPage,
    setEnableFilter,
    setSelectedRowsForOptimize,
    selectedTabSelection,
    addAggregateHostsCountData,
    addAggregatePgSqlHostsCountData,
    addAggregatedOracleHostsCount,
    addAggregatedProtectionDbCount,
    addAggregatedStorageSavings,
    addAggregatedPgsqlStorageSavings,
    addAggregatedCosts,
    addInitialData,
    setSelectedConfig,
    setSelectedAssessmentRow,
    setSandboxAgeRange,
    setSelectedConfigSummary,
    setPotentialSavingsValues,
    setSelectedRowsForDismiss
} = databaseHomeSlice.actions;

export default databaseHomeSlice;
