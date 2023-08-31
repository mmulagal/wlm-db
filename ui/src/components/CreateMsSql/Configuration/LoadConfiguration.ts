import { Dispatch } from 'redux';
import store from '../../../store/store';
import { addNotification } from '../../../store/notificationSlice';
import { setMssqlForm } from '../../../store/mssql/mssqlFormSlice';

export const LoadConfiguration = (dispatch: Dispatch, data: any) => {
    dispatch(setMssqlForm(data));
    dispatch(addNotification({ notificationType: 'SUCCESS', message: 'Configuration was loaded successfully.' }));
    console.log('load config');
    return '';
};

export const SaveConfiguration = (dispatch: Dispatch, saveConfigData: any) => {
    const state = store.getState();
    const saveConfigName = state.mssqlForm.saveConfigName;
    const payload = {'data':state.mssqlForm};

    saveConfigData({ configId: saveConfigName, payload: payload })
        .then((data: any) => {
            console.log("Saved Data - ",data);
        })
        .catch((error: any) => {
            console.log("Error while saving data - ",error);
        });

    dispatch(addNotification({ notificationType: 'SUCCESS', message: 'Configuration was saved successfully.' }));
    return '';
};
