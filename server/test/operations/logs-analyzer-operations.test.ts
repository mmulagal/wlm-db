import {
    calculateLogsAnalysisPrice,
    getLogsAnalysisReport,
    listLogsAnalysisReportsIdentifiers,
    triggerLogsAnalysis,
    analyzePreRequisites,
    getLatestLogsAnalysisReports
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
            'f4b7c5d3-e1f6-4g2a-9b5d',
            {}
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
            'f4b7c5d3-e1f6-4g2a-9b5d',
            {}
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
            'mssql',
            undefined,
            TEST_RESOURCE_ID
        );

        expect(response.items[0]).toBeDefined();
        expect(response.items[0]).toHaveProperty('bedrockPreRequisites');
        expect(response.items[0]).toHaveProperty('instanceProfilePreRequisites');
        expect(response.items[0]).toHaveProperty('credentialsPreRequisites');
        expect(response.items[0]).toHaveProperty('networkingPreRequisites');
    });

    it('Should handle prerequisites analysis with invalid database instance', async () => {
        const response = await analyzePreRequisites(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            'mssql',
            undefined,
            'invalid-resource-id'
        );
        expect(response.items[0]).toBeDefined();
        expect(response.items[0]).toHaveProperty('errorMessage');
    });

    it('Should get latest logs analysis reports at account level', async () => {
        await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, JOB_ID!);

        const response = await getLatestLogsAnalysisReports(ACCOUNT_ID, TEST_REGION, TEST_CREDENTIALS_ID, 'mssql');

        expect(response).toBeDefined();
        expect(response).toHaveProperty('items');
        expect(Array.isArray(response.items)).toBe(true);

        if (response.items.length > 0) {
            const report = response.items[0];
            expect(report).toHaveProperty('id');
            expect(report).toHaveProperty('databaseHostId');
            expect(report).toHaveProperty('databaseInstanceId');
            expect(report.latestReport).toHaveProperty('creationTime');
            expect(report.latestReport).toHaveProperty('errorCount');
            expect(report.latestReport).toHaveProperty('jobId');
            expect(typeof report.latestReport.creationTime).toBe('number');
            expect(typeof report.latestReport.errorCount).toBe('number');
        }
    });

    it('Should return empty items array when no reports exist for account', async () => {
        const nonExistentAccountId = 'non-existent-account-123';

        const response = await getLatestLogsAnalysisReports(nonExistentAccountId);

        expect(response).toBeDefined();
        expect(response).toHaveProperty('items');
        expect(Array.isArray(response.items)).toBe(true);
        expect(response.items).toHaveLength(0);
    });

    it('Should handle optional parameters for getLatestLogsAnalysisReports', async () => {
        const response = await getLatestLogsAnalysisReports(ACCOUNT_ID);

        expect(response).toBeDefined();
        expect(response).toHaveProperty('items');
        expect(Array.isArray(response.items)).toBe(true);
    });

    it('Should filter reports to only include latest per database instance', async () => {
        await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, JOB_ID!);

        const { jobId: secondJobId } = await triggerLogsAnalysis(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            {}
        );

        await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, secondJobId);

        const response = await getLatestLogsAnalysisReports(ACCOUNT_ID, TEST_REGION, TEST_CREDENTIALS_ID, 'mssql');

        expect(response).toBeDefined();
        expect(response.items).toBeDefined();

        const instanceIds = response.items.map(item => item.databaseInstanceId);
        const uniqueInstanceIds = [...new Set(instanceIds)];
        expect(instanceIds).toHaveLength(uniqueInstanceIds.length);

        response.items.forEach(item => {
            expect(item).toHaveProperty('id');
            expect(item).toHaveProperty('databaseInstanceId');
            expect(item.databaseInstanceId).toBe('f4b7c5d3-e1f6-4g2a-9b5d');
            expect(item).toHaveProperty('databaseHostId');
            expect(item.databaseHostId).toBe(TEST_RESOURCE_ID);
            expect(typeof item.latestReport.errorCount).toBe('number');
            expect(item.latestReport.errorCount).toBeGreaterThanOrEqual(0);
            if (item.latestReport.errorCount > 0) {
                expect(item.latestReport).toHaveProperty('severityCounts');
            }
        });
    });
});
