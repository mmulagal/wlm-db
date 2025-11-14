import { sendWFNotification } from '../../../src/lib/cloud-manager/wf-notification';
import { ACCOUNT_ID } from '../../../src/utils/consts';

const notificationRequestBody = {
    content:
        'All Microsoft SQL Server instances in your account have been analyzed for well-architected issues. Well-architected Instances: 5, Not optimized Instances: 2. Review detailed findings and recommendations in the Workload Factory database inventory.',
    subject: '3 instances on your account are not well-architected.',
    resourceType: 'DB',
    resourceId: 'instance-123',
    workload: 'WLMDB',
    priority: 'Recommendation',
    resourceName: 'Test-Instance',
    timestamp: 1748461308606,
    notificationType: 'Well-architected',
    actionRequired: false,
    persist: false,
    ttl: 3600,
    action: '',
    userId: 'user-abc',
    service: 'fsxw'
};

describe('send WF Notification', () => {
    it('Should Send WF notification', async () => {
        const response = await sendWFNotification(ACCOUNT_ID, notificationRequestBody);
        expect(response?.statusCode).toBe(204);
    });
});
