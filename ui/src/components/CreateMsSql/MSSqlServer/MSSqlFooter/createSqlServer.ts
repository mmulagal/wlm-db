import { Dispatch } from '@reduxjs/toolkit';
import {
    setActiveDirectoryValue,
    setAZSelectedValue,
    setCreateHit,
    setCreatePressed,
    setDBCredentialPasswordValue,
    setDBNameValue,
    setFSXNNameValue,
    setLicenseIdValue,
    setVPCSelectedValue
} from '../../../../store/mssql/msSqlActionSlice';
import { GENERAL } from '../../../../utils/appConstants';
import { AWS_MANAGED_AD, FORM_OPTIONS, FSX_DEPLOYMENT_MODE, SQL_DEPLOYMENT_MODE } from '../../../../utils/consts';
import { MssqlRequestBody, TagObj } from '../../../../utils/types/mssqlTypes';
import { dbPassVal, fsxPassVal, isFsxnExisting, isFsxnNew, isValidUserName } from '../../../../utils/utilityFunctions';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';

const createMssqlPayload = (state: any) => {
    let payload: MssqlRequestBody;
    const [licenseId, licenceName] = (() => {
        const licenseType = state.mssqlForm.license?.selectedLicenseType;
        if (licenseType === FORM_OPTIONS.LICENSE_AMI) {
            return [
                state.mssqlForm.license?.selectedLicenseId?.value,
                state.mssqlForm.license?.selectedLicenseId?.data?.amiName
            ];
        } else {
            return [
                state.mssqlForm.license?.selectedCustomAMI?.value,
                state.mssqlForm.license?.selectedCustomAMI?.data?.amiName
            ];
        }
    })();

    const encryptionKey = (() => {
        const encryptionType = state.mssqlForm.encryption?.encryptionType;
        if (encryptionType === GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT) {
            if (state.mssqlForm.encryption?.selectedRow) {
                return state.mssqlForm.encryption?.selectedRow[0]?.id;
            } else {
                return '';
            }
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
        if (isFsxnNew(fsxnType)) {
            fsObj.fsxUsername = state.mssqlForm.fsxN?.fsxNNewUserName;
            fsObj.fsxPassword = state.mssqlForm.fsxN?.fsxNPassword;
        } else {
            fsObj.fsxFileSystemId = state.mssqlForm.fsxN?.fsxNExistingName?.data?.fileSystemId;
            fsObj.fsxUsername = state.mssqlForm.fsxN?.fsxNExistingUserName;
            fsObj.fsxPassword = state.mssqlForm.fsxN?.fsxNPassword;
        }
        return fsObj;
    })();

    const databaseSize = (() => {
        let capacity = state.mssqlForm.storageCapacity?.capacity || 0;
        const unit = state.mssqlForm.storageCapacity?.unit?.value;
        if (unit === 'TiB') {
            capacity = 1024 * capacity;
        }
        return capacity;
    })();

    const fsxVolThroughput = (() => {
        const value = state.mssqlForm.throughput?.value || '128';
        const value1 = value.split(' ');
        if (value1?.length === 2) {
            if (value1[1] === 'GBps') {
                return value1[0] * 1024;
            } else {
                return value1[0];
            }
        } else {
            return value;
        }
    })();

    const fsxIOPS = (() => {
        const type = state.mssqlForm?.provisionedIOPS?.provisionedType;
        if (type === GENERAL.AUTOMATIC) {
            return 3;
        } else {
            return state.mssqlForm?.provisionedIOPS?.IOPSValue || 0;
        }
    })();

    const ontapSgGroupIdsList = (() => {
        let ontapSgGroupList = [];
        const sgType = state.mssqlForm.securityGroup?.selectedSecurityType;
        const vpcsg = state.mssqlForm.securityGroup?.selectedExistingSecurityGroup?.value;
        if (sgType === GENERAL.USE_AN_EXISTING_SECURITY && vpcsg) {
            ontapSgGroupList.push(vpcsg);
        }
        const fsxnType = state.mssqlForm.fsxN?.fsxNType;
        if (isFsxnExisting(fsxnType)) {
            const fsxsg = state.mssqlForm.fsxN?.fsxNExistingName?.data?.securityGroups || [];
            fsxsg.map((val: string) => {
                ontapSgGroupList.push(val);
            });
        }
        return ontapSgGroupList;
    })();

    const fsxDeploymentMode = (() => {
        const deploymentType = state.mssqlForm.dbDeploymentModel?.value;
        if (deploymentType === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            return FSX_DEPLOYMENT_MODE.SINGLE_AZ_1;
        } else {
            return FSX_DEPLOYMENT_MODE.MULTI_AZ_1;
        }
    })();

    const selectedSnapshotPolicy = (() => {
        if (state.mssqlForm.snapshotPolicyToggle === true) {
            return 'default';
        } else {
            return 'none';
        }
    })();

    payload = {
        networkConfiguration: {
            vpcId: state.mssqlForm.regionAndVpc.selectedVPC?.data?.id || '',
            vpcCidr: state.mssqlForm.regionAndVpc.selectedVPC?.data?.cidrBlock || '',
            availabilityZone1: state.mssqlForm.availabilityZones.selectedAzNode1?.value || '',
            privateSubnet1Id: state.mssqlForm.availabilityZones.selectedSubnetNode1?.data?.id || '',
            routeTable1Id: state.mssqlForm.availabilityZones.selectedSubnetNode1?.data?.routeTableId || '',
            availabilityZone2: state.mssqlForm.availabilityZones.selectedAzNode2?.value,
            privateSubnet2Id: state.mssqlForm.availabilityZones.selectedSubnetNode2?.data?.id,
            routeTable2Id: state.mssqlForm.availabilityZones.selectedSubnetNode2?.data?.routeTableId
        },
        ec2Configuration: {
            workloadInstanceType: state.mssqlForm.instanceType?.value || '',
            keyPairName: state.mssqlForm.keyPair.selectedKeyPair?.value || ''
        },
        adConfiguration: {
            adScenarioType: state.mssqlForm.activeDirectory?.scenarioType || AWS_MANAGED_AD,
            domainUsername: state.mssqlForm.activeDirectory?.userName || '',
            domainPassword: state.mssqlForm.activeDirectory?.password || '',
            domainDnsname: state.mssqlForm.activeDirectory?.domainName?.value || '',
            dnsIpaddress: state.mssqlForm.activeDirectory?.domainAddress || '',
            securityGroupId: state.mssqlForm.activeDirectory?.domainName?.data?.securityGroupId || ''
        },
        fsxConfiguration: {
            fsxDeploymentMode: fsxDeploymentMode,
            fsxFileSystemId: fileSystem?.fsxFileSystemId,
            fsxUsername: fileSystem?.fsxUsername,
            fsxPassword: fileSystem?.fsxPassword,
            databaseSize: databaseSize,
            ontapSgGroupId: ontapSgGroupIdsList,
            fsxVolThroughput: fsxVolThroughput,
            fsxIOPS: fsxIOPS,
            encryptionKey: encryptionKey || '',
            snapshotPolicy: selectedSnapshotPolicy || ''
        },
        sqlConfiguration: {
            sqlDeploymentMode: state.mssqlForm.dbDeploymentModel?.value || SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE,
            sqlAmiId: licenseId || '',
            sqlAmiName: licenceName || '',
            serviceAccountName: state.mssqlForm.dbCredentials?.name || '',
            serviceAccountPassword: state.mssqlForm.dbCredentials?.password || '',
            sqlCollation: state.mssqlForm.sqlServerCollation?.label || '',
            sqlServerName: state.mssqlForm.dbName || ''
        },
        topicArn: state.mssqlForm.simpleNotification.snsState ? state.mssqlForm.simpleNotification?.snsARN?.value : '',
        enableCloudWatch: state.mssqlForm.cloudWatch,
        tags: state.mssqlForm.tags.filter((tag: TagObj) => tag.key)
    };
    return payload;
};

const handleCreateSQLServer = (state: any, dispatch: Dispatch) => {
    let payload;
    dispatch(setCreatePressed(true));
    dispatch(setCreateHit(Math.random()));
    if (state.auth.isDemoMode) {
        payload = createMssqlPayload(state);
        console.log('Deploy Payload', payload);
    } else {
        const vpcStateValue = !state.mssqlForm.regionAndVpc.selectedVPC;

        const azStateValue =
            (state.mssqlForm.dbDeploymentModel?.label === GENERAL.FAILOVER_CLUSTER &&
                (!state.mssqlForm.availabilityZones.selectedAzNode1 ||
                    !state.mssqlForm.availabilityZones.selectedSubnetNode1 ||
                    !state.mssqlForm.availabilityZones.selectedAzNode2 ||
                    !state.mssqlForm.availabilityZones.selectedSubnetNode2)) ||
            (state.mssqlForm.dbDeploymentModel?.label === GENERAL.SINGLE_INSTANCE &&
                (!state.mssqlForm.availabilityZones.selectedAzNode1 ||
                    !state.mssqlForm.availabilityZones.selectedSubnetNode1));

        const dbCredStateValue = !state.mssqlForm.dbCredentials.password;

        const adStateValue =
            !state.mssqlForm.activeDirectory.domainAddress ||
            !state.mssqlForm.activeDirectory.domainName ||
            !state.mssqlForm.activeDirectory.userName ||
            !state.mssqlForm.activeDirectory.password;

        const fsxStateValue =
            (isFsxnNew(state.mssqlForm.fsxN.fsxNType) && !state.mssqlForm.fsxN.fsxNPassword) ||
            (isFsxnExisting(state.mssqlForm.fsxN.fsxNType) && !state.mssqlForm.fsxN.fsxNExistingName);

        const licenseIdCheck = !state.mssqlForm.license.selectedLicenseId;
        //Check for VPC values
        if (vpcStateValue) {
            dispatch(setVPCSelectedValue(false));
        } else {
            dispatch(setVPCSelectedValue(true));
        }
        //Check for AZ values
        if (azStateValue) {
            dispatch(setAZSelectedValue(false));
        } else {
            dispatch(setAZSelectedValue(true));
        }

        //Check for DB cred password
        dispatch(setDBCredentialPasswordValue(dbCredStateValue ? false : true));
        const checkForUserName = isValidUserName(state.mssqlForm.dbCredentials.name);

        //Check of AD values
        if (adStateValue) {
            dispatch(setActiveDirectoryValue(false));
        } else {
            dispatch(setActiveDirectoryValue(true));
        }

        //Check for FsxN Name
        dispatch(setFSXNNameValue(fsxStateValue ? false : true));

        //Check for DB Name - InvalidName
        const input = state.mssqlForm.dbName;
        const dataBaseNameValue =
            (input && input.length > 15) || !/^[a-zA-Z0-9]/.test(input?.charAt(0)) || !/^[a-zA-Z0-9/-]+$/.test(input);
        const isDBValueValid = dataBaseNameValue ? true : false;
        if (dataBaseNameValue) {
            dispatch(setDBNameValue(false));
        } else {
            dispatch(setDBNameValue(true));
        }

        //Check for License ID
        if (licenseIdCheck) {
            dispatch(setLicenseIdValue(false));
        } else {
            dispatch(setLicenseIdValue(true));
        }

        //Proceed for post call
        if (
            !vpcStateValue &&
            !azStateValue &&
            !dbCredStateValue &&
            !adStateValue &&
            !fsxStateValue &&
            !isDBValueValid &&
            !licenseIdCheck &&
            !checkForUserName &&
            !dbPassVal(state.mssqlForm.dbCredentials?.password) &&
            !fsxPassVal(state.mssqlForm.fsxN?.fsxNPassword)
        ) {
            payload = createMssqlPayload(state);
            console.log('Deploy Payload', payload);
        } else {
            const missingField = vpcStateValue
                ? 'VPC'
                : azStateValue
                ? 'Availability Zone'
                : dbCredStateValue
                ? 'DB credentials'
                : adStateValue
                ? 'Active Directory params'
                : fsxStateValue
                ? 'FSx'
                : licenseIdCheck
                ? 'License information'
                : '';
            if (state.chatbot.isShow) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: `Action required: ${missingField || 'some parameters'} ${
                            missingField ? 'is' : 'are'
                        } missing`
                    })
                );
            }
            console.log('Action required');
        }
    }
    return payload;
};

export { createMssqlPayload, handleCreateSQLServer };
