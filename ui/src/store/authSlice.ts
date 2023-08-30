import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AUTH_STATUS } from '../utils/consts';


interface AuthState {
    status: string | null;
    error: string | null;
    accessToken: string;
    resourceId: string | (string | null)[] | null;
    resourceName: string | (string | null)[] | null;
}

interface PayloadAuthSuccess {
    accessToken: string;
}

const initialState: AuthState = {
    status: AUTH_STATUS.AUTH_STATUS_PROGRESS,
    error: '',
    accessToken: '',
    resourceId: '',
    resourceName: ''
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
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
        }
    }
});

export const { updateAuthSuccess, updateAuthFailed, updateResourceId, updateResourceName } = authSlice.actions;
export default authSlice;
