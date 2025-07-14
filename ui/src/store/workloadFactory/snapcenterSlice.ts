import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SnapCenterEntities } from '../../utils/types/snapCenterTypes';

export const initialSandboxState: SnapCenterEntities = {
    selectedAgent: [],
    dataMap: {}
};

const snapCenterSlice = createSlice({
    name: 'snapCenter',
    initialState: initialSandboxState,
    reducers: {
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

export const { setSelectedAgent, setDataForRow, clearDataForRow, cancelProtectionForRow } = snapCenterSlice.actions;

export default snapCenterSlice;
