import nock from 'nock';
import { faker } from '@faker-js/faker';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .post(/^\/accounts\/(.+)\/links\/v1\/links$/)
    .reply((_, body) => {
        const requestBody = typeof body === 'string' ? JSON.parse(body) : body;
        if (requestBody?.arn && requestBody.arn === 'invalid arn') {
            return [500, { errorMessage: 'Internal server error' }];
        }
        return [
            200,
            {
                id: faker.string.uuid(),
                name: faker.string.alphanumeric(10)
            }
        ];
    });
