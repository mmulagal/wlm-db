import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { HeaderTypeEntities } from '../../utils/types/headerTypes';

const initialHeaderState: HeaderTypeEntities = {
    headerSelectedCred: null,
    headerSelectedRegion: null,
    headerSelectedMultiCred: null,
    headerSelectedMultiRegion: null,
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
    getStatus: {
        statusData: null,
        statusLoading: false,
        statusError: null
    },
    refreshTime: null,
    dashboardRefresh: false,
    multiSelectData: {}
};

const headersSlice = createSlice({
    name: 'headers',
    initialState: initialHeaderState,
    reducers: {
        setMultiSelectData(state, action: PayloadAction<any>) {
            const { cred, region, apiName, response, status } = action.payload;
            const key = `${cred}/${region}`;
            if (!state.multiSelectData[key]) {
                state.multiSelectData[key] = {};
            }

            // Store API response and update completion status in a single object
            state.multiSelectData[key][apiName] = { response, status };
        },
        resetMultiSelectData(state) {
            state.multiSelectData = {};
        },
        setHeaderSelectedCred(state, action: PayloadAction<any>) {
            state.headerSelectedCred = action.payload;
        },
        setHeaderSelectedMultiCred(state, action: PayloadAction<any>) {
            state.headerSelectedMultiCred = action.payload;
        },
        setHeaderSelectedMultiRegion(state, action: PayloadAction<any>) {
            state.headerSelectedMultiRegion = action.payload;
        },
        setHeaderSelectedRegion(state, action: PayloadAction<any>) {
            state.headerSelectedRegion = action.payload;
        },
        addCredentialsHeaderList: (state, action: PayloadAction<any>) => {
            state.getCredentials = action.payload;
        },
        addRegionsHeaderList: (state, action: PayloadAction<any>) => {
            state.getRegions = action.payload;
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
    setHeaderSelectedCred,
    setHeaderSelectedMultiCred,
    setHeaderSelectedRegion,
    setHeaderSelectedMultiRegion,
    addCredentialsHeaderList,
    addRegionsHeaderList,
    addStatus,
    setRefreshTime,
    setDashboardRefresh
} = headersSlice.actions;

export default headersSlice;
