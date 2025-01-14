import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT } from '../../../../src/utils/consts';
import { faker } from '@faker-js/faker';

nock(`${CLOUD_MANAGER_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .post(/^\/accounts\/[a-zA-Z0-9-]+\/links\/v1\/links$/)
    .reply(() => [
        200,
        {
            id: faker.string.uuid(),
            name: faker.string.alphanumeric(10)
        }
    ]);
