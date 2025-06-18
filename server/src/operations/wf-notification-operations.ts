import createError from 'http-errors';
import { WLMDB_RESOURCE_CLASS, WF_NOTIFICATION_RESOURCE_TYPE, WF_NOTIFICATION_PRIORITY } from '../utils/consts';
import sendWFNotification from '../lib/cloud-manager/wf-notification';
import getLogger from '../utils/logger';
import { isNonEmptyObject } from '../utils/utils';

const logger = getLogger();

// Notification interface
export interface WFNotification {
    content: string;
    subject: string;
    resourceType?: string;
    resourceId: string;
    workload?: string;
    priority?: string;
    resourceName: string;
    timestamp?: number;
    notificationType: string;
    actionRequired?: boolean;
    persist?: boolean;
    ttl?: number;
    action?: string;
    userId?: string;
    service?: string;
    link?: string;
}

/**
 * Prepares and sends a notification using the Workload Factory notification service.
 * @param accountId - WLF account ID
 * @param notificationData - Notification body (subject, content, etc.)
 * @param userId - WLF user
 * @param service - Service name (e.g., 'wlmdb')
 * @returns The response from the notification service
 */
export async function prepareWFNotificationRequest(
    accountId: string,
    notificationData: WFNotification,
    userId: string = '*',
    service: string = WLMDB_RESOURCE_CLASS
) {
    logger.info('prepare WF Notification Request', {
        accountId,
        userId,
        service,
        notificationData
    });

    try {
        const notification: WFNotification = {
            ...notificationData,
            resourceType: notificationData.resourceType ?? WF_NOTIFICATION_RESOURCE_TYPE,
            workload: notificationData.workload ?? WLMDB_RESOURCE_CLASS,
            priority: notificationData.priority ?? WF_NOTIFICATION_PRIORITY.WF_RECOMMENDATION,
            persist: notificationData.persist ?? false,
            ttl: notificationData.ttl ?? 3600,
            action: notificationData.action ?? '',
            timestamp: Date.now(),
            userId,
            service,
            ...(isNonEmptyObject(notificationData.actionRequired) && {
                actionRequired: notificationData.actionRequired
            }),
            ...(isNonEmptyObject(notificationData.link) && { link: notificationData.link })
        };

        logger.debug('Prepared WF notification request body', notification);
        const response = await sendWFNotification(accountId, notification);
        logger.debug('WF notification sent successfully', { response });
        return { message: 'Notification sent successfully' };
    } catch (err: any) {
        logger.error('Error in prepare WF Notification request', err);
        throw createError(500, `Failed to send notification: ${err.message}`);
    }
}
