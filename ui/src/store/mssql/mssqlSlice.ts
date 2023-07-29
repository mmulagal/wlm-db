import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MssqlEntities } from "../../utils/types/mssqlTypes";


const initialState: MssqlEntities =  {
    getCredentials: {
        credentialData: [],
        credentialLoading: false,
        credentialError: null
    },
    getRegions: {
        regionsData: {},
        regionsLoading: false,
        regionsError: null
    },
    getVPCList: {
        vpcData: {},
        vpcLoading: false,
        vpcError: null
    },
    getAdsList: {
        adData: {},
        adLoading: false,
        adError: null
    },
    getAmiList: {
        amiData: {},
        amiLoading: false,
        amiError: null
    },
    getSnsList: {
        snsData: {},
        snsLoading: false,
        snsError: null
    }
};

const mssqlSlice = createSlice({
    name: 'mssql',
    initialState,
    reducers: {
        addCredentials: (state, action: PayloadAction<any>) => {
            state.getCredentials = action.payload;
        },
        addRegions: (state, action: PayloadAction<any>) => {
            state.getRegions = action.payload;
        },
        addVpcList: (state, action: PayloadAction<any>) => {
            state.getVPCList = action.payload;
        },
        addAdsList: (state, action: PayloadAction<any>) => {
            state.getAdsList = action.payload;
        },
        addAmiList: (state, action: PayloadAction<any>) => {
            state.getAmiList= action.payload;
        },
        addSnsList: (state, action: PayloadAction<any>) => {
            state.getSnsList= action.payload;
        }
    }

})

export const { addCredentials, addRegions, addVpcList, addAdsList, addAmiList, addSnsList } = mssqlSlice.actions;
export default mssqlSlice;
