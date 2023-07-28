import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GENERAL } from '../../utils/appConstants';
import { MssqlFormEntities } from '../../utils/types/mssqlTypes';

const initialState: any = {
    awsAccount: {
        credentials: ''
    },
    regionAndVpc: {},
    securityGroup: {
        selectedSecurityType: GENERAL.USE_AN_EXISTING_SECURITY,
        selectedExistingSecurityGroup: ''
    },
    operatingSystem: {
        selectedOperatingSystem: GENERAL.WIN_SERVER_2016
    },
    dbVersion: GENERAL.SQL_SERVER_2016
};

const mssqlFormSlice = createSlice({
    name: 'mssqlForm',
    initialState,
    reducers: {
        setSelectedOperatingSystem(state, action: PayloadAction<any>) {
            state.operatingSystem.selectedOperatingSystem = action.payload;
        },
        setSelectedSecurityGroup(state, action: PayloadAction<any>) {
            state.securityGroup.selectedSecurityType = action.payload;
        },
        setSelectedExistingSecurityGroup(state, action: PayloadAction<any>) {
            state.securityGroup.selectedExistingSecurityGroup = action.payload;
        },
        setDBVersion(state, action: PayloadAction<any>) {
            state.dbVersion = action.payload;
        }
    }
});

export const { setSelectedOperatingSystem, setSelectedSecurityGroup, setSelectedExistingSecurityGroup, setDBVersion } =
    mssqlFormSlice.actions;
export default mssqlFormSlice;
