import { faker } from '@faker-js/faker';
import { getAdsList } from '../../../src/operations/aws/directory-service-operations';

const credentialsid = `${faker.string.alphanumeric(20)}`;

describe('Directory service operations', () => {
    it('List all Active Directories in a region', async () => {
        const resp = await getAdsList(credentialsid, 'ap-southeast-1');
        expect(resp.directories).toBeDefined();
    });
});
