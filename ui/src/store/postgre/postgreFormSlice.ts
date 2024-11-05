import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GENERAL } from '../../utils/appConstants';

export const initialPostgreState: any = {
    selectedDatabaseType: '',
    postgreDeploymentType: GENERAL.STANDALONE_INSTANCE,
    postgreOS: {},
    postgreVersion: {},
    postgreServerName: 'pgsqlserver',
    dbCredentials: {
        name: 'postgres',
        password: ''
    }
};

const postgreFormSlice = createSlice({
    name: 'postgreForm',
    initialState: initialPostgreState,
    reducers: {
        setSelectedDatabaseType: (state, action: PayloadAction<string>) => {
            state.selectedDatabaseType = action.payload;
        },
        setPostgreDeploymentType: (state, action: PayloadAction<string>) => {
            state.postgreDeploymentType = action.payload;
        },
        setPostgreOperatingSystem: (state, action: PayloadAction<string>) => {
            state.postgreOS = action.payload;
        },
        setPostgreVersion: (state, action: PayloadAction<string>) => {
            state.postgreVersion = action.payload;
        },
        setPostgreServerName: (state, action: PayloadAction<string>) => {
            state.postgreServerName = action.payload;
        },
        // databaseCredentials
        setPostgreDBCredentialsName(state, action: PayloadAction<any>) {
            state.dbCredentials.name = action.payload;
        },
        setPostgreDBCredentialsPassword(state, action: PayloadAction<any>) {
            state.dbCredentials.password = action.payload;
        }
    }
});

export const {
    setSelectedDatabaseType,
    setPostgreDeploymentType,
    setPostgreOperatingSystem,
    setPostgreVersion,
    setPostgreServerName
} = postgreFormSlice.actions;

export default postgreFormSlice;
