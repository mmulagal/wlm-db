import { Dispatch } from '@reduxjs/toolkit';
import {
    setActiveDirectoryValue,
    setAZSelectedValue,
    setCreatePressed,
    setDBCredentialPasswordValue,
    setDBNameValue,
    setFSXNNameValue,
    setVPCSelectedValue
} from '../../../store/mssql/msSqlActionSlice';

export const handleCreateSQLServer = (state: any, dispatch: Dispatch) => {
    const payload = {};
    dispatch(setCreatePressed(true));
    //Check for VPC values
    if (state.mssqlForm.regionAndVpc.selectedVPC === null) {
        dispatch(setVPCSelectedValue(false));
    } else {
        dispatch(setVPCSelectedValue(true));
    }
    //Check for AZ values
    if (
        !state.mssqlForm.availabilityZones.selectedAzNode1 ||
        !state.mssqlForm.availabilityZones.selectedSubnetNode1 ||
        !state.mssqlForm.availabilityZones.selectedAzNode2 ||
        !state.mssqlForm.availabilityZones.selectedSubnetNode2
    ) {
        dispatch(setAZSelectedValue(false));
    } else {
        dispatch(setAZSelectedValue(true));
    }

    //Check for DB cred password
    dispatch(setDBCredentialPasswordValue(!state.mssqlForm.dbCredentials.password ? false : true));

    //Check of AD values
    if (
        !state.mssqlForm.activeDirectory.domainAddress ||
        !state.mssqlForm.activeDirectory.userName ||
        !state.mssqlForm.activeDirectory.password
    ) {
        dispatch(setActiveDirectoryValue(false));
    } else {
        dispatch(setActiveDirectoryValue(true));
    }

    //Check for FsxN Name
    dispatch(setFSXNNameValue(!state.mssqlForm.fsxN.fsxNName ? false : true));

    //Check for DB Name - InvalidName
    if (state.mssqlForm.dbName.length > 0) {
        const input = state.mssqlForm.dbName;
        if (input.length > 16 || !/^[a-zA-Z_#&]/.test(input.charAt(0)) || !/^[a-zA-Z0-9_#&]+$/.test(input)) {
            dispatch(setDBNameValue(false));
        } else {
            dispatch(setDBNameValue(true));
        }
    }

    //Proceed for post call

    if (
        state.msSqlAction.vpcSelected &&
        state.msSqlAction.availabilityZoneSelected &&
        state.msSqlAction.dbCredentialPasswordSelected &&
        state.msSqlAction.activeDirectorySelected &&
        state.msSqlAction.fsxNNameSelected
    ) {
        console.log('enter');
    } else {
        console.log('rejected');
    }
};
