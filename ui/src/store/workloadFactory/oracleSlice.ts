import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { OracleEntities } from '../../utils/types/oracleTypes';
import { WELL_ARCHITECTED_TABS } from '../../utils/consts';

export const initialOracleState: OracleEntities = {
    selectedOracleInnerPageTab: WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS,
    visitedTabs: {},
    resourceDetails: {},
    resourceLoading: true
};

const oracleSlice = createSlice({
    name: 'oracleSlice',
    initialState: initialOracleState,
    reducers: {
        setSelectedOracleInnerPageTab: (state, action: PayloadAction<string>) => {
            state.selectedOracleInnerPageTab = action.payload;
        },
        setOracleResourceVisitedTabs: (state, action: PayloadAction<any>) => {
            state.visitedTabs[action.payload] = true;
        },
        resetOracleResourceVisitedTabs: state => {
            state.visitedTabs = {};
        },
        setOracleResourceDetails: (state, action: PayloadAction<any>) => {
            state.resourceDetails = action.payload;
        },
        setOracleResourceLoading: (state, action: PayloadAction<boolean>) => {
            state.resourceLoading = action.payload;
        }
    }
});

export const {
    setSelectedOracleInnerPageTab,
    setOracleResourceVisitedTabs,
    resetOracleResourceVisitedTabs,
    setOracleResourceDetails,
    setOracleResourceLoading
} = oracleSlice.actions;

export default oracleSlice;
