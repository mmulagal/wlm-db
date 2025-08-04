import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { OracleEntities } from '../../utils/types/oracleTypes';
import { WELL_ARCHITECTED_TABS } from '../../utils/consts';

export const initialOracleState: OracleEntities = {
    selectedOracleInnerPageTab: WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS
};

const oracleSlice = createSlice({
    name: 'oracleSlice',
    initialState: initialOracleState,
    reducers: {
        setSelectedOracleInnerPageTab: (state, action: PayloadAction<string>) => {
            state.selectedOracleInnerPageTab = action.payload;
        }
    }
});

export const { setSelectedOracleInnerPageTab } = oracleSlice.actions;

export default oracleSlice;
