import { Dispatch } from 'redux';
import { addNotification } from '../../../store/notificationSlice';

export const LoadConfiguration = (dispatch: Dispatch) => {
    dispatch(addNotification({ notificationType: 'SUCCESS', message: 'Configuration was loaded successfully.' }));
    console.log('load config');
    return '';
};
