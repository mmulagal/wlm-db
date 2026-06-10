import { faker } from '@faker-js/faker';
import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';

const PROXY_PATH_REGEX = /^\/accounts\/([^/]+)\/proxy\/v1\/targets\/([^/]+)\/https\/.+/;

function isErrorTarget(uri: string): boolean {
    const match = PROXY_PATH_REGEX.exec(uri);
    return match?.[2] === 'error-target';
}

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(PROXY_PATH_REGEX)
    .reply(uri =>
        isErrorTarget(uri) ? [500, { errorMessage: 'Internal server error' }] : [200, { records: [], num_records: 0 }]
    )
    .post(PROXY_PATH_REGEX)
    .reply(uri =>
        isErrorTarget(uri)
            ? [500, { errorMessage: 'Internal server error' }]
            : [200, { job: { uuid: faker.string.uuid() } }]
    )
    .patch(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, { errorMessage: 'Internal server error' }] : [200, {}]))
    .put(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, { errorMessage: 'Internal server error' }] : [200, {}]))
    .delete(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, { errorMessage: 'Internal server error' }] : [200, {}]))
    .head(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, {}] : [200, {}]));
