import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ResourceEntities } from '../../utils/types/resourceTypes'; 

const initialState: ResourceEntities = {
    tables: [],
    ready: false
};

const resourceSlice = createSlice({
    name: 'resources',
    initialState,
    reducers: {
        setResourceTables: (state, action: PayloadAction<any>) => {
            state.ready = true;
            action.payload.map((value: any) => {
                const tableRow = state.tables.find( (table) =>
                {return (table.databaseName === value.databaseName) && (table.tableName === value.tableName)});
                if(!tableRow) {
                    state.tables = [...state.tables, value]
                }
            });
        },
        resetMssqlTables: (state) => {
            state.tables = [];
            state.ready = false;
        }
    }
});

export const {
    setResourceTables,
    resetMssqlTables
} = resourceSlice.actions;
export default resourceSlice;