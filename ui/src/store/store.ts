import { configureStore, combineReducers, MiddlewareAPI, isRejectedWithValue, Middleware } from '@reduxjs/toolkit';
import notificationSlice, { addNotification, NOTIFICATION_TYPES } from './notificationSlice';
import {
    awsApi,
    chatbotApi,
    configApi,
    databaseHomeApi,
    jobMonitoringApi,
    resourceApi,
    workloadFactoryResourceApi
} from '../utils/apiService';
import authSlice from './authSlice';
import mssqlSlice from './mssql/mssqlSlice';
import mssqlFormSlice from './mssql/mssqlFormSlice';
import msSqlActionSlice from './mssql/msSqlActionSlice';
import resourceSlice from './resource/resourceSlice';
import { GENERAL } from '../utils/appConstants';
import { customErrorMessages, requiredFieldError } from '../utils/utilityFunctions';
import databaseHomeSlice from './workloadFactory/databaseHomeSlice';
import previewPanelSlice from './previewPanel/previewPanelSlice';
import chatbotSlice, { setShowRetry } from './chatbot/chatbotSlice';
import workloadFactoryResourceSlice from './workloadFactory/workloadFactoryResourceSlice';
import jobMonitoringSlice from './workloadFactory/jobMonitoringSlice';

const rootReducer = combineReducers({
    [notificationSlice.name]: notificationSlice.reducer,
    [authSlice.name]: authSlice.reducer,
    [awsApi.reducerPath]: awsApi.reducer,
    [resourceApi.reducerPath]: resourceApi.reducer,
    [mssqlSlice.name]: mssqlSlice.reducer,
    [mssqlFormSlice.name]: mssqlFormSlice.reducer,
    [msSqlActionSlice.name]: msSqlActionSlice.reducer,
    [resourceSlice.name]: resourceSlice.reducer,
    [configApi.reducerPath]: configApi.reducer,
    [databaseHomeApi.reducerPath]: databaseHomeApi.reducer,
    [chatbotApi.reducerPath]: chatbotApi.reducer,
    [databaseHomeSlice.name]: databaseHomeSlice.reducer,
    [previewPanelSlice.name]: previewPanelSlice.reducer,
    [chatbotSlice.name]: chatbotSlice.reducer,
    [workloadFactoryResourceSlice.name]: workloadFactoryResourceSlice.reducer,
    [workloadFactoryResourceApi.reducerPath]: workloadFactoryResourceApi.reducer,
    [jobMonitoringApi.reducerPath]: jobMonitoringApi.reducer,
    [jobMonitoringSlice.name]: jobMonitoringSlice.reducer
});

const rtkQueryErrorLogger: Middleware = (api: MiddlewareAPI) => next => (action: any) => {
    // RTK Query uses `createAsyncThunk` from redux-toolkit under the hood, so we're able to utilize these matchers
    if (isRejectedWithValue(action) && !action.meta.arg.originalArgs.selfErrorHandling) {
        let errorMsg = action.payload.error || action.payload.data?.message || action.payload.data?.responseMessage;

        const reqFieldChk = requiredFieldError(errorMsg);
        if (reqFieldChk) {
            errorMsg = reqFieldChk + GENERAL.IS_REQUIRED_MSG;
        }

        errorMsg = customErrorMessages(errorMsg);
        if (errorMsg && errorMsg.length > 250) {
            api.dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: GENERAL.QUERY_ERROR,
                    additionalText: errorMsg
                })
            );
        } else {
            api.dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.ERROR, message: errorMsg }));
        }
        api.dispatch(setShowRetry(true));
    }

    return next(action);
};

const store = configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware({ serializableCheck: false })
            .concat(awsApi.middleware)
            .concat(resourceApi.middleware)
            .concat(configApi.middleware)
            .concat(databaseHomeApi.middleware)
            .concat(chatbotApi.middleware)
            .concat(workloadFactoryResourceApi.middleware)
            .concat(jobMonitoringApi.middleware)
            .concat(rtkQueryErrorLogger)
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export default store;
