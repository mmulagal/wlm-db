import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const initialExploreSavingsState: any = {
    selectedSnapshotFrequency: null,
    numberOfClonedCopies: 0,
    selectedCloneRefresh: null,
    monthlyChangeRate: null
};

const exploreSavingsSlice = createSlice({
    name: 'exploreSavings',
    initialState: initialExploreSavingsState,
    reducers: {
        setSelectedSnapshotFrequency(state, action: PayloadAction<any>) {
            state.selectedSnapshotFrequency = action.payload;
        },
        setNumberOfClonedCopies(state, action: PayloadAction<any>) {
            state.numberOfClonedCopies = action.payload;
        },
        setSelectedCloneRefresh(state, action: PayloadAction<any>) {
            state.selectedCloneRefresh = action.payload;
        },
        setMonthlyChangeRate(state, action: PayloadAction<any>) {
            state.monthlyChangeRate = action.payload;
        }
    }
});

export const { setSelectedSnapshotFrequency, setNumberOfClonedCopies, setSelectedCloneRefresh, setMonthlyChangeRate } =
    exploreSavingsSlice.actions;

export default exploreSavingsSlice;
