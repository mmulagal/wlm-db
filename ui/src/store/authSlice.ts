import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AUTH_STATUS } from '../utils/consts';


interface AuthState {
    status: string | null;
    error: string | null;
    accessToken: string;
}

interface PayloadAuthSuccess {
    accessToken: string;
}

const initialState: AuthState = {
    status: AUTH_STATUS.AUTH_STATUS_PROGRESS,
    error: '',
    accessToken: '',
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
        }
    }
});

export const { updateAuthSuccess, updateAuthFailed } = authSlice.actions;
export default authSlice;
