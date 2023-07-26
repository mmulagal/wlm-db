import { faker } from '@faker-js/faker';
import { getAllAwsCredentials, getCredentialDetails } from '../../../src/lib/cloud-manager/credentials';
import {
    cloudManagerAllAwsCredentials,
    cloudManagerAwsCredentials,
    credentialsId
} from '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';

const account_id = 'account-' + `${faker.string.alpha(6)}`;

vi.mock('../../../src/utils/async-local-storage.ts', () => {
    return {
        getAsyncLocalStorageResource() {
            return account_id;
        }
    };
});

describe('getAllAwsCredentials', () => {
    it('should return a list of AWS credentials', async () => {
        const credentialsType = 'aws_assume_role';
        const resp = await getAllAwsCredentials(credentialsType);
        expect(resp).toEqual(cloudManagerAllAwsCredentials);
    });
});

describe('getAwsCredentials', () => {
    it('should return details of AWS credential for credentials id passed', async () => {
        const resp = await getCredentialDetails(credentialsId);
        expect(resp).toEqual(cloudManagerAwsCredentials);
    });
});
