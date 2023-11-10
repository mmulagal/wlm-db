import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import {
    ACCOUNT_ID,
    WLMDB_RESOURCE_CLASS,
    WLMDB_ABSOLUTE_ENDPOINT,
    CRITICAL,
    RESOURCE_ID,
    PUBLISH,
    MOREINFO,
    ACTION_BUTTON_DASHBOARD
} from '../../utils/consts.js';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage.js';
import sendNotification from '../../lib/cloud-manager/notification.js';
import getLogger from '../../utils/logger.js';

const logger = getLogger();

interface Notification {
    notificationAction: string;
    subject: string;
    uiNotificationDescription: string;
    mailNotificationDescription?: string;
    actionLabel: string;
    redirectURL?: string;
    label: string;
    priority?: string;
    params?: any;
    persist?: boolean;
    errors?: any;
    accountId?: string;
}

async function prepareDetailsToSendNotification(
    action: string,
    subject: string,
    uiNotificationDescription: string,
    notification: { uiNotification: boolean; emailNotification: boolean },
    label: string = ACTION_BUTTON_DASHBOARD,
    priority?: string,
    redirectURL: string = '/database-services',
    mailNotificationDescription?: string,
    params?: any,
    accountId?: string
) {
    if (process.env.ENV_WLMDB_BUILD_MODE !== 'demo') {
        logger.info('Prepare details to send notificaiton', {
            action,
            subject,
            uiNotificationDescription,
            notification,
            priority,
            redirectURL,
            label,
            mailNotificationDescription,
            params,
            accountId
        });
        const data = {
            notificationAction: action,
            subject,
            uiNotificationDescription,
            ...(mailNotificationDescription && { mailNotificationDescription }), // If we want to send different notification description for ui notification and email notification then we can pass both description
            actionLabel: subject,
            redirectURL,
            label,
            priority,
            params,
            accountId
        };
        const notificationResponse = await handleNotification(data, notification);
        return notificationResponse;
    }
}

async function handleNotification(
    data: Notification,
    notifications: { uiNotification: boolean; emailNotification: boolean }
) {
    logger.info('handling notification', { data, notifications });

    const { uiNotification, emailNotification } = notifications;
    if (uiNotification || emailNotification) {
        const plugins = [];

        if (uiNotification) {
            plugins.push('ui');
        }
        if (emailNotification) {
            plugins.push('alert-notification');
        }

        const requestBody = [
            {
                type: PUBLISH,
                accountId: data.accountId || getAsyncLocalStorageResource(ACCOUNT_ID) || process.env.ACCOUNT_ID,
                resourceType: WLMDB_RESOURCE_CLASS,
                resourceId: RESOURCE_ID, // can be changed later on
                action: data.notificationAction,
                plugins,
                payload: {
                    plugins: {
                        ...(uiNotification && {
                            ui: {
                                user: '*',
                                timestamp: new Date().getTime(),
                                priority: data.priority || CRITICAL,
                                service: WLMDB_RESOURCE_CLASS,
                                description: data.uiNotificationDescription,
                                errors: data.errors || '',
                                persist: data.persist || true,
                                persistConfig: {
                                    ttl: 3600
                                },
                                resourceName: WLMDB_RESOURCE_CLASS,
                                actionLabel: data.actionLabel,
                                ...(data.redirectURL && {
                                    actionRequired: {
                                        to: data.redirectURL || '',
                                        label: data.label || '',
                                        ...(!isEmpty(data.params) && { params: data.params })
                                    }
                                }),
                                checkPermission: false,
                                permissionConfig: {
                                    action: 'resources:*',
                                    enforceWorkspace: true
                                },
                                ...(data.label && {
                                    link: {
                                        url: data.redirectURL,
                                        label: MOREINFO
                                    }
                                })
                            }
                        }),
                        ...(emailNotification && {
                            alertNotification: {
                                subject: data.subject,
                                title: data.subject,
                                priority: data.priority || CRITICAL,
                                body: {
                                    contentType: 'markdown',
                                    content: data.mailNotificationDescription
                                        ? data.mailNotificationDescription
                                        : data.uiNotificationDescription
                                },
                                ...(data.redirectURL && {
                                    actionRequired: {
                                        to: `${WLMDB_ABSOLUTE_ENDPOINT}${data.redirectURL}` || '',
                                        label: data.label || ''
                                    }
                                }),
                                service: WLMDB_RESOURCE_CLASS,
                                ...(data.label && {
                                    link: {
                                        url: `${WLMDB_ABSOLUTE_ENDPOINT}${data.redirectURL}`,
                                        label: MOREINFO
                                    }
                                })
                            }
                        })
                    }
                }
            }
        ];

        try {
            return await sendNotification(requestBody);
        } catch (error: any) {
            const errMsg = `Failed to send the notification. ${error.message}`;

            logger.error(errMsg);
        }
    } else {
        const errMsg = 'Failed to send the notification, Minimum one notification required';
        logger.error(errMsg);
        throw createError(500, errMsg);
    }
}

export { prepareDetailsToSendNotification, handleNotification };
