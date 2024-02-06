import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { HeaderTypeEntities } from "../../utils/types/headerTypes";

const initialHeaderState: HeaderTypeEntities = {
    headerSelectedCred: null,
    headerSelectedRegion: null,
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
    refreshTime: null
};

const headersSlice = createSlice({
    name: 'headers',
    initialState: initialHeaderState,
    reducers: {
        setHeaderSelectedCred(state, action: PayloadAction<any>) {
            state.headerSelectedCred = action.payload;
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
        }
    }
});

export const {
    setHeaderSelectedCred,
    setHeaderSelectedRegion,
    addCredentialsHeaderList,
    addRegionsHeaderList,
    addStatus,
    setRefreshTime
} = headersSlice.actions;

export default headersSlice;
