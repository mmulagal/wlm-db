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
}

const initialState: DialogComponentState = {
    dialogError: {
        showDialogError: false,
        errorMessage: ''
    },
    dialogTooltip: {
        showTooltipInfo: false,
        tooltipText: '',
        showBullets: false,
        bulletPoints: []
    },
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
                showBullets?: boolean;
                bulletPoints?: string[];
            }>
        ) => {
            state.dialogError = {
                showDialogError: action.payload.showDialogError,
                errorMessage: action.payload.errorMessage || ''
            };
            state.dialogTooltip = {
                showTooltipInfo: action.payload.showTooltipInfo ?? false,
                tooltipText: action.payload.tooltipText ?? '',
                showBullets: action.payload.showBullets ?? false,
                bulletPoints: action.payload.bulletPoints ?? []
            };
        },
        setActionsDisabled: (state, action: PayloadAction<boolean>) => {
            state.actionsDisabled = action.payload;
        },
        resetDialogComponent: () => initialState
    }
});

export const { setDialogError, setDialogErrorWithTooltip, setActionsDisabled, resetDialogComponent } =
    dialogComponentSlice.actions;
export default dialogComponentSlice;
