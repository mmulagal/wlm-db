import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const initialSandboxState: any = {
    selectedSourceHost: null,
    selectedSourceInstance: null,
    selectedSourceDatabase: null
};

const sandboxSlice = createSlice({
    name: 'sandbox',
    initialState: initialSandboxState,
    reducers: {
        setSelectedSourceHost: (state, action: PayloadAction<any>) => {
            state.selectedSourceHost = action.payload;
        },
        setSelectedSourceInstance: (state, action: PayloadAction<any>) => {
            state.selectedSourceHost = action.payload;
        },
        setSelectedSourceDatabase: (state, action: PayloadAction<any>) => {
            state.selectedSourceHost = action.payload;
        }
    }
});

export const { setSelectedSourceHost, setSelectedSourceInstance, setSelectedSourceDatabase } = sandboxSlice.actions;

export default sandboxSlice;
