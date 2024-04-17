import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SandboxEntities } from '../../utils/types/sandBoxTypes';

export const initialSandboxState: SandboxEntities = {
    isNA: false,
    getSandboxList: {
        sandboxListData: [],
        sandboxListLoading: false,
        sandboxListError: ''
    },
    aggregatedSandboxList: [],
    getSandboxSavings: {
        sandboxSavings: {
            consumedStorage: 0,
            savedStorage: 0,
            sandboxSavingsPercentage: 0
        },
        sandboxSavingsLoading: false,
        sandboxSavingsError: ''
    }
};

const sandboxSlice = createSlice({
    name: 'sandbox',
    initialState: initialSandboxState,
    reducers: {
        setSandboxListState: (state, action: PayloadAction<any>) => {
            state.getSandboxList = action.payload;
        },
        setAggregatedSandboxList: (state, action: PayloadAction<any>) => {
            state.aggregatedSandboxList = action.payload;
        },
        setSandboxSavingsState: (state, action: PayloadAction<any>) => {
            state.getSandboxSavings = action.payload;
        }
    }
});

export const { setSandboxListState, setAggregatedSandboxList, setSandboxSavingsState } = sandboxSlice.actions;

export default sandboxSlice;
