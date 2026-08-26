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

const genericDecryptedCredentials = {
    id: credentialsId,
    type: 'AWS_ASSUME_ROLE',
    metadata: {
        name: `${faker.string.alpha(10)}`,
        externalId: `${faker.string.alphanumeric(10)}`,
        arn: 'arn:aws:iam::718273455463:role/test-assume-role',
        policy: {
            fsx: false,
            vmware: false,
            databases: 'operate'
        },
        isAlpha: false
    },
    credentials: {
        accessKeyId: `${faker.string.alphanumeric(20)}`,
        secretAccessKey: `${faker.string.alphanumeric(20)}`,
        sessionToken: `${faker.string.alphanumeric(60)}`,
        expiration: '2025-07-18T16:04:22.000Z'
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

// Stands in for an ONTAP credential registered against a simulated FSx file system. `metadata.ip`
// is omitted so callers address ONTAP by the management DNS name from DescribeFileSystems.
const ontapCredentialsId = 'ontap-credentials-simulated';
const ontapUserName = 'fsxadmin';
const ontapPassword = 'simulated-fsxadmin-password';
const ontapDecryptedCredentials = {
    id: ontapCredentialsId,
    type: 'ONTAP',
    metadata: { userName: ontapUserName },
    credentials: ontapPassword
};
nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(/^\/accounts\/(.+)\/credentials\/v1\/credentials/)
    .query(queryObj => String(queryObj?.filter ?? '').includes('ONTAP'))
    .reply(() => [
        200,
        {
            items: [{ id: ontapCredentialsId, type: 'ONTAP', metadata: { userName: ontapUserName } }],
            nextToken: null
        }
    ])
    .get(/^\/accounts\/(.+)\/credentials\/v1\/generic\/(.+)/)
    .query(queryObj => Boolean(queryObj?.decrypt) === true)
    .reply(uri => [200, uri.includes(ontapCredentialsId) ? ontapDecryptedCredentials : genericDecryptedCredentials])
    .get(/^\/accounts\/(.+)\/credentials\/v1\/generic\/(.+)/)
    .query(queryObj => Boolean(queryObj?.decrypt) === false)
    .reply(() => [200, genericCredentials])
    .post(/^\/accounts\/(.+)\/credentials\/v1\/associations/)
    .reply(() => [
        200,
        {
            credentials: '35887b14-3e98-499d-8165-e0f45ec5057e',
            resources: [
                {
                    id: '0cec115582d22fcc87b193ae485fa4bba0d67d590e806674fe07e6fbea608652',
                    name: 'sqldbvy5p4',
                    type: 'MSSQL'
                },
                {
                    id: 'fs-08195cb9399d38c19',
                    name: null,
                    type: 'FSxFileSystem'
                }
            ]
        }
    ]);

export { allCredentials, genericDecryptedCredentials, credentialsId, ontapUserName, ontapPassword };
