import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SnapCenterEntities } from '../../utils/types/snapCenterTypes';

export const initialSandboxState: SnapCenterEntities = {
    selectedAgent: [],
    data: null
};

const snapCenterSlice = createSlice({
    name: 'snapCenter',
    initialState: initialSandboxState,
    reducers: {
        setSelectedAgent: (state, action: PayloadAction<any>) => {
            state.selectedAgent = action.payload;
        },
        setConnectors: (state, action) => {
            state.data = action.payload;
        },
        clearConnectors: state => {
            state.data = null;
        }
    }
});

export const { setSelectedAgent, setConnectors, clearConnectors } = snapCenterSlice.actions;

export default snapCenterSlice;
