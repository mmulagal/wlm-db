import { faker } from '@faker-js/faker';
import nock from 'nock';
import { CREDENTIALS_ENDPOINT } from '../../../../src/utils/consts.js';

const credentialsId = `${faker.string.alphanumeric(20)}`;
const cloudManagerAllAwsCredentials = [
    {
        credentialsId: credentialsId,
        credentialsType: 'aws_assume_role',
        extra: {
            name: `${faker.string.alpha(10)}`,
            externalId: `${faker.string.alphanumeric(10)}`,
            arn: 'arn:aws:iam::210811601128:role/fsx_blanchet_role_occm',
            isGov: false
        },
        isSimulated: false
    }
];

const cloudManagerAwsCredentials = {
    credentialsId: credentialsId,
    credentialsType: 'aws_assume_role',
    extra: {
        name: `${faker.string.alpha(10)}`,
        externalId: `${faker.string.alphanumeric(10)}`,
        arn: 'arn:aws:iam::210811601128:role/fsx_blanchet_role_occm',
        isGov: false
    },
    credentials: {
        accessKey: `${faker.string.alphanumeric(20)}`,
        secretKey: `${faker.string.alphanumeric(20)}`,
        sessionId: `${faker.string.alphanumeric(60)}`,
        expiration: '2023-07-18T16:04:22.000Z'
    },
    isSimulated: false
};

nock(`${CREDENTIALS_ENDPOINT}`)
    .persist(true)
    .get(/^\/credentials\/accounts\/(.+)\/credentials$/)
    .query(queryObj => queryObj?.credentialsType === 'aws_assume_role')
    .reply(() => [200, cloudManagerAllAwsCredentials])
    .get(/^\/credentials\/accounts\/(.+)\/credentials\/(.+)$/)
    .reply(() => [200, cloudManagerAwsCredentials]);

export { cloudManagerAllAwsCredentials, cloudManagerAwsCredentials, credentialsId };
