import { PayloadAction, createSlice } from "@reduxjs/toolkit";

const initialHeaderState: any = {
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
    }
});

export const {
    setHeaderSelectedCred,
    setHeaderSelectedRegion,
    addCredentialsHeaderList,
    addRegionsHeaderList
} = headersSlice.actions;

export default headersSlice;
