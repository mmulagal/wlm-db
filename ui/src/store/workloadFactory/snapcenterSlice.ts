import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SnapCenterEntities } from '../../utils/types/snapCenterTypes';

export interface ProtectionProcessStatus {
    step1Status: 'idle' | 'running' | 'done';
    step2Status: 'idle' | 'running' | 'done';
}

export interface ProtectionProcessState {
    [key: string]: ProtectionProcessStatus;
}

export const initialSandboxState: SnapCenterEntities = {
    selectedAgent: [],
    dataMap: {},
    workSpaceData: {},
    protectionProcessState: {}
};

const snapCenterSlice = createSlice({
    name: 'snapCenter',
    initialState: initialSandboxState,
    reducers: {
        startProtectionStep1: (state, action: PayloadAction<string>) => {
            const key = action.payload;
            state.protectionProcessState[key] ??= {
                step1Status: 'idle',
                step2Status: 'idle'
            };
            state.protectionProcessState[key].step1Status = 'running';
            state.protectionProcessState[key].step2Status = 'idle';
        },
        completeProtectionStep1: (state, action: PayloadAction<string>) => {
            const key = action.payload;
            if (state.protectionProcessState[key]) {
                state.protectionProcessState[key].step1Status = 'done';
                state.protectionProcessState[key].step2Status = 'running';
            }
        },
        completeProtectionStep2: (state, action: PayloadAction<string>) => {
            const key = action.payload;
            if (state.protectionProcessState[key]) {
                state.protectionProcessState[key].step2Status = 'done';
            }
        },
        resetProtectionProcess: (state, action: PayloadAction<string>) => {
            const key = action.payload;
            state.protectionProcessState[key] = {
                step1Status: 'idle',
                step2Status: 'idle'
            };
        },

        setWorkSpaceData: (state, action: PayloadAction<any>) => {
            state.workSpaceData = action.payload;
        },
        setSelectedAgent: (state, action: PayloadAction<any>) => {
            state.selectedAgent = action.payload;
        },
        setDataForRow: (state, action) => {
            const { key, stepData } = action.payload;
            if (!state.dataMap[key]) {
                state.dataMap[key] = {};
            }
            state.dataMap[key] = {
                ...state.dataMap[key],
                ...stepData
            };
        },
        clearDataForRow: (state, action) => {
            delete state.dataMap[action.payload.key];
        },
        cancelProtectionForRow: (state, action) => {
            const key = action.payload;
            if (state.dataMap[key]) {
                state.dataMap[key].cancelled = true;
            }
        }
    }
});

export const {
    setWorkSpaceData,
    setSelectedAgent,
    setDataForRow,
    clearDataForRow,
    startProtectionStep1,
    cancelProtectionForRow,
    resetProtectionProcess,
    completeProtectionStep1,
    completeProtectionStep2
} = snapCenterSlice.actions;

export default snapCenterSlice;
