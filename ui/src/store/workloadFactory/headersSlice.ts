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
    dashboardRefresh: false
};

const headersSlice = createSlice({
    name: 'headers',
    initialState: initialHeaderState,
    reducers: {
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
