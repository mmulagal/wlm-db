import prepareWFNotificationRequest from '../../src/operations/wf-notification-operations';
import { ACCOUNT_ID } from '../../src/utils/consts';

const notificationData = {
    content:
        'All Microsoft SQL Server instances in your account have been analyzed for well-architected issues. Well-architected Instances: 5, Not optimized Instances: 2. Review detailed findings and recommendations in the Workload Factory database inventory.',
    subject: '3 instances on your account are not well-architected.',
    resourceName: 'Test-Instance',
    resourceId: 'instance-123',
    notificationType: 'Well-architected'
};

describe('preparing wf notification', () => {
    it('Prepare details to send WF Notification', async () => {
        const response = await prepareWFNotificationRequest(ACCOUNT_ID, notificationData);
        expect(response).toEqual({ message: 'Notification sent successfully' });
    });
});
