import { JOBTYPE } from '@prisma/client';
import { createResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/opentelemetry-scope';
import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/aws/ec2-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';
import '../../../simulator/scopes/aws/compute-optimizer-scope';
import { handleComputeRemediation } from '../../../../src/operations/continuous-optimization/compute-optimize-operations';
import { handleOptimizeJobCreation } from '../../../../src/operations/continuous-optimization/assessment-utils';

const RESOURCE_ID = '6cbdabbfe3fb147e';
let optimizeParentId = '';
const databaseInstanceId = 'f4b7c5d3-e1f6-4g2a-9b5d';

beforeAll(async () => {
    const resourceName = 'test-resource';

    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
        resourceName,
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
        databaseInstanceId,
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: ''
    });

    const rootJobId = 'root-job-id';

    optimizeParentId = await handleOptimizeJobCreation(
        ACCOUNT_ID,
        DEFAULT_AWS_CREDENTIALS_ID,
        DEFAULT_AWS_REGION,
        resourceName!,
        JOBTYPE.WELL_ARCHITECTED,
        `Fix EC2 compute for ${resourceName}`,
        `Fix EC2 compute for ${resourceName}`,
        rootJobId
    );
});

describe('Compute remediation operations', () => {
    it('Should handle compute remediation with 2 nodes', async () => {
        const response = await handleComputeRemediation(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ACCOUNT_ID,
            'm5.large',
            [
                {
                    account_id: ACCOUNT_ID,
                    id: RESOURCE_ID,
                    resource_id: RESOURCE_ID,
                    metadata: {
                        node1InstanceId: 'i-07e76a4b916548dc0',
                        // node2InstanceId: 'i-0880a21327284f67c',
                        sqlDeploymentType: 'FCI'
                    },
                    resource_type: 'MSSQL',
                    region: DEFAULT_AWS_REGION,
                    cloud_provider_name: 'AWS',
                    cloud_provider_account_id: 'test-aws-account',
                    credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                    storage_type: 'FSXN',
                    co_relation_id: 'fs-f6082f35c1db',
                    resource_name: 'test-resource',
                    configurations: {},
                    assessment_data: null,
                    assessment_results: null
                }
            ],
            optimizeParentId,
            databaseInstanceId
        );

        expect(response).toBeFalsy();
    });

    it('Should handle compute remediation with 1 node', async () => {
        const response = await handleComputeRemediation(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ACCOUNT_ID,
            'm5.large',
            [
                {
                    account_id: ACCOUNT_ID,
                    id: RESOURCE_ID,
                    resource_id: RESOURCE_ID,
                    metadata: {
                        node1InstanceId: 'i-07e76a4b916548dc0'
                    },
                    resource_type: 'MSSQL',
                    region: DEFAULT_AWS_REGION,
                    cloud_provider_name: 'AWS',
                    cloud_provider_account_id: 'test-aws-account',
                    credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                    storage_type: 'FSXN',
                    co_relation_id: 'fs-f6082f35c1db',
                    resource_name: 'test-resource',
                    configurations: null,
                    assessment_data: null,
                    assessment_results: null
                }
            ],
            optimizeParentId,
            databaseInstanceId
        );

        expect(response).toBeFalsy();
    });
});
