import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import {
    FsxAuthStatus,
    FsxAuthStatusMap,
    InstanceAuthStatus,
    InstanceAuthStatusMap,
    InventorySliceData
} from '../../utils/types/inventoryV2Types';
import {
    AUTHENTICATION_TYPE,
    CREDENTIAL_OPTIONS,
    DBType,
    FSX_FOR_ONTAP_CRED_OPTION,
    WLF_TABS,
    PREPARE_PAGE_TABS
} from '../../utils/consts';
import {
    getInitialInstanceTableColState,
    getInitialHostTableColState,
    getInitialDatabaseTableColState
} from '../../utils/manageColumnUtils';

const initialInventoryV2State: InventorySliceData = {
    selectedPreparePageTab: PREPARE_PAGE_TABS.PREREQUISITE_CHECK,
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
    detectSsmParameterArn: '',
    detectOntapUsername: '',
    detectOntapPassword: '',
    detectOntapSsmParameterArn: '',
    detectOntapCredentialsByFsx: {} as Record<string, { username: string; password: string; ssmParameterArn?: string }>,
    fsxAuthStatus: {} as FsxAuthStatusMap,
    instanceAuthStatus: {} as InstanceAuthStatusMap,
    instanceAuthErrors: {} as Record<string, string>,
    detectWindowsAuthentication: {
        username: '',
        password: ''
    },
    detectCredentialErrors: {
        databaseServerError: '',
        fsxnError: '',
        oracleAsmError: ''
    },
    resetManagedData: false,
    removeSecNodeDiscoveredList: [],
    unManagedPerfInstanceIdsList: [],
    unManagedInstanceIdsList: [],
    managedHostInstanceLoading: false,
    selectedHeaderTab: WLF_TABS.DASHBOARD,
    isRefreshed: false,
    optimizeFilterTags: [],
    defaultFilterOptions: {},
    managedAssessmentHostIdsList: [],
    allmssqlHostAssessmentData: [],
    allOracleHostAssessmentData: [],
    allmssqlHostAssessmentLoading: false,
    allOracleHostAssessmentLoading: false,
    allLogAnalysisData: [],
    allLogAnalysisLoading: false,
    allLogAnalysisOracleLoading: false,
    offlineMssqlHostAssessmentData: [],
    offlineMssqlHostAssessmentLoading: false,
    offlineOracleHostAssessmentData: [],
    offlineOracleHostAssessmentLoading: false,
    offlineMssqlDatabasesData: [],
    offlineMssqlDatabasesLoading: false,
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
    selectedEngineTypeForWADDashboard: DBType.MSSQL,
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
    registerReplicaSelection: true, // For AOAG if user is selcting related instances
    replicaSelectionForAuth: true, // For AOAG if user is proceeding with failed authentication to provide credentials later
    credentialOption: CREDENTIAL_OPTIONS.SAME_FOR_ALL,
    bulkInstanceCredentials: {
        authMode: {
            label: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
            value: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
        },
        username: '',
        password: '',
        ssmParameterArn: ''
    },
    oracleBulkDatabaseCredentials: {
        oracleUsername: '',
        oraclePassword: '',
        ssmParameterArn: ''
    },
    instanceCredentials: {},
    manageInstanceInstallAction: {
        installMissingAWS: false,
        installMissingPowershell: false,
        installMissingJQ: false,
        installMissingPython: false
    },
    manageSingleInstanceReadiness: null,
    manageSingleInstanceChecks: null,
    manageSingleInstanceData: null,
    replicaSelectedRowsForManage: null,
    wizardOperationType: '',
    registerHostType: '',
    bulkWizardStartAtFsxStep: false,
    selectedMultiDetectInstances: [],
    bulkDetectedInstanceList: [],
    landingFromWizard: false,
    selectedFSxForOntapCredentials: FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED,
    selectedRowsForBulkRegister: [] as any[],
    mssqlInstancesTabVisitCount: 0,
    isUploadLoading: false
};

const inventoryV2Slice = createSlice({
    name: 'inventoryV2',
    initialState: initialInventoryV2State,
    reducers: {
        setSelectedPreparePageTab: (state, action: PayloadAction<string>) => {
            state.selectedPreparePageTab = action.payload;
        },
        setSelectedFSxForOntapCredentials: (state, action: PayloadAction<string>) => {
            state.selectedFSxForOntapCredentials = action.payload;
        },
        setLandingFromWizard: (state, action: PayloadAction<any>) => {
            state.landingFromWizard = action.payload;
        },
        setSelectedMultiDetectInstances: (state, action: PayloadAction<any>) => {
            state.selectedMultiDetectInstances = action.payload;
        },
        setBulkDetectedInstanceList: (state, action: PayloadAction<any>) => {
            state.bulkDetectedInstanceList = action.payload;
        },
        setSelectedRowsForBulkRegister: (state, action: PayloadAction<any[]>) => {
            state.selectedRowsForBulkRegister = action.payload;
        },
        incrementMssqlInstancesTabVisitCount: state => {
            state.mssqlInstancesTabVisitCount += 1;
        },
        setMssqlInstancesTabVisitCount: (state, action: PayloadAction<number>) => {
            state.mssqlInstancesTabVisitCount = action.payload;
        },
        setIsUploadLoading: (state, action: PayloadAction<boolean>) => {
            state.isUploadLoading = action.payload;
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
        setBulkWizardStartAtFsxStep: (state, action: PayloadAction<boolean>) => {
            state.bulkWizardStartAtFsxStep = action.payload;
        },
        setRegisterHostType: (state, action: PayloadAction<any>) => {
            state.registerHostType = action.payload;
        },
        setAuthenticationType: (state, action: PayloadAction<any>) => {
            state.authenticationType = action.payload;
        },
        setRegisterReplicaSelection: (state, action: PayloadAction<any>) => {
            state.registerReplicaSelection = action.payload;
        },
        setReplicaSelectionForAuth: (state, action: PayloadAction<any>) => {
            state.replicaSelectionForAuth = action.payload;
        },
        setCredentialOption: (state, action: PayloadAction<string>) => {
            state.credentialOption = action.payload;
        },
        setBulkInstanceCredentials: (state, action: PayloadAction<Partial<typeof state.bulkInstanceCredentials>>) => {
            state.bulkInstanceCredentials = {
                ...state.bulkInstanceCredentials,
                ...action.payload
            };
        },
        setOracleBulkDatabaseCredentials: (
            state,
            action: PayloadAction<Partial<typeof state.oracleBulkDatabaseCredentials>>
        ) => {
            state.oracleBulkDatabaseCredentials = {
                ...state.oracleBulkDatabaseCredentials,
                ...action.payload
            };
        },
        setInstanceCredentials: (
            state,
            action: PayloadAction<{
                instanceId: string;
                credentials: Partial<{
                    authMode: any;
                    username: string;
                    password: string;
                    ssmParameterArn: string;
                }>;
            }>
        ) => {
            const { instanceId, credentials } = action.payload;
            state.instanceCredentials[instanceId] = {
                ...state.instanceCredentials[instanceId],
                ...credentials
            };
        },
        removeInstanceCredentials: (state, action: PayloadAction<string>) => {
            delete state.instanceCredentials[action.payload];
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
        setDetectSsmParameterArn: (state, action: PayloadAction<string>) => {
            state.detectSsmParameterArn = action.payload;
        },
        setDetectONTAPUserName: (state, action: PayloadAction<any>) => {
            state.detectOntapUsername = action.payload;
        },
        setDetectONTAPPassword: (state, action: PayloadAction<any>) => {
            state.detectOntapPassword = action.payload;
        },
        setDetectONTAPSsmParameterArn: (state, action: PayloadAction<string>) => {
            state.detectOntapSsmParameterArn = action.payload;
        },
        setDetectONTAPCredentialsByFsx: (
            state,
            action: PayloadAction<{ fsxId: string; username?: string; password?: string; ssmParameterArn?: string }>
        ) => {
            const { fsxId, username, password, ssmParameterArn } = action.payload;
            if (!state.detectOntapCredentialsByFsx[fsxId]) {
                state.detectOntapCredentialsByFsx[fsxId] = { username: '', password: '' };
            }
            if (username !== undefined) {
                state.detectOntapCredentialsByFsx[fsxId].username = username;
            }
            if (password !== undefined) {
                state.detectOntapCredentialsByFsx[fsxId].password = password;
            }
            if (ssmParameterArn !== undefined) {
                state.detectOntapCredentialsByFsx[fsxId].ssmParameterArn = ssmParameterArn;
            }
        },
        setFsxAuthStatus: (
            state,
            action: PayloadAction<{ fsxId: string; status: FsxAuthStatus } | FsxAuthStatusMap>
        ) => {
            if ('fsxId' in action.payload) {
                state.fsxAuthStatus[action.payload.fsxId] = action.payload.status;
            } else {
                state.fsxAuthStatus = action.payload;
            }
        },
        resetFsxAuthStatus: state => {
            state.fsxAuthStatus = {};
            state.detectOntapUsername = '';
            state.detectOntapPassword = '';
            state.detectOntapSsmParameterArn = '';
            state.detectOntapCredentialsByFsx = {};
            state.selectedFSxForOntapCredentials = FSX_FOR_ONTAP_CRED_OPTION.USE_THE_SAME_CRED;
        },
        setInstanceAuthStatus: (
            state,
            action: PayloadAction<{ instanceId: string; status: InstanceAuthStatus } | InstanceAuthStatusMap>
        ) => {
            if ('instanceId' in action.payload) {
                state.instanceAuthStatus[action.payload.instanceId] = action.payload.status;
            } else {
                state.instanceAuthStatus = action.payload;
            }
        },
        resetInstanceAuthStatus: state => {
            state.instanceAuthStatus = {};
            state.instanceAuthErrors = {};
            state.detectManageUserName = '';
            state.detectManagePassword = '';
            state.detectSsmParameterArn = '';
            state.detectWindowsAuthentication = { username: '', password: '' };
            state.authenticationType = AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION;
            state.credentialOption = CREDENTIAL_OPTIONS.SAME_FOR_ALL;
            state.bulkInstanceCredentials = {
                authMode: {
                    label: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION,
                    value: AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                },
                username: '',
                password: '',
                ssmParameterArn: ''
            };
            state.instanceCredentials = {};
            state.oracleBulkDatabaseCredentials = {
                oracleUsername: '',
                oraclePassword: '',
                ssmParameterArn: ''
            };
            state.detectCredentialErrors = {
                databaseServerError: '',
                fsxnError: '',
                oracleAsmError: ''
            };
        },
        setInstanceAuthError: (state, action: PayloadAction<{ instanceId: string; error: string }>) => {
            state.instanceAuthErrors[action.payload.instanceId] = action.payload.error;
        },
        clearInstanceAuthErrors: state => {
            state.instanceAuthErrors = {};
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
        setDetectCredentialErrors: (state, action: PayloadAction<Partial<typeof state.detectCredentialErrors>>) => {
            state.detectCredentialErrors = {
                ...state.detectCredentialErrors,
                ...action.payload
            };
        },
        clearDetectCredentialErrors: state => {
            state.detectCredentialErrors = {
                databaseServerError: '',
                fsxnError: '',
                oracleAsmError: ''
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
        setUnManagedInstanceIdsList: (state, action: PayloadAction<any>) => {
            state.unManagedInstanceIdsList = action.payload;
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
        addAllOracleHostAssessmentData: (state, action: PayloadAction<any>) => {
            state.allOracleHostAssessmentData = action.payload;
        },
        setAllMssqlHostAssessmentLoading: (state, action: PayloadAction<any>) => {
            state.allmssqlHostAssessmentLoading = action.payload;
        },
        setAllOracleHostAssessmentLoading: (state, action: PayloadAction<any>) => {
            state.allOracleHostAssessmentLoading = action.payload;
        },
        addAllLogAnalysisData: (state, action: PayloadAction<any>) => {
            state.allLogAnalysisData = action.payload;
        },
        setAllLogAnalysisLoading: (state, action: PayloadAction<any>) => {
            state.allLogAnalysisLoading = action.payload;
        },
        setAllLogAnalysisOracleLoading: (state, action: PayloadAction<any>) => {
            state.allLogAnalysisOracleLoading = action.payload;
        },
        addOfflineMssqlHostAssessmentData: (state, action: PayloadAction<any>) => {
            state.offlineMssqlHostAssessmentData = action.payload;
        },
        setOfflineMssqlHostAssessmentLoading: (state, action: PayloadAction<any>) => {
            state.offlineMssqlHostAssessmentLoading = action.payload;
        },
        addOfflineOracleHostAssessmentData: (state, action: PayloadAction<any>) => {
            state.offlineOracleHostAssessmentData = action.payload;
        },
        setOfflineOracleHostAssessmentLoading: (state, action: PayloadAction<any>) => {
            state.offlineOracleHostAssessmentLoading = action.payload;
        },
        addOfflineMssqlDatabasesData: (state, action: PayloadAction<any>) => {
            state.offlineMssqlDatabasesData = action.payload;
        },
        setOfflineMssqlDatabasesLoading: (state, action: PayloadAction<any>) => {
            state.offlineMssqlDatabasesLoading = action.payload;
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
        setSelectedEngineTypeForWADDashboard: (state, action: PayloadAction<string>) => {
            state.selectedEngineTypeForWADDashboard = action.payload;
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
        setReplicaSelectedRowsForManage: (state, action: PayloadAction<any>) => {
            state.replicaSelectedRowsForManage = action.payload;
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
            state.allOracleHostAssessmentLoading = true;
            state.allLogAnalysisLoading = true;
            state.allLogAnalysisOracleLoading = true;
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
            state.fsxCredentialStatusObjOracle = {};
            state.fsxCredentialStatusObjPgsql = {};
            state.allmssqlHostAssessmentData = [];
            state.allOracleHostAssessmentData = [];
            state.allLogAnalysisData = [];
            state.offlineMssqlHostAssessmentData = [];
            state.offlineOracleHostAssessmentData = [];
            state.offlineMssqlDatabasesData = [];
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
            state.allOracleHostAssessmentLoading = false;
            state.allLogAnalysisLoading = false;
            state.allLogAnalysisOracleLoading = false;
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
            state.allOracleHostAssessmentLoading = false;
            state.allLogAnalysisLoading = false;
            state.allLogAnalysisOracleLoading = false;
            state.dashSandboxList.loading = false;
            state.dashSandboxSavings.loading = false;
        }
    }
});

export const {
    setSelectedPreparePageTab,
    setSelectedFSxForOntapCredentials,
    setLandingFromWizard,
    setSelectedMultiDetectInstances,
    setWizardOperationType,
    setBulkWizardStartAtFsxStep,
    setRegisterHostType,
    setInstallType,
    setAuthenticationType,
    setRegisterReplicaSelection,
    setReplicaSelectionForAuth,
    setCredentialOption,
    setBulkInstanceCredentials,
    setOracleBulkDatabaseCredentials,
    setInstanceCredentials,
    removeInstanceCredentials,
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
    setDetectCredentialErrors,
    clearDetectCredentialErrors,
    setPerfMssqlInstancesData,
    setInProgressInstances,
    setDetectManageUserName,
    setDetectManagePassword,
    setDetectSsmParameterArn,
    setDetectONTAPUserName,
    setDetectONTAPPassword,
    setDetectONTAPSsmParameterArn,
    setDetectONTAPCredentialsByFsx,
    setFsxAuthStatus,
    resetFsxAuthStatus,
    setInstanceAuthStatus,
    resetInstanceAuthStatus,
    setInstanceAuthError,
    clearInstanceAuthErrors,
    setResetManagedData,
    setRemoveSecNodeDiscoveredList,
    setUnManagedPerfInstanceIdsList,
    setUnManagedInstanceIdsList,
    setManagedHostInstanceLoading,
    setSelectedHeaderTab,
    setIsRefreshed,
    setBreadCrumbSelectedFrom,
    setManagedAssessmentHostIdsList,
    addAllMssqlHostAssessmentData,
    addAllOracleHostAssessmentData,
    setAllMssqlHostAssessmentLoading,
    setAllOracleHostAssessmentLoading,
    addAllLogAnalysisData,
    setAllLogAnalysisLoading,
    setAllLogAnalysisOracleLoading,
    addOfflineMssqlHostAssessmentData,
    setOfflineMssqlHostAssessmentLoading,
    addOfflineOracleHostAssessmentData,
    setOfflineOracleHostAssessmentLoading,
    addOfflineMssqlDatabasesData,
    setOfflineMssqlDatabasesLoading,
    setPotentialSavingsHostData,
    resetPerComboData,
    setTableManageColumnState,
    setHostTableRows,
    setInstanceTableRows,
    setDatabaseTableRows,
    setInventoryTablesRows,
    setSelectedHostType,
    setSelectedEngineTypeForWADDashboard,
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
    setReplicaSelectedRowsForManage,
    setBulkDetectedInstanceList,
    setSelectedRowsForBulkRegister,
    incrementMssqlInstancesTabVisitCount,
    setMssqlInstancesTabVisitCount,
    setIsUploadLoading
} = inventoryV2Slice.actions;

export default inventoryV2Slice;
