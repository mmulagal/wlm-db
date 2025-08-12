import { DATABASE_TYPE, JOBSTATUS, JOBTYPE, STORAGE_TYPE } from '@prisma/client';
import {
    countLogsAnalysisReports,
    createLogsAnalysisReports,
    listLogsAnalysisReports,
    removeLogsAnalysisReports
} from '../../../src/lib/database/logs-analysis-reports';
import { ACCOUNT_ID, MSSQL } from '../../../src/utils/consts';
import { prisma } from '../../../src/utils/prisma-utils';
import logsAnalysisData from '../../simulator/responses/logs-analysis/logs-analysis.json';
import { createResource, upsertDatabaseInstance } from '../../../src/lib/database/db';
import { DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { createJob } from '../../../src/lib/database/job';

describe('logs_analysis_reports database operations', () => {
    const accountId = ACCOUNT_ID;
    const resourceId = 'test-resource-id';
    const databaseInstanceId = 'test-db-instance-id';

    const version = '1.0.0';

    let jobId: string;
    beforeAll(async () => {
        // Create the parent resource to satisfy foreign key constraints for logs_analysis_reports
        await createResource(accountId, {
            resourceId,
            resourceName: 'resourcewithDBInstance',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            coRelationId: 'fsx-1234',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN,
            region: DEFAULT_AWS_REGION
        });
        const DATABASE_INSTANCE_RECORD = {
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            resourceId,
            databaseInstanceId,
            databaseInstanceName: 'MSSQLSERVER',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'FCI',
            fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
            fsxnIds: 'fs-0f53fbecdd3d85fb2',
            databaseType: '' // Add the missing property 'databaseType'
        };

        // // Insert a new record
        await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);

        ({ id: jobId } = await createJob(ACCOUNT_ID, {
            account_id: ACCOUNT_ID,
            credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            name: 'test-job-1',
            description: 'test-job-description',
            resource_name: 'test-resource',
            initiator: 'test-user',
            start_time: new Date(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.DEPLOYMENT
        }));
    });

    afterAll(async () => {
        await prisma.client.logs_analysis_reports.deleteMany({
            where: { account_id: accountId }
        });
        await prisma.client.resource.deleteMany({
            where: { account_id: accountId, resource_id: resourceId }
        });
    });

    it('should create logs analysis reports', async () => {
        const records = [
            {
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                resource_id: resourceId,
                database_instance_id: databaseInstanceId,
                job_id: jobId,
                account_id: accountId,
                database_type: MSSQL as DATABASE_TYPE,
                logs_analysis_data: logsAnalysisData,
                version,
                creation_time: new Date()
            }
        ];
        const { count } = await createLogsAnalysisReports(records);
        expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should list logs analysis reports', async () => {
        const response = await listLogsAnalysisReports({
            accountId,
            databaseHostId: resourceId,
            databaseInstanceId,
            jobId
        });
        expect(response.length).toBeGreaterThanOrEqual(0);
    });

    it('Should count logs analysis reports', async () => {
        const response = await countLogsAnalysisReports(accountId, DEFAULT_AWS_CREDENTIALS_ID);
        expect(response).toBeGreaterThanOrEqual(0);
    });

    it('should remove logs analysis reports', async () => {
        const [response] = await listLogsAnalysisReports({
            accountId,
            databaseHostId: resourceId,
            databaseInstanceId,
            jobId
        });
        const deleteResponse = await removeLogsAnalysisReports([response.id]);
        expect(deleteResponse.count).toBeGreaterThanOrEqual(0);
    });

    it('should remove multiple logs analysis reports', async () => {
        await createLogsAnalysisReports([
            {
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                resource_id: resourceId,
                database_instance_id: databaseInstanceId,
                job_id: jobId,
                account_id: accountId,
                database_type: MSSQL as DATABASE_TYPE,
                logs_analysis_data: logsAnalysisData,
                version
            }
        ]);
        const response = await listLogsAnalysisReports({
            accountId,
            databaseHostId: resourceId,
            databaseInstanceId,
            jobId
        });
        const idList = response.map(r => r.id);
        const deleteResponse = await removeLogsAnalysisReports(idList);
        expect(deleteResponse.count).toBeGreaterThanOrEqual(0);
    });
});
