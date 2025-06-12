import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GENERAL } from '../../utils/appConstants';
import { DBType } from '../../utils/consts';

export const initialPostgreState: any = {
    selectedDatabaseType: DBType.MSSQL,
    postgreDeploymentType: GENERAL.STANDALONE_INSTANCE,
    postgreOS: {},
    postgreVersion: '16',
    postgreServerName: 'pgsqlserver'
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
        setPostgreDBCredentialsName(state, action: PayloadAction<any>) {
            state.dbCredentials.name = action.payload;
        },
        setPostgreDBCredentialsPassword(state, action: PayloadAction<any>) {
            state.dbCredentials.password = action.payload;
        },
        // Update full form
        setPostgreForm(state, action: PayloadAction<any>) {
            return { ...state, ...action.payload };
        }
    }
});

export const {
    setSelectedDatabaseType,
    setPostgreDeploymentType,
    setPostgreOperatingSystem,
    setPostgreVersion,
    setPostgreServerName,
    setPostgreDBCredentialsName,
    setPostgreDBCredentialsPassword,
    setPostgreForm
} = postgreFormSlice.actions;

export default postgreFormSlice;
