import { createResource, listResources, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import {
    calculateComputeDrift,
    managedHostsComputeAssessment
} from '../../../../src/operations/continuous-optimization/compute-assessment-operations';
import { DEMO_AWS_ACCOUNT_ID } from '../../../../src/utils/consts';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { Metadata, ResourceAssessmentData } from '../../../../src/utils/common-types';
import { RESOURCE_DEFAULT_SELECT_FIELDS } from '../../../../src/utils/database-consts';

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
        },
        assessmentData: {
            compute: {
                finding: 'OPTIMIZED',
                findingReasonCodes: [],
                currentInstanceType: 'r7i.xlarge',
                recommendationOptions: []
            }
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
describe('Compute assessment operations', () => {
    it('Should calculate compute drift', async () => {
        const [resource = {}] =
            (await listResources({
                accountId: ACCOUNT_ID,
                resourceId: RESOURCE_ID,
                credentialIds: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                selectKeys: [...RESOURCE_DEFAULT_SELECT_FIELDS, 'assessment_data', 'configurations']
            })) || [];
        const { assessment_data: assessmentData } = resource as {
            metadata?: Metadata;
            assessment_data?: ResourceAssessmentData;
        };
        const response = await calculateComputeDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            assessmentData as ResourceAssessmentData
        );

        expect(response.id).toEqual('compute-rightsizing');
    });

    it('Should perform compute assessment for managed hosts', async () => {
        const { computeAssessment } = await managedHostsComputeAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            DEMO_AWS_ACCOUNT_ID,
            'i-07e76a4b916548dc0',
            'test-resource',
            'test-job-id'
        );
        expect(computeAssessment?.finding).toBeDefined();
    });
});
