import {
    calculateCloneDrift,
    managedHostsCloneAssessment,
    runCloneAssessment
} from '../../../../src/operations/continuous-optimization/mssql/clone-assessment-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/aws/cloud-watch-logs-scope';
import { createResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';

const RESOURCE_ID = '6cbdabbfe3fb147e';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
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
            node2InstanceId: 'i-0880a21327284f67c',
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

describe('calculate clone drift', () => {
    const activeNodeInstanceId = 'test-active-node-instance-id';
    it('should run clone assessment', async () => {
        const result = await runCloneAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            activeNodeInstanceId,
            'MSSQLSERVER',
            'f4b7c5d3-e1f6-4g2a-9b5d',
            '6cbdabbfe3fb147e',
            'test-resource',
            { MSSQLSERVER: { fsxId: 'fs-0f53fbecdd3d85fb2', svmUuid: 'svm-0123456789abcdef0' } },
            false
        );
        expect(result.cloneDetails).toBeDefined();
    });

    it('calculate clone assessment drift data', async () => {
        const result = await runCloneAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            activeNodeInstanceId,
            'MSSQLSERVER',
            'f4b7c5d3-e1f6-4g2a-9b5d',
            '6cbdabbfe3fb147e',
            'test-resource',
            { MSSQLSERVER: { fsxId: 'fs-0f53fbecdd3d85fb2', svmUuid: 'svm-0123456789abcdef0' } },
            false
        );
        const cloneAssessmentResponse = await calculateCloneDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            result
        );
        expect(cloneAssessmentResponse).toBeDefined();
    });

    it('perform clone assessment for managed hosts', async () => {
        const response = await managedHostsCloneAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            activeNodeInstanceId,
            'test-resource',
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            'test-job-id'
        );
        expect(response?.cloneDetails).toBeDefined();
    });
});
