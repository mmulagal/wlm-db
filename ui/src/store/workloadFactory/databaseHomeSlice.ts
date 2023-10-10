import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DatabaseHostsEntities } from "../../utils/types/databaseHomeTypes";

const initialState: DatabaseHostsEntities = {
    getDatabaseHosts: {
        databaseHostsData: null,
        databaseHostsLoading: false,
        databaseHostsError: null
    },
};

const databaseHomeSlice = createSlice({
    name: 'databaseHome',
    initialState,
    reducers: {
        addDatabaseHosts: (state, action: PayloadAction<any>) => {
            state.getDatabaseHosts = action.payload;
        },
    }
});

export const {
    addDatabaseHosts
} = databaseHomeSlice.actions;

export default databaseHomeSlice;
