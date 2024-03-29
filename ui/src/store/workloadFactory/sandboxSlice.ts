import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const initialSandboxState: any = {
    selectedSourceHost: null,
    selectedSourceInstance: null,
    selectedSourceDatabase: null,
    selectedMount: 'Auto-assign mount point',
    mountPath: '',
    selectedTargetHost: null,
    selectedTargetInstance: null,
    selectedTargetDatabase: 'DBname_sandbox',
    selectedTag: 'Dev',
    hideBanner: false,
    isCreateSandboxPressed: false,
    isDBNameAdded: true,
    isMountPathAdded: true
};

const sandboxSlice = createSlice({
    name: 'sandbox',
    initialState: initialSandboxState,
    reducers: {
        setIsMountPathAdded(state, action: PayloadAction<any>) {
            state.isMountPathAdded = action.payload;
        },
        setIsDBNameAdded(state, action: PayloadAction<any>) {
            state.isDBNameAdded = action.payload;
        },
        setCreateSandboxPressed(state, action: PayloadAction<any>) {
            state.isCreateSandboxPressed = action.payload;
        },
        setShowBanner: (state, action: PayloadAction<any>) => {
            state.hideBanner = action.payload;
        },
        setSelectedTag: (state, action: PayloadAction<any>) => {
            state.selectedTag = action.payload;
        },
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
    setShowBanner,
    setSelectedTag,
    setSelectedMount,
    setSelectedSourceInstance,
    setSelectedSourceDatabase,
    setSelectedTargetHost,
    setSelectedTargetInstance,
    setSelectedTargetDatabase,
    setCreateSandboxPressed,
    setIsDBNameAdded,
    setIsMountPathAdded
} = sandboxSlice.actions;

export default sandboxSlice;
