import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const initialState: any = {
    isCreatePressed: false,
    vpcSelected: true,
    availabilityZoneSelected: true,
    dbCredentialPasswordSelected: true,
    activeDirectorySelected: true,
    fsxNNameSelected: true
};

const msSqlActionSlice = createSlice({
    name: 'msSqlAction',
    initialState,
    reducers: {
        setCreatePressed(state, action: PayloadAction<any>) {
            state.isCreatePressed = action.payload;
        },
        setVPCSelectedValue(state, action: PayloadAction<any>) {
            state.vpcSelected = action.payload;
        },
        setAZSelectedValue(state, action: PayloadAction<any>) {
            state.availabilityZoneSelected = action.payload;
        },
        setDBCredentialPasswordValue(state, action: PayloadAction<any>) {
            state.dbCredentialPasswordSelected = action.payload;
        },
        setActiveDirectoryValue(state, action: PayloadAction<any>) {
            state.activeDirectorySelected = action.payload;
        },
        setFSXNNameValue(state, action: PayloadAction<any>) {
            state.fsxNNameSelected = action.payload;
        }
    }
});

export const {
    setCreatePressed,
    setVPCSelectedValue,
    setAZSelectedValue,
    setDBCredentialPasswordValue,
    setActiveDirectoryValue,
    setFSXNNameValue
} = msSqlActionSlice.actions;
export default msSqlActionSlice;
