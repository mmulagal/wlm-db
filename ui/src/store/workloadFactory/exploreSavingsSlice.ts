import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { ExploreSavingsSliceEntities } from '../../utils/types/exploreSavingsType';

export const initialExploreSavingsState: ExploreSavingsSliceEntities = {
    selectedSnapshotFrequency: null,
    numberOfClonedCopies: 1,
    selectedCloneRefresh: null,
    monthlyChangeRate: 8,
    saveConfigName: '',
    loading: false,
    unmanagedExploreSavingsHost: [],
    selectedInstanceId: '',
    selectedPartnerInstanceId: '',
    selectedServerName: '',
    selectedHostDetails: {},
    selectedPartnerHostDetails: {},
    getPartnerHostDetailsLoading: false,
    storageSavingsResponse: {},
    storageSavingsLoading: false,
    savingsCalculatorRefresh: false,
    selectedDeploymentModel: '',
    viewCalculationsResponse: null,
    viewCalculationsLoading: false,
    savingsCalculatorFrom: null,
    selectedManualRegion: null,
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
    volumeFilledStatus: false,
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
    }
};

const exploreSavingsSlice = createSlice({
    name: 'exploreSavings',
    initialState: initialExploreSavingsState,
    reducers: {
        setVolumeFilledStatus: (state, action: PayloadAction<any>) => {
            state.volumeFilledStatus = action.payload;
        },
        addManualInstanceTypeList: (state, action: PayloadAction<any>) => {
            state.getManualInstanceTypeList = action.payload;
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
        setSavingsCalculatorFrom(state, action: PayloadAction<any>) {
            state.savingsCalculatorFrom = action.payload;
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
        setSelectedPartnerInstanceId(state, action: PayloadAction<any>) {
            state.selectedPartnerInstanceId = action.payload;
        },
        setSelectedServerName(state, action: PayloadAction<any>) {
            state.selectedServerName = action.payload;
        },
        setSelectedHostDetails(state, action: PayloadAction<any>) {
            state.selectedHostDetails = action.payload;
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
        setSavingsCalculatorRefresh(state, action: PayloadAction<any>) {
            state.savingsCalculatorRefresh = action.payload;
        },
        addExploreSavingsInitialData(state, action: PayloadAction<any>) {
            state.selectedSnapshotFrequency = null;
            state.numberOfClonedCopies = 1;
            state.selectedCloneRefresh = null;
            state.monthlyChangeRate = 8;
            state.selectedInstanceId = '';
            state.selectedPartnerInstanceId = '';
            state.selectedServerName = '';
            state.selectedHostDetails = {};
            state.selectedPartnerHostDetails = {};
            state.getPartnerHostDetailsLoading = false;
            state.storageSavingsResponse = {};
            state.storageSavingsLoading = false;
            state.savingsCalculatorRefresh = false;
            state.selectedDeploymentModel = '';
            state.viewCalculationsResponse = null;
            state.viewCalculationsLoading = false;
        },
        setSelectedDeploymentModel(state, action: PayloadAction<any>) {
            state.selectedDeploymentModel = action.payload;
        },
        setViewCalculationsResponse(state, action: PayloadAction<any>) {
            state.viewCalculationsResponse = action.payload;
        },
        setViewCalculationsLoading(state, action: PayloadAction<any>) {
            state.viewCalculationsLoading = action.payload;
        }
    }
});

export const {
    addManualInstanceTypeList,
    setVolumeFilledStatus,
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
    setSelectedSnapshotFrequency,
    setNumberOfClonedCopies,
    setSelectedCloneRefresh,
    setMonthlyChangeRate,
    setSaveConfigName,
    setSelectedVolumeTabForSecondary,
    setUnmanagedExploreSavingsHost,
    setSelectedInstanceId,
    setSelectedPartnerInstanceId,
    setSelectedServerName,
    setSelectedHostDetails,
    setSelectedPartnerHostDetails,
    setGetPartnerHostDetailsLoading,
    setStorageSavingsResponse,
    setStorageSavingsLoading,
    setSavingsCalculatorRefresh,
    addExploreSavingsInitialData,
    setSelectedDeploymentModel,
    setViewCalculationsResponse,
    setViewCalculationsLoading,
    setSavingsCalculatorFrom
} = exploreSavingsSlice.actions;

export default exploreSavingsSlice;
