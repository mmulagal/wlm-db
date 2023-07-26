import { faker } from '@faker-js/faker';
import { getAdsList } from '../../../src/operations/aws/directory-service-operations';

import '../../simulator/scopes/aws/directory-service-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';

const credentialsid = `${faker.string.alphanumeric(20)}`;

describe('Directory service operations', () => {
    it('List all Active Directories in a VPC', async () => {
        const resp = await getAdsList(credentialsid, 'ap-southeast-1', 'vpc-7d4a2818');
        expect(resp.directories).toBeDefined();
    });

    it('List all Active Directories in a VPC - VPC ID is not matched', async () => {
        const resp = await getAdsList(credentialsid, 'ap-southeast-1', 'vpc-123');
        expect(resp).toEqual({ directories: [] });
    });
});
