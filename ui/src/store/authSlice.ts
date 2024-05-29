import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
    accountId: string;
    accessToken: string;
    resourceId: string | (string | null)[] | null;
    resourceName: string | (string | null)[] | null;
    workspaceId?: string;
    pathname?: string;
    loading?: boolean;
    isDemoMode?: boolean;
    features: any;
    isWorkloadFactory: boolean;
    isInventoryV2: boolean;
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
    isInventoryV2: false // This flag is added to check if new inventory has to run or old.
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
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
        }
    }
});

export const {
    updateAccountId,
    updateAuthSuccess,
    updateResourceId,
    updateResourceName,
    updateWorkspaceId,
    updatePathname,
    updateIsLoading,
    updateIsDemoMode,
    updateIsWorkloadfactory,
    updateFeatures
} = authSlice.actions;

export default authSlice;
