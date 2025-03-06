import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { InventorySliceData } from '../../utils/types/inventoryV2Types';
import { DETECT_HOST_VAR, WLF_TABS } from '../../utils/consts';
import { initialColStateManagedHosts } from '../../utils/utilityFunctions';

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
    getPgSqlDatabaseHosts: {
        databaseHostsData: null,
        databaseHostsLoading: false,
        fullHostDataLoading: false
    },
    discoveredHosts: {
        discoveredHostData: null,
        discoverHostLoading: false
    },
    fsxCredentialStatusObj: {},
    fsxCredentialStatusLoading: false,
    mssqlInstancesData: null,
    perfMssqlInstancesData: null,
    inProgressInstances: new Set(),
    manageHostSelectedRows: [],
    valuesNotFilled: false, // Detect host dialog fields check
    detectHostRadio: DETECT_HOST_VAR.MOVE_TO_MANAGE,
    detectManageUserName: '',
    detectManagePassword: '',
    detectOntapUsername: '',
    detectOntapPassword: '',
    detectedInstanceId: '',
    inventoryExpandedRowHostData: null,
    resetManagedData: false,
    removeSecNodeDiscoveredList: [],
    unManagedPerfInstanceIdsList: [],
    managedHostInstanceLoading: false,
    selectedHeaderTab: WLF_TABS.DASHBOARD,
    managedHostInitialColumns: initialColStateManagedHosts,
    isRefreshed: false,
    optimizeFilterTags: [],
    defaultFilterOptions: {},
    managedAssessmentHostIdsList: [],
    managedAssessmentHostData: null,
    allmssqlHostAssessmentData: [],
    allmssqlHostAssessmentLoading: false,
    potentialSavingsHostData: {},
    selectedInventoryTab: 'Hosts',
    selectedOptimizeConfig: {
        type: '',
        data: {}
    },
    optimizeInnerPageValues: {},
    selectedFilterValue: {
        flag: false,
        value: '',
        filterType: ''
    }
};

const inventoryV2Slice = createSlice({
    name: 'inventoryV2',
    initialState: initialInventoryV2State,
    reducers: {
        setSelectedFilterValue: (state, action: PayloadAction<any>) => {
            state.selectedFilterValue = action.payload;
        },
        setSelectedInventoryTab: (state, action: PayloadAction<any>) => {
            state.selectedInventoryTab = action.payload;
        },
        setOptimizeInnerPageValues: (state, action: PayloadAction<any>) => {
            state.optimizeInnerPageValues = action.payload;
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
        setInventoryExpandedRowHostData: (state, action: PayloadAction<any>) => {
            state.inventoryExpandedRowHostData = action.payload;
        },
        setValuesForForm: (state, action: PayloadAction<any>) => {
            state.valuesNotFilled = action.payload;
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
        setIsFullHostDataLoading: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.fullHostDataLoading = action.payload;
        },
        setIsFullPgSqlHostDataLoading: (state, action: PayloadAction<any>) => {
            state.getPgSqlDatabaseHosts.fullHostDataLoading = action.payload;
        },
        addDatabaseHostsDataV2: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts.databaseHostsData = action.payload;
        },
        addPgSqlDatabaseHostsData: (state, action: PayloadAction<any>) => {
            state.getPgSqlDatabaseHosts.databaseHostsData = action.payload;
        },
        setIsDiscoveredHostData: (state, action: PayloadAction<any>) => {
            state.discoveredHosts.discoveredHostData = action.payload;
        },
        setIsDiscoverHostLoading: (state, action: PayloadAction<any>) => {
            state.discoveredHosts.discoverHostLoading = action.payload;
        },
        setFsxCredentialStatus: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusObj = action.payload;
        },
        setFsxCredentialStatusLoading: (state, action: PayloadAction<any>) => {
            state.fsxCredentialStatusLoading = action.payload;
        },
        setMssqlInstancesData: (state, action: PayloadAction<any>) => {
            state.mssqlInstancesData = action.payload;
        },
        setPerfMssqlInstancesData: (state, action: PayloadAction<any>) => {
            state.perfMssqlInstancesData = action.payload;
        },
        setInProgressInstances: (state, action: PayloadAction<any>) => {
            state.inProgressInstances = action.payload;
        },
        setManageHostSelectedRows: (state, action: PayloadAction<any>) => {
            state.manageHostSelectedRows = action.payload;
        },
        setRadioValueDetect: (state, action: PayloadAction<any>) => {
            state.detectHostRadio = action.payload;
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
        setDetectedInstanceId: (state, action: PayloadAction<any>) => {
            state.detectedInstanceId = action.payload;
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
        setManagedHostColState: (state, action: PayloadAction<any>) => {
            state.managedHostInitialColumns = action.payload;
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
        setManagedAssessmentHostData: (state, action: PayloadAction<any>) => {
            state.managedAssessmentHostData = action.payload;
        },
        addAllMssqlHostAssessmentData: (state, action: PayloadAction<any>) => {
            state.allmssqlHostAssessmentData = action.payload;
        },
        setAllMssqlHostAssessmentLoading: (state, action: PayloadAction<any>) => {
            state.allmssqlHostAssessmentLoading = action.payload;
        },
        setPotentialSavingsHostData: (state, action: PayloadAction<any>) => {
            state.potentialSavingsHostData = action.payload;
        },
        setSelectedOptimizeConfig: (state, action: PayloadAction<any>) => {
            state.selectedOptimizeConfig = action.payload;
        },
        resetPerComboData: (state, action: PayloadAction<any>) => {
            state.resetManagedData = true;
            state.isManagedHostListLoading = true;
            state.getDatabaseHosts.databaseHostsLoading = true;
            state.getPgSqlDatabaseHosts.databaseHostsLoading = true;
            state.getDatabaseHosts.fullHostDataLoading = true;
            state.getPgSqlDatabaseHosts.fullHostDataLoading = true;
            state.allmssqlHostAssessmentLoading = true;
            state.getDatabaseHosts.databaseHostsData = null;
            state.getPgSqlDatabaseHosts.databaseHostsData = null;
            state.discoveredHosts.discoveredHostData = null;
            state.discoveredHosts.discoverHostLoading = true;
            state.mssqlInstancesData = null;
            state.inventoryChartData = null;
            state.removeSecNodeDiscoveredList = [];
            state.unManagedPerfInstanceIdsList = [];
            state.managedAssessmentHostIdsList = [];
            state.perfMssqlInstancesData = {};
            state.managedAssessmentHostData = {};
            state.allmssqlHostAssessmentData = [];
            state.potentialSavingsHostData = {};
        }
    }
});

export const {
    setSelectedFilterValue,
    setSelectedInventoryTab,
    setOptimizeInnerPageValues,
    setSelectedOptimizeConfig,
    setDefaultFilterOptions,
    setOptimizeFilterTags,
    setValuesForForm,
    setInventoryExpandedRowHostData,
    setInventoryTableData,
    setInventoryChartData,
    setIsManagedHostListLoading,
    setIsDatabaseHostsLoading,
    setIsPgSqlDatabaseHostsLoading,
    setIsFullHostDataLoading,
    setIsFullPgSqlHostDataLoading,
    addDatabaseHostsDataV2,
    addPgSqlDatabaseHostsData,
    setIsDiscoveredHostData,
    setIsDiscoverHostLoading,
    setFsxCredentialStatus,
    setFsxCredentialStatusLoading,
    setMssqlInstancesData,
    setPerfMssqlInstancesData,
    setInProgressInstances,
    setManageHostSelectedRows,
    setRadioValueDetect,
    setDetectManageUserName,
    setDetectManagePassword,
    setDetectONTAPUserName,
    setDetectONTAPPassword,
    setDetectedInstanceId,
    setResetManagedData,
    setRemoveSecNodeDiscoveredList,
    setUnManagedPerfInstanceIdsList,
    setManagedHostInstanceLoading,
    setSelectedHeaderTab,
    setManagedHostColState,
    setIsRefreshed,
    setBreadCrumbSelectedFrom,
    setManagedAssessmentHostIdsList,
    setManagedAssessmentHostData,
    addAllMssqlHostAssessmentData,
    setAllMssqlHostAssessmentLoading,
    setPotentialSavingsHostData,
    resetPerComboData
} = inventoryV2Slice.actions;

export default inventoryV2Slice;
