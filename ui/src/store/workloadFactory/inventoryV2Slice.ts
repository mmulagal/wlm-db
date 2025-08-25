import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { InventorySliceData } from '../../utils/types/inventoryV2Types';
import { AUTHENTICATION_TYPE, DBType, WLF_TABS } from '../../utils/consts';
import {
    getInitialInstanceTableColState,
    getInitialHostTableColState,
    getInitialDatabaseTableColState
} from '../../utils/manageColumnUtils';

const initialInventoryV2State: InventorySliceData = {
    breadCrumbSelectedFrom: '',
    inventoryTableData: null,
    inventoryChartData: null,
    isManagedHostListLoading: false,
    getDatabaseHosts: {
        databaseHostsData: null, // To fetch database-hosts API data
        databaseHostsLoading: false, // To check if partial database-hosts api is running
        fullHostDataLoading: false // To check if full database-hosts api is running
    },
    multiMssqlDatabaseHostsData: null,
    getPgSqlDatabaseHosts: {
        databaseHostsData: null,
        databaseHostsLoading: false,
        fullHostDataLoading: false
    },
    getOracleDatabaseHosts: {
        databaseHostsData: null,
        databaseHostsLoading: false,
        fullHostDataLoading: false
    },
    multiPgSqlDatabaseHostsData: null,
    multiOracleDatabaseHostsData: null,
    discoveredHosts: {
        discoveredHostData: null,
        discoverHostLoading: false
    },
    discoveredOracleHosts: {
        discoveredOracleHostData: null,
        discoverOracleHostLoading: false
    },
    discoveredPgsqlHosts: {
        discoveredPgsqlHostData: null,
        discoverPgsqlHostLoading: false
    },
    fsxCredentialStatusObj: {}, // For MSSQL
    fsxCredentialStatusObjOracle: {}, // For Oracle
    fsxCredentialStatusObjPgsql: {}, // For PostgreSQL
    fsxCredentialStatusLoading: false,
    fsxCredentialStatusLoadingOracle: false,
    fsxCredentialStatusLoadingPgsql: false,
    mssqlInstancesData: null,
    pgsqlInstancesData: null,
    oracleInstancesData: null,
    perfMssqlInstancesData: null,
    inProgressInstances: new Set(),
    detectManageUserName: '',
    detectManagePassword: '',
    detectOntapUsername: '',
    detectOntapPassword: '',
    detectWindowsAuthentication: {
        username: '',
        password: ''
    },
    detectAsmAuthentication: {
        username: '',
        password: ''
    },
    resetManagedData: false,
    removeSecNodeDiscoveredList: [],
    unManagedPerfInstanceIdsList: [],
    managedHostInstanceLoading: false,
    selectedHeaderTab: WLF_TABS.DASHBOARD,
    isRefreshed: false,
    optimizeFilterTags: [],
    defaultFilterOptions: {},
    managedAssessmentHostIdsList: [],
    allmssqlHostAssessmentData: [],
    allmssqlHostAssessmentLoading: false,
    allLogAnalysisData: [],
    allLogAnalysisLoading: false,
    potentialSavingsHostData: {},
    selectedInventoryTab: 'Instances',
    selectedOptimizeConfig: {
        type: '',
        data: {}
    },
    selectedFilterValue: {
        flag: false,
        value: '',
        filterType: ''
    },
    tableManageColumnState: {
        instanceTable: getInitialInstanceTableColState(DBType.MSSQL),
        hostTable: getInitialHostTableColState(DBType.MSSQL),
        databaseTable: getInitialDatabaseTableColState(DBType.MSSQL)
    },
    selectedHostType: 'Microsoft SQL Server',
    hostTableRows: [],
    instanceTableRows: [],
    databaseTableRows: [],
    fullHostTableRows: [],
    fullInstanceTableRows: [],
    fullDatabaseTableRows: [],
    dashSandboxList: {
        data: [],
        loading: false,
        error: ''
    },
    dashSandboxSavings: {
        data: [],
        loading: false,
        error: ''
    },
    createResourceApiLoading: false,
    authenticationType: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
    manageInstanceInstallAction: {
        installMissingAWS: false,
        installMissingPowershell: false,
        installMissingJQ: false,
        installMissingPython: false
    },
    manageSingleInstanceReadiness: null,
    manageSingleInstanceChecks: null,
    manageSingleInstanceData: null,
    wizardOperationType: '',
    selectedMultiDetectInstances: [],
    bulkDetectedInstanceList: [],
    landingFromWizard: false
};

const inventoryV2Slice = createSlice({
    name: 'inventoryV2',
    initialState: initialInventoryV2State,
    reducers: {
        setLandingFromWizard: (state, action: PayloadAction<any>) => {
            state.landingFromWizard = action.payload;
        },
        setSelectedMultiDetectInstances: (state, action: PayloadAction<any>) => {
            state.selectedMultiDetectInstances = action.payload;
        },
        setBulkDetectedInstanceList: (state, action: PayloadAction<any>) => {
            state.bulkDetectedInstanceList = action.payload;
        },
        setInstallType: (state, action: PayloadAction<Partial<typeof state.manageInstanceInstallAction>>) => {
            state.manageInstanceInstallAction = {
                ...state.manageInstanceInstallAction,
                ...action.payload
            };
        },
        setWizardOperationType: (state, action: PayloadAction<any>) => {
            state.wizardOperationType = action.payload;
        },
        setAuthenticationType: (state, action: PayloadAction<any>) => {
            state.authenticationType = action.payload;
        },
        setTableManageColumnState: (state, action: PayloadAction<any>) => {
            state.tableManageColumnState = action.payload;
        },
        setSelectedFilterValue: (state, action: PayloadAction<any>) => {
            state.selectedFilterValue = action.payload;
        },
        setSelectedInventoryTab: (state, action: PayloadAction<any>) => {
            state.selectedInventoryTab = action.payload;
        },
        setBreadCrumbSelectedFrom: (state, action: PayloadAction<any>) => {
            state.breadCrumbSelectedFrom = action.payload;
        },
        setDefaultFilterOptions: (state, action: PayloadAction<any>) => {
            state.defaultFilterOptions = action.payload;
        },
        setOptimizeFilterTags: (state, action: PayloadAction<any>) => {
            state.optimizeFilterTags = action.payload;
        },
        setInventoryTableData: (state, action: PayloadAction<any>) => {
            state.inventoryTableData = action.payload;
        },
        setInventoryChartData: (state, action: PayloadAction<any>) => {
            state.inventoryChartData = action.payload;
        },
        setIsManagedHostListLoading: (state, action: PayloadAction<any>) => {
            state.isManagedHostListLoading = action.payload;
        },
        setIsDatabaseHostsLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.databaseHostsLoading = action.payload;
        },
        setIsPgSqlDatabaseHostsLoading: (state, action: PayloadAction<any>) => {
            state.getPgSqlDatabaseHosts.databaseHostsLoading = action.payload;
        },
        setIsOracleDatabaseHostsLoading: (state, action: PayloadAction<any>) => {
            state.getOracleDatabaseHosts.databaseHostsLoading = action.payload;
        },
        setIsFullHostDataLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.fullHostDataLoading = action.payload;
        },
        setIsFullPgSqlHostDataLoading: (state, action: PayloadAction<any>) => {
            state.getPgSqlDatabaseHosts.fullHostDataLoading = action.payload;
        },
        setIsFullOracleHostDataLoading: (state, action: PayloadAction<any>) => {
            state.getOracleDatabaseHosts.fullHostDataLoading = action.payload;
        },
        addDatabaseHostsDataV2: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.databaseHostsData = action.payload;
        },
        addPgSqlDatabaseHostsData: (state, action: PayloadAction<any>) => {
            state.getPgSqlDatabaseHosts.databaseHostsData = action.payload;
        },
        addOracleDatabaseHostsData: (state, action: PayloadAction<any>) => {
            state.getOracleDatabaseHosts.databaseHostsData = action.payload;
        },
        addMultiMssqlDatabaseHostsDataV2: (state, action: PayloadAction<any>) => {
            state.multiMssqlDatabaseHostsData = action.payload;
        },
        addMultiPgSqlDatabaseHostsData: (state, action: PayloadAction<any>) => {
            state.multiPgSqlDatabaseHostsData = action.payload;
        },
        addMultiOracleDatabaseHostsData: (state, action: PayloadAction<any>) => {
            state.multiOracleDatabaseHostsData = action.payload;
        },
        setIsDiscoveredHostData: (state, action: PayloadAction<any>) => {
            state.discoveredHosts.discoveredHostData = action.payload;
        },
        setIsDiscoverHostLoading: (state, action: PayloadAction<any>) => {
            state.discoveredHosts.discoverHostLoading = action.payload;
        },
        setIsDiscoveredOracleHostData: (state, action: PayloadAction<any>) => {
            state.discoveredOracleHosts.discoveredOracleHostData = action.payload;
        },
        setIsDiscoverOracleHostLoading: (state, action: PayloadAction<any>) => {
            state.discoveredOracleHosts.discoverOracleHostLoading = action.payload;
        },
        setIsDiscoveredPgsqlHostData: (state, action: PayloadAction<any>) => {
            state.discoveredPgsqlHosts.discoveredPgsqlHostData = action.payload;
        },
        setIsDiscoverPgsqlHostLoading: (state, action: PayloadAction<any>) => {
            state.discoveredPgsqlHosts.discoverPgsqlHostLoading = action.payload;
        },
        setFsxCredentialStatus: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusObj = action.payload;
        },
        setFsxCredentialStatusOracle: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusObjOracle = action.payload;
        },
        setFsxCredentialStatusPgsql: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusObjPgsql = action.payload;
        },
        setFsxCredentialStatusLoading: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusLoading = action.payload;
        },
        setFsxCredentialStatusLoadingOracle: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusLoadingOracle = action.payload;
        },
        setFsxCredentialStatusLoadingPgsql: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusLoadingPgsql = action.payload;
        },
        setMssqlInstancesData: (state, action: PayloadAction<any>) => {
            state.mssqlInstancesData = action.payload;
        },
        setPgsqlInstancesData: (state, action: PayloadAction<any>) => {
            state.pgsqlInstancesData = action.payload;
        },
        setOracleInstancesData: (state, action: PayloadAction<any>) => {
            state.oracleInstancesData = action.payload;
        },
        setPerfMssqlInstancesData: (state, action: PayloadAction<any>) => {
            state.perfMssqlInstancesData = action.payload;
        },
        setInProgressInstances: (state, action: PayloadAction<any>) => {
            state.inProgressInstances = action.payload;
        },
        setDetectManageUserName: (state, action: PayloadAction<any>) => {
            state.detectManageUserName = action.payload;
        },
        setDetectManagePassword: (state, action: PayloadAction<any>) => {
            state.detectManagePassword = action.payload;
        },
        setDetectONTAPUserName: (state, action: PayloadAction<any>) => {
            state.detectOntapUsername = action.payload;
        },
        setDetectONTAPPassword: (state, action: PayloadAction<any>) => {
            state.detectOntapPassword = action.payload;
        },
        setDetectWindowsAuthentication: (
            state,
            action: PayloadAction<Partial<typeof state.detectWindowsAuthentication>>
        ) => {
            state.detectWindowsAuthentication = {
                ...state.detectWindowsAuthentication,
                ...action.payload
            };
        },
        setDetectAsmAuthentication: (state, action: PayloadAction<Partial<typeof state.detectAsmAuthentication>>) => {
            state.detectAsmAuthentication = {
                ...state.detectAsmAuthentication,
                ...action.payload
            };
        },
        setResetManagedData: (state, action: PayloadAction<any>) => {
            state.resetManagedData = action.payload;
        },
        setRemoveSecNodeDiscoveredList: (state, action: PayloadAction<any>) => {
            state.removeSecNodeDiscoveredList = action.payload;
        },
        setUnManagedPerfInstanceIdsList: (state, action: PayloadAction<any>) => {
            state.unManagedPerfInstanceIdsList = action.payload;
        },
        setManagedHostInstanceLoading: (state, action: PayloadAction<any>) => {
            state.managedHostInstanceLoading = action.payload;
        },
        setSelectedHeaderTab: (state, action: PayloadAction<any>) => {
            state.selectedHeaderTab = action.payload;
        },
        setIsRefreshed: (state, action: PayloadAction<any>) => {
            state.isRefreshed = action.payload;
        },
        setManagedAssessmentHostIdsList: (state, action: PayloadAction<any>) => {
            state.managedAssessmentHostIdsList = action.payload;
        },
        addAllMssqlHostAssessmentData: (state, action: PayloadAction<any>) => {
            state.allmssqlHostAssessmentData = action.payload;
        },
        setAllMssqlHostAssessmentLoading: (state, action: PayloadAction<any>) => {
            state.allmssqlHostAssessmentLoading = action.payload;
        },
        addAllLogAnalysisData: (state, action: PayloadAction<any>) => {
            state.allLogAnalysisData = action.payload;
        },
        setAllLogAnalysisLoading: (state, action: PayloadAction<any>) => {
            state.allLogAnalysisLoading = action.payload;
        },
        setPotentialSavingsHostData: (state, action: PayloadAction<any>) => {
            state.potentialSavingsHostData = action.payload;
        },
        setSelectedOptimizeConfig: (state, action: PayloadAction<any>) => {
            state.selectedOptimizeConfig = action.payload;
        },
        setHostTableRows: (state, action: PayloadAction<any>) => {
            state.hostTableRows = action.payload;
        },
        setInstanceTableRows: (state, action: PayloadAction<any>) => {
            state.instanceTableRows = action.payload;
        },
        setDatabaseTableRows: (state, action: PayloadAction<any>) => {
            state.databaseTableRows = action.payload;
        },
        setInventoryTablesRows: (state, action: PayloadAction<any>) => {
            state.hostTableRows = action.payload?.hosts;
            state.instanceTableRows = action.payload?.instances;
            state.databaseTableRows = action.payload?.databases;
        },
        setSelectedHostType: (state, action: PayloadAction<string>) => {
            state.selectedHostType = action.payload;
            // Update columns for new engine type
            state.tableManageColumnState = {
                ...state.tableManageColumnState,
                instanceTable: getInitialInstanceTableColState(action.payload),
                hostTable: getInitialHostTableColState(action.payload),
                databaseTable: getInitialDatabaseTableColState(action.payload)
            };
        },
        setFullInventoryTablesRows: (state, action: PayloadAction<any>) => {
            state.fullHostTableRows = action.payload?.hosts;
            state.fullInstanceTableRows = action.payload?.instances;
            state.fullDatabaseTableRows = action.payload?.databases;
        },
        setDashSandboxListData: (state, action: PayloadAction<any>) => {
            state.dashSandboxList.data = action.payload;
        },
        setDashSandboxListLoading: (state, action: PayloadAction<any>) => {
            state.dashSandboxList.loading = action.payload;
        },
        setDashSandboxList: (state, action: PayloadAction<any>) => {
            state.dashSandboxList.data = action.payload.data;
            state.dashSandboxList.loading = action.payload.loading;
        },
        setDashSandboxSavingsData: (state, action: PayloadAction<any>) => {
            state.dashSandboxSavings.data = action.payload;
        },
        setDashSandboxSavingsLoading: (state, action: PayloadAction<any>) => {
            state.dashSandboxSavings.loading = action.payload;
        },
        setDashSandboxSavings: (state, action: PayloadAction<any>) => {
            state.dashSandboxSavings.data = action.payload.data;
            state.dashSandboxSavings.loading = action.payload.loading;
        },
        setCreateResourceApiLoading: (state, action: PayloadAction<any>) => {
            state.createResourceApiLoading = action.payload;
        },
        setManageSingleInstanceReadiness: (state, action: PayloadAction<any>) => {
            state.manageSingleInstanceReadiness = action.payload;
        },
        setManageSingleInstanceChecks: (state, action: PayloadAction<any>) => {
            state.manageSingleInstanceChecks = action.payload;
        },
        setManageSingleInstanceData: (state, action: PayloadAction<any>) => {
            state.manageSingleInstanceData = action.payload;
        },
        resetPerComboData: (state, action: PayloadAction<any>) => {
            state.createResourceApiLoading = true;
            state.resetManagedData = true;
            state.isManagedHostListLoading = true;
            state.getDatabaseHosts.databaseHostsLoading = true;
            state.getPgSqlDatabaseHosts.databaseHostsLoading = true;
            state.getOracleDatabaseHosts.databaseHostsLoading = true;
            state.getDatabaseHosts.fullHostDataLoading = true;
            state.getPgSqlDatabaseHosts.fullHostDataLoading = true;
            state.getOracleDatabaseHosts.fullHostDataLoading = true;
            state.allmssqlHostAssessmentLoading = true;
            state.allLogAnalysisLoading = true;
            state.getDatabaseHosts.databaseHostsData = null;
            state.getPgSqlDatabaseHosts.databaseHostsData = null;
            state.discoveredHosts.discoveredHostData = null;
            state.discoveredHosts.discoverHostLoading = true;
            state.discoveredOracleHosts.discoveredOracleHostData = null;
            state.discoveredOracleHosts.discoverOracleHostLoading = true;
            state.discoveredPgsqlHosts.discoveredPgsqlHostData = null;
            state.discoveredPgsqlHosts.discoverPgsqlHostLoading = true;
            state.dashSandboxList.loading = true;
            state.dashSandboxSavings.loading = true;
            state.inventoryChartData = null;
            state.removeSecNodeDiscoveredList = [];
            state.managedAssessmentHostIdsList = [];
        },
        resetRefreshData: (state, action: PayloadAction<any>) => {
            state.inventoryTableData = null;
            state.fsxCredentialStatusObj = {};
            state.allmssqlHostAssessmentData = [];
            state.allLogAnalysisData = [];
            state.dashSandboxList.data = [];
            state.dashSandboxSavings.data = [];
            state.hostTableRows = [];
            state.instanceTableRows = [];
            state.databaseTableRows = [];
            state.multiMssqlDatabaseHostsData = null;
            state.multiPgSqlDatabaseHostsData = null;
            state.potentialSavingsHostData = {};

            state.mssqlInstancesData = null;
            state.pgsqlInstancesData = null;
            state.oracleInstancesData = null;
            state.perfMssqlInstancesData = {};
            state.unManagedPerfInstanceIdsList = [];
        },
        resetInventoryLoading: state => {
            state.createResourceApiLoading = false;
            state.resetManagedData = false;
            state.isManagedHostListLoading = false;
            state.getDatabaseHosts.databaseHostsLoading = false;
            state.getPgSqlDatabaseHosts.databaseHostsLoading = false;
            state.getOracleDatabaseHosts.databaseHostsLoading = false;
            state.getDatabaseHosts.fullHostDataLoading = false;
            state.getPgSqlDatabaseHosts.fullHostDataLoading = false;
            state.getOracleDatabaseHosts.fullHostDataLoading = false;
            state.allmssqlHostAssessmentLoading = false;
            state.allLogAnalysisLoading = false;
            state.discoveredHosts.discoverHostLoading = false;
            state.discoveredOracleHosts.discoverOracleHostLoading = false;
            state.discoveredPgsqlHosts.discoverPgsqlHostLoading = false;
            state.dashSandboxList.loading = false;
            state.dashSandboxSavings.loading = false;
        },
        resetManagedInventoryData: state => {
            state.getDatabaseHosts.databaseHostsLoading = false;
            state.getPgSqlDatabaseHosts.databaseHostsLoading = false;
            state.getOracleDatabaseHosts.databaseHostsLoading = false;
            state.getDatabaseHosts.fullHostDataLoading = false;
            state.getPgSqlDatabaseHosts.fullHostDataLoading = false;
            state.getOracleDatabaseHosts.fullHostDataLoading = false;
            state.allmssqlHostAssessmentLoading = false;
            state.allLogAnalysisLoading = false;
            state.dashSandboxList.loading = false;
            state.dashSandboxSavings.loading = false;
        }
    }
});

export const {
    setLandingFromWizard,
    setSelectedMultiDetectInstances,
    setWizardOperationType,
    setInstallType,
    setAuthenticationType,
    setSelectedFilterValue,
    setSelectedInventoryTab,
    setSelectedOptimizeConfig,
    setDefaultFilterOptions,
    setOptimizeFilterTags,
    setInventoryTableData,
    setInventoryChartData,
    setIsManagedHostListLoading,
    setIsDatabaseHostsLoading,
    setIsPgSqlDatabaseHostsLoading,
    setIsOracleDatabaseHostsLoading,
    setIsFullHostDataLoading,
    setIsFullPgSqlHostDataLoading,
    setIsFullOracleHostDataLoading,
    addDatabaseHostsDataV2,
    addPgSqlDatabaseHostsData,
    addOracleDatabaseHostsData,
    setIsDiscoveredHostData,
    setIsDiscoverHostLoading,
    setIsDiscoveredOracleHostData,
    setIsDiscoverOracleHostLoading,
    setIsDiscoveredPgsqlHostData,
    setIsDiscoverPgsqlHostLoading,
    setFsxCredentialStatus,
    setFsxCredentialStatusOracle,
    setFsxCredentialStatusPgsql,
    setFsxCredentialStatusLoading,
    setFsxCredentialStatusLoadingOracle,
    setFsxCredentialStatusLoadingPgsql,
    setMssqlInstancesData,
    setPgsqlInstancesData,
    setOracleInstancesData,
    setDetectWindowsAuthentication,
    setDetectAsmAuthentication,
    setPerfMssqlInstancesData,
    setInProgressInstances,
    setDetectManageUserName,
    setDetectManagePassword,
    setDetectONTAPUserName,
    setDetectONTAPPassword,
    setResetManagedData,
    setRemoveSecNodeDiscoveredList,
    setUnManagedPerfInstanceIdsList,
    setManagedHostInstanceLoading,
    setSelectedHeaderTab,
    setIsRefreshed,
    setBreadCrumbSelectedFrom,
    setManagedAssessmentHostIdsList,
    addAllMssqlHostAssessmentData,
    setAllMssqlHostAssessmentLoading,
    addAllLogAnalysisData,
    setAllLogAnalysisLoading,
    setPotentialSavingsHostData,
    resetPerComboData,
    setTableManageColumnState,
    setHostTableRows,
    setInstanceTableRows,
    setDatabaseTableRows,
    setInventoryTablesRows,
    setSelectedHostType,
    setFullInventoryTablesRows,
    setDashSandboxListData,
    setDashSandboxListLoading,
    setDashSandboxSavingsData,
    setDashSandboxSavingsLoading,
    resetRefreshData,
    addMultiMssqlDatabaseHostsDataV2,
    addMultiPgSqlDatabaseHostsData,
    addMultiOracleDatabaseHostsData,
    setDashSandboxList,
    setDashSandboxSavings,
    setCreateResourceApiLoading,
    resetInventoryLoading,
    resetManagedInventoryData,
    setManageSingleInstanceChecks,
    setManageSingleInstanceReadiness,
    setManageSingleInstanceData,
    setBulkDetectedInstanceList
} = inventoryV2Slice.actions;

export default inventoryV2Slice;
