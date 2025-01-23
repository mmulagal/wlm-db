import React, { useEffect, useMemo } from 'react';
import { Notification, NotificationPanel } from '@netapp/design-system';

import styles from './AppNotification.module.scss';
import { NOTIFICATION_TYPES } from '../../store/notificationSlice';

export type NotificationObject = {
    messages: [
        {
            notificationType: string;
            additionalText: string | undefined;
            linkComp: { comp: any; data: any; label: string };
            message: string | undefined;
            allowDuplicate: boolean;
            notificationPlacement: string | undefined;
        }
    ];
    showDetailedView: boolean;
};

type NotificationDetails = {
    notificationType: any;
    additionalText: string | undefined;
    linkComp: { comp: any; data: any; label: string };
    message: string | undefined;
    allowDuplicate: boolean;
};

type AppNotificationParams = {
    notifications: NotificationObject;
    onClose: (idx?: number, totalCount?: number) => void;
};

const AppNotification = ({ notifications, onClose }: AppNotificationParams) => {
    //@ts-ignore
    const showGroupNotificationMessage = useMemo(() => {
        return notifications && notifications.messages.length > 1 && notifications.showDetailedView === false;
    }, [notifications]);
    const manualNotificationPlacement =
        notifications.messages.length === 1 && notifications.messages[0].notificationPlacement;

    // Set timers for specific notification types: success and info
    useEffect(() => {
        const timers: NodeJS.Timeout[] = [];

        notifications.messages.forEach((notification, idx) => {
            if (
                notification.notificationType === NOTIFICATION_TYPES.SUCCESS ||
                notification.notificationType === NOTIFICATION_TYPES.INFO
            ) {
                const timer = setTimeout(() => {
                    onClose(idx, notifications.messages.length);
                }, 8000);

                timers.push(timer);
            }
        });

        return () => {
            // Clear timers when component unmounts or notifications change
            timers.forEach(clearTimeout);
        };
    }, [notifications, onClose]);

    return (
        <div
            className={styles['app-notification-container']}
            style={{
                bottom: manualNotificationPlacement ? manualNotificationPlacement : ''
            }}
        >
            <div
                style={
                    showGroupNotificationMessage
                        ? { display: 'flex', backgroundColor: '#ffffff' }
                        : notifications.messages.length === 1
                        ? {
                              //display: 'flex',
                              //backgroundColor: getTypeBGColor(notifications.messages[0]),
                          }
                        : { display: 'initial', backgroundColor: '#ffffff' }
                }
                className={styles[`app-notification-content-container`]}
            >
                {notifications.messages.length > 1 ? (
                    <NotificationPanel
                        notifications={notifications.messages.map((notification: NotificationDetails, idx: number) => {
                            const newNotObj: any = {};
                            const LinkComp = notification.linkComp && notification.linkComp.comp;
                            const compData = notification.linkComp && notification.linkComp.data;
                            const label = notification.linkComp && notification.linkComp.label;
                            if (notification.additionalText) {
                                newNotObj.moreInfo = notification.additionalText;
                            }
                            if (LinkComp) {
                                newNotObj.children = (
                                    <div style={{ display: 'flex' }} key={idx}>
                                        {notification.message}
                                        {LinkComp && (
                                            <LinkComp data={compData} onClose={() => onClose()} label={label} />
                                        )}
                                    </div>
                                );
                            } else {
                                newNotObj.children = notification.message;
                            }

                            newNotObj.id = idx;
                            newNotObj.onClose = () => onClose(idx);
                            newNotObj.type = notification?.notificationType?.toLowerCase();
                            return newNotObj;
                        })}
                    />
                ) : (
                    notifications.messages.map((notification: NotificationDetails, idx: number) => {
                        const totalCount = notifications.messages.length;
                        const LinkComp = notification.linkComp && notification.linkComp.comp;
                        const compData = notification.linkComp && notification.linkComp.data;
                        const label = notification.linkComp && notification.linkComp.label;
                        return notification.additionalText ? (
                            //This condition is for restore scenario requirement SFR-2262
                            notification.notificationType === 'INFO_DETAIL' ? (
                                <Notification
                                    onClose={() => {
                                        onClose(idx, totalCount);
                                    }}
                                    key={idx}
                                    type="info"
                                    variant="primary"
                                >
                                    <div style={{ display: 'block' }}>
                                        <div>{notification.message}</div>
                                        <div style={{ display: 'flex' }}>
                                            {notification.additionalText}&nbsp;
                                            {LinkComp && (
                                                <LinkComp
                                                    data={compData}
                                                    onClose={() => onClose()}
                                                    label="Job Monitoring"
                                                />
                                            )}{' '}
                                            &nbsp;tab.
                                        </div>
                                    </div>
                                </Notification>
                            ) : (
                                <Notification //With show more option
                                    onClose={() => {
                                        onClose(idx, totalCount);
                                    }}
                                    moreInfo={notification.additionalText}
                                    type={notification?.notificationType?.toLowerCase()}
                                    variant="primary"
                                    key={idx}
                                >
                                    {notification.message}
                                </Notification>
                            )
                        ) : (
                            <Notification
                                onClose={() => {
                                    onClose(idx, totalCount);
                                }}
                                type={notification?.notificationType?.toLowerCase()}
                                variant="primary"
                                className={styles['adjust-notifiction-height']}
                                key={idx}
                            >
                                <div>
                                    {notification.message}
                                    {LinkComp && <LinkComp data={compData} onClose={() => onClose()} label={label} />}
                                </div>
                            </Notification>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default AppNotification;
