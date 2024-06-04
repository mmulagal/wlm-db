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
    viewCalculationsLoading: false
};

const exploreSavingsSlice = createSlice({
    name: 'exploreSavings',
    initialState: initialExploreSavingsState,
    reducers: {
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
    setSelectedSnapshotFrequency,
    setNumberOfClonedCopies,
    setSelectedCloneRefresh,
    setMonthlyChangeRate,
    setSaveConfigName,
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
    setViewCalculationsLoading
} = exploreSavingsSlice.actions;

export default exploreSavingsSlice;
