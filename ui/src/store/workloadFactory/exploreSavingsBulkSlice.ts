import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ExploreSavingsBulkSliceEntities } from '../../utils/types/exploreSavingsBulkType';

const initialHeaderState: ExploreSavingsBulkSliceEntities = {
    selectedRowsForExploreSavingsEBSBulk: [],
    selectedRowsForExploreSavingsOnPremBulk: [],
    selectedRowsForExploreSavingsOracleOnPremBulk: [],
    selectedRowsForExploreSavingsOracleEbsBulk: [],
    ebsTCOAction: '',
    bulkAuthCredentials: {},
    // rows that require auth when doing a bulk action
    rowsRequiringAuthBulk: [],
    bulkAuthStatus: {},
    triggerBulkDataFetch: false,
    partialDataBannerAuthedHostKeys: []
};

const exploreSavingsBulkSlice = createSlice({
    name: 'exploreSavingsBulk',
    initialState: initialHeaderState,
    reducers: {
        setSelectedRowsForExploreSavingsEBSBulk: (state, action: PayloadAction<any>) => {
            state.selectedRowsForExploreSavingsEBSBulk = action.payload;
        },
        setSelectedRowsForExploreSavingsOnPremBulk: (state, action: PayloadAction<any>) => {
            state.selectedRowsForExploreSavingsOnPremBulk = action.payload;
        },
        setSelectedRowsForExploreSavingsOracleOnPremBulk: (state, action: PayloadAction<any>) => {
            state.selectedRowsForExploreSavingsOracleOnPremBulk = action.payload;
        },
        setSelectedRowsForExploreSavingsOracleEbsBulk: (state, action: PayloadAction<any>) => {
            state.selectedRowsForExploreSavingsOracleEbsBulk = action.payload;
        },
        setEbsTCOAction: (state, action: PayloadAction<any>) => {
            state.ebsTCOAction = action.payload;
        },
        setBulkAuthCredentials: (state, action) => {
            state.bulkAuthCredentials = {
                ...state.bulkAuthCredentials,
                ...action.payload
            };
        },
        setRowsRequiringAuthBulk: (state, action: PayloadAction<any>) => {
            state.rowsRequiringAuthBulk = action.payload;
        },
        resetRowsRequiringAuthBulk: state => {
            state.rowsRequiringAuthBulk = [];
        },
        resetBulkAuthCredentials: state => {
            state.bulkAuthCredentials = {};
        },
        setBulkAuthStatus: (state, action: PayloadAction<any>) => {
            state.bulkAuthStatus = {
                ...state.bulkAuthStatus,
                ...action.payload
            };
        },
        resetBulkAuthStatus: state => {
            state.bulkAuthStatus = {};
        },
        resetBulkAuthCredentialsAndStatus: state => {
            state.bulkAuthCredentials = {};
            state.bulkAuthStatus = {};
        },
        setTriggerBulkDataFetch: (state, action: PayloadAction<boolean>) => {
            state.triggerBulkDataFetch = action.payload;
        },
        addPartialDataBannerAuthedHostKeys: (state, action: PayloadAction<string[]>) => {
            const nextKeys = new Set(state.partialDataBannerAuthedHostKeys || []);
            action.payload.forEach(key => nextKeys.add(key));
            state.partialDataBannerAuthedHostKeys = [...nextKeys];
        },
        resetPartialDataBannerAuthedHostKeys: state => {
            state.partialDataBannerAuthedHostKeys = [];
        }
    }
});

export const {
    setSelectedRowsForExploreSavingsEBSBulk,
    setSelectedRowsForExploreSavingsOnPremBulk,
    setSelectedRowsForExploreSavingsOracleOnPremBulk,
    setSelectedRowsForExploreSavingsOracleEbsBulk,
    setEbsTCOAction,
    setBulkAuthCredentials,
    setRowsRequiringAuthBulk,
    resetRowsRequiringAuthBulk,
    resetBulkAuthCredentials,
    setBulkAuthStatus,
    resetBulkAuthStatus,
    resetBulkAuthCredentialsAndStatus,
    setTriggerBulkDataFetch,
    addPartialDataBannerAuthedHostKeys,
    resetPartialDataBannerAuthedHostKeys
} = exploreSavingsBulkSlice.actions;

export default exploreSavingsBulkSlice;
