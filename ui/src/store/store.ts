import { configureStore } from "@reduxjs/toolkit";
import notificationSlice from "./notificationSlice";

const store = configureStore({
  reducer: {
    notifications: notificationSlice.reducer,
  },
});

export default store;
