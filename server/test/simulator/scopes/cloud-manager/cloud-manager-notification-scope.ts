import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT } from '../../../../src/utils/consts.js';
import notificationResponse from '../../responses/cloud-manager/notification.json';

const cloudManagerNotificationResponse = nock(`${CLOUD_MANAGER_ENDPOINT}`, { allowUnmocked: process.env.NODE_ENV === 'demo' })
    .persist(true)
    .post(/^\/pubsub\/publish/)
    .reply(() => [200, notificationResponse]);

export default cloudManagerNotificationResponse;
