import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { InventoryBannerEntities } from '../../utils/types/inventoryBannerTypes';

export const initialInventoryBannerState: InventoryBannerEntities = {
    notRegisteredSQLView: false,
    notActiveSQLInstancesView: false,
    notRegisteredOracleDatabasesView: false,
    notOptimizedSQLInstancesView: false,
    notOptimizedOracleDatabaseView: false
};

const inventoryBannerSlice = createSlice({
    name: 'inventoryBannerSlice',
    initialState: initialInventoryBannerState,
    reducers: {
        setNotRegisteredSQLView: (state, action: PayloadAction<boolean>) => {
            state.notRegisteredSQLView = action.payload;
        },
        setNotActiveSQLInstancesView: (state, action: PayloadAction<boolean>) => {
            state.notActiveSQLInstancesView = action.payload;
        },
        setNotRegisteredOracleDatabasesView: (state, action: PayloadAction<boolean>) => {
            state.notRegisteredOracleDatabasesView = action.payload;
        },
        setNotOptimizedSQLInstancesView: (state, action: PayloadAction<boolean>) => {
            state.notOptimizedSQLInstancesView = action.payload;
        },
        setNotOptimizedOracleDatabaseView: (state, action: PayloadAction<boolean>) => {
            state.notOptimizedOracleDatabaseView = action.payload;
        }
    }
});

export const {
    setNotRegisteredSQLView,
    setNotActiveSQLInstancesView,
    setNotRegisteredOracleDatabasesView,
    setNotOptimizedSQLInstancesView,
    setNotOptimizedOracleDatabaseView
} = inventoryBannerSlice.actions;

export default inventoryBannerSlice;
