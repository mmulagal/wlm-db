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
import { GENERAL } from '../../../utils/appConstants';
import { MssqlRequestBody } from '../../../utils/types/mssqlTypes';

const createMssqlPayload = (state: any) => {
    let payload: MssqlRequestBody;
    const licenseId = (() => {
        const licenseType = state.mssqlForm.license?.selectedLicenseType;
        if (licenseType === GENERAL.LICENSE_INCLUDED_AMI) {
            return state.mssqlForm.license?.selectedLicenseId?.value;
        } else {
            return state.mssqlForm.license?.selectedCustomAMI;
        }
    })();

    const encryptionKey = (() => {
        const encryptionType = state.mssqlForm.encryption?.encryptionType;
        if (encryptionType === GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT) {
            return state.mssqlForm.encryption?.selectedRow[0]?.name;
        } else {
            return state.mssqlForm.encryption?.encryptionArn;
        }
    })();

    const fileSystem = (() => {
        let fsObj = {
            fsxFileSystemId: '',
            fsxUsername: '',
            fsxPassword: ''
        };
        const fsxnType = state.mssqlForm.fsxN?.fsxNType;
        if (fsxnType === GENERAL.CREATE_NEW_FSXN) {
            fsObj.fsxFileSystemId = state.mssqlForm.fsxN?.fsxNName;
            fsObj.fsxUsername = state.mssqlForm.fsxN?.fsxNNewUserName;
            fsObj.fsxPassword = state.mssqlForm.fsxN?.fsxNPassword;
        } else {
            fsObj.fsxFileSystemId = state.mssqlForm.fsxN?.fsxNExistingName?.value;
            fsObj.fsxUsername = state.mssqlForm.fsxN?.fsxNExistingUserName;
            fsObj.fsxPassword = state.mssqlForm.fsxN?.fsxNPassword;
        }
        return fsObj;
    })();

    const databaseSize = (() => {
        let capacity = state.mssqlForm.storageCapacity?.capacity;
        const unit = state.mssqlForm.storageCapacity?.unit?.value;
        if (unit === 'TiB') {
            capacity = 1024 * capacity;
        }
        return capacity;
    })();

    const fsxVolThroughput = (() => {
        const value = state.mssqlForm.throughput?.value;
        const value1 = value.split(' ');
        if (value1.length === 2) {
            if (value1[1] === 'GBps') {
                return value1[0] * 1000;
            } else {
                return value1[0];
            }
        } else {
            return value;
        }
    })();

    const fsxIOPS = (() => {
        const type = state.mssqlForm.provisionedIOPS.provisionedType;
        if (type === GENERAL.AUTOMATIC) {
            return 3;
        } else {
            return state.mssqlForm.provisionedIOPS?.IOPSValue;
        }
    })();

    payload = {
        networkConfiguration: {
            vpcId: state.mssqlForm.regionAndVpc.selectedVPC?.data?.id,
            vpcCidr: state.mssqlForm.regionAndVpc.selectedVPC?.data?.cidrBlock,
            availabilityZone1: state.mssqlForm.availabilityZones.selectedAzNode1?.value,
            privateSubnet1Id: state.mssqlForm.availabilityZones.selectedSubnetNode1?.data?.id,
            routeTable1Id: state.mssqlForm.availabilityZones.selectedSubnetNode1?.data?.routeTableId,
            availabilityZone2: state.mssqlForm.availabilityZones.selectedAzNode2?.value,
            privateSubnet2Id: state.mssqlForm.availabilityZones.selectedSubnetNode2?.data?.id,
            routeTable2Id: state.mssqlForm.availabilityZones.selectedSubnetNode2?.data?.routeTableId
        },
        ec2Configuration: {
            workloadInstanceType: state.mssqlForm.instanceType?.value,
            keyPairName: state.mssqlForm.keyPair.selectedKeyPair?.value
        },
        adConfiguration: {
            adScenarioType: state.mssqlForm.activeDirectory?.scenarioType,
            domainUsername: state.mssqlForm.activeDirectory?.userName,
            domainPassword: state.mssqlForm.activeDirectory?.password,
            domainDnsname: state.mssqlForm.activeDirectory?.domainName?.value,
            dnsIpaddress: state.mssqlForm.activeDirectory?.domainAddress,
            securityGroupId: state.mssqlForm.activeDirectory?.domainName?.data?.securityGroupId
        },
        fsxConfiguration: {
            fsxFileSystemId: fileSystem?.fsxFileSystemId,
            fsxUsername: fileSystem?.fsxUsername,
            fsxPassword: fileSystem?.fsxPassword,
            databaseSize: databaseSize,
            ontapSgGroupId: state.mssqlForm.securityGroup?.selectedExistingSecurityGroup?.value,
            fsxVolThroughput: fsxVolThroughput,
            fsxIOPS: fsxIOPS,
            encryptionKey: encryptionKey
        },
        sqlConfiguration: {
            sqlAmiId: licenseId,
            serviceAccountName: state.mssqlForm.dbCredentials?.name,
            serviceAccountPassword: state.mssqlForm.dbCredentials?.password,
            sqlFciName: state.mssqlForm.dbName
        },
        topicArn: state.mssqlForm.simpleNotification.snsState ? state.mssqlForm.simpleNotification?.snsARN?.value : '',
        enableCloudWatch: state.mssqlForm.cloudWatch,
        tags: state.mssqlForm.tags
    };
    return payload;
};

const handleCreateSQLServer = (state: any, dispatch: Dispatch) => {
    let payload;
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
        payload = createMssqlPayload(state);
        // payload = JSON.stringify(createMssqlPayload(state), null, 2);
        console.log('Deploy Payload', payload);
    } else {
        console.log('Action required');
    }
    return payload;
};

export { createMssqlPayload, handleCreateSQLServer };
