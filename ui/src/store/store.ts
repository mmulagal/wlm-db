import { configureStore, combineReducers, MiddlewareAPI, isRejectedWithValue, Middleware } from '@reduxjs/toolkit';
import notificationSlice, { addNotification, NOTIFICATION_TYPES } from './notificationSlice';
import {
    awsApi,
    chatbotApi,
    configApi,
    createUserDbApi,
    databaseHomeApi,
    headersApi,
    jobMonitoringApi,
    policiesApi,
    resourceApi,
    inventoryApi,
    sandboxApi,
    exploreSavingsApi,
    inventoryApiV2,
    workloadFactoryResourceApiV2,
    getWellApi,
    errorInvestigationApi,
    snapcenterAPI
} from '../utils/apiService';
import authSlice from './authSlice';
import mssqlSlice from './mssql/mssqlSlice';
import mssqlFormSlice from './mssql/mssqlFormSlice';
import postgreFormSlice from './postgre/postgreFormSlice';
import msSqlActionSlice from './mssql/msSqlActionSlice';
import resourceSlice from './resource/resourceSlice';
import { GENERAL } from '../utils/appConstants';
import {
    customErrorMessages,
    errorMessagesToBlock,
    removeOldApisError,
    requiredFieldError
} from '../utils/utilityFunctions';
import databaseHomeSlice from './workloadFactory/databaseHomeSlice';
import chatbotSlice, { setShowRetry } from './chatbot/chatbotSlice';
import workloadFactoryResourceSlice from './workloadFactory/workloadFactoryResourceSlice';
import jobMonitoringSlice from './workloadFactory/jobMonitoringSlice';
import inventoryV2Slice from './workloadFactory/inventoryV2Slice';
import headersSlice from './workloadFactory/headersSlice';
import createNewUserSlice from './workloadFactory/createNewDBSlice';
import sandboxSlice from './workloadFactory/sandboxSlice';
import exploreSavingsSlice from './workloadFactory/exploreSavingsSlice';
import createSandboxSlice from './workloadFactory/createSandboxSlice';
import getWellOptimizeSlice from './workloadFactory/getWellOptimizeSlice';
import agenticAISlice from './workloadFactory/agenticAISlice';
import snapCenterSlice from './workloadFactory/snapcenterSlice';
import dialogComponentSlice from './workloadFactory/dialogComponentSlice';
// import postgressSlice from './mssql/postgressSlice';

const rootReducer = combineReducers({
    [notificationSlice.name]: notificationSlice.reducer,
    [authSlice.name]: authSlice.reducer,
    [awsApi.reducerPath]: awsApi.reducer,
    [resourceApi.reducerPath]: resourceApi.reducer,
    [mssqlSlice.name]: mssqlSlice.reducer,
    [mssqlFormSlice.name]: mssqlFormSlice.reducer,
    [postgreFormSlice.name]: postgreFormSlice.reducer,
    [msSqlActionSlice.name]: msSqlActionSlice.reducer,
    [resourceSlice.name]: resourceSlice.reducer,
    [configApi.reducerPath]: configApi.reducer,
    [databaseHomeApi.reducerPath]: databaseHomeApi.reducer,
    [chatbotApi.reducerPath]: chatbotApi.reducer,
    [databaseHomeSlice.name]: databaseHomeSlice.reducer,
    [chatbotSlice.name]: chatbotSlice.reducer,
    [workloadFactoryResourceSlice.name]: workloadFactoryResourceSlice.reducer,
    [workloadFactoryResourceApiV2.reducerPath]: workloadFactoryResourceApiV2.reducer,
    [jobMonitoringApi.reducerPath]: jobMonitoringApi.reducer,
    [jobMonitoringSlice.name]: jobMonitoringSlice.reducer,
    [inventoryV2Slice.name]: inventoryV2Slice.reducer,
    [headersApi.reducerPath]: headersApi.reducer,
    [headersSlice.name]: headersSlice.reducer,
    [createNewUserSlice.name]: createNewUserSlice.reducer,
    [policiesApi.reducerPath]: policiesApi.reducer,
    [createUserDbApi.reducerPath]: createUserDbApi.reducer,
    [inventoryApi.reducerPath]: inventoryApi.reducer,
    [snapcenterAPI.reducerPath]: snapcenterAPI.reducer,
    [inventoryApiV2.reducerPath]: inventoryApiV2.reducer,
    [sandboxSlice.reducerPath]: sandboxSlice.reducer,
    [snapCenterSlice.reducerPath]: snapCenterSlice.reducer,
    [sandboxApi.reducerPath]: sandboxApi.reducer,
    [exploreSavingsSlice.reducerPath]: exploreSavingsSlice.reducer,
    [createSandboxSlice.reducerPath]: createSandboxSlice.reducer,
    [exploreSavingsApi.reducerPath]: exploreSavingsApi.reducer,
    [getWellApi.reducerPath]: getWellApi.reducer,
    [getWellOptimizeSlice.name]: getWellOptimizeSlice.reducer,
    [agenticAISlice.name]: agenticAISlice.reducer,
    [errorInvestigationApi.reducerPath]: errorInvestigationApi.reducer,
    [dialogComponentSlice.name]: dialogComponentSlice.reducer
    // [postgressSlice.name]: postgressSlice.reducer
});

const rtkQueryErrorLogger: Middleware = (api: MiddlewareAPI) => next => (action: any) => {
    // RTK Query uses `createAsyncThunk` from redux-toolkit under the hood, so we're able to utilize these matchers
    if (isRejectedWithValue(action) && !action.meta.arg.originalArgs.selfErrorHandling) {
        let errorMsg = action.payload.error || action.payload.data?.message || action.payload.data?.responseMessage;

        // This error msg is blocked to have in notification. This error will be part of detect host dialog error.
        // getMssqlInstanceData - it is for each row in unmanaged host so not adding
        if (
            action?.meta?.arg?.endpointName === 'registerResourceCredentials' ||
            action?.meta?.arg?.endpointName === 'manageHost' ||
            action?.meta?.arg?.endpointName === 'getMssqlInstanceData' ||
            action?.meta?.arg?.endpointName === 'prepareHost' ||
            action?.meta?.arg?.endpointName === 'manageMssqlInstance' ||
            (action?.meta?.arg?.endpointName === 'listExistingHosts' && errorMsg?.includes('Unauthorized'))
        ) {
            return;
        }

        if (
            (action?.meta?.arg?.endpointName === 'discoverHosts' ||
                action?.meta?.arg?.endpointName === 'getDatabaseHosts') &&
            removeOldApisError(action?.meta?.arg)
        ) {
            return;
        }

        if (errorMessagesToBlock(errorMsg)) {
            return;
        }

        const reqFieldChk = requiredFieldError(errorMsg);
        if (reqFieldChk) {
            errorMsg = reqFieldChk + GENERAL.IS_REQUIRED_MSG;
        }

        errorMsg = customErrorMessages(errorMsg, action?.meta?.arg?.endpointName);
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
        // api.dispatch(setShowRetry(true));
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
            .concat(workloadFactoryResourceApiV2.middleware)
            .concat(jobMonitoringApi.middleware)
            .concat(headersApi.middleware)
            .concat(policiesApi.middleware)
            .concat(createUserDbApi.middleware)
            .concat(inventoryApi.middleware)
            .concat(snapcenterAPI.middleware)
            .concat(inventoryApiV2.middleware)
            .concat(sandboxApi.middleware)
            .concat(exploreSavingsApi.middleware)
            .concat(getWellApi.middleware)
            .concat(errorInvestigationApi.middleware)
            .concat(rtkQueryErrorLogger)
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export default store;
