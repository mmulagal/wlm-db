import nock from 'nock';
import { faker } from '@faker-js/faker';
import { getAllAwsCredentials, getCredentialDetails } from '../../../src/lib/cloud-manager/credentials';
import { CREDENTIALS_ENDPOINT } from '../../../src/utils/consts';

const cloudManagerAllAwsCredentials = [
    {
        credentialsId: `${faker.string.alphanumeric(20)}`,
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

const credentialsId = `${faker.string.alphanumeric(20)}`;

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

const account_id = 'account-' +  `${faker.string.alpha(6)}`;

vi.mock('../../../src/utils/async-local-storage.ts', () => {
    return {
        getAsyncLocalStorageResource(){
        return account_id;
        }
    };
});

nock(`${CREDENTIALS_ENDPOINT}`)
    .persist(true)
    .get(/^\/credentials\/accounts\/(.+)\/credentials\?credentialsType=aws_assume_role$/)
    .reply(() => [200, cloudManagerAllAwsCredentials])
    .get(/^\/credentials\/accounts\/(.+)\/credentials\/(.+)$/)
    .reply(() => [200, cloudManagerAwsCredentials]);

describe('getAllAwsCredentials', () => {
  it('should return a list of AWS credentials', async () => {
    const resp = await getAllAwsCredentials();
    expect(resp).toEqual(cloudManagerAllAwsCredentials);  
  });
});

describe('getAwsCredentials', () => {
    it('should return details of AWS credential for credentials id passed', async () => {
      const resp = await getCredentialDetails(credentialsId);
      expect(resp).toEqual(cloudManagerAwsCredentials);  
    });
  });

