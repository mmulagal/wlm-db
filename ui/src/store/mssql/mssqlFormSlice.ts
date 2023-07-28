import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GENERAL } from '../../utils/appConstants';
import { MssqlFormEntities } from '../../utils/types/mssqlTypes';

const initialState: any = {
    awsAccount: {
        credentials: ''
    },
    regionAndVpc: {},
    operatingSystem: {
        selectedOperatingSystem: GENERAL.WIN_SERVER_2016
    }
};

const mssqlFormSlice = createSlice({
    name: 'mssqlForm',
    initialState,
    reducers: {
        setSelectedOperatingSystem(state, action: PayloadAction<any>) {
            state.operatingSystem.selectedOperatingSystem = action.payload;
        }
    }
});

export const { setSelectedOperatingSystem } = mssqlFormSlice.actions;
export default mssqlFormSlice;
