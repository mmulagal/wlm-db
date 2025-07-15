import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { reset } from 'numeral';
import { ResourceEntities } from '../../utils/types/resourceTypes';

interface DialogComponentState {
    dialogError?: {
        showDialogError?: boolean;
        errorMessage?: string;
    };
    dialogTooltip?: {
        showTooltipInfo?: boolean;
        tooltipText?: string;
    };
    primaryButtonLoading?: boolean;
    actionsDisabled?: boolean;
}

const initialState: DialogComponentState = {
    dialogError: {
        showDialogError: false,
        errorMessage: ''
    },
    dialogTooltip: {
        showTooltipInfo: false,
        tooltipText: ''
    },
    primaryButtonLoading: false,
    actionsDisabled: false
};

const dialogComponentSlice = createSlice({
    name: 'dialogComponent',
    initialState,
    reducers: {
        setDialogError: (state, action: PayloadAction<{ showDialogError: boolean; errorMessage?: string }>) => {
            state.dialogError = {
                showDialogError: action.payload.showDialogError,
                errorMessage: action.payload.errorMessage || ''
            };
        },
        setDialogErrorWithTooltip: (
            state,
            action: PayloadAction<{
                showDialogError: boolean;
                errorMessage?: string;
                showTooltipInfo?: boolean;
                tooltipText?: string;
            }>
        ) => {
            state.dialogError = {
                showDialogError: action.payload.showDialogError,
                errorMessage: action.payload.errorMessage || ''
            };
            state.dialogTooltip = {
                showTooltipInfo: action.payload.showTooltipInfo ?? false,
                tooltipText: action.payload.tooltipText ?? ''
            };
        },
        setPrimaryButtonLoading: (state, action: PayloadAction<boolean>) => {
            state.primaryButtonLoading = action.payload;
        },
        setActionsDisabled: (state, action: PayloadAction<boolean>) => {
            state.actionsDisabled = action.payload;
        },
        resetDialogComponent: () => initialState
    }
});

export const {
    setDialogError,
    setDialogErrorWithTooltip,
    setPrimaryButtonLoading,
    setActionsDisabled,
    resetDialogComponent
} = dialogComponentSlice.actions;
export default dialogComponentSlice;
