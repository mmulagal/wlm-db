import {
    calculateLogsAnalysisPrice,
    getLogsAnalysisReport,
    handleLogsAnalysis,
    triggerLogsAnalysis
} from '../../src/operations/logs-analyzer/logs-analyzer-operations';

import {
    createResource,
    deleteResource,
    listDatabaseInstances,
    upsertDatabaseInstance
} from '../../src/lib/database/db';
import { ACCOUNT_ID } from '../utils/consts';

import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/ssm-scope';
import '../simulator/scopes/aws/bedrock-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/cloud-watch-logs-scope';
import { sleep } from '../../src/utils/utils';

const TEST_RESOURCE_ID = '36E53042-04E8-40C9-AE69-26E56CB0D216';
const TEST_CREDENTIALS_ID = 'f6082f35-c1db-4619-bb5c-84bcb5bf3286';
const TEST_REGION = 'ap-southeast-1';

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
    });

    afterAll(async () => {
        await deleteResource(ACCOUNT_ID, TEST_RESOURCE_ID);
        await deleteResource(ACCOUNT_ID, 'fs-f6082f35c1db');
    });

    it.skip('should trigger logs analysis and return a jobId', async () => {
        const result = await triggerLogsAnalysis(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        );
        expect(result).toHaveProperty('jobId');
    });

    it('should run logs analysis and return a jobId', async () => {
        const [managedInstance] = await listDatabaseInstances(ACCOUNT_ID, {
            sqlInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d'
        });
        const { jobId } = await triggerLogsAnalysis(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        );
        const result =
            (await handleLogsAnalysis(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, managedInstance, jobId)) || [];
        expect((result?.[0] as any)?.status)?.toBeDefined();
    });

    it('should list logs analysis reports', async () => {
        const { jobId } = await triggerLogsAnalysis(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        );

        await sleep(3000); // Wait for the job to complete

        const reports = await getLogsAnalysisReport(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            TEST_RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d'
        );

        expect(reports).toBeDefined();
        expect(reports).toHaveProperty('remediationRecommendation');
        expect(reports.remediationRecommendation.length).toBeGreaterThan(0);
    });

    it('Should calculate logs analysis cost', async () => {
        const response = await calculateLogsAnalysisPrice(TEST_REGION);
        expect(response).toHaveProperty('costPerError');
    });
});
