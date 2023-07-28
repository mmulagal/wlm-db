import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {  MssqlFormEntities } from "../../utils/types/mssqlTypes";

const initialState: MssqlFormEntities = {
    credentials: {},
    regions: {},
    existingVpc: {},
    newVpcName: ""
};


const mssqlFormSlice = createSlice({
    name: 'mssqlForm',
    initialState,
    reducers: {
        addFormCredentials: (state, action: PayloadAction<any>) => {
            const { credentials } = action.payload;
            state.credentials = credentials;
        },
        addFormRegions: (state, action: PayloadAction<any>) => {
            const { regions } = action.payload;
            state.regions = regions;
        },
        addFormExistingVpcList: (state, action: PayloadAction<any>) => {
            const { existingVpc } = action.payload;
            state.existingVpc = existingVpc;
        },
        addFormNewVpcName: (state, action: PayloadAction<any>) => {
            const { newVpcName } = action.payload;
            state.newVpcName = newVpcName;
        },
    }

})

export const { addFormCredentials, addFormRegions, addFormExistingVpcList, addFormNewVpcName } = mssqlFormSlice.actions;
export default mssqlFormSlice;
