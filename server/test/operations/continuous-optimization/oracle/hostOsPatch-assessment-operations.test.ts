import { vi } from 'vitest';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import {
    calculateHostOsPatchDrift,
    fetchOracleHostOsPatchWithMissingPatches
} from '../../../../src/operations/continuous-optimization/oracle/hostOsPatch-assessment-operations';
import * as ospatchSsmOps from '../../../../src/operations/aws/ospatch-ssm-operations';
import { ResourceAssessmentData } from '../../../../src/utils/common-types';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';

const ORACLE_RESOURCE_ID = 'oracle-hostospatch-resource';
const ORACLE_INSTANCE_ID = 'oradb-hostospatch-1';
const NODE1_INSTANCE_ID = 'i-0a1f31a39bd2d9362';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: ORACLE_RESOURCE_ID,
        resourceName: 'oracle-hostospatch-host',
        resourceType: 'ORACLE',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: NODE1_INSTANCE_ID
        }
    });

    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: ORACLE_RESOURCE_ID,
        databaseInstanceId: ORACLE_INSTANCE_ID,
        databaseInstanceName: ORACLE_INSTANCE_ID,
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'Standalone',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: 'Oracle'
    });
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, ORACLE_RESOURCE_ID);
});

describe('calculateHostOsPatchDrift (oracle)', () => {
    it('returns an errorMessage when no hostOsPatch assessment data is present', () => {
        const result = calculateHostOsPatchDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ORACLE_RESOURCE_ID,
            {} as unknown as ResourceAssessmentData
        );

        expect('errorMessage' in result).toBe(true);
        if ('errorMessage' in result) {
            expect(result.errorMessage).toContain('host-os-patch');
        }
    });

    it('returns an optimized drift response when no hosts have missing patches', () => {
        const assessmentData = {
            hostOsPatch: [
                {
                    baselineId: 'pb-optimized',
                    criticalNonCompliantCount: 0,
                    otherNonCompliantCount: 0,
                    ec2InstanceId: NODE1_INSTANCE_ID,
                    ec2InstanceName: 'oracle-host',
                    operationStartTime: Date.now(),
                    operationEndTime: Date.now(),
                    securityNonCompliantCount: 0
                }
            ]
        } as unknown as ResourceAssessmentData;

        const result = calculateHostOsPatchDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ORACLE_RESOURCE_ID,
            assessmentData
        );

        expect('errorMessage' in result).toBe(false);
        if (!('errorMessage' in result)) {
            expect(result.status).toEqual(AssessmentStatus.OPTIMIZED);
            expect(result.ec2InstancesToPatch).toEqual([]);
        }
    });
});

describe('fetchOracleHostOsPatchWithMissingPatches', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a not-optimized response with ec2InstancesToPatch for a standalone Oracle host', async () => {
        const response = await fetchOracleHostOsPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ORACLE_RESOURCE_ID,
            NODE1_INSTANCE_ID
        );

        expect('errorMessage' in response).toBe(false);
        const success = response as {
            status: string;
            ec2InstancesToPatch: Array<{ ec2InstanceId: string; missingPatchDetails: unknown[] }>;
        };
        // The simulator always reports SecurityNonCompliantCount: 1 so this host is
        // expected to surface as NOT_OPTIMIZED.
        expect(success.status).toEqual(AssessmentStatus.NOT_OPTIMIZED);
        expect(success.ec2InstancesToPatch).toHaveLength(1);
        expect(success.ec2InstancesToPatch[0].ec2InstanceId).toEqual(NODE1_INSTANCE_ID);
        expect(Array.isArray(success.ec2InstancesToPatch[0].missingPatchDetails)).toBe(true);
    });

    it('returns an errorMessage when getInstancesPatchStatus returns an empty list', async () => {
        vi.spyOn(ospatchSsmOps, 'getInstancesPatchStatus').mockResolvedValueOnce([]);

        const response = await fetchOracleHostOsPatchWithMissingPatches(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ORACLE_RESOURCE_ID,
            NODE1_INSTANCE_ID
        );

        expect(response).toMatchObject({
            errorMessage: expect.stringContaining('Unable to retrieve patch status for the Oracle database host')
        });
    });
});
