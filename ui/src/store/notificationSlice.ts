import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NotificationType } from '@netapp/design-system/dist/components/Notification';
import { MouseEventHandler, ReactNode } from 'react';

export type Notification = {
    messages: any;
    showDetailedView: boolean;
};

export enum NOTIFICATION_TYPES {
    SUCCESS = 'success',
    WARNING = 'warning',
    ERROR = 'error',
    INFO = 'info',
    URGENT = 'urgent',
    FAILED = 'failed'
}

export interface NewNotificationPayload {
    children: ReactNode;
    notificationType: NotificationType;
    id: string | undefined;
    onClose?: MouseEventHandler<HTMLButtonElement>;
}
const initialState: Notification = {
    messages: [],
    showDetailedView: false
};

const notificationSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        addNotification: (state: Notification, action: PayloadAction<any>) => {
            const { message, allowDuplicate } = action.payload;

            const existingNotifications = state.messages ? [...state.messages] : [];

            const isExists = existingNotifications.find(item => item.message === message && !item.linkComp);

            const notificationMessages =
                isExists && !allowDuplicate ? [...state.messages] : [...state.messages, action.payload];

            state.messages = notificationMessages;
        },
        removeNotification: (state, action: PayloadAction<number>) => {
            const notifications = [...state.messages];

            const idToRemove = action.payload;

            notifications.splice(idToRemove, 1);

            state.messages = notifications;
        },
        clearNotifications: () => initialState
    }
});

export const { addNotification, removeNotification, clearNotifications } = notificationSlice.actions;
export default notificationSlice;
