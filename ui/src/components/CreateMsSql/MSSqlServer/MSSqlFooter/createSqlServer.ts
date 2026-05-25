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
    setOUPathValue,
    setVPCSelectedValue
} from '../../../../store/mssql/msSqlActionSlice';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
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
        }
        return [
            state.mssqlForm.license?.selectedCustomAMI?.value,
            state.mssqlForm.license?.selectedCustomAMI?.data?.amiName
        ];
    })();

    const encryptionKey = (() => {
        const encryptionType = state.mssqlForm.encryption?.encryptionType;
        if (encryptionType === GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT) {
            if (state.mssqlForm.encryption?.selectedRow) {
                return state.mssqlForm.encryption?.selectedRow[0]?.id;
            }
            return '';
        }
        return state.mssqlForm.encryption?.encryptionArn;
    })();

    const fileSystem = (() => {
        const fsObj = {
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
            }
            return value1[0];
        }
        return value;
    })();

    const fsxIOPS = (() => {
        const type = state.mssqlForm?.provisionedIOPS?.provisionedType;
        if (type === GENERAL.AUTOMATIC) {
            return 3;
        }
        return state.mssqlForm?.provisionedIOPS?.IOPSValue || 0;
    })();

    const ontapSgGroupIdsList = (() => {
        const ontapSgGroupList: string[] = [];
        const selectedSGs = state.mssqlForm.securityGroup?.selectedExistingSecurityGroup;
        const sgsArray = Array.isArray(selectedSGs) ? selectedSGs : [];
        sgsArray.forEach((sg: any) => {
            const sgId = sg?.data?.id || sg?.id || sg?.value;
            if (sgId) ontapSgGroupList.push(sgId);
        });
        return ontapSgGroupList;
    })();

    const fsxDeploymentMode = (() => {
        const fsxnType = state.mssqlForm.fsxN?.fsxNType;
        if (isFsxnExisting(fsxnType)) {
            const fsxDeploymentType = state.mssqlForm.fsxN?.fsxNExistingName?.data?.deploymentType || '';
            if (fsxDeploymentType) {
                return fsxDeploymentType;
            }
        }
        const deploymentType = state.mssqlForm.dbDeploymentModel?.value;
        if (deploymentType === SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE) {
            return FSX_DEPLOYMENT_MODE.SINGLE_AZ_1;
        }
        return FSX_DEPLOYMENT_MODE.MULTI_AZ_1;
    })();

    const selectedSnapshotPolicy = (() => {
        if (state.mssqlForm.snapshotPolicyToggle === true) {
            return 'daily_weekretention';
        }
        return 'none';
    })();

    // Check if MSSQL Advanced Create mode (Standard Create = Advanced)
    const isMssqlAdvancedCreate = state.mssqlForm.selectConfig === SELECT_CONFIG.STANDARD_CREATE;

    // Build adConfiguration with conditional fields
    const adConfiguration: any = {
        adScenarioType: state.mssqlForm.activeDirectory?.scenarioType || AWS_MANAGED_AD,
        domainUsername: state.mssqlForm.activeDirectory?.userName || '',
        domainPassword: state.mssqlForm.activeDirectory?.password || '',
        domainDnsname: state.mssqlForm.activeDirectory?.domainName?.value || '',
        dnsIpaddress: state.mssqlForm.activeDirectory?.domainAddress || '',
        securityGroupId: ''
    };

    // Only add these fields in MSSQL Advanced Create mode
    if (isMssqlAdvancedCreate) {
        const preferredDC = state.mssqlForm.activeDirectory?.preferredDomainController || '';
        const ouPath = state.mssqlForm.activeDirectory?.preferredOUPath || '';
        const adGroup = state.mssqlForm.activeDirectory?.targetADGroup || '';

        // Always add these fields in Advanced mode (even if empty)
        adConfiguration.preferredDomainController = preferredDC;
        adConfiguration.ouPath = ouPath;
        adConfiguration.adGroup = adGroup;
    }

    // Build sqlConfiguration with conditional fields
    const sqlConfiguration: any = {
        sqlDeploymentMode: state.mssqlForm.dbDeploymentModel?.value || SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE,
        isCustomAmi: state.mssqlForm.license?.selectedLicenseType === FORM_OPTIONS.CUSTOM_AMI,
        sqlAmiId: licenseId || '',
        sqlAmiName: licenceName || '',
        serviceAccountName: state.mssqlForm.dbCredentials?.name || '',
        serviceAccountPassword: state.mssqlForm.dbCredentials?.password || '',
        sqlCollation: state.mssqlForm.sqlServerCollation?.label || '',
        sqlServerName: state.mssqlForm.dbName || ''
    };

    // Only add isManagedServiceAccount in MSSQL Advanced Create mode
    if (isMssqlAdvancedCreate) {
        sqlConfiguration.isManagedServiceAccount = state.mssqlForm.activeDirectory?.useManagedServiceAccount || false;
    }

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
        adConfiguration,
        fsxConfiguration: {
            fsxDeploymentMode,
            fsxFileSystemId: fileSystem?.fsxFileSystemId,
            fsxUsername: fileSystem?.fsxUsername,
            fsxPassword: fileSystem?.fsxPassword,
            databaseSize,
            ontapSgGroupId: ontapSgGroupIdsList,
            fsxVolThroughput,
            fsxIOPS,
            encryptionKey: encryptionKey || '',
            snapshotPolicy: selectedSnapshotPolicy || ''
        },
        sqlConfiguration,
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

    // Validate OU path format BEFORE demo mode check to block deployment in all modes
    const isAdvancedCreate = state.mssqlForm.selectConfig === SELECT_CONFIG.STANDARD_CREATE;
    const { preferredOUPath } = state.mssqlForm.activeDirectory;
    const hasInvalidOUPath =
        isAdvancedCreate &&
        preferredOUPath &&
        preferredOUPath.trim() !== '' &&
        !/\b[A-Za-z]+\s*=\s*[^,]+/i.test(preferredOUPath);
    dispatch(setOUPathValue(!hasInvalidOUPath));

    if (hasInvalidOUPath) {
        return;
    }

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

        // Password is only NOT required in Advanced Create mode when managed service account is checked
        const isAdvancedCreate = state.mssqlForm.selectConfig === SELECT_CONFIG.STANDARD_CREATE;
        const isPasswordRequired = !(isAdvancedCreate && state.mssqlForm.activeDirectory.useManagedServiceAccount);
        const dbCredStateValue = isPasswordRequired && !state.mssqlForm.dbCredentials.password;

        const adStateValue =
            !state.mssqlForm.activeDirectory.domainAddress ||
            !state.mssqlForm.activeDirectory.domainName ||
            !state.mssqlForm.activeDirectory.userName ||
            !state.mssqlForm.activeDirectory.password;

        const fsxStateValue =
            (isFsxnNew(state.mssqlForm.fsxN.fsxNType) && !state.mssqlForm.fsxN.fsxNPassword) ||
            (isFsxnExisting(state.mssqlForm.fsxN.fsxNType) && !state.mssqlForm.fsxN.fsxNExistingName);

        const licenseIdCheck = !state.mssqlForm.license.selectedLicenseId;
        // Check for VPC values
        if (vpcStateValue) {
            dispatch(setVPCSelectedValue(false));
        } else {
            dispatch(setVPCSelectedValue(true));
        }
        // Check for AZ values
        if (azStateValue) {
            dispatch(setAZSelectedValue(false));
        } else {
            dispatch(setAZSelectedValue(true));
        }

        // Check for DB cred password
        dispatch(setDBCredentialPasswordValue(!dbCredStateValue));
        const checkForUserName = isValidUserName(state.mssqlForm.dbCredentials.name);

        // Check of AD values
        if (adStateValue) {
            dispatch(setActiveDirectoryValue(false));
        } else {
            dispatch(setActiveDirectoryValue(true));
        }

        // Check for FsxN Name
        dispatch(setFSXNNameValue(!fsxStateValue));

        // Check for DB Name - InvalidName
        const input = state.mssqlForm.dbName;
        const dataBaseNameValue =
            (input && input.length > 15) || !/^[a-zA-Z0-9]/.test(input?.charAt(0)) || !/^[a-zA-Z0-9/-]+$/.test(input);
        const isDBValueValid = !!dataBaseNameValue;
        if (dataBaseNameValue) {
            dispatch(setDBNameValue(false));
        } else {
            dispatch(setDBNameValue(true));
        }

        // Check for License ID
        if (licenseIdCheck) {
            dispatch(setLicenseIdValue(false));
        } else {
            dispatch(setLicenseIdValue(true));
        }

        // Proceed for post call
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
                : hasInvalidOUPath
                ? 'Valid Organizational Unit path'
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
