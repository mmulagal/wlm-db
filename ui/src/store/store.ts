import { configureStore, combineReducers, MiddlewareAPI, isRejectedWithValue, Middleware } from '@reduxjs/toolkit';
import notificationSlice, { addNotification, NOTIFICATION_TYPES } from './notificationSlice';
import { awsApi } from '../utils/apiService';
import authSlice from './authSlice';
import appContextSlice from './appContextSlice';
import mssqlSlice from './mssql/mssqlSlice';
import mssqlFormSlice from './mssql/mssqlFormSlice';
import msSqlActionSlice from './mssql/msSqlActionSlice';
import { GENERAL } from '../utils/appConstants';
import { requiredFieldError } from '../utils/utilityFunctions';

const rootReducer = combineReducers({
    [notificationSlice.name]: notificationSlice.reducer,
    [appContextSlice.name]: appContextSlice.reducer,
    [authSlice.name]: authSlice.reducer,
    [awsApi.reducerPath]: awsApi.reducer,
    [mssqlSlice.name]: mssqlSlice.reducer,
    [mssqlFormSlice.name]: mssqlFormSlice.reducer,
    [msSqlActionSlice.name]: msSqlActionSlice.reducer
});

const rtkQueryErrorLogger: Middleware = (api: MiddlewareAPI) => next => action => {
    // RTK Query uses `createAsyncThunk` from redux-toolkit under the hood, so we're able to utilize these matchers
    if (isRejectedWithValue(action) && !action.meta.arg.originalArgs.selfErrorHandling) {
        let errorMsg = action.payload.error || action.payload.data?.message;
        const reqFieldChk = requiredFieldError(errorMsg);
        if(reqFieldChk){
            errorMsg = reqFieldChk + GENERAL.IS_REQUIRED_MSG;
        }
        if(errorMsg && errorMsg.length > 250) {
            api.dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.ERROR, message: GENERAL.QUERY_ERROR, 
                additionalText: errorMsg }));
        } else {
            api.dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.ERROR, message: errorMsg }));
        }
    }

    return next(action);
};

const store = configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware({ serializableCheck: false }).concat(awsApi.middleware).concat(rtkQueryErrorLogger)
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export default store;
