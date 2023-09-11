import { Dispatch } from 'redux';
import store from '../../../store/store';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { setMssqlForm } from '../../../store/mssql/mssqlFormSlice';
import { 
    setIsLoadConfig, 
    setIsMissingFieldsInLoad, 
    setIsSaveConfigLoading, 
    setRefetchApiCountExpected, 
    setRefetchApiCountLoading, 
    setRefetchApiCountRan, 
    setSavedConfig 
} from '../../../store/mssql/msSqlActionSlice';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import { dbPassVal, fsxPassVal, isValidUserName } from '../../../utils/utilityFunctions';

/*
This function is used to load config data on click on config load. 
*/
export const LoadConfiguration = (dispatch: Dispatch, loadConfigDataExe: any, closeDialog:any) => {
    const state = store.getState();
    const selectedConfig = state.mssqlForm.loadConfig;
    dispatch(setIsLoadConfig(true));
    loadConfigDataExe({ configId: selectedConfig })
        .then((data: any) => {
            if(data?.data?.data){
                dispatch(setSavedConfig(data?.data?.data));
                apiCallsCount(dispatch, data?.data?.data);
                const isMissing = checkMissingFields(data?.data?.data);
                dispatch(setIsMissingFieldsInLoad(isMissing));
                dispatch(setMssqlForm(data?.data?.data));
            } else {
                dispatch(setIsLoadConfig(false));
                closeDialog();
                dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.WARNING, 
                    message: SELECT_CONFIG.MISSING_FIELDS_MESSAGE }));
            }
        })
        .catch((error: any) => {
            console.log("Error while loading data - ", error);
            dispatch(setIsLoadConfig(false));
            closeDialog();
        });
    return '';
};

/* 
This function is used to reset all load config related action states once data is loaded.
*/
export const resetChecksAfterLoad = (dispatch: Dispatch, closeDialog:any, isMissing:boolean) => {
    dispatch(setIsLoadConfig(false));
    closeDialog();
    if(isMissing){
        dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.WARNING, 
            message: SELECT_CONFIG.MISSING_FIELDS_MESSAGE }));
    } else {
        dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, 
            message: SELECT_CONFIG.LOAD_CONFIG_SUCCESS }));
    }
    dispatch(setRefetchApiCountExpected(0));
    dispatch(setRefetchApiCountRan(0));
    dispatch(setRefetchApiCountLoading(false));
}

/* 
On click of load config this function will check how many get APIs call will run on change on any dependent fields.
Get APIs calls are required on change fields as to show latest data in accordions dropdown.
*/
export const apiCallsCount = (dispatch: Dispatch, loadData: any) => {
    const state = store.getState();
    let apiCount = 0;
    if(state.mssqlForm.awsAccount?.selectedCredential?.value !== loadData?.awsAccount?.selectedCredential?.value){
        apiCount = 9;
    } else if(state.mssqlForm.regionAndVpc?.selectedRegion?.value !== loadData?.regionAndVpc?.selectedRegion?.value){
        apiCount = 8;
    } else{
        if(state.mssqlForm.regionAndVpc?.selectedVPC?.label2 !== loadData?.regionAndVpc?.selectedVPC?.label2) {
            apiCount += 1;
        } 
        if(
            state.mssqlForm?.operatingSystem?.label === loadData?.operatingSystem?.label ||
            state.mssqlForm?.dbVersion?.value === loadData?.dbVersion?.value ||
            state.mssqlForm?.dbEdition?.value === loadData?.dbEdition?.value ) {
            apiCount += 1;
        }
    } 
    dispatch(setRefetchApiCountExpected(apiCount));
    dispatch(setRefetchApiCountLoading(true));
}

/*
On click of save config it will call API to store config data.
*/
export const SaveConfiguration = (dispatch: Dispatch, saveConfigData: any, configListRefetch: any, closeDialog:any) => {
    const state = store.getState();
    const saveConfigName = state.mssqlForm.saveConfigName;
    const existingSavedConfig = state.msSqlAction.savedConfig;
    const payload = {name: saveConfigName, data:state.mssqlForm};
    const isDuplicate = duplicateSaveCheck(state.mssqlForm, existingSavedConfig);
    if(isDuplicate){
        dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.ERROR, 
            message: SELECT_CONFIG.DUPLICATE_SAVED_CONFIG }));
        closeDialog();
    } else {
        dispatch(setIsSaveConfigLoading(true));
        saveConfigData({ payload: payload })
            .then((data: any) => {
                if (!data?.error) {
                    dispatch(setSavedConfig(state.mssqlForm));
                    dispatch(setIsSaveConfigLoading(false));
                    dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, 
                        message: SELECT_CONFIG.SAVE_CONFIG_SUCCESS }));
                    configListRefetch();
                }
                closeDialog();
            })
            .catch((error: any) => {
                console.log("Error while saving data - ",error);
                dispatch(setIsSaveConfigLoading(false));
                closeDialog();
            });
    }
    return '';
};

/*
This function is used to avoid saving config again if saved just now.
If data is loaded recently and user is trying to save same data again than also it will not allow to save. 
*/
const duplicateSaveCheck = (newConfig:any, oldConfig:any) => {
    if(!oldConfig){
        return false;
    }
    const cred = newConfig?.awsAccount?.selectedCredential?.value === oldConfig?.awsAccount?.selectedCredential?.value;
    const region = newConfig?.regionAndVpc?.selectedRegion?.value === oldConfig?.regionAndVpc?.selectedRegion?.value;
    const vpcId = newConfig?.regionAndVpc?.selectedVPC?.label2 === oldConfig?.regionAndVpc?.selectedVPC?.label2;
    const availabilityZone1 = newConfig?.availabilityZones?.selectedAzNode1?.value === oldConfig?.availabilityZones?.selectedAzNode1?.value;
    const availabilityZone2 = newConfig?.availabilityZones?.selectedAzNode2?.value === oldConfig?.availabilityZones?.selectedAzNode2?.value;
    const privateSubnet1Id = newConfig?.availabilityZones?.selectedSubnetNode1?.label2 === oldConfig?.availabilityZones?.selectedSubnetNode1?.label2;
    const privateSubnet2Id = newConfig?.availabilityZones?.selectedSubnetNode2?.label2 === oldConfig?.availabilityZones?.selectedSubnetNode2?.label2;
    const securityGroupType = newConfig?.securityGroup?.selectedSecurityType === oldConfig?.securityGroup?.selectedSecurityType;
    const securityGroup = newConfig?.securityGroup?.selectedExistingSecurityGroup?.value === oldConfig?.securityGroup?.selectedExistingSecurityGroup?.value;
    const operatingSystem = newConfig?.operatingSystem?.label === oldConfig?.operatingSystem?.label;
    const deploymentModel = newConfig?.dbDeploymentModel === oldConfig?.dbDeploymentModel;
    const edition = newConfig?.dbEdition?.value === oldConfig?.dbEdition?.value;
    const dbVersion = newConfig?.dbVersion?.value === oldConfig?.dbVersion?.value;
    const licenseType = newConfig?.license?.selectedLicenseType === oldConfig?.license?.selectedLicenseType;
    const license = newConfig?.license?.selectedLicenseId?.value === oldConfig?.license?.selectedLicenseId?.value;
    const dbName = newConfig?.dbName === oldConfig?.dbName;
    const dbUsername = newConfig?.dbCredentials?.name === oldConfig?.dbCredentials?.name;
    const dbPass = newConfig?.dbCredentials?.password === oldConfig?.dbCredentials?.password;
    const keyPair = newConfig?.keyPair?.selectedKeyPair?.value === oldConfig?.keyPair?.selectedKeyPair?.value;
    const adType = newConfig?.activeDirectory?.scenarioType === oldConfig?.activeDirectory?.scenarioType;
    const adName = newConfig?.activeDirectory?.domainName?.value === oldConfig?.activeDirectory?.domainName?.value;
    const adIPAddress = newConfig?.activeDirectory?.domainAddress === oldConfig?.activeDirectory?.domainAddress;
    const adUser = newConfig?.activeDirectory?.userName === oldConfig?.activeDirectory?.userName;
    const adPass = newConfig?.activeDirectory?.password === oldConfig?.activeDirectory?.password;
    const dbInstanceType = newConfig?.instanceType?.value === oldConfig?.instanceType?.value;
    const fsxType = newConfig?.fsxN?.fsxNType === oldConfig?.fsxN?.fsxNType;
    const fsxNewName = newConfig?.fsxN?.fsxNName === oldConfig?.fsxN?.fsxNName;
    const fsxNewUserName = newConfig?.fsxN?.fsxNNewUserName === oldConfig?.fsxN?.fsxNNewUserName;
    const fsxExName = newConfig?.fsxN?.fsxNExistingName?.value === oldConfig?.fsxN?.fsxNExistingName?.value;
    const fsxExUserName = newConfig?.fsxN?.fsxNExistingUserName === oldConfig?.fsxN?.fsxNExistingUserName;
    const fsxPass = newConfig?.fsxN?.fsxNPassword === oldConfig?.fsxN?.fsxNPassword;
    const dataDriveSize = newConfig?.storageCapacity?.capacity === oldConfig?.storageCapacity?.capacity;
    const dataDriveUnit = newConfig?.storageCapacity?.unit?.value === oldConfig?.storageCapacity?.unit?.value;
    const provisionedIops = newConfig?.provisionedIOPS?.IOPSValue === oldConfig?.provisionedIOPS?.IOPSValue;
    const throughput = newConfig?.throughput?.value === oldConfig?.throughput?.value;
    const encryptionType = newConfig?.encryption?.encryptionType === oldConfig?.encryption?.encryptionType;
    const encryptionRow = (() => {
        const newConfigEncryption = newConfig?.encryption?.selectedRow;
        const oldConfigEncryption = oldConfig?.encryption?.selectedRow;
        if(newConfigEncryption && newConfigEncryption.length > 0  && 
            oldConfigEncryption && oldConfigEncryption.length > 0) {
            return newConfigEncryption[0]?.id === oldConfigEncryption[0]?.id;
        } else {
            return true;
        }
    })();
    const encryptionArn = newConfig?.encryption?.encryptionArn === oldConfig?.encryption?.encryptionArn;
    const tags = newConfig?.tags === oldConfig?.tags;
    const snsKey = newConfig?.simpleNotification?.snsARN?.value === oldConfig?.simpleNotification?.snsARN?.value;
    const cloudWatch = newConfig?.cloudWatch === oldConfig?.cloudWatch;
    return cred && region && vpcId && availabilityZone1 && availabilityZone2 && privateSubnet1Id && privateSubnet2Id && 
            securityGroupType && securityGroup && operatingSystem && deploymentModel && edition && dbVersion && licenseType && 
            license && dbName && dbUsername && dbPass && keyPair && adType && adName && adIPAddress && adUser && adPass && 
            dbInstanceType && fsxType && fsxNewName && fsxNewUserName && fsxExName && fsxExUserName && fsxPass && dataDriveSize && 
            dataDriveUnit && provisionedIops && throughput && encryptionType && encryptionRow && encryptionArn && tags && 
            snsKey && cloudWatch;
};


/*
On config load this function will check if load data has any missing mandatory fields. 
*/
const checkMissingFields = (data: any) => {
    const vpcStateValue = !data?.regionAndVpc?.selectedVPC;

    const azStateValue =
        !data?.availabilityZones?.selectedAzNode1 ||
        !data?.availabilityZones?.selectedSubnetNode1 ||
        !data?.availabilityZones?.selectedAzNode2 ||
        !data?.availabilityZones?.selectedSubnetNode2;

    const dbCredStateValue = !data?.dbCredentials?.password;

    const adStateValue =
        !data?.activeDirectory?.domainAddress ||
        !data?.activeDirectory?.domainName ||
        !data?.activeDirectory?.userName ||
        !data?.activeDirectory?.password;

    const fsxStateValue =
        (data?.fsxN?.fsxNType === GENERAL.CREATE_NEW_FSXN && !data?.fsxN?.fsxNPassword) ||
        (data?.fsxN?.fsxNType === GENERAL.SELECT_EXISTING_FSX && !data?.fsxN?.fsxNExistingName);

    const licenseIdCheck = !data?.license?.selectedLicenseId;
    const checkForUserName = isValidUserName(data?.dbCredentials?.name);

    //Check for DB Name - InvalidName
    const input = data?.dbName;
    const dataBaseNameValue =
        input.length > 15 || !/^[a-zA-Z0-9]/.test(input.charAt(0)) || !/^[a-zA-Z0-9/-]+$/.test(input);
    const isDBValueValid = input.length > 0 && dataBaseNameValue ? true : false;

    if (
        !vpcStateValue &&
        !azStateValue &&
        !dbCredStateValue &&
        !adStateValue &&
        !fsxStateValue &&
        !isDBValueValid &&
        !licenseIdCheck &&
        !checkForUserName &&
        !dbPassVal(data?.dbCredentials?.password) &&
        !fsxPassVal(data?.fsxN?.fsxNPassword)
    ) {
        return false;
    } else {
        return true;
    }
};
