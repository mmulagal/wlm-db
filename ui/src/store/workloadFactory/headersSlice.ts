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
    dashboardRefresh: false,
    multiSelectData: {},
    multiSelectStatus: {}
};

const headersSlice = createSlice({
    name: 'headers',
    initialState: initialHeaderState,
    reducers: {
        setMultiSelectData(state, action: PayloadAction<any>) {
            const { cred, region, apiName, response, status, isSuccess, error } = action.payload;
            const key = `${cred}/${region}`;
            if (!state.multiSelectData[key]) {
                state.multiSelectData[key] = {};
            }

            // Store API response and update completion status in a single object
            state.multiSelectData[key][apiName] = { response, status, isSuccess, error };
        },
        setMultiSelectStatus(state, action: PayloadAction<any>) {
            const { cred, region, status } = action.payload;
            const key = `${cred}/${region}`;
            if (!state.multiSelectStatus[key]) {
                state.multiSelectStatus[key] = {};
            }

            // Store API response and update completion status in a single object
            state.multiSelectStatus[key] = status;
        },
        resetMultiSelectData(state) {
            state.multiSelectStatus = {};
            state.multiSelectData = {};
        },
        setHeaderSelectedCred(state, action: PayloadAction<any>) {
            state.headerSelectedCred = action.payload;
            // Will remove below lines once multi cred will be available
            state.headerSelectedCredSandbox = action.payload;
            state.headerSelectedMultiCred = [action.payload];
            state.headerSelectedMultiCredIdsList = [];
            [action.payload]?.forEach((item: any) => {
                state.headerSelectedMultiCredIdsList.push(item?.data?.credentialsId);
            });
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
            // Will remove below lines once multi region will be available
            state.headerSelectedRegionSandbox = action.payload;
            state.headerSelectedMultiRegion = [action.payload];
            state.headerSelectedMultiRegionIdsList = [];
            [action.payload]?.forEach((item: any) => {
                state.headerSelectedMultiRegionIdsList.push(item?.data?.regionCode);
            });
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
        setDashboardRefresh: (state, action: PayloadAction<any>) => {
            state.dashboardRefresh = action.payload;
        }
    }
});

export const {
    resetMultiSelectData,
    setMultiSelectData,
    setMultiSelectStatus,
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
    setDashboardRefresh,
    setCredentialMapping,
    setRegionMapping
} = headersSlice.actions;

export default headersSlice;
