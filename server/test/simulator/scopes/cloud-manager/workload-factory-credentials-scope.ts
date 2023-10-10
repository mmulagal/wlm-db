import { faker } from '@faker-js/faker';
import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';

const credentialsId = `${faker.string.alphanumeric(20)}`;
const allCredentials = {
    items: [
        {
            id: 'bfe4d230-0b9c-404a-bb33-f915a20b13f9',
            credentials: 'arn:aws:iam::718273455463:role/test-assume-role',
            type: 'AWS_ASSUME_ROLE',
            metadata: {
                name: 'test-sg'
            },
            numAssociatedResources: 0,
            accountId: 'account-6S5xAetX'
        }
    ],
    nextToken: ''
};

const awsCredentials = {
    items: [
        {
            id: 'bfe4d230-0b9c-404a-bb33-f915a20b13f9',
            credentials: 'arn:aws:iam::718273455463:role/test-assume-role',
            type: 'AWS_ASSUME_ROLE',
            metadata: {
                name: 'test-sg'
            },
            numAssociatedResources: 0
        }
    ]
};

const genericDecryptedCredentials = {
    id: credentialsId,
    type: 'AWS_ASSUME_ROLE',
    metadata: {
        name: `${faker.string.alpha(10)}`,
        externalId: `${faker.string.alphanumeric(10)}`
    },
    credentials: {
        accessKey: `${faker.string.alphanumeric(20)}`,
        secretKey: `${faker.string.alphanumeric(20)}`,
        sessionId: `${faker.string.alphanumeric(60)}`,
        expiration: '2023-07-18T16:04:22.000Z'
    },
    numAssociatedResources: 0
};

const genericCredentials = {
    id: credentialsId,
    type: 'AWS_ASSUME_ROLE',
    metadata: {
        name: `${faker.string.alpha(10)}`,
        externalId: `${faker.string.alphanumeric(10)}`
    },
    credentials: 'arn:aws:iam::718273455463:role/test-assume-role',
    numAssociatedResources: 0
};
nock(`${WORKLOAD_FACTORY_ENDPOINT}`)
    .persist(true)
    .get(/^\/accounts\/(.+)\/credentials\/v1\/credentials$/)
    .query(queryObj => queryObj?.type === 'AWS_ASSUME_ROLE')
    .reply(() => [200, allCredentials])
    .get(/^\/accounts\/(.+)\/credentials\/v1\/assume-role\/(.+)$/)
    .query(true)
    .reply(() => [200, awsCredentials])
    .get(/^\/accounts\/(.+)\/credentials\/v1\/generic\/(.+)$/)
    .query(queryObj => Boolean(queryObj?.decrypt) === true)
    .reply(() => [200, genericDecryptedCredentials])
    .get(/^\/accounts\/(.+)\/credentials\/v1\/generic\/(.+)$/)
    .query(queryObj => Boolean(queryObj?.decrypt) === false)
    .reply(() => [200, genericCredentials]);

export { allCredentials, genericDecryptedCredentials, credentialsId };
