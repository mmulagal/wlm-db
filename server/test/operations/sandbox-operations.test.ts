import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/aws/fsx-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/aws/ssm-scope';
import { ACCOUNT_ID } from '../../src/utils/consts';
import { createResource, deleteResource } from '../../src/lib/database/db';
import { createSandbox, getSandboxSavings, getSandboxesInfo } from '../../src/operations/sandbox-operations';
import sandboxResponse from '../simulator/responses/workload/sandbox-response.json';

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
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI',
            sandboxCreated: true
        }
    });
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
});

describe('sandbox operations ', () => {
    it('Get sandbox details for all resources', async () => {
        const resp = await getSandboxesInfo(ACCOUNT_ID, 'f6082f35-c1db-4619-bb5c-84bcb5bf3286', 'ap-southeast-1');
        expect(resp).toMatchObject(sandboxResponse.getSandboxDetailsResponse);
    });

    it('Get the storage savings for cloned resources', async () => {
        const resp = await getSandboxSavings(ACCOUNT_ID, 'f6082f35-c1db-4619-bb5c-84bcb5bf3286', 'ap-southeast-1');
        expect(Object.keys(resp).sort()).toEqual(
            ['consumedStorage', 'sandboxSavingsPercentage', 'savedStorage'].sort()
        );
    });

    it('create sandbox', async () => {
        const resp = await createSandbox(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            {
                host: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                instance: 'default',
                database: 'testdb1'
            },
            {
                host: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                instance: 'default',
                database: 'testdb1'
            },
            'other'
        );
        expect(resp.jobId).toBeDefined();
    });
});
