import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const initialState: any = {
    isCreatePressed: false,
    isCreateHit: 0,
    vpcSelected: true,
    availabilityZoneSelected: true,
    dbCredentialPasswordSelected: true,
    activeDirectorySelected: true,
    fsxNNameSelected: true,
    dbNameSelected: true,
    licenseIdSelected: true,
    isLoading: false,
    isLoadConfig: false,
    savedConfig: null,
    isMissingFieldsInLoad: false,
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
        },
        setDBNameValue(state, action: PayloadAction<any>) {
            state.dbNameSelected = action.payload;
        },
        setIsLoading(state, action: PayloadAction<any>) {
            state.isLoading = action.payload;
        },
        setLicenseIdValue(state, action: PayloadAction<any>) {
            state.licenseIdSelected = action.payload;
        },
        setCreateHit(state, action: PayloadAction<any>) {
            state.isCreateHit = action.payload;
        },
        setIsLoadConfig(state, action: PayloadAction<any>) {
            state.isLoadConfig = action.payload;
        },
        setSavedConfig(state, action: PayloadAction<any>) {
            state.savedConfig = action.payload;
        },
        setIsMissingFieldsInLoad(state, action: PayloadAction<any>) {
            state.isMissingFieldsInLoad = action.payload;
        }
    }
});

export const {
    setCreateHit,
    setCreatePressed,
    setVPCSelectedValue,
    setAZSelectedValue,
    setDBCredentialPasswordValue,
    setActiveDirectoryValue,
    setFSXNNameValue,
    setDBNameValue,
    setIsLoading,
    setLicenseIdValue,
    setIsLoadConfig,
    setSavedConfig,
    setIsMissingFieldsInLoad
} = msSqlActionSlice.actions;
export default msSqlActionSlice;
