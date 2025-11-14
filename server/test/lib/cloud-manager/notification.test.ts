import sendNotification from '../../../src/lib/cloud-manager/notification';
import { ACCOUNT_ID } from '../../../src/utils/consts';

import notificationResponse from '../../simulator/responses/cloud-manager/notification.json';

const requestJson = [
    {
        type: 'publish',
        accountId: ACCOUNT_ID,
        resourceType: 'WLMDB',
        resourceId: 'WLMDB-Resource-1',
        action: 'deployment',
        plugins: ['ui', 'alert-notification'],
        payload: {
            plugins: {
                ui: {
                    user: '*',
                    timestamp: 1694493503551,
                    priority: 'critical',
                    service: 'WLMDB',
                    description: 'MSSql cloud formation template successfully deployed',
                    errors: '',
                    persist: true,
                    persistConfig: {
                        ttl: 3600
                    },
                    resourceName: 'WLMDB',
                    actionLabel: 'MSSql Cloud Formation Deployment',
                    actionRequired: {
                        to: '/database-services',
                        label: 'Go to Dashboard'
                    },
                    checkPermission: false,
                    permissionConfig: {
                        action: 'resources:*',
                        enforceWorkspace: true
                    },
                    link: {
                        url: '/database-services',
                        label: 'More information'
                    }
                },
                alertNotification: {
                    subject: 'MSSql Cloud Formation Deployment',
                    title: 'MSSql Cloud Formation Deployment',
                    priority: 'critical',
                    body: {
                        contentType: 'markdown',
                        content: 'MSSql cloud formation template successfully deployed'
                    },
                    actionRequired: {
                        to: 'https://staging.api.bluexp.netapp.com/database-services',
                        label: 'Go to Dashboard'
                    },
                    service: 'WLMDB',
                    link: {
                        url: 'https://staging.api.bluexp.netapp.com/database-services',
                        label: 'More information'
                    }
                }
            }
        }
    }
];
describe('Send Notification', () => {
    it('Send notification', async () => {
        const response = await sendNotification(requestJson);

        expect(response).toEqual(notificationResponse);
    });
});
