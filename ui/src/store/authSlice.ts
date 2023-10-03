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
    isDemoMode: false
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        updateAccountId: (state, action: PayloadAction<string>) => {
            state.accountId = action.payload;
        },
        updateAuthSuccess: (
            state,
            action: PayloadAction<PayloadAuthSuccess>
        ) => {
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
        }
    }
});

export const { 
    updateAccountId, 
    updateAuthSuccess, 
    updateResourceId, 
    updateResourceName ,
    updateWorkspaceId,
    updatePathname,
    updateIsLoading,
    updateIsDemoMode
} = authSlice.actions;

export default authSlice;
