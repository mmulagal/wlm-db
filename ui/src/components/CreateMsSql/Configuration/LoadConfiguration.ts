import { Dispatch } from 'redux';
import store from '../../../store/store';
import { addNotification } from '../../../store/notificationSlice';

export const LoadConfiguration = (dispatch: Dispatch) => {
    dispatch(addNotification({ notificationType: 'SUCCESS', message: 'Configuration was loaded successfully.' }));
    console.log('load config');
    return '';
};

export const SaveConfiguration = (dispatch: Dispatch) => {
    const state = store.getState();
    const saveConfigName = state.mssqlForm.saveConfigName;
    dispatch(addNotification({ notificationType: 'SUCCESS', message: 'Configuration was saved successfully.' }));

    return '';
};
