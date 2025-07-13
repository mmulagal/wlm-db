import { createResource, listResources, upsertDatabaseInstance } from '../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/aws/cloud-watch-scope';
import '../../simulator/scopes/aws/compute-optimizer-scope';
import {
    calculateHostOsPatchDrift,
    managedHostOsPatchAssessment
} from '../../../src/operations/continuous-optimization/hostOsPatch-assessment-operations';
import { ResourceAssessmentData } from '../../../src/utils/common-types';

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
describe('Host OS Patch assessment operations', () => {
    it('Should calculate host os patch drift', async () => {
        const [{ assessment_data: assessmentData }] =
            (await listResources(ACCOUNT_ID, RESOURCE_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION)) || [];
        try {
            await calculateHostOsPatchDrift(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                assessmentData as unknown as ResourceAssessmentData
            );
        } catch (error) {
            expect(error).toContain('No HOST_OS_PATCH assessment data found');

            // before throwing the calculateHostOsPatchDrift initiates host os patch assessment in the background
            const response = await calculateHostOsPatchDrift(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                assessmentData as unknown as ResourceAssessmentData
            );

            expect(response.name).toEqual('host-os-patch');
        }
    });

    it('Should perform host os patch assessment for managed hosts clustered', async () => {
        const { hostOsPatchAssessment } =
            (await managedHostOsPatchAssessment(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                'i-07e76a4b916548dc0',
                true,
                'test-resource',
                'test-job-id'
            )) || [];
        expect(hostOsPatchAssessment?.[0]?.baselineId).toBeDefined();
    });

    it('Should perform host os patch assessment for managed hosts standalone', async () => {
        const { hostOsPatchAssessment } =
            (await managedHostOsPatchAssessment(
                ACCOUNT_ID,
                DEFAULT_AWS_CREDENTIALS_ID,
                DEFAULT_AWS_REGION,
                RESOURCE_ID,
                'i-07e76a4b916548dc0',
                false,
                'test-resource',
                'test-job-id'
            )) || [];
        expect(hostOsPatchAssessment?.[0]?.baselineId).toBeDefined();
    });
});
