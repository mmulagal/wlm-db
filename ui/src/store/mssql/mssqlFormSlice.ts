import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GENERAL } from '../../utils/appConstants';
import { MssqlFormEntities } from '../../utils/types/mssqlTypes';

const initialState: any = {
    awsAccount: {
        credentials: ''
    },
    regionAndVpc: {
        selectedRegions: '',
        selectedVPC: ''
    },
    securityGroup: {
        selectedSecurityType: GENERAL.USE_AN_EXISTING_SECURITY,
        selectedExistingSecurityGroup: ''
    },
    operatingSystem: {
        selectedOperatingSystem: GENERAL.WIN_SERVER_2016
    },
    dbVersion: GENERAL.SQL_SERVER_2016,
    dbDeploymentModel: GENERAL.FAILOVER_CLUSTER,
    dbEdition: GENERAL.SQL_SERVER_STANDARD_EDITION
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
        },
        setSelectedRegionData(state, action: PayloadAction<any>) {
            state.regionAndVpc.selectedRegions = action.payload;
        },
        setSelectedVPC(state, action: PayloadAction<any>) {
            state.regionAndVpc.selectedVPC = action.payload;
        },
        setSelectedDBDeploymentModel(state, action: PayloadAction<any>) {
            state.dbDeploymentModel = action.payload;
        },
        setSelectedDBEdition(state, action: PayloadAction<any>) {
            state.dbEdition = action.payload;
        }
    }
});

export const {
    setSelectedOperatingSystem,
    setSelectedSecurityGroup,
    setSelectedExistingSecurityGroup,
    setDBVersion,
    setSelectedRegionData,
    setSelectedVPC,
    setSelectedDBDeploymentModel,
    setSelectedDBEdition
} = mssqlFormSlice.actions;
export default mssqlFormSlice;
