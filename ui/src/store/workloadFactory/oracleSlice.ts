import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { OracleEntities } from '../../utils/types/oracleTypes';
import { WELL_ARCHITECTED_TABS } from '../../utils/consts';

export const initialOracleState: OracleEntities = {
    selectedOracleInnerPageTab: WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS,
    visitedTabs: {},
    resourceDetails: {},
    resourceLoading: true,
    oracleOptimizeFilterTags: [],
    oracleDefaultFilterOptions: {},
    refreshOverview: false,
    refreshWellArchitect: false,
    refreshTimes: {
        overviewRefreshTime: '',
        optimizeRefreshTime: ''
    }
};

const oracleSlice = createSlice({
    name: 'oracleSlice',
    initialState: initialOracleState,
    reducers: {
        setOracleRefreshTimes: (
            state,
            action: PayloadAction<{ overviewRefreshTime?: string; optimizeRefreshTime?: string }>
        ) => {
            state.refreshTimes = { ...state.refreshTimes, ...action.payload };
        },
        setRefreshOracleOverview: (state, action: PayloadAction<boolean>) => {
            state.refreshOverview = action.payload;
        },
        setRefreshOracleWellArchitect: (state, action: PayloadAction<boolean>) => {
            state.refreshWellArchitect = action.payload;
        },

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
        },
        setOracleDefaultFilterOptions: (state, action: PayloadAction<any>) => {
            state.oracleDefaultFilterOptions = action.payload;
        },
        setOracleOptimizeFilterTags: (state, action: PayloadAction<any>) => {
            state.oracleOptimizeFilterTags = action.payload;
        }
    }
});

export const {
    setSelectedOracleInnerPageTab,
    setOracleResourceVisitedTabs,
    resetOracleResourceVisitedTabs,
    setOracleResourceDetails,
    setOracleResourceLoading,
    setOracleDefaultFilterOptions,
    setOracleOptimizeFilterTags,
    setRefreshOracleOverview,
    setRefreshOracleWellArchitect,
    setOracleRefreshTimes
} = oracleSlice.actions;

export default oracleSlice;
