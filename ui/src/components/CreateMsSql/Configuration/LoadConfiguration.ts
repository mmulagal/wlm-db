import { Dispatch } from 'redux';
import store from '../../../store/store';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { setMssqlForm } from '../../../store/mssql/mssqlFormSlice';
import {
    setIsLoadConfig,
    setIsLoading,
    setIsSaveConfigLoading,
    setRefetchApiCountExpected,
    setRefetchApiCountLoading,
    setRefetchApiCountRan,
    setSavedConfig
} from '../../../store/mssql/msSqlActionSlice';
import { SELECT_CONFIG } from '../../../utils/appConstants';
import { API_NAME, FROM_DIALOG, WIZARD_TYPE } from '../../../utils/consts';
import { navigateToCanvas } from '../../../utils/appConfig';
import { setIsWizardTouched, setLoadConfigClicked } from '../../../store/chatbot/chatbotSlice';
import { removePasswordInConfig } from '../../../utils/utilityFunctions';
import { setPostgreForm } from '../../../store/postgre/postgreFormSlice';

/*
This function is used to load config data on click on config load. 
*/
export const LoadConfiguration = (
    dispatch: Dispatch,
    loadConfigDataExe: any,
    closeDialog: any,
    selectedConfig?: string | undefined,
    databaseType: string = WIZARD_TYPE.MSSQL
) => {
    if (!selectedConfig) {
        const state = store.getState();
        selectedConfig = state.mssqlForm.loadConfig;
    }
    resetRefetchApiCheck(dispatch);
    dispatch(setIsLoadConfig(true));
    loadConfigDataExe({ configId: selectedConfig })
        .then((data: any) => {
            if (data?.data?.data) {
                dispatch(setSavedConfig(data?.data?.data));
                const apiList = apiCallsList(dispatch, data?.data?.data, databaseType);
                if (apiList) {
                    dispatch(setRefetchApiCountExpected(apiList));
                    dispatch(setRefetchApiCountLoading(true));
                }
                dispatch(setMssqlForm(data?.data?.data));
                dispatch(setPostgreForm(data?.data?.data));
                dispatch(setIsWizardTouched(true));
                dispatch(setLoadConfigClicked(true));
            } else {
                dispatch(setIsLoadConfig(false));
                dispatch(setIsLoading(false));
                if (closeDialog) {
                    closeDialog();
                }
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.WARNING,
                        message: SELECT_CONFIG.MISSING_FIELDS_MESSAGE
                    })
                );
            }
        })
        .catch((error: any) => {
            console.log('Error while loading data - ', error);
            dispatch(setIsLoadConfig(false));
            dispatch(setIsLoading(false));
            if (closeDialog) {
                closeDialog();
            }
        });
};

/*
This function is used to load recommended config data
*/
export const LoadRecommendedConfig = (dispatch: Dispatch, mssqlFormData: any, showNotification: boolean = true) => {
    resetRefetchApiCheck(dispatch);
    if (mssqlFormData) {
        dispatch(setMssqlForm(mssqlFormData));
        dispatch(setIsLoading(false));
        if (showNotification) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                    message: SELECT_CONFIG.LOAD_CONFIG_SUCCESS
                })
            );
        }
    } else {
        dispatch(setIsLoading(false));
        if (showNotification) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.WARNING,
                    message: SELECT_CONFIG.MISSING_FIELDS_MESSAGE
                })
            );
        }
    }
};

/* 
This function is used to reset all load config related action states once data is loaded.
*/
export const resetChecksAfterLoad = (dispatch: Dispatch, closeDialog: any) => {
    dispatch(setIsLoadConfig(false));
    dispatch(setIsLoading(false));
    closeDialog();
    dispatch(
        addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, message: SELECT_CONFIG.LOAD_CONFIG_SUCCESS })
    );
    resetRefetchApiCheck(dispatch);
};

/* 
This function is used to reset refetch API checks
*/
export const resetRefetchApiCheck = (dispatch: Dispatch) => {
    dispatch(setRefetchApiCountExpected([]));
    dispatch(setRefetchApiCountRan(null));
    dispatch(setRefetchApiCountLoading(false));
};

/* 
On click of load config this function will check how many get APIs call will run on change on any dependent fields.
Get APIs calls are required on change fields as to show latest data in accordions dropdown.
*/
export const apiCallsList = (dispatch: Dispatch, loadData: any, databaseType: string) => {
    const state = store.getState();
    const apis = [];
    const credId = loadData?.awsAccount?.selectedCredential?.data?.credentialsId;
    const regionId = loadData?.regionAndVpc?.selectedRegion?.data?.regionCode;
    const vpcId = loadData?.regionAndVpc?.selectedVPC?.label2;
    const osVersion = loadData?.operatingSystem?.label;
    const dbVersion = loadData?.dbVersion?.value;
    const dbEdition = loadData?.dbEdition?.value;

    // cred value was getting compared earlier. But found 1 case where cred id was same but name was different so comparing with credId now.
    const isSameCred = state.mssqlForm.awsAccount?.selectedCredential?.data?.credentialsId === credId;
    const isSameRegion = state.mssqlForm.regionAndVpc?.selectedRegion?.data?.regionCode === regionId;
    const isSameVpc = state.mssqlForm.regionAndVpc?.selectedVPC?.label2 === vpcId;

    const isSameOs = state.mssqlForm?.operatingSystem?.label === osVersion;
    const isSameDbVersion = state.mssqlForm?.dbVersion?.value === dbVersion;
    const isSameDbEdition = state.mssqlForm?.dbEdition?.value === dbEdition;

    if (credId && !isSameCred) {
        apis.push(API_NAME.REGION);
    }
    if (credId && regionId && (!isSameRegion || !isSameCred)) {
        apis.push(API_NAME.VPC);
        if (databaseType === WIZARD_TYPE.MSSQL) {
            apis.push(API_NAME.ADS);
        }
        apis.push(API_NAME.SNS);
        apis.push(API_NAME.KMS);
        apis.push(API_NAME.KEYPAIR);
        apis.push(API_NAME.INSTANCE);
        if (databaseType === WIZARD_TYPE.MSSQL) {
            apis.push(API_NAME.CUSTOM_AMI);
        }
    }
    if (credId && regionId && vpcId && (!isSameRegion || !isSameCred || !isSameVpc)) {
        apis.push(API_NAME.FSXN);
        apis.push(API_NAME.SG);
    }
    if (
        credId &&
        regionId &&
        osVersion &&
        dbEdition &&
        dbVersion &&
        (!isSameRegion || !isSameCred || !isSameOs || !isSameDbVersion || !isSameDbEdition)
    ) {
        if (databaseType === WIZARD_TYPE.MSSQL) {
            apis.push(API_NAME.AMI);
        }
    }
    if (dbVersion && !isSameDbVersion && databaseType === WIZARD_TYPE.MSSQL) {
        apis.push(API_NAME.COLLATION);
    }
    return apis;
};

/*
On click of save config it will call API to store config data.
*/
export const SaveConfiguration = (
    dispatch: Dispatch,
    saveConfigData: any,
    configListRefetch: any,
    closeDialog: any,
    dialogFrom: string,
    databaseType: string = WIZARD_TYPE.MSSQL
) => {
    const state = store.getState();
    const { saveConfigName } = state.mssqlForm;
    const existingSavedConfig = state.msSqlAction.savedConfig;
    const formData =
        databaseType === WIZARD_TYPE.MSSQL ? state.mssqlForm : { ...state.mssqlForm, ...state.postgreForm };
    const payload = {
        name: saveConfigName,
        data: removePasswordInConfig(formData),
        databaseType
    };
    const isDuplicate = duplicateSaveCheck(state.mssqlForm, existingSavedConfig);
    if (isDuplicate) {
        dispatch(
            addNotification({
                notificationType: NOTIFICATION_TYPES.INFO,
                message: SELECT_CONFIG.DUPLICATE_SAVED_CONFIG
            })
        );
        closeSaveDialog(dialogFrom, closeDialog);
    } else {
        dispatch(setIsSaveConfigLoading(true));
        saveConfigData({ payload })
            .then((data: any) => {
                if (!data?.error) {
                    dispatch(setSavedConfig(state.mssqlForm));
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: SELECT_CONFIG.SAVE_CONFIG_SUCCESS
                        })
                    );
                    configListRefetch();
                }
                closeSaveDialog(dialogFrom, closeDialog);
                dispatch(setIsSaveConfigLoading(false));
            })
            .catch((error: any) => {
                console.log('Error while saving data - ', error);
                dispatch(setIsSaveConfigLoading(false));
                closeDialog();
            });
    }
    return '';
};

/* 
Close dialog in case of save configuration. If save configuration is clicked from cross header than redirect to CM.
*/
const closeSaveDialog = (dialogFrom: string, closeDialog: any) => {
    closeDialog();
    if (dialogFrom === FROM_DIALOG.HEADER_CROSS) {
        setTimeout(() => {
            navigateToCanvas('/');
        }, 3000);
    }
};

/*
This function is used to avoid saving config again if saved just now.
If data is loaded recently and user is trying to save same data again than also it will not allow to save. 
*/
export const duplicateSaveCheck = (newConfig: any, oldConfig: any) => {
    if (!oldConfig) {
        return false;
    }
    const cred = newConfig?.awsAccount?.selectedCredential?.value === oldConfig?.awsAccount?.selectedCredential?.value;
    const region = newConfig?.regionAndVpc?.selectedRegion?.value === oldConfig?.regionAndVpc?.selectedRegion?.value;
    const vpcId = newConfig?.regionAndVpc?.selectedVPC?.label2 === oldConfig?.regionAndVpc?.selectedVPC?.label2;
    const availabilityZone1 =
        newConfig?.availabilityZones?.selectedAzNode1?.value === oldConfig?.availabilityZones?.selectedAzNode1?.value;
    const availabilityZone2 =
        newConfig?.availabilityZones?.selectedAzNode2?.value === oldConfig?.availabilityZones?.selectedAzNode2?.value;
    const privateSubnet1Id =
        newConfig?.availabilityZones?.selectedSubnetNode1?.label2 ===
        oldConfig?.availabilityZones?.selectedSubnetNode1?.label2;
    const privateSubnet2Id =
        newConfig?.availabilityZones?.selectedSubnetNode2?.label2 ===
        oldConfig?.availabilityZones?.selectedSubnetNode2?.label2;
    const securityGroupType =
        newConfig?.securityGroup?.selectedSecurityType === oldConfig?.securityGroup?.selectedSecurityType;
    const getSgIds = (val: any): string[] => {
        let arr: any[] = [];
        if (Array.isArray(val)) {
            arr = val;
        } else if (val) {
            arr = [val];
        }
        return arr.map((sg: any) => sg?.data?.id || sg?.id || sg?.value || '').sort();
    };
    const securityGroup =
        getSgIds(newConfig?.securityGroup?.selectedExistingSecurityGroup).join(',') ===
        getSgIds(oldConfig?.securityGroup?.selectedExistingSecurityGroup).join(',');
    const operatingSystem = newConfig?.operatingSystem?.label === oldConfig?.operatingSystem?.label;
    const deploymentModel = newConfig?.dbDeploymentModel?.value === oldConfig?.dbDeploymentModel?.value;
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
        if (
            newConfigEncryption &&
            newConfigEncryption.length > 0 &&
            oldConfigEncryption &&
            oldConfigEncryption.length > 0
        ) {
            return newConfigEncryption[0]?.id === oldConfigEncryption[0]?.id;
        }
        return true;
    })();
    const encryptionArn = newConfig?.encryption?.encryptionArn === oldConfig?.encryption?.encryptionArn;
    const tags = newConfig?.tags === oldConfig?.tags;
    const snsKey = newConfig?.simpleNotification?.snsARN?.value === oldConfig?.simpleNotification?.snsARN?.value;
    const cloudWatch = newConfig?.cloudWatch === oldConfig?.cloudWatch;
    return (
        cred &&
        region &&
        vpcId &&
        availabilityZone1 &&
        availabilityZone2 &&
        privateSubnet1Id &&
        privateSubnet2Id &&
        securityGroupType &&
        securityGroup &&
        operatingSystem &&
        deploymentModel &&
        edition &&
        dbVersion &&
        licenseType &&
        license &&
        dbName &&
        dbUsername &&
        dbPass &&
        keyPair &&
        adType &&
        adName &&
        adIPAddress &&
        adUser &&
        adPass &&
        dbInstanceType &&
        fsxType &&
        fsxNewName &&
        fsxNewUserName &&
        fsxExName &&
        fsxExUserName &&
        fsxPass &&
        dataDriveSize &&
        dataDriveUnit &&
        provisionedIops &&
        throughput &&
        encryptionType &&
        encryptionRow &&
        encryptionArn &&
        tags &&
        snsKey &&
        cloudWatch
    );
};
