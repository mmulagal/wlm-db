import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { ExploreSavingsSliceEntities } from '../../utils/types/exploreSavingsType';
import { DBType, SAVINGS_CALC_MODE, TCO_CALCULATOR_MODE, WLF_TABS } from '../../utils/consts';

export const initialExploreSavingsState: ExploreSavingsSliceEntities = {
    selectedTCOHostType: DBType.MSSQL,
    showOptimizeMode: {
        optimizeLoading: false,
        showCalcMode: false
    },
    selectedCalculatorMode: TCO_CALCULATOR_MODE.OPTIMIZED,
    selectedSnapshotFrequency: null,
    numberOfClonedCopies: 3,
    selectedCloneRefresh: null,
    monthlyChangeRate: 10,
    saveConfigName: '',
    loading: false,
    unmanagedExploreSavingsHost: [],
    selectedInstanceId: '',
    selectedExCredId: '',
    selectedExRegionId: '',
    selectedOnPremHostId: '',
    selectedPartnerInstanceId: '',
    selectedServerName: '',
    selectedHostDetails: {},
    selectedOnPremHostDetails: {},
    selectedPartnerHostDetails: {},
    getPartnerHostDetailsLoading: false,
    storageSavingsResponse: {},
    optimizedStorageSavingsResponse: {},
    standardStorageSavingsResponse: {},
    hasFetched: false,
    showOptimizedModal: false,
    storageSavingsLoading: false,
    oracleLicenseCostUpdating: false,
    savingsCalculatorRefresh: false,
    selectedDeploymentModel: '',
    viewCalculationsResponse: null,
    optimizedViewCalculationsResponse: {},
    standardViewCalculationsResponse: {},
    viewCalculationsApiResponse: null,
    viewCalculationsLoading: false,
    savingsCalculatorFrom: null,
    selectedManualRegion: null,
    selectedOnPremRegion: null,
    selectedManualDeploymentModel: null,
    monthlyBYOLCost: '',
    manualMonthlyDescription: '',
    manualSecondaryMachineDescription: '',
    selectedManualServerEdition: null,
    selectedManualInstanceType: null,
    selectedSecondaryManualInstanceType: null,
    selectedVolumeTab: 'gp2',
    selectedVolumeTabForSecondary: 'gp2',
    getManualInstanceTypeList: {
        instanceTypeData: {},
        instanceTypeLoading: false,
        instanceTypeError: null
    },
    getManualRegionsList: {
        manualRegionsData: null,
        manualRegionsLoading: false,
        manualRegionsError: null
    },
    getOnPremRegionList: {
        onPremRegionsData: null,
        onPremRegionsLoading: false,
        onPremRegionsError: null
    },
    onPremiseData: null,
    onPremiseDataLoading: false,
    onPremiseOracleData: null,
    onPremiseOracleDataLoading: false,
    volumeFilledStatus: false,
    secondaryVolumeFilledStatus: false,
    manualTCOVolumeTypes: {
        io2: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        },
        io1: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        },
        gp2: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        },
        gp3: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        },
        st1: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        }
    },

    manualTCOVolumeTypes2: {
        io2: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        },
        io1: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        },
        gp2: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        },
        gp3: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        },
        st1: {
            manualTCONumberOfVolumes: null,
            manualTCOStorageAmount: null,
            manualTCOProvisionedIOPS: null,
            manualTCOThroughput: null
        }
    },
    recommendedTargetInstance: '',
    requestedPayload: {},
    requestedRegion: '',
    disableState: false,
    selectedManualDeploymentType: null,
    selectedManualStorageType: null,
    manualStorageCapacity: 2,
    selectedManualStorageCapacityUnit: null,
    selectedManualFSXIOPS: 6000,
    selectedManualFSXThroughput: 128,
    snapshotLoading: false,
    selectedExploreSavingsTab: WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE,
    selectedOracleExploreSavingsTab: WLF_TABS.ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE,
    onPremStorageAndComputeInfo: {},
    onPremNetworkPerformance: null,
    storageSavingsOnPremResponse: {},
    storageSavingsOnPremLoading: false,
    regionChangeInstanceLoading: false,
    serverDetails: {
        password: '',
        userName: ''
    },
    selectedAuthenticationType: '',
    showOptimizeLink: false,
    exploreSavingsRouteTab: WLF_TABS.EXPLORE_SAVINGS_EBS,
    instanceDataUpdatedTrigger: null
};

const exploreSavingsSlice = createSlice({
    name: 'exploreSavings',
    initialState: initialExploreSavingsState,
    reducers: {
        setSelectedOracleExploreSavingsTab: (state, action: PayloadAction<string>) => {
            state.selectedOracleExploreSavingsTab = action.payload;
        },
        setSelectedTCOHostType(state, action: PayloadAction<string>) {
            state.selectedTCOHostType = action.payload;
        },
        setShowOptimizeMode(state, action: PayloadAction<{ optimizeLoading: boolean; showCalcMode: boolean }>) {
            state.showOptimizeMode = action.payload;
        },
        setSelectedCalculatorMode: (state, action: PayloadAction<any>) => {
            state.selectedCalculatorMode = action.payload;
        },
        setOptimizedStorageSavingsResponse(state, action: PayloadAction<any>) {
            state.optimizedStorageSavingsResponse = action.payload?.optimized;
            state.standardStorageSavingsResponse = action.payload?.standard;
        },
        setShowFirstTimeOptimize(state, action: PayloadAction<any>) {
            state.hasFetched = true;
            state.showOptimizedModal = true; // show modal first time after fetch
            state.showOptimizeLink = false; // show link after first fetch
        },
        setOptimizedViewCalculationResponse(state, action: PayloadAction<any>) {
            state.optimizedViewCalculationsResponse = action.payload?.optimized;
            state.standardViewCalculationsResponse = action.payload?.standard;
        },
        setShowOptimizeModal(state, action: PayloadAction<boolean>) {
            state.showOptimizedModal = action.payload;
        },
        setOptimizeLink(state, action: PayloadAction<boolean>) {
            state.showOptimizeLink = action.payload;
            state.showOptimizedModal = false;
        },
        resetOptimizedStorage(state) {
            state.optimizedStorageSavingsResponse = {};
            state.standardStorageSavingsResponse = {};
            state.optimizedViewCalculationsResponse = {};
            state.standardViewCalculationsResponse = {};
            state.hasFetched = false;
            state.showOptimizedModal = false;
            state.showOptimizeLink = false;
            state.showOptimizeMode = {
                optimizeLoading: false,
                showCalcMode: false
            };
            state.selectedCalculatorMode = TCO_CALCULATOR_MODE.OPTIMIZED;
        },
        setExploreSavingsRouteTab: (state, action: PayloadAction<string>) => {
            state.exploreSavingsRouteTab = action.payload;
        },
        setCredentials: (state, action: PayloadAction<Partial<typeof state.serverDetails>>) => {
            state.serverDetails = {
                ...state.serverDetails,
                ...action.payload
            };
        },
        setSelectedAuthenticationType: (state, action: PayloadAction<any>) => {
            state.selectedAuthenticationType = action.payload;
        },
        setRegionChangeInstanceLoading(state, action: PayloadAction<any>) {
            state.regionChangeInstanceLoading = action.payload;
        },
        setOnPremiseData(state, action: PayloadAction<any>) {
            state.onPremiseData = action.payload;
        },
        setOnPremiseDataLoading(state, action: PayloadAction<any>) {
            state.onPremiseDataLoading = action.payload;
        },
        setOnPremiseOracleData(state, action: PayloadAction<any>) {
            state.onPremiseOracleData = action.payload;
        },
        setOnPremiseOracleDataLoading(state, action: PayloadAction<any>) {
            state.onPremiseOracleDataLoading = action.payload;
        },
        setOnPremStorageAndComputeInfo(state, action: PayloadAction<any>) {
            if (!state.onPremStorageAndComputeInfo[action.payload.type]) {
                state.onPremStorageAndComputeInfo[action.payload.type] = {};
            }
            if (!state.onPremStorageAndComputeInfo[action.payload.type][action.payload.mode]) {
                state.onPremStorageAndComputeInfo[action.payload.type][action.payload.mode] = {};
            }
            state.onPremStorageAndComputeInfo[action.payload.type][action.payload.mode] = action.payload.value;
        },
        setOnPremStorageAndComputeInfoFull(state, action: PayloadAction<any>) {
            state.onPremStorageAndComputeInfo = action.payload;
        },
        removeOnPremStorageAndComputeInfoKey(state, action: PayloadAction<string>) {
            delete state.onPremStorageAndComputeInfo[action.payload];
        },
        setOnPremNetworkPerformance(state, action: PayloadAction<any>) {
            state.onPremNetworkPerformance = action.payload;
        },
        setSelectedExploreSavingsTab: (state, action: PayloadAction<any>) => {
            state.selectedExploreSavingsTab = action.payload;
        },
        setSelectedManualFSXThroughput: (state, action: PayloadAction<any>) => {
            state.selectedManualFSXThroughput = action.payload;
        },
        setSelectedManualFSXIOPS: (state, action: PayloadAction<any>) => {
            state.selectedManualFSXIOPS = action.payload;
        },
        setSelectedManualStorageCapacityUnit: (state, action: PayloadAction<any>) => {
            state.selectedManualStorageCapacityUnit = action.payload;
        },
        setSelectedManualStorageCapacity: (state, action: PayloadAction<any>) => {
            state.manualStorageCapacity = action.payload;
        },
        setSelectedManualStorageType: (state, action: PayloadAction<any>) => {
            state.selectedManualStorageType = action.payload;
        },
        setSelectedManualDeploymentType: (state, action: PayloadAction<any>) => {
            state.selectedManualDeploymentType = action.payload;
        },
        setDisableState: (state, action: PayloadAction<any>) => {
            state.disableState = action.payload;
        },
        setRequestedPayload: (state, action: PayloadAction<any>) => {
            state.requestedPayload = action.payload;
        },
        setRequestedRegion: (state, action: PayloadAction<any>) => {
            state.requestedRegion = action.payload;
        },
        setVolumeFilledStatus: (state, action: PayloadAction<any>) => {
            state.volumeFilledStatus = action.payload;
        },
        setSecondaryVolumeFilledStatus: (state, action: PayloadAction<any>) => {
            state.secondaryVolumeFilledStatus = action.payload;
        },
        addManualInstanceTypeList: (state, action: PayloadAction<any>) => {
            state.getManualInstanceTypeList.instanceTypeData = action.payload;
        },
        setInstanceLoading: (state, action: PayloadAction<any>) => {
            state.getManualInstanceTypeList.instanceTypeLoading = action.payload;
        },
        addManualRegionsList: (state, action: PayloadAction<any>) => {
            state.getManualRegionsList.manualRegionsData = action.payload;
        },
        setManualRegionsLoading: (state, action: PayloadAction<any>) => {
            state.getManualRegionsList.manualRegionsLoading = action.payload;
        },
        addOnPremRegionsList: (state, action: PayloadAction<any>) => {
            state.getOnPremRegionList.onPremRegionsData = action.payload;
        },
        setOnPremRegionsLoading: (state, action: PayloadAction<any>) => {
            state.getOnPremRegionList.onPremRegionsLoading = action.payload;
        },
        setVolumeTypeOperation(state, action: PayloadAction<any>) {
            state.manualTCOVolumeTypes[action.payload.type][action.payload.mode] = action.payload.value;
        },
        setSecondaryVolumeTypeOperation(state, action: PayloadAction<any>) {
            state.manualTCOVolumeTypes2[action.payload.type][action.payload.mode] = action.payload.value;
        },

        setSelectedVolumeType(state, action: PayloadAction<any>) {
            state.selectedVolumeTab = action.payload;
        },
        setSelectedVolumeTabForSecondary(state, action: PayloadAction<any>) {
            state.selectedVolumeTabForSecondary = action.payload;
        },
        setSelectedManualInstanceType(state, action: PayloadAction<any>) {
            state.selectedManualInstanceType = action.payload;
        },
        setSelectedSecondaryManualInstanceType(state, action: PayloadAction<any>) {
            state.selectedSecondaryManualInstanceType = action.payload;
        },
        setSelectedManualServerEdition(state, action: PayloadAction<any>) {
            state.selectedManualServerEdition = action.payload;
        },
        setSelectedMachineDescription(state, action: PayloadAction<any>) {
            state.manualMonthlyDescription = action.payload;
        },
        setSecondarySelectedMachineDescription(state, action: PayloadAction<any>) {
            state.manualSecondaryMachineDescription = action.payload;
        },
        setSelectedMonthlyBYOLCost(state, action: PayloadAction<any>) {
            state.monthlyBYOLCost = action.payload;
        },
        setSelectedDeploymentModelForManualTCO(state, action: PayloadAction<any>) {
            state.selectedManualDeploymentModel = action.payload;
        },
        setSelectedRegionFromManualTCO(state, action: PayloadAction<any>) {
            state.selectedManualRegion = action.payload;
        },
        setSelectedOnPremRegion(state, action: PayloadAction<any>) {
            state.selectedOnPremRegion = action.payload;
        },
        setSavingsCalculatorFrom(state, action: PayloadAction<any>) {
            state.savingsCalculatorFrom = action.payload;

            state.numberOfClonedCopies = 3;
            state.monthlyChangeRate = 10;
        },
        setSelectedSnapshotFrequency(state, action: PayloadAction<any>) {
            state.selectedSnapshotFrequency = action.payload;
        },
        setNumberOfClonedCopies(state, action: PayloadAction<any>) {
            state.numberOfClonedCopies = action.payload;
        },
        setSelectedCloneRefresh(state, action: PayloadAction<any>) {
            state.selectedCloneRefresh = action.payload;
        },
        setMonthlyChangeRate(state, action: PayloadAction<any>) {
            state.monthlyChangeRate = action.payload;
        },
        setSaveConfigName(state, action: PayloadAction<any>) {
            state.saveConfigName = action.payload;
        },
        setUnmanagedExploreSavingsHost(state, action: PayloadAction<any>) {
            state.unmanagedExploreSavingsHost = action.payload;
        },
        setSelectedInstanceId(state, action: PayloadAction<any>) {
            state.selectedInstanceId = action.payload;
        },
        setSelectedExCredId(state, action: PayloadAction<any>) {
            state.selectedExCredId = action.payload;
        },
        setSelectedExRegionId(state, action: PayloadAction<any>) {
            state.selectedExRegionId = action.payload;
        },
        setSelectedOnPremHostId(state, action: PayloadAction<any>) {
            state.selectedOnPremHostId = action.payload;
        },
        setSelectedPartnerInstanceId(state, action: PayloadAction<any>) {
            state.selectedPartnerInstanceId = action.payload;
        },
        setSelectedServerName(state, action: PayloadAction<any>) {
            state.selectedServerName = action.payload;
        },
        setSelectedHostDetails(state, action: PayloadAction<any>) {
            state.selectedHostDetails = action.payload;
        },
        setSelectedOnPremHostDetails(state, action: PayloadAction<any>) {
            state.selectedOnPremHostDetails = action.payload;
        },
        setSelectedPartnerHostDetails(state, action: PayloadAction<any>) {
            state.selectedPartnerHostDetails = action.payload;
        },
        setGetPartnerHostDetailsLoading(state, action: PayloadAction<any>) {
            state.getPartnerHostDetailsLoading = action.payload;
        },
        setStorageSavingsResponse(state, action: PayloadAction<any>) {
            state.storageSavingsResponse = action.payload;
        },
        setStorageSavingsLoading(state, action: PayloadAction<any>) {
            state.storageSavingsLoading = action.payload;
        },
        setOracleLicenseCostUpdating(state, action: PayloadAction<boolean>) {
            state.oracleLicenseCostUpdating = action.payload;
        },
        setSavingsCalculatorRefresh(state, action: PayloadAction<any>) {
            state.savingsCalculatorRefresh = action.payload;
        },
        setSecondaryVolDetails(state, action: PayloadAction<any>) {
            state.manualTCOVolumeTypes2.gp2.manualTCONumberOfVolumes = action.payload.gp2.manualTCONumberOfVolumes;
            state.manualTCOVolumeTypes2.gp2.manualTCOProvisionedIOPS = action.payload.gp2.manualTCOProvisionedIOPS;
            state.manualTCOVolumeTypes2.gp2.manualTCOStorageAmount = action.payload.gp2.manualTCOStorageAmount;
            state.manualTCOVolumeTypes2.gp2.manualTCOThroughput = action.payload.gp2.manualTCOThroughput;

            state.manualTCOVolumeTypes2.io2.manualTCONumberOfVolumes = action.payload.io2.manualTCONumberOfVolumes;
            state.manualTCOVolumeTypes2.io2.manualTCOProvisionedIOPS = action.payload.io2.manualTCOProvisionedIOPS;
            state.manualTCOVolumeTypes2.io2.manualTCOStorageAmount = action.payload.io2.manualTCOStorageAmount;
            state.manualTCOVolumeTypes2.io2.manualTCOThroughput = action.payload.io2.manualTCOThroughput;

            state.manualTCOVolumeTypes2.io1.manualTCONumberOfVolumes = action.payload.io1.manualTCONumberOfVolumes;
            state.manualTCOVolumeTypes2.io1.manualTCOProvisionedIOPS = action.payload.io1.manualTCOProvisionedIOPS;
            state.manualTCOVolumeTypes2.io1.manualTCOStorageAmount = action.payload.io1.manualTCOStorageAmount;
            state.manualTCOVolumeTypes2.io1.manualTCOThroughput = action.payload.io1.manualTCOThroughput;

            state.manualTCOVolumeTypes2.gp3.manualTCONumberOfVolumes = action.payload.gp3.manualTCONumberOfVolumes;
            state.manualTCOVolumeTypes2.gp3.manualTCOProvisionedIOPS = action.payload.gp3.manualTCOProvisionedIOPS;
            state.manualTCOVolumeTypes2.gp3.manualTCOStorageAmount = action.payload.gp3.manualTCOStorageAmount;
            state.manualTCOVolumeTypes2.gp3.manualTCOThroughput = action.payload.gp3.manualTCOThroughput;

            state.manualTCOVolumeTypes2.st1.manualTCONumberOfVolumes = action.payload.st1.manualTCONumberOfVolumes;
            state.manualTCOVolumeTypes2.st1.manualTCOProvisionedIOPS = action.payload.st1.manualTCOProvisionedIOPS;
            state.manualTCOVolumeTypes2.st1.manualTCOStorageAmount = action.payload.st1.manualTCOStorageAmount;
            state.manualTCOVolumeTypes2.st1.manualTCOThroughput = action.payload.st1.manualTCOThroughput;
        },
        addExploreSavingsInitialData(state, action: PayloadAction<any>) {
            state.selectedSnapshotFrequency = null;
            state.numberOfClonedCopies = 3;
            state.selectedCloneRefresh = null;
            state.monthlyChangeRate = 10;
            state.selectedInstanceId = '';
            state.selectedExCredId = '';
            state.selectedExCredId = '';
            state.selectedOnPremHostId = '';
            state.selectedPartnerInstanceId = '';
            state.selectedServerName = '';
            state.selectedHostDetails = {};
            state.selectedPartnerHostDetails = {};
            state.getPartnerHostDetailsLoading = false;
            state.storageSavingsResponse = {};
            state.storageSavingsLoading = false;
            state.oracleLicenseCostUpdating = false;
            state.savingsCalculatorRefresh = false;
            state.selectedDeploymentModel = '';
            state.viewCalculationsResponse = null;
            state.viewCalculationsApiResponse = null;
            state.viewCalculationsLoading = false;
            state.recommendedTargetInstance = '';
            state.manualTCOVolumeTypes = {
                io2: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                },
                io1: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                },
                gp2: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                },
                gp3: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                },
                st1: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                }
            };
            state.manualTCOVolumeTypes2 = {
                io2: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                },
                io1: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                },
                gp2: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                },
                gp3: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                },
                st1: {
                    manualTCONumberOfVolumes: null,
                    manualTCOStorageAmount: null,
                    manualTCOProvisionedIOPS: null,
                    manualTCOThroughput: null
                }
            };
            state.selectedManualRegion = null;
            state.selectedOnPremRegion = null;
            state.selectedManualDeploymentModel = null;
            state.selectedManualServerEdition = null;
            state.getManualInstanceTypeList = {
                instanceTypeData: {},
                instanceTypeLoading: false,
                instanceTypeError: null
            };
            state.selectedManualInstanceType = null;
            state.selectedSecondaryManualInstanceType = null;
            state.monthlyBYOLCost = '';
            state.selectedManualDeploymentType = null;
            state.selectedManualStorageType = null;
            state.manualStorageCapacity = 2;
            state.selectedManualStorageCapacityUnit = null;
            state.selectedManualFSXIOPS = 6000;
            state.selectedManualFSXThroughput = 128;
            state.requestedPayload = {};
            state.onPremNetworkPerformance = null;
            state.onPremStorageAndComputeInfo = {};
        },
        setSelectedDeploymentModel(state, action: PayloadAction<any>) {
            state.selectedDeploymentModel = action.payload;
        },
        setViewCalculationsResponse(state, action: PayloadAction<any>) {
            state.viewCalculationsResponse = action.payload;
        },
        setViewCalculationsApiResponse(state, action: PayloadAction<any>) {
            state.viewCalculationsApiResponse = action.payload;
        },
        setViewCalculationsLoading(state, action: PayloadAction<any>) {
            state.viewCalculationsLoading = action.payload;
        },
        setRecommendedTargetInstance(state, action: PayloadAction<any>) {
            state.recommendedTargetInstance = action.payload;
        },
        setSnapshotLoading(state, action: PayloadAction<any>) {
            state.snapshotLoading = action.payload;
        },
        setStorageSavingsOnPremResponse(state, action: PayloadAction<any>) {
            state.storageSavingsOnPremResponse = action.payload;
        },
        setStorageSavingsOnPremLoading(state, action: PayloadAction<any>) {
            state.storageSavingsOnPremLoading = action.payload;
        },
        setSelectedEsPageInstance(state, action: PayloadAction<any>) {
            state.selectedInstanceId = action.payload.instanceId;
            state.selectedExCredId = action.payload.credentialId;
            state.selectedExRegionId = action.payload.regionId;
            state.selectedDeploymentModel = action.payload.deploymentModel;
            state.selectedServerName = action.payload.serverName;
        },
        resetServerDetailsCredentials(state) {
            state.serverDetails = {
                password: '',
                userName: ''
            };
        },
        setInstanceDataUpdatedTrigger(state, action: PayloadAction<string | null>) {
            state.instanceDataUpdatedTrigger = action.payload;
        },
        setOnPremBulkLoadingState(state, action: PayloadAction<'start' | 'success' | 'error'>) {
            const status = action.payload;
            const isLoading = status === 'start';
            state.disableState = status === 'error';
            state.storageSavingsOnPremLoading = isLoading;
            state.storageSavingsLoading = isLoading;
            state.viewCalculationsLoading = isLoading;
            if (status === 'error') {
                state.storageSavingsOnPremResponse = null;
            }
        },
        resetSavingsApiState(state) {
            state.storageSavingsResponse = null as any;
            state.viewCalculationsResponse = null;
            state.viewCalculationsApiResponse = null;
            state.storageSavingsLoading = false;
            state.oracleLicenseCostUpdating = false;
            state.viewCalculationsLoading = false;
        }
    }
});

export const {
    setSelectedOracleExploreSavingsTab,
    setSelectedTCOHostType,
    setShowOptimizeMode,
    setSelectedCalculatorMode,
    setShowOptimizeModal,
    setOptimizeLink,
    resetOptimizedStorage,
    setOptimizedStorageSavingsResponse,
    setOptimizedViewCalculationResponse,
    setExploreSavingsRouteTab,
    setCredentials,
    setSelectedAuthenticationType,
    setOnPremiseData,
    setRegionChangeInstanceLoading,
    setOnPremiseDataLoading,
    setOnPremiseOracleData,
    setOnPremiseOracleDataLoading,
    setOnPremNetworkPerformance,
    setSelectedExploreSavingsTab,
    setRequestedRegion,
    addManualRegionsList,
    setManualRegionsLoading,
    setSelectedManualFSXIOPS,
    setSelectedManualFSXThroughput,
    setSelectedManualStorageCapacityUnit,
    setSelectedManualStorageCapacity,
    setSelectedManualStorageType,
    setSelectedManualDeploymentType,
    setSecondaryVolDetails,
    setDisableState,
    setInstanceLoading,
    setRequestedPayload,
    addManualInstanceTypeList,
    setVolumeFilledStatus,
    setSecondaryVolumeFilledStatus,
    setVolumeTypeOperation,
    setSelectedSecondaryManualInstanceType,
    setSecondarySelectedMachineDescription,
    setSecondaryVolumeTypeOperation,
    setSelectedVolumeType,
    setSelectedManualInstanceType,
    setSelectedManualServerEdition,
    setSelectedMachineDescription,
    setSelectedMonthlyBYOLCost,
    setSelectedDeploymentModelForManualTCO,
    setSelectedRegionFromManualTCO,
    setSelectedOnPremRegion,
    setSelectedSnapshotFrequency,
    setNumberOfClonedCopies,
    setSelectedCloneRefresh,
    setMonthlyChangeRate,
    setSaveConfigName,
    setSelectedVolumeTabForSecondary,
    setUnmanagedExploreSavingsHost,
    setSelectedInstanceId,
    setSelectedExCredId,
    setSelectedExRegionId,
    setSelectedOnPremHostId,
    setSelectedPartnerInstanceId,
    setSelectedServerName,
    setSelectedHostDetails,
    setSelectedOnPremHostDetails,
    setSelectedPartnerHostDetails,
    setGetPartnerHostDetailsLoading,
    setStorageSavingsResponse,
    setStorageSavingsLoading,
    setOracleLicenseCostUpdating,
    setSavingsCalculatorRefresh,
    addExploreSavingsInitialData,
    setSelectedDeploymentModel,
    setViewCalculationsResponse,
    setViewCalculationsApiResponse,
    setViewCalculationsLoading,
    setSavingsCalculatorFrom,
    setRecommendedTargetInstance,
    setSnapshotLoading,
    setStorageSavingsOnPremResponse,
    setStorageSavingsOnPremLoading,
    addOnPremRegionsList,
    setOnPremRegionsLoading,
    setOnPremStorageAndComputeInfo,
    setOnPremStorageAndComputeInfoFull,
    removeOnPremStorageAndComputeInfoKey,
    setSelectedEsPageInstance,
    resetServerDetailsCredentials,
    setShowFirstTimeOptimize,
    setInstanceDataUpdatedTrigger,
    setOnPremBulkLoadingState,
    resetSavingsApiState
} = exploreSavingsSlice.actions;

export default exploreSavingsSlice;
