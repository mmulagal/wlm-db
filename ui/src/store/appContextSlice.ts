import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppContextState {
    accountId: string | null;
    isDemoMode: boolean;
    environment: string | null;
}

const initialState: AppContextState = {
    accountId: null,
    isDemoMode: false,
    environment: null,
};

const appContextSlice = createSlice({
    name: 'appContext',
    initialState,
    reducers: {
        setAppContext: (state, action: PayloadAction<AppContextState>) => {
            return { ...state, ...action.payload };
        },
        setAccountId: (state, action: PayloadAction<string>) => {
            state.accountId = action.payload;
        },
    }
});

export const { setAppContext, setAccountId } =
    appContextSlice.actions;
export default appContextSlice;
