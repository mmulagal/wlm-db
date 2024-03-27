import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const initialSandboxState: any = {
    selectedSourceHost: null,
    selectedSourceInstance: null,
    selectedSourceDatabase: null,
    selectedMount: 'Auto-assign mount point',
    mountPath: ''
};

const sandboxSlice = createSlice({
    name: 'sandbox',
    initialState: initialSandboxState,
    reducers: {
        setSelectedSourceHost: (state, action: PayloadAction<any>) => {
            state.selectedSourceHost = action.payload;
        },
        setSelectedSourceInstance: (state, action: PayloadAction<any>) => {
            state.selectedSourceInstance = action.payload;
        },
        setSelectedSourceDatabase: (state, action: PayloadAction<any>) => {
            state.selectedSourceDatabase = action.payload;
        },
        setSelectedMount: (state, action: PayloadAction<any>) => {
            state.selectedMount = action.payload;
        },
        setMountPath: (state, action: PayloadAction<any>) => {
            state.mountPath = action.payload;
        }
    }
});

export const {
    setSelectedSourceHost,
    setMountPath,
    setSelectedMount,
    setSelectedSourceInstance,
    setSelectedSourceDatabase
} = sandboxSlice.actions;

export default sandboxSlice;
