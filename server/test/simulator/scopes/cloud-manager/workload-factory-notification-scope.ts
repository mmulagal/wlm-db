import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts.js';

const workloadFactoryNotificationResponse = nock(WORKLOAD_FACTORY_ENDPOINT, {
    allowUnmocked: process.env.NODE_ENV === 'demo'
})
    .persist(true)
    .post(/\/accounts\/[^/]+\/notification\/v1\/send/)
    .reply(204);

export default workloadFactoryNotificationResponse;
