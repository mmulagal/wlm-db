import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { reset } from 'numeral';
import { ResourceEntities } from '../../utils/types/resourceTypes';

interface DialogComponentState {
    showDialogError?: boolean;
    showTooltipInfo?: boolean;
    tooltipText?: string;
    primaryButtonLoading?: boolean;
    allActionsDisabled?: boolean;
    dialogPrimaryButtonDisabled?: boolean;
}

const initialState: DialogComponentState = {
    showDialogError: false,
    showTooltipInfo: false,
    tooltipText: '',
    primaryButtonLoading: false,
    allActionsDisabled: false,
    dialogPrimaryButtonDisabled: false
};

const dialogComponentSlice = createSlice({
    name: 'dialogComponent',
    initialState,
    reducers: {
        setDialogError: (state, action: PayloadAction<boolean>) => {
            state.showDialogError = action.payload;
        },
        setTooltipInfo: (state, action: PayloadAction<boolean>) => {
            state.showTooltipInfo = action.payload;
        },
        setTooltipText: (state, action: PayloadAction<string>) => {
            state.tooltipText = action.payload;
        },
        setPrimaryButtonLoading: (state, action: PayloadAction<boolean>) => {
            state.primaryButtonLoading = action.payload;
        },
        setAllActionsDisabled: (state, action: PayloadAction<boolean>) => {
            state.allActionsDisabled = action.payload;
        },
        setDialogPrimaryButtonDisabled: (state, action: PayloadAction<boolean>) => {
            state.dialogPrimaryButtonDisabled = action.payload;
        },
        resetDialogComponent: () => initialState
    }
});

export const {
    setDialogError,
    setTooltipInfo,
    setTooltipText,
    setPrimaryButtonLoading,
    setAllActionsDisabled,
    setDialogPrimaryButtonDisabled,
    resetDialogComponent
} = dialogComponentSlice.actions;
export default dialogComponentSlice;
