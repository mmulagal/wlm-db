import { faker } from '@faker-js/faker';
import { getDatabases } from '../../src/operations/database-hosts-operations';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/aws/fsx-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/aws/ssm-scope';
import { ACCOUNT_ID, SECRETS } from '../../src/utils/consts';
import { createResource, deleteResource } from '../../src/lib/database/db';

SECRETS.AUTH_CLIENT_ID = `${faker.string.alphanumeric(20)}`;
SECRETS.SIGNURL_ACCESS_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
SECRETS.SIGNURL_SECRET_KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: 'ap-southeast-1',
        credentialsId: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node1InstanceName: 'node1',
            node2InstanceId: 'i-0880a21327284f67c',
            node2InstanceName: 'node2'
        }
    });
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
});

describe('Get databases in a server', () => {
    it('Get databases in a server', async () => {
        const resp = await getDatabases(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toBeDefined();
    });
});
