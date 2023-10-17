import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PreviewPanelEntities } from '../../utils/types/previewPanelTypes';

const initialState: PreviewPanelEntities = {
    showPanel: false,
    type: '',
    data: {}
};

const previewPanelSlice = createSlice({
    name: 'previewPanel',
    initialState,
    reducers: {
        setShowPreviewPanel: (state, action: PayloadAction<any>) => {
            state.showPanel = action.payload;
        },
        setPanelType: (state, action: PayloadAction<any>) => {
            state.type = action.payload;
        },
        setPanelData: (state, action: PayloadAction<any>) => {
            state.data = action.payload;
        }
    }
});

export const { setShowPreviewPanel, setPanelType, setPanelData } = previewPanelSlice.actions;
export default previewPanelSlice;
