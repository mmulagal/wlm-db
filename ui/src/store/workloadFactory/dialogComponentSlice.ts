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
        showBullets?: boolean;
        bulletPoints?: string[];
    };
    actionsDisabled?: boolean;
    requireAcknowledge?: boolean;
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
    actionsDisabled: false,
    requireAcknowledge: false
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
        setActionsDisabled: (state, action: PayloadAction<boolean>) => {
            state.actionsDisabled = action.payload;
        },
        setRequireAcknowledge: (state, action: PayloadAction<boolean>) => {
            state.requireAcknowledge = action.payload;
        },
        resetDialogComponent: () => initialState
    }
});

export const {
    setDialogError,
    setDialogErrorWithTooltip,
    setActionsDisabled,
    setRequireAcknowledge,
    resetDialogComponent
} = dialogComponentSlice.actions;
export default dialogComponentSlice;
