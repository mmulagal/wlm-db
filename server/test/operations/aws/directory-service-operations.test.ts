import { faker } from '@faker-js/faker';
import { getAdsList } from '../../../src/operations/aws/directory-service-operations';

import '../../simulator/scopes/aws/directory-service-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';

const credentialsid = `${faker.string.alphanumeric(20)}`;

describe('Directory service operations', () => {
    it('List all Active Directories in a region', async () => {
        const resp = await getAdsList(credentialsid, 'ap-southeast-1');
        expect(resp.directories).toBeDefined();
    });
});
