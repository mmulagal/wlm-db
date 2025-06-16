import { faker } from '@faker-js/faker';
import {
    getAllClusterNodeDetails,
    getDatabaseHostSummaryV2,
    isInstanceAppConsistentBackupEnabled
} from '../../src/operations/database-hosts-operations';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/aws/fsx-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/cloud-watch-scope';
import '../simulator/scopes/aws/pricing-scope';
import { ACCOUNT_ID, SECRETS } from '../../src/utils/consts';
import { createResource, deleteResource } from '../../src/lib/database/db';
import { CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';

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
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI'
        }
    });
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
});

describe('Database host operations', () => {
    // it('Get databases in a server', async () => {
    //     const resp = await getDatabases(ACCOUNT_ID, '36E53042-04E8-40C9-AE69-26E56CB0D216');
    //     expect(resp).toBeDefined();
    // });
    it('Get databases host summary', async () => {
        const resp = await getDatabaseHostSummaryV2(
            ACCOUNT_ID,
            '36E53042-04E8-40C9-AE69-26E56CB0D216',
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            'serverDetails,performance,usageEstimation,storage,protection',
            {
                id: null,
                account_id: ACCOUNT_ID,
                resource_id: '36E53042-04E8-40C9-AE69-26E56CB0D216',
                resource_name: 'test-resource',
                resource_type: 'MSSQL',
                co_relation_id: 'fs-f6082f35c1db',
                cloud_provider_account_id: 'test-aws-account',
                cloud_provider_name: 'AWS',
                region: 'ap-southeast-1',
                credentials_id: 'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
                storage_type: 'FSXN',
                metadata: {
                    node1InstanceId: 'i-123456678',
                    node2InstanceId: undefined
                }
            },
            undefined,
            false
        );
        expect(resp).toBeDefined();
    });

    it('Get all cluster node details', async () => {
        const [response] = await getAllClusterNodeDetails(
            ACCOUNT_ID,
            'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
            'ap-southeast-1',
            '36E53042-04E8-40C9-AE69-26E56CB0D216'
        );
        expect(response.ec2InstanceId).toBeDefined();
    });
});

describe('Protection', () => {
    const volumeDBMap: Array<{ ontapVolumeuuid: string; databaseName: string }> = [
        { ontapVolumeuuid: 'ad251a8f-da34-11ef-b315-11b9ce95d982', databaseName: 'salesdb' },
        { ontapVolumeuuid: '74a8a789-c5dd-11ef-b315-11b9ce95d982', databaseName: 'inventory' },
        { ontapVolumeuuid: '438cc269-edeb-11ef-994b-3b81e03bea3e', databaseName: 'analytics' }
    ];
    const volUuids = [
        'ad251a8f-da34-11ef-b315-11b9ce95d982',
        '74a8a789-c5dd-11ef-b315-11b9ce95d982',
        '438cc269-edeb-11ef-994b-3b81e03bea3e'
    ];
    it('should test app consistent backup', async () => {
        const res = await isInstanceAppConsistentBackupEnabled(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'fs-4242424242',
            volUuids,
            volumeDBMap,
            'i-4242424242'
        );
        expect(res).toBeDefined();
        expect(Object.values(res).every(Boolean)).toBe(true);
    });
});
