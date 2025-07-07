import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SnapCenterEntities } from '../../utils/types/snapCenterTypes';

export const initialSandboxState: SnapCenterEntities = {
    selectedAgent: []
};

const snapCenterSlice = createSlice({
    name: 'snapCenter',
    initialState: initialSandboxState,
    reducers: {
        setSelectedAgent: (state, action: PayloadAction<any>) => {
            state.selectedAgent = action.payload;
        }
    }
});

export const { setSelectedAgent } = snapCenterSlice.actions;

export default snapCenterSlice;
