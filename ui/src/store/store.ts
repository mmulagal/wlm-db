import { configureStore, combineReducers } from "@reduxjs/toolkit";
import notificationSlice from "./notificationSlice";
import { awsApi } from "../utils/apiService";
import authSlice from './authSlice';
import appContextSlice from "./appContextSlice";
import mssqlSlice from "./mssqlSlice";

const rootReducer = combineReducers({
  [notificationSlice.name]: notificationSlice.reducer,
  [appContextSlice.name]: appContextSlice.reducer,
  [authSlice.name]: authSlice.reducer,
  [awsApi.reducerPath]: awsApi.reducer,
  [mssqlSlice.name]: mssqlSlice.reducer,
})

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(awsApi.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export default store;
