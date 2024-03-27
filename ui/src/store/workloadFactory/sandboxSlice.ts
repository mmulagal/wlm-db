import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const initialSandboxState: any = {
    selectedSourceHost: null,
    selectedSourceInstance: null,
    selectedSourceDatabase: null,
    selectedMount: 'Auto-assign mount point',
    mountPath: '',
    selectedTargetHost: null,
    selectedTargetInstance: null,
    selectedTargetDatabase: 'DBname_sandbox'
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
        },
        setSelectedTargetHost: (state, action: PayloadAction<any>) => {
            state.selectedTargetHost = action.payload;
        },
        setSelectedTargetInstance: (state, action: PayloadAction<any>) => {
            state.selectedTargetInstance = action.payload;
        },
        setSelectedTargetDatabase: (state, action: PayloadAction<any>) => {
            state.selectedTargetDatabase = action.payload;
        }
    }
});

export const {
    setSelectedSourceHost,
    setMountPath,
    setSelectedMount,
    setSelectedSourceInstance,
    setSelectedSourceDatabase,
    setSelectedTargetHost,
    setSelectedTargetInstance,
    setSelectedTargetDatabase
} = sandboxSlice.actions;

export default sandboxSlice;
