import { faker } from '@faker-js/faker';
import {
    getAllBxpCredentials,
    getBxpCredentialDetails,
    getAllWfCredentials,
    getWfAwsCredentialDetails,
    getWfCredentialDetails
} from '../../../src/lib/cloud-manager/credentials';
import {
    cloudManagerAwsCredentials,
    credentialsId
} from '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import {
    allCredentials,
    awsCredentials,
    genericDecryptedCredentials
} from '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';

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
        expect(resp.length).toBeDefined();
    });

    it('should return details of AWS credential for credentials id passed', async () => {
        const resp = await getBxpCredentialDetails(credentialsId);
        expect(resp).toEqual(cloudManagerAwsCredentials);
    });
});

describe('Get workload factory credentials ', () => {
    it('should return a list of all AWS credentials stored in workload factory', async () => {
        const credentialsType = 'AWS_ASSUME_ROLE';
        const resp = await getAllWfCredentials(credentialsType);
        expect(resp).toEqual(allCredentials);
    });

    it.skip('should return decrypted AWS credentials for credentials id passed', async () => {
        const resp = await getWfCredentialDetails(credentialsId, accountId);
        expect(resp).toEqual(genericDecryptedCredentials);
    });

    it('should return decrypted AWS credentials details for credentials id passed', async () => {
        const resp = await getWfAwsCredentialDetails(credentialsId, accountId);
        expect(resp).toEqual(awsCredentials);
    });
});
