import { createResource, upsertDatabaseInstance } from "../../../src/lib/database/db";
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from "../../utils/consts";
import { getAvailableSnapshotPolicyList } from '../../../src/operations/continuous-optimization/resilience-optimize-operations';
import { RESOURCE_ID } from '../../../src/utils/consts';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
            resourceId: RESOURCE_ID,
            resourceName: 'test-resource',
            resourceType: 'MSSQL',
            coRelationId: 'fs-f6082f35c1db',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId: 'i-07e76a4b916548dc0',
                node2InstanceId: 'i-07e76a4b916548dc0',
                sqlDeploymentType: 'FCI'
            }
        });
    
        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId: RESOURCE_ID,
            databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-0f53fbecdd3d85fb2',
            databaseType: '' // Add the missing property 'databaseType'
        });
});
describe('List snapshot policies om svm and cluster level', () => {
    it('Should list snapshot policies on svm and cluster level', async () => {
        const res = await getAvailableSnapshotPolicyList(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        );
        expect(res.snapshotPolicies).toBeDefined();
    });

});
