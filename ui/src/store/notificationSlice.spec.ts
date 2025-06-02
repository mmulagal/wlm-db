import { configureStore, createAction } from "@reduxjs/toolkit";
import notificationSlice, {
  Notification,
  addNotification,
  removeNotification,
  clearNotifications,
  NewNotificationPayload,
} from "./notificationSlice";

jest.mock("@netapp/design-system", () => {
  return {
    Notification: jest.fn(),
    NotificationPanel: jest.fn(),
    Typography: jest.fn(),
  };
});

describe("notificationSlice", () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        notifications: notificationSlice.reducer,
      },
    });
  });

  it("should add a notification", () => {
    const notificationPayload: NewNotificationPayload = {
      children: "Notification message",
      type: "success",
      id: "notificationId",
    };

    store.dispatch(addNotification(notificationPayload));

    const state: Notification = store.getState().notifications;

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual(notificationPayload);
  });

  it("should remove a notification", () => {
    const initialState: Notification = {
      messages: [
        {
          children: "Notification message",
          type: "success",
          id: "notificationId",
        },
      ],
      showDetailedView: false,
    };

    store.dispatch(notificationSlice.actions.removeNotification(0));

    const state: Notification = store.getState().notifications;

    expect(state.messages).toHaveLength(0);
  });

  it("should clear all notifications", () => {
    const initialState: Notification = {
      messages: [
        {
          children: "Notification message",
          type: "success",
          id: "notificationId",
        },
      ],
      showDetailedView: false,
    };

    store.dispatch(clearNotifications());

    const state: Notification = store.getState().notifications;

    expect(state.messages).toHaveLength(0);
  });
});
