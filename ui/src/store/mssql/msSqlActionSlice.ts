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
    pgDbNameSelected: true,
    licenseIdSelected: true,
    ouPathValid: true,
    isLoading: false, // To load page while create or save form or estimate cost
    isLoadConfig: false, // To show loading in load config
    isSaveConfigLoading: false, // To show loading while saving config
    savedConfig: null, // Last Saved or last loaded data
    isMissingFieldsInLoad: false,
    refetchApiCount: {
        expected: [],
        ran: [],
        isLoading: false
    },
    isRecommendedInstance: null, // To load default instance type on recommended templates load
    // True until the instance type is explicitly chosen by the user (dropdown
    // pick), a recommended-template tile, or a restored config. Controls the
    // size-based auto-recommendation effect in InstanceType.tsx.
    isAutoRecommendedSelection: true,
    refetchJobSummaryApi: false,
    permissionWarning: false,
    permissionData: {},
    deployRedirectToCfLink: null, // This link is when user has less permissions
    // DB create related checks
    isDbCreatePressed: false,
    isDbCreateHit: 0,
    dbCreateNameAdded: true,
    dbCreateDataNameAdded: true,
    dbCreateLogNameAdded: true,
    dbCreateDataSizeValid: true,
    dbCreateLogSizeValid: true,
    // Detect Host check - Inventory
    isDetectHostLoading: false, // If Detect host is loading on registerResourceCredentials API call
    isDetectReplicaHostLoading: false, // If Detect Replica host is loading on registerResourceCredentials API call
    databaseHostEntryPoint: '',
    pricingPayload: null
};

const msSqlActionSlice = createSlice({
    name: 'msSqlAction',
    initialState,
    reducers: {
        setDatabaseHostEntryPoint(state, action: PayloadAction<any>) {
            state.databaseHostEntryPoint = action.payload;
        },
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
        setOUPathValue(state, action: PayloadAction<any>) {
            state.ouPathValid = action.payload;
        },
        setDBNameValue(state, action: PayloadAction<any>) {
            state.dbNameSelected = action.payload;
        },
        setPgDBNameValue(state, action: PayloadAction<any>) {
            state.pgDbNameSelected = action.payload;
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
        setIsSaveConfigLoading(state, action: PayloadAction<any>) {
            state.isSaveConfigLoading = action.payload;
        },
        setSavedConfig(state, action: PayloadAction<any>) {
            state.savedConfig = action.payload;
        },
        setIsMissingFieldsInLoad(state, action: PayloadAction<any>) {
            state.isMissingFieldsInLoad = action.payload;
        },
        setRefetchApiCountExpected(state, action: PayloadAction<any>) {
            state.refetchApiCount.expected = action.payload;
        },
        setRefetchApiCountRan(state, action: PayloadAction<any>) {
            if (action.payload) {
                state.refetchApiCount.ran.push(action.payload);
            } else {
                state.refetchApiCount.ran = [];
            }
        },
        setRefetchApiCountLoading(state, action: PayloadAction<any>) {
            state.refetchApiCount.isLoading = action.payload;
        },
        setIsRecommendedInstance(state, action: PayloadAction<any>) {
            state.isRecommendedInstance = action.payload;
        },
        setIsAutoRecommendedSelection(state, action: PayloadAction<boolean>) {
            state.isAutoRecommendedSelection = action.payload;
        },
        setRefetchJobSummaryApi(state, action: PayloadAction<any>) {
            state.refetchJobSummaryApi = action.payload;
        },
        setPermissionWarning(state, action: PayloadAction<any>) {
            state.permissionWarning = action.payload;
        },
        setPermissionData(state, action: PayloadAction<any>) {
            state.permissionData = action.payload;
        },
        setDeployRedirectToCfLink(state, action: PayloadAction<any>) {
            state.deployRedirectToCfLink = action.payload;
        },
        setDbCreatePressed(state, action: PayloadAction<any>) {
            state.isDbCreatePressed = action.payload;
        },
        setDbCreateHit(state, action: PayloadAction<any>) {
            state.isDbCreateHit = action.payload;
        },
        setDbCreateNameAdded(state, action: PayloadAction<any>) {
            state.dbCreateNameAdded = action.payload;
        },
        setDbCreateDataNameAdded(state, action: PayloadAction<any>) {
            state.dbCreateDataNameAdded = action.payload;
        },
        setDbCreateLogNameAdded(state, action: PayloadAction<any>) {
            state.dbCreateLogNameAdded = action.payload;
        },
        setDbCreateDataSizeValid(state, action: PayloadAction<any>) {
            state.dbCreateDataSizeValid = action.payload;
        },
        setDbCreateLogSizeValid(state, action: PayloadAction<any>) {
            state.dbCreateLogSizeValid = action.payload;
        },
        setIsDetectHostLoading(state, action: PayloadAction<any>) {
            state.isDetectHostLoading = action.payload;
        },
        setIsDetectReplicaHostLoading(state, action: PayloadAction<any>) {
            state.isDetectReplicaHostLoading = action.payload;
        },
        setPricingPayload(state, action: PayloadAction<any>) {
            state.pricingPayload = action.payload;
        }
    }
});

export const {
    setCreateHit,
    setDatabaseHostEntryPoint,
    setCreatePressed,
    setVPCSelectedValue,
    setAZSelectedValue,
    setDBCredentialPasswordValue,
    setActiveDirectoryValue,
    setOUPathValue,
    setFSXNNameValue,
    setDBNameValue,
    setPgDBNameValue,
    setIsLoading,
    setLicenseIdValue,
    setIsLoadConfig,
    setIsSaveConfigLoading,
    setSavedConfig,
    setIsMissingFieldsInLoad,
    setRefetchApiCountExpected,
    setRefetchApiCountRan,
    setRefetchApiCountLoading,
    setIsRecommendedInstance,
    setIsAutoRecommendedSelection,
    setRefetchJobSummaryApi,
    setPermissionWarning,
    setPermissionData,
    setDeployRedirectToCfLink,
    setDbCreatePressed,
    setDbCreateHit,
    setDbCreateNameAdded,
    setDbCreateDataNameAdded,
    setDbCreateLogNameAdded,
    setDbCreateDataSizeValid,
    setDbCreateLogSizeValid,
    setIsDetectHostLoading,
    setIsDetectReplicaHostLoading,
    setPricingPayload
} = msSqlActionSlice.actions;
export default msSqlActionSlice;
