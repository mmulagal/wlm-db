import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { HeaderTypeEntities } from '../../utils/types/headerTypes';

const initialHeaderState: HeaderTypeEntities = {
    headerSelectedCred: null,
    headerSelectedRegion: null,
    headerSelectedCredSandbox: null,
    headerSelectedRegionSandbox: null,
    headerSelectedMultiCred: null,
    headerSelectedMultiRegion: null,
    headerSelectedMultiCredIdsList: [], // This will store the list of selected credentials ids for comparison in API calls
    headerSelectedMultiRegionIdsList: [], // This will store the list of selected region ids for comparison in API calls
    getCredentials: {
        credentialData: null,
        credentialLoading: false,
        credentialError: null
    },
    getRegions: {
        regionsData: null,
        regionsLoading: false,
        regionsError: null
    },
    credentialMapping: {},
    regionMapping: {},
    getStatus: {
        statusData: null,
        statusLoading: false,
        statusError: null
    },
    refreshTime: null,
    refreshTimeSandbox: null,
    refreshTimeJobMonitor: null,
    dashboardRefresh: false,
    multiDataStatus: {},
    multiDataLoading: false,
    showNA: false,
    secondaryCTAFlow: false,
    deepLinkCredId: null,
    deepLinkRegionId: null
};

const headersSlice = createSlice({
    name: 'headers',
    initialState: initialHeaderState,
    reducers: {
        setSecondaryCTAFlow: (state, action: PayloadAction<boolean>) => {
            state.secondaryCTAFlow = action.payload;
        },
        setHeaderSelectedCred(state, action: PayloadAction<any>) {
            state.headerSelectedCred = action.payload;
        },
        setHeaderSelectedCredSandbox(state, action: PayloadAction<any>) {
            state.headerSelectedCredSandbox = action.payload;
        },
        setHeaderSelectedMultiCred(state, action: PayloadAction<any>) {
            state.headerSelectedMultiCred = action.payload;
            state.headerSelectedMultiCredIdsList = [];
            action.payload?.forEach((item: any) => {
                state.headerSelectedMultiCredIdsList.push(item?.data?.credentialsId);
            });
        },
        setHeaderSelectedMultiRegion(state, action: PayloadAction<any>) {
            state.headerSelectedMultiRegion = action.payload;
            state.headerSelectedMultiRegionIdsList = [];
            action.payload?.forEach((item: any) => {
                state.headerSelectedMultiRegionIdsList.push(item?.data?.regionCode);
            });
        },
        setHeaderSelectedRegion(state, action: PayloadAction<any>) {
            state.headerSelectedRegion = action.payload;
        },
        setHeaderSelectedRegionSandbox(state, action: PayloadAction<any>) {
            state.headerSelectedRegionSandbox = action.payload;
        },
        addCredentialsHeaderList: (state, action: PayloadAction<any>) => {
            state.getCredentials = action.payload;
        },
        addRegionsHeaderList: (state, action: PayloadAction<any>) => {
            state.getRegions = action.payload;
        },
        setCredentialMapping: (state, action: PayloadAction<any>) => {
            state.credentialMapping = action.payload;
        },
        setRegionMapping: (state, action: PayloadAction<any>) => {
            state.regionMapping = action.payload;
        },
        addStatus: (state, action: PayloadAction<any>) => {
            state.getStatus = action.payload;
        },
        setRefreshTime: (state, action: PayloadAction<any>) => {
            state.refreshTime = action.payload;
        },
        setRefreshTimeSandbox: (state, action: PayloadAction<any>) => {
            state.refreshTimeSandbox = action.payload;
        },
        setRefreshTimeJobMonitor: (state, action: PayloadAction<any>) => {
            state.refreshTimeJobMonitor = action.payload;
        },
        setDashboardRefresh: (state, action: PayloadAction<any>) => {
            state.dashboardRefresh = action.payload;
        },
        setMultiDataStatus: (state, action: PayloadAction<any>) => {
            state.multiDataStatus = action.payload;
        },
        setSingleComboCredAndRegion: (state, action: PayloadAction<any>) => {
            state.headerSelectedCred = action.payload?.cred;
            state.headerSelectedRegion = action.payload?.region;
        },
        setMultiDataLoading: (state, action: PayloadAction<any>) => {
            state.multiDataLoading = action.payload;
        },
        setShowNA: (state, action: PayloadAction<boolean>) => {
            state.showNA = action.payload;
        },
        setDeepLinkCredId: (state, action: PayloadAction<string[] | null>) => {
            state.deepLinkCredId = action.payload;
        },
        setDeepLinkRegionId: (state, action: PayloadAction<string[] | null>) => {
            state.deepLinkRegionId = action.payload;
        }
    }
});

export const {
    setSecondaryCTAFlow,
    setHeaderSelectedCred,
    setHeaderSelectedCredSandbox,
    setHeaderSelectedMultiCred,
    setHeaderSelectedRegion,
    setHeaderSelectedRegionSandbox,
    setHeaderSelectedMultiRegion,
    addCredentialsHeaderList,
    addRegionsHeaderList,
    addStatus,
    setRefreshTime,
    setRefreshTimeSandbox,
    setRefreshTimeJobMonitor,
    setDashboardRefresh,
    setCredentialMapping,
    setRegionMapping,
    setMultiDataStatus,
    setSingleComboCredAndRegion,
    setMultiDataLoading,
    setShowNA,
    setDeepLinkCredId,
    setDeepLinkRegionId
} = headersSlice.actions;

export default headersSlice;
