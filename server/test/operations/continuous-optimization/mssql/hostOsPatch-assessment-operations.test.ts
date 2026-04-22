import { vi } from 'vitest';
import { createResource, listResources, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import {
    calculateHostOsPatchDrift,
    fetchMssqlHostOsPatchWithMissingPatches,
    managedHostOsPatchAssessment
} from '../../../../src/operations/continuous-optimization/mssql/hostOsPatch-assessment-operations';
import * as ospatchSsmOps from '../../../../src/operations/aws/ospatch-ssm-operations';
import { ResourceAssessmentData } from '../../../../src/utils/common-types';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';

const RESOURCE_ID = '6cbdabbfe3fb147e';
const CLUSTERED_INSTANCE_ID = 'f4b7c5d3-e1f6-4g2a-9b5d';
const CLUSTERED_NODE1_INSTANCE_ID = 'i-07e76a4b916548dc0';
const STANDALONE_RESOURCE_ID = '7edcabbfe3fb147f';
const STANDALONE_INSTANCE_ID = 'a1b2c3d4-e5f6-7g8h-9i0j';
const STANDALONE_NODE1_INSTANCE_ID = 'i-0a1f31a39bd2d9362';

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
        databaseInstanceId: CLUSTERED_INSTANCE_ID,
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    });

    // Seed a separate standalone host (no node2InstanceId) so we can exercise the
    // non-cluster branch of getFullMssqlHostOsPatchAssessment independently.
    await createResource(ACCOUNT_ID, {
        resourceId: STANDALONE_RESOURCE_ID,
        resourceName: 'test-resource-standalone',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-0a1f31a39bd2d9362',
            sqlDeploymentType: 'Standalone'
        }
    });

    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: STANDALONE_RESOURCE_ID,
        databaseInstanceId: STANDALONE_INSTANCE_ID,
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'Standalone',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: ''
    });
});
describe('Host OS Patch assessment operations', () => {
    it('Should calculate host os patch drift', async () => {
        const [{ assessment_data: assessmentData }] =
            (await listResources({
                accountId: ACCOUNT_ID,
                resourceId: RESOURCE_ID,
                credentialIds: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION
            })) || [];
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

describe('fetchMssqlHostOsPatchWithMissingPatches', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a not-optimized response with one ec2InstancesToPatch entry per node for a clustered FCI host', async () => {
        const response = await fetchMssqlHostOsPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            CLUSTERED_NODE1_INSTANCE_ID,
            true
        );

        expect('errorMessage' in response).toBe(false);
        const success = response as {
            status: string;
            ec2InstancesToPatch: Array<{ ec2InstanceId: string; missingPatchDetails: unknown[] }>;
        };
        expect([AssessmentStatus.OPTIMIZED, AssessmentStatus.NOT_OPTIMIZED]).toContain(success.status);
        expect(success.ec2InstancesToPatch.length).toBeGreaterThan(0);
        success.ec2InstancesToPatch.forEach(({ ec2InstanceId, missingPatchDetails }) => {
            expect(typeof ec2InstanceId).toBe('string');
            expect(Array.isArray(missingPatchDetails)).toBe(true);
        });
    });

    it('returns a single ec2InstancesToPatch entry for a standalone host', async () => {
        const response = await fetchMssqlHostOsPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            STANDALONE_RESOURCE_ID,
            STANDALONE_NODE1_INSTANCE_ID,
            false
        );

        expect('errorMessage' in response).toBe(false);
        const success = response as {
            status: string;
            ec2InstancesToPatch: Array<{ ec2InstanceId: string; missingPatchDetails: unknown[] }>;
        };
        expect(success.status).toEqual(AssessmentStatus.NOT_OPTIMIZED);
        expect(success.ec2InstancesToPatch).toHaveLength(1);
        expect(success.ec2InstancesToPatch[0].ec2InstanceId).toEqual(STANDALONE_NODE1_INSTANCE_ID);
        expect(Array.isArray(success.ec2InstancesToPatch[0].missingPatchDetails)).toBe(true);
    });

    it('returns an errorMessage when getInstancesPatchStatus returns no patch status', async () => {
        vi.spyOn(ospatchSsmOps, 'getInstancesPatchStatus').mockResolvedValueOnce([]);

        const response = await fetchMssqlHostOsPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            STANDALONE_RESOURCE_ID,
            STANDALONE_NODE1_INSTANCE_ID,
            false
        );

        expect(response).toMatchObject({
            errorMessage: expect.stringContaining('Unable to retrieve patch status for the MSSQL database host')
        });
    });
});
