import { faker } from '@faker-js/faker';
import { getAllBxpCredentials, getBxpCredentialDetails } from '../../../src/lib/cloud-manager/credentials';
import {
    cloudManagerAllAwsCredentials,
    cloudManagerAwsCredentials,
    credentialsId
} from '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';

const accountId = `account-${faker.string.alpha(6)}`;

vi.mock('../../../src/utils/async-local-storage.ts', () => ({
    getAsyncLocalStorageResource() {
        return accountId;
    }
}));

describe('Get Blue XP credentials ', () => {
    it('should return a list of AWS credentials', async () => {
        const credentialsType = 'aws_assume_role';
        const resp = await getAllBxpCredentials(credentialsType);
        expect(resp).toEqual(cloudManagerAllAwsCredentials);
    });

    it('should return details of AWS credential for credentials id passed', async () => {
        const resp = await getBxpCredentialDetails(credentialsId);
        expect(resp).toEqual(cloudManagerAwsCredentials);
    });
});
