import { Dispatch } from 'redux';
import store from '../../../store/store';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { setMssqlForm } from '../../../store/mssql/mssqlFormSlice';
import { setIsLoadConfig } from '../../../store/mssql/msSqlActionSlice';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import { dbPassVal, fsxPassVal, isValidUserName } from '../../../utils/utilityFunctions';

export const LoadConfiguration = (dispatch: Dispatch, loadConfigDataExe: any, closeDialog:any) => {
    const state = store.getState();
    const selectedConfig = state.mssqlForm.loadConfig;
    dispatch(setIsLoadConfig(true));
    loadConfigDataExe({ configId: selectedConfig })
        .then((data: any) => {
            if(data?.data?.data){
                dispatch(setMssqlForm(data?.data?.data));
                const isMissing = checkMissingFields(data?.data?.data);
                if(isMissing){
                    dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.WARNING, 
                        message: SELECT_CONFIG.MISSING_FIELDS_MESSAGE }));
                } else {
                    dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, 
                        message: SELECT_CONFIG.LOAD_CONFIG_SUCCESS }));
                }
            } 
            setTimeout(() => {
                dispatch(setIsLoadConfig(false));
            }, 1000);
            closeDialog();
        })
        .catch((error: any) => {
            console.log("Error while loading data - ", error);
            dispatch(setIsLoadConfig(false));
            closeDialog();
        });
    return '';
};

export const SaveConfiguration = (dispatch: Dispatch, saveConfigData: any) => {
    const state = store.getState();
    const saveConfigName = state.mssqlForm.saveConfigName;
    const payload = {name: saveConfigName, data:state.mssqlForm};

    saveConfigData({ payload: payload })
        .then((data: any) => {
            if (!data?.error) {
                dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, 
                    message: SELECT_CONFIG.SAVE_CONFIG_SUCCESS }));
            }
        })
        .catch((error: any) => {
            console.log("Error while saving data - ",error);
        });
    return '';
};


const checkMissingFields = (data: any) => {
    const vpcStateValue = !data?.regionAndVpc.selectedVPC;

    const azStateValue =
        !data?.availabilityZones.selectedAzNode1 ||
        !data?.availabilityZones.selectedSubnetNode1 ||
        !data?.availabilityZones.selectedAzNode2 ||
        !data?.availabilityZones.selectedSubnetNode2;

    const dbCredStateValue = !data?.dbCredentials.password;

    const adStateValue =
        !data?.activeDirectory.domainAddress ||
        !data?.activeDirectory.domainName ||
        !data?.activeDirectory.userName ||
        !data?.activeDirectory.password;

    const fsxStateValue =
        (data?.fsxN.fsxNType === GENERAL.CREATE_NEW_FSXN && !data?.fsxN.fsxNPassword) ||
        (data?.fsxN.fsxNType === GENERAL.SELECT_EXISTING_FSX && !data?.fsxN.fsxNExistingName);

    const licenseIdCheck = !data?.license.selectedLicenseId;
    const checkForUserName = isValidUserName(data?.dbCredentials.name);

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
