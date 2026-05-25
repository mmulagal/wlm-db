import { Dispatch } from '@reduxjs/toolkit';
import {
    setAZSelectedValue,
    setCreateHit,
    setCreatePressed,
    setDBCredentialPasswordValue,
    setFSXNNameValue,
    setPgDBNameValue,
    setVPCSelectedValue
} from '../../store/mssql/msSqlActionSlice';
import { FSX_DEPLOYMENT_MODE, SQL_DEPLOYMENT_MODE } from '../../utils/consts';
import { TagObj } from '../../utils/types/mssqlTypes';
import { fsxPassVal, isFsxnExisting, isFsxnNew, isValidUserName } from '../../utils/utilityFunctions';
import { addNotification, NOTIFICATION_TYPES } from '../../store/notificationSlice';
import { GENERAL, SELECT_CONFIG } from '../../utils/appConstants';

const createPgsqlPayload = (state: any) => {
    let payload;

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
        sqlConfiguration: {
            sqlDeploymentMode:
                state.mssqlForm.selectConfig === SELECT_CONFIG.EASY_CREATE
                    ? 'ha'
                    : state.mssqlForm.dbDeploymentModel?.value === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
                    ? 'ha'
                    : 'standalone',
            sqlServerName: state?.postgreForm?.postgreServerName || '',
            serviceAccountName: state.mssqlForm?.dbCredentials?.name || '',
            serviceAccountPassword: state.mssqlForm?.dbCredentials?.password || '',
            sqlVersion: state.postgreForm?.postgreVersion?.value || ''
        },
        topicArn: state.mssqlForm?.simpleNotification?.snsState
            ? state.mssqlForm?.simpleNotification?.snsARN?.value
            : '',
        enableCloudWatch: state.mssqlForm?.cloudWatch,
        tags: state.mssqlForm?.tags.filter((tag: TagObj) => tag.key)
    };
    return payload;
};

const handleCreatePgsql = (state: any, dispatch: Dispatch) => {
    let payload;
    dispatch(setCreatePressed(true));
    dispatch(setCreateHit(Math.random()));
    if (state.auth.isDemoMode) {
        payload = createPgsqlPayload(state);
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

        const fsxStateValue =
            (isFsxnNew(state.mssqlForm.fsxN.fsxNType) && !state.mssqlForm.fsxN.fsxNPassword) ||
            (isFsxnExisting(state.mssqlForm.fsxN.fsxNType) && !state.mssqlForm.fsxN.fsxNExistingName);

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

        // Check for FsxN Name
        dispatch(setFSXNNameValue(!fsxStateValue));

        // Check for DB Name - InvalidName
        const input = state.postgreForm.postgreServerName;
        const dataBaseNameValue =
            (input && input.length > 15) || !/^[a-zA-Z0-9]/.test(input?.charAt(0)) || !/^[a-zA-Z0-9/-]+$/.test(input);
        const isDBValueValid = !!dataBaseNameValue;
        if (dataBaseNameValue) {
            dispatch(setPgDBNameValue(false));
        } else {
            dispatch(setPgDBNameValue(true));
        }

        // Check for DB cred password
        dispatch(setDBCredentialPasswordValue(!dbCredStateValue));
        const checkForUserName = isValidUserName(state.mssqlForm.dbCredentials.name);

        // Proceed for post call
        if (
            !vpcStateValue &&
            !azStateValue &&
            !dbCredStateValue &&
            !fsxStateValue &&
            !isDBValueValid &&
            !checkForUserName &&
            !fsxPassVal(state.mssqlForm.fsxN?.fsxNPassword)
        ) {
            payload = createPgsqlPayload(state);
            console.log('Deploy Payload', payload);
        } else {
            const missingField = vpcStateValue
                ? 'VPC'
                : azStateValue
                ? 'Availability Zone'
                : dbCredStateValue
                ? 'DB credentials'
                : fsxStateValue
                ? 'FSx'
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

export { createPgsqlPayload, handleCreatePgsql };
