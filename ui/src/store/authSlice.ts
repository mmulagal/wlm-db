import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
    userMetadata: {
        email: string;
        sub: string;
    };
    accountId: string;
    accessToken: string;
    resourceId: string | (string | null)[] | null;
    resourceName: string | (string | null)[] | null;
    workspaceId?: string;
    pathname?: string;
    loading?: boolean;
    isDemoMode: boolean;
    features: any;
    isWorkloadFactory: boolean;
    refreshBlocked: boolean;
    orgId: string;
    initialPathName?: string;
    isGovAccount: boolean;
    aiAnalysisEnabled: boolean;
}

interface PayloadAuthSuccess {
    accessToken: string;
}

const initialState: AuthState = {
    accountId: '',
    accessToken: '',
    resourceId: '',
    resourceName: '',
    workspaceId: '',
    pathname: '',
    loading: true,
    isDemoMode: false,
    features: {
        active: {
            'Platform.BlueXP/DarkTheme': false
        }
    },
    isWorkloadFactory: false,
    refreshBlocked: false,
    userMetadata: {
        email: '',
        sub: ''
    },
    orgId: '',
    initialPathName: '',
    isGovAccount: false,
    aiAnalysisEnabled: true
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        updateInitialPathName: (state, action: PayloadAction<string>) => {
            state.initialPathName = action.payload;
        },
        updateOrgId: (state, action: PayloadAction<string>) => {
            state.orgId = action.payload;
        },
        updateUserMetaData: (state, action: PayloadAction<{ email: string; sub: string }>) => {
            state.userMetadata = action.payload;
        },
        updateFeatures: (state, action: PayloadAction<string>) => {
            state.features = action.payload;
        },
        updateAccountId: (state, action: PayloadAction<string>) => {
            state.accountId = action.payload;
        },
        updateAuthSuccess: (state, action: PayloadAction<PayloadAuthSuccess>) => {
            const { accessToken } = action.payload;
            const loginToken = `Bearer ${accessToken}`;
            state.accessToken = loginToken;
        },
        updateResourceId: (state, action: PayloadAction<string | (string | null)[] | null>) => {
            state.resourceId = action.payload;
        },
        updateResourceName: (state, action: PayloadAction<string | (string | null)[] | null>) => {
            state.resourceName = action.payload;
        },
        updateWorkspaceId: (state, action: PayloadAction<string>) => {
            state.workspaceId = action.payload;
        },
        updatePathname: (state, action: PayloadAction<string>) => {
            state.pathname = action.payload;
        },
        updateIsLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        updateIsDemoMode: (state, action: PayloadAction<boolean>) => {
            state.isDemoMode = action.payload;
        },
        updateIsWorkloadfactory: (state, action: PayloadAction<boolean>) => {
            state.isWorkloadFactory = action.payload;
        },
        updateRefreshBlocked: (state, action: PayloadAction<boolean>) => {
            state.refreshBlocked = action.payload;
        },
        updateIsGovAccount: (state, action: PayloadAction<boolean>) => {
            state.isGovAccount = action.payload;
        },
        updateAiAnalysisEnabled: (state, action: PayloadAction<boolean>) => {
            state.aiAnalysisEnabled = action.payload;
        }
    }
});

export const {
    updateInitialPathName,
    updateOrgId,
    updateUserMetaData,
    updateAccountId,
    updateAuthSuccess,
    updateResourceId,
    updateResourceName,
    updateWorkspaceId,
    updatePathname,
    updateIsLoading,
    updateIsDemoMode,
    updateIsWorkloadfactory,
    updateFeatures,
    updateRefreshBlocked,
    updateIsGovAccount,
    updateAiAnalysisEnabled
} = authSlice.actions;

export default authSlice;
