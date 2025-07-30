import {
    calculateLogsAnalysisPrice,
    getLogsAnalysisReport,
    listLogsAnalysisReportsIdentifiers,
    triggerLogsAnalysis,
    analyzePreRequisites
} from '../../src/operations/logs-analyzer/logs-analyzer-operations';

import { createResource, deleteResource, upsertDatabaseInstance } from '../../src/lib/database/db';
import { ACCOUNT_ID } from '../utils/consts';

import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/bedrock-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/cloud-watch-logs-scope';
import waitForJobCompletion from '../utils/utils';

const TEST_RESOURCE_ID = '36E53042-04E8-40C9-AE69-26E56CB0D216';
const TEST_CREDENTIALS_ID = 'f6082f35-c1db-4619-bb5c-84bcb5bf3286';
const TEST_REGION = 'ap-southeast-1';

let JOB_ID: string | undefined;
describe('Logs Analyzer Operations', () => {
    beforeAll(async () => {
        await createResource(ACCOUNT_ID, {
            resourceId: TEST_RESOURCE_ID,
            resourceName: 'test-resource',
            resourceType: 'MSSQL',
            coRelationId: 'fs-f6082f35c1db',
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: TEST_REGION,
            credentialsId: TEST_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId: 'i-07e76a4b916548dc0',
                node2InstanceId: 'i-0880a21327284f67c',
                sqlDeploymentType: 'FCI'
            }
        });

        await upsertDatabaseInstance(ACCOUNT_ID, {
            credentialsId: TEST_CREDENTIALS_ID,
            region: TEST_REGION,
            resourceId: TEST_RESOURCE_ID,
            databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-0f53fbecdd3d85fb2',
            databaseType: 'MSSQL'
        });

        ({ jobId: JOB_ID } = await triggerLogsAnalysis(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        ));
    });

    afterAll(async () => {
        await deleteResource(ACCOUNT_ID, TEST_RESOURCE_ID);
        await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
    });

    it('should trigger logs analysis and return a jobId', async () => {
        const result = await triggerLogsAnalysis(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        );
        expect(result).toHaveProperty('jobId');
    });

    it('should list logs analysis reports', async () => {
        await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, JOB_ID!);
        const reports = await getLogsAnalysisReport(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            JOB_ID
        );

        expect(reports).toBeDefined();
        expect(reports).toHaveProperty('remediationRecommendation');
        expect(reports.remediationRecommendation.length).toBeGreaterThan(0);
    });

    it('Should calculate logs analysis cost', async () => {
        const response = await calculateLogsAnalysisPrice(TEST_REGION);
        expect(response).toHaveProperty('costPerError');
    });

    it('should list logs analysis report identifiers with pagination', async () => {
        await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, JOB_ID!);
        const result = await listLogsAnalysisReportsIdentifiers(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result.reports)).toBe(true);

        const {
            reports: [firstReport]
        } = result;
        expect(firstReport).toHaveProperty('id');
        expect(firstReport).toHaveProperty('creationTime');
    });

    it('should throw error when no reports exist for given parameters', async () => {
        await expect(
            listLogsAnalysisReportsIdentifiers(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                'non-existent-resource-id',
                'non-existent-database-instance-id'
            )
        ).rejects.toThrow(/No logs analysis reports found/);
    });

    it('Should analyze prerequisites for logs analysis', async () => {
        const response = await analyzePreRequisites(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'mssql'
        );

        expect(response).toBeDefined();
        expect(response).toHaveProperty('bedrockPreRequisites');
        expect(response).toHaveProperty('instanceProfilePreRequisites');
        expect(response).toHaveProperty('credentialsPreRequisites');
        expect(response).toHaveProperty('networkingPreRequisites');
    });

    it('Should handle prerequisites analysis with invalid database instance', async () => {
        await expect(
            analyzePreRequisites(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                'invalid-resource-id',
                'mssql'
            )
        ).rejects.toThrow();
    });
});
