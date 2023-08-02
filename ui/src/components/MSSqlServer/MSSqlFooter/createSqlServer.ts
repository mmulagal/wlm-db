import { Dispatch } from '@reduxjs/toolkit';
import {
    setActiveDirectoryValue,
    setAZSelectedValue,
    setCreatePressed,
    setDBCredentialPasswordValue,
    setFSXNNameValue,
    setVPCSelectedValue
} from '../../../store/mssql/msSqlActionSlice';

export const handleCreateSQLServer = (state: any, dispatch: Dispatch) => {
    const payload = {};
    dispatch(setCreatePressed(true));
    //Check for VPC values
    if (state.regionAndVpc.selectedVPC === null) {
        dispatch(setVPCSelectedValue(false));
    } else {
        dispatch(setVPCSelectedValue(true));
    }
    //Check for AZ values
    if (
        !state.availabilityZones.selectedAzNode1 ||
        !state.availabilityZones.selectedSubnetNode1 ||
        !state.availabilityZones.selectedAzNode2 ||
        !state.availabilityZones.selectedSubnetNode2
    ) {
        dispatch(setAZSelectedValue(false));
    } else {
        dispatch(setAZSelectedValue(true));
    }

    //Check for DB cred password
    dispatch(setDBCredentialPasswordValue(!state.dbCredentials.password ? false : true));

    //Check of AD values
    if (!state.activeDirectory.domainAddress || !state.activeDirectory.userName || !state.activeDirectory.password) {
        dispatch(setActiveDirectoryValue(false));
    } else {
        dispatch(setActiveDirectoryValue(true));
    }

    //Check for FsxN Name
    dispatch(setFSXNNameValue(!state.fsxN.fsxNName ? false : true));
};
