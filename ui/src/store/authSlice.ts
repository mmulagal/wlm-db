import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AUTH_STATUS } from '../utils/consts';


interface AuthState {
    accountId: string;
    status: string | null;
    error: string | null;
    accessToken: string;
    resourceId: string | (string | null)[] | null;
    resourceName: string | (string | null)[] | null;
    workspaceId?: string;
    pathname?: string;
}

interface PayloadAuthSuccess {
    accessToken: string;
}

const initialState: AuthState = {
    accountId: '',
    status: AUTH_STATUS.AUTH_STATUS_PROGRESS,
    error: '',
    accessToken: '',
    resourceId: '',
    resourceName: '',
    workspaceId: '',
    pathname: ''
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

            state.status = AUTH_STATUS.AUTH_STATUS_SUCCESS;
            state.accessToken = loginToken;
        },
        updateAuthFailed: (state, action: PayloadAction<string>) => {
            state.status = AUTH_STATUS.AUTH_STATUS_ERROR;
            state.error = action.payload;
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
    }
});

export const { 
    updateAccountId, 
    updateAuthSuccess, 
    updateAuthFailed, 
    updateResourceId, 
    updateResourceName ,
    updateWorkspaceId,
    updatePathname
} = authSlice.actions;

export default authSlice;
