import { faker } from '@faker-js/faker';
import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .post(/^\/auth\/v1\/auth\/token$/)
    .reply(() => [
        200,
        {
            access_token: `${faker.string.alpha(100)}`,
            expires_in: 21600,
            token_type: 'JWT'
        }
    ])
    .get(/^\/auth\/v1\/auth0\/token$/)
    .reply(() => [
        200,
        {
            access_token: `${faker.string.alpha(100)}`,
            expires_in: 21600,
            token_type: 'Bearer'
        }
    ]);
