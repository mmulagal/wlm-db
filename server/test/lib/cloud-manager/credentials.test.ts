import { faker } from '@faker-js/faker';
import {
    getAllBxpCredentials,
    getBxpCredentialDetails,
    getAllWfCredentials,
    getWfCredentialDetails,
    associateResource
} from '../../../src/lib/cloud-manager/credentials';
import {
    cloudManagerAwsCredentials,
    credentialsId
} from '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import {
    allCredentials,
    genericDecryptedCredentials
} from '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';

const accountId = `account-${faker.string.alpha(6)}`;

vi.mock('../../../src/utils/async-local-storage.ts', () => ({
    setAsyncLocalStorageResource() {},
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
    // Its not mocked as we are making actual api call
    it.skip('should return a list of all AWS credentials stored in workload factory', async () => {
        const credentialsType = 'AWS_ASSUME_ROLE';
        const resp = await getAllWfCredentials(credentialsType);
        expect(resp).toEqual(allCredentials);
    });

    it('should return decrypted AWS credentials for credentials id passed', async () => {
        const resp = await getWfCredentialDetails(credentialsId, accountId);
        expect(resp).toEqual(genericDecryptedCredentials);
    });

    it('Associate resources in credentials service', async () => {
        const resp = await associateResource(credentialsId, accountId, [
            {
                id: '0cec115582d22fcc87b193ae485fa4bba0d67d590e806674fe07e6fbea608652',
                name: 'sqldbvy5p4',
                type: 'MSSQL'
            },
            {
                id: 'fs-08195cb9399d38c19',
                name: '',
                type: 'FSxFileSystem'
            }
        ]);
        expect(resp.credentials).toBeDefined();
        expect(resp.resources.length).toBeGreaterThan(0);
    });
});
