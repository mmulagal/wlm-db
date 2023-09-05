import { Dispatch } from 'redux';
import store from '../../../store/store';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { setMssqlForm } from '../../../store/mssql/mssqlFormSlice';
import { setIsLoadConfig } from '../../../store/mssql/msSqlActionSlice';
import { SELECT_CONFIG } from '../../../utils/appConstants';

export const LoadConfiguration = (dispatch: Dispatch, loadConfigDataExe: any) => {
    const state = store.getState();
    const selectedConfig = state.mssqlForm.loadConfig;
    
    loadConfigDataExe({ configId: selectedConfig })
        .then((data: any) => {
            console.log("Loaded Data response- ",data?.data?.data);
            dispatch(setIsLoadConfig(true));
            dispatch(setMssqlForm(data?.data?.data));
            dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, 
                message: SELECT_CONFIG.LOAD_CONFIG_SUCCESS }));
            setTimeout(() => {
                dispatch(setIsLoadConfig(false));
            }, 1000)
        })
        .catch((error: any) => {
            console.log("Error while loading data - ", error);
        });
    return '';
};

export const SaveConfiguration = (dispatch: Dispatch, saveConfigData: any) => {
    const state = store.getState();
    const saveConfigName = state.mssqlForm.saveConfigName;
    const payload = {'name': saveConfigName, 'data':state.mssqlForm};

    saveConfigData({ payload: payload })
        .then((data: any) => {
            if (!data?.error) {
                console.log("Saved Data - ",data);
                dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.SUCCESS, 
                    message: SELECT_CONFIG.SAVE_CONFIG_SUCCESS }));
            }
        })
        .catch((error: any) => {
            console.log("Error while saving data - ",error);
        });
    return '';
};
