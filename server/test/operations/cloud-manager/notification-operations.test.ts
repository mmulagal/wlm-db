import {
    handleNotification,
    prepareDetailsToSendNotification
} from '../../../src/operations/cloud-manager/notification-operations';
import notificationResponse from '../../simulator/responses/cloud-manager/notification.json';

describe('handling notification', () => {
    it('handling notification', async () => {
        const data = {
            notificationAction: 'test_notification',
            subject: 'MSSql Cloud Formation Deployment',
            description: 'MSSql cloud formation template successfully deployed',
            actionLabel: 'MSSql Cloud Formation Deployment',
            redirectURL: '/database-services',
            label: 'Go to Dashboard',
            priority: 'critical',
            uiNotificationDescription: 'MSSql cloud formation template successfully deployed'
        };

        const response = await handleNotification(data, { uiNotification: true, emailNotification: true });

        expect(response).toEqual(notificationResponse);
    });

    it('Prepare details to send Notification', async () => {
        const response = await prepareDetailsToSendNotification(
            'test_notification',
            'MSSql Cloud Formation Deployment',
            'MSSql cloud formation template successfully deployed',
            { uiNotification: true, emailNotification: false }
        );
        expect(response).toEqual(notificationResponse);
    });
});
