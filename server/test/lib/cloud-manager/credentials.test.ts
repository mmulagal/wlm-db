import { faker } from '@faker-js/faker';
import {
    getAllWfCredentials,
    getWfCredentialDetails,
    associateResource
} from '../../../src/lib/cloud-manager/credentials';
import {
    allCredentials,
    genericDecryptedCredentials
} from '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import { DEFAULT_AWS_CREDENTIALS_ID } from '../../utils/consts';

const accountId = `account-${faker.string.alpha(6)}`;

vi.mock('../../../src/utils/async-local-storage.ts', () => ({
    setAsyncLocalStorageResource() {},
    getAsyncLocalStorageResource() {
        return accountId;
    }
}));

describe('Get workload factory credentials ', () => {
    // Its not mocked as we are making actual api call
    it.skip('should return a list of all AWS credentials stored in workload factory', async () => {
        const credentialsType = 'AWS_ASSUME_ROLE';
        const resp = await getAllWfCredentials(credentialsType);
        expect(resp).toEqual(allCredentials);
    });

    it('should return decrypted AWS credentials for credentials id passed', async () => {
        const resp = await getWfCredentialDetails(DEFAULT_AWS_CREDENTIALS_ID, accountId);
        expect(resp).toEqual(genericDecryptedCredentials);
    });

    it('Associate resources in credentials service', async () => {
        const resp = await associateResource(DEFAULT_AWS_CREDENTIALS_ID, accountId, [
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
