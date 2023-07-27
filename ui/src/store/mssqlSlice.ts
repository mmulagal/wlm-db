import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AD, Ami, Credentials, VPC } from "../utils/types";

interface mssqlEntities {
    getCredentials: {
        credentialData: Credentials[],
        credentialLoading: false,
        credentialError: null
    },
    getVPCList: {
        vpcData: VPC[],
        vpcLoading: false,
        vpcError: null
    },
    getAdsList: {
        adData: AD[],
        adLoading: false,
        adError: null
    },
    getAmiList: {
        amiData: Ami[],
        amiLoading: false,
        amiError: null
    },
}

const initialState: mssqlEntities =  {
    getCredentials: {
        credentialData: [],
        credentialLoading: false,
        credentialError: null
    },
    getVPCList: {
        vpcData: [],
        vpcLoading: false,
        vpcError: null
    },
    getAdsList: {
        adData: [],
        adLoading: false,
        adError: null
    },
    getAmiList: {
        amiData: [],
        amiLoading: false,
        amiError: null
    },
};

const mssqlSlice = createSlice({
    name: 'mssql',
    initialState,
    reducers: {
        addCredentials: (state, action: PayloadAction<any>) => {
            state.getCredentials = action.payload;
        },
        addVpcList: (state, action: PayloadAction<any>) => {
            state.getVPCList = action.payload;
        },
        addAdsList: (state, action: PayloadAction<any>) => {
            state.getAdsList = action.payload;
        },
        addAmiList: (state, action: PayloadAction<any>) => {
            state.getAmiList= action.payload;
        }
    }

})

export const { addCredentials, addVpcList } = mssqlSlice.actions;
export default mssqlSlice;
