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

    it('Should analyze prerequisites for Oracle logs analysis', async () => {
        const response = await analyzePreRequisites(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            'oracle',
            undefined,
            TEST_RESOURCE_ID
        );

        expect(response.items[0]).toBeDefined();
        expect(response.items[0]).toHaveProperty('bedrockPreRequisites');
        expect(response.items[0]).toHaveProperty('instanceProfilePreRequisites');
        expect(response.items[0]).toHaveProperty('credentialsPreRequisites');
        expect(response.items[0]).toHaveProperty('networkingPreRequisites');
    });

    it('Should handle Oracle prerequisites analysis with invalid database instance', async () => {
        const response = await analyzePreRequisites(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            'oracle',
            undefined,
            'invalid-resource-id'
        );
        expect(response.items[0]).toBeDefined();
        expect(response.items[0]).toHaveProperty('errorMessage');
    });

    it('Should analyze Oracle prerequisites with ec2InstanceId parameter', async () => {
        const response = await analyzePreRequisites(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            'oracle',
            'i-07e76a4b916548dc0',
            undefined
        );

        expect(response).toBeDefined();
        expect(response).toHaveProperty('items');
        expect(Array.isArray(response.items)).toBe(true);
        expect(response.items.length).toBeGreaterThan(0);
        expect(response.items[0]).toHaveProperty('bedrockPreRequisites');
        expect(response.items[0]).toHaveProperty('instanceProfilePreRequisites');
        expect(response.items[0]).toHaveProperty('credentialsPreRequisites');
        expect(response.items[0]).toHaveProperty('networkingPreRequisites');
    });

    it('Should handle multiple ec2InstanceIds for Oracle prerequisites', async () => {
        const response = await analyzePreRequisites(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            'oracle',
            'i-07e76a4b916548dc0,i-0880a21327284f67c',
            undefined
        );

        expect(response).toBeDefined();
        expect(response).toHaveProperty('items');
        expect(Array.isArray(response.items)).toBe(true);
        expect(response.items.length).toBe(2);
    });

    it('Should handle multiple databaseHostIds for Oracle prerequisites', async () => {
        const response = await analyzePreRequisites(
            ACCOUNT_ID,
            TEST_CREDENTIALS_ID,
            TEST_REGION,
            'oracle',
            undefined,
            `${TEST_RESOURCE_ID},another-resource-id`
        );

        expect(response).toBeDefined();
        expect(response).toHaveProperty('items');
        expect(Array.isArray(response.items)).toBe(true);
        expect(response.items.length).toBe(2);
    });

    it('Should throw error when both ec2InstanceId and databaseHostId are provided for Oracle', async () => {
        await expect(
            analyzePreRequisites(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                'oracle',
                'i-07e76a4b916548dc0',
                TEST_RESOURCE_ID
            )
        ).rejects.toThrow();
    });

    it('Should throw error when neither ec2InstanceId nor databaseHostId is provided for Oracle', async () => {
        await expect(
            analyzePreRequisites(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, 'oracle', undefined, undefined)
        ).rejects.toThrow();
    });

    it('Should validate max instances limit for Oracle ec2InstanceIds', async () => {
        const tooManyInstances = Array(6)
            .fill('i-')
            .map((prefix, i) => `${prefix}${i}`)
            .join(',');

        await expect(
            analyzePreRequisites(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, 'oracle', tooManyInstances, undefined)
        ).rejects.toThrow();
    });

    it('Should validate max instances limit for Oracle databaseHostIds', async () => {
        const tooManyHosts = Array(6)
            .fill('host-')
            .map((prefix, i) => `${prefix}${i}`)
            .join(',');

        await expect(
            analyzePreRequisites(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, 'oracle', undefined, tooManyHosts)
        ).rejects.toThrow();
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

    describe('Timestamp related tests', () => {
        it('should throw error when logsAnalyzerFromTimestamp is in the future', async () => {
            const futureTimestamp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours in the future

            await expect(
                triggerLogsAnalysis(
                    ACCOUNT_ID,
                    TEST_CREDENTIALS_ID,
                    TEST_REGION,
                    TEST_RESOURCE_ID,
                    'f4b7c5d3-e1f6-4g2a-9b5d',
                    { logsAnalyzerFromTimestamp: futureTimestamp }
                )
            ).rejects.toThrow();
        });

        it('should accept valid past timestamp for logsAnalyzerFromTimestamp and use it as startTime', async () => {
            const pastTimestamp = Date.now() - 12 * 60 * 60 * 1000; // 12 hours ago

            const result = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                {
                    logsAnalyzerFromTimestamp: pastTimestamp,
                    logsWindowDuration: 6
                }
            );

            expect(result).toHaveProperty('jobId');

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, result.jobId);

            const response = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                result.jobId
            );

            expect(response.items.length).toBeGreaterThan(0);
            const report = response.items.find(item => item.latestReport.jobId === result.jobId);
            expect(report).toBeDefined();
            expect(report?.latestReport.startTime).toBeDefined();
            // startTime should be close to the provided pastTimestamp (within a small margin)
            if (report?.latestReport.startTime) {
                expect(report.latestReport.startTime).toBeGreaterThanOrEqual(pastTimestamp - 1000);
                expect(report.latestReport.startTime).toBeLessThanOrEqual(Date.now());
            }
        });

        it('should use default 24h lookback when logsAnalyzerFromTimestamp is not provided', async () => {
            const triggerTime = Date.now();

            const result = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                {}
            );

            expect(result).toHaveProperty('jobId');

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, result.jobId);

            const response = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                result.jobId
            );

            expect(response.items.length).toBeGreaterThan(0);
            const report = response.items.find(item => item.latestReport.jobId === result.jobId);
            expect(report).toBeDefined();

            if (report?.latestReport.startTime && report?.latestReport.endTime) {
                // Default lookback is 24 hours, so startTime should be around triggerTime - 24h
                const expectedStartTime = triggerTime - 24 * 60 * 60 * 1000;
                expect(report.latestReport.startTime).toBeGreaterThanOrEqual(expectedStartTime - 60000);
                expect(report.latestReport.startTime).toBeLessThanOrEqual(triggerTime);
                // endTime should not exceed current time
                expect(report.latestReport.endTime).toBeLessThanOrEqual(Date.now() + 60000);
            }
        });

        it('should include startTime and endTime in latest logs analysis reports', async () => {
            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, JOB_ID!);

            const response = await getLatestLogsAnalysisReports(ACCOUNT_ID, TEST_REGION, TEST_CREDENTIALS_ID, 'mssql');

            expect(response).toBeDefined();
            expect(response.items.length).toBeGreaterThan(0);

            response.items.forEach(item => {
                expect(item.latestReport).toHaveProperty('startTime');
                expect(item.latestReport).toHaveProperty('endTime');
                if (item.latestReport.startTime !== undefined) {
                    expect(typeof item.latestReport.startTime).toBe('number');
                }
                if (item.latestReport.endTime !== undefined) {
                    expect(typeof item.latestReport.endTime).toBe('number');
                }
            });
        });

        it('should have startTime less than or equal to endTime in reports', async () => {
            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, JOB_ID!);

            const response = await getLatestLogsAnalysisReports(ACCOUNT_ID, TEST_REGION, TEST_CREDENTIALS_ID, 'mssql');

            expect(response).toBeDefined();
            expect(response.items.length).toBeGreaterThan(0);

            response.items.forEach(item => {
                if (item.latestReport.startTime !== undefined && item.latestReport.endTime !== undefined) {
                    expect(item.latestReport.startTime).toBeLessThanOrEqual(item.latestReport.endTime);
                }
            });
        });

        it('should include start_time and end_time in report identifiers list', async () => {
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
            expect(result.reports.length).toBeGreaterThan(0);

            const firstReport = result.reports[0];
            expect(firstReport).toHaveProperty('startTime');
            expect(firstReport).toHaveProperty('endTime');
        });

        it('should handle logsWindowDuration parameter correctly', async () => {
            const logsWindowDuration = 10; // 10 hours
            const pastTimestamp = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

            const result = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                { logsAnalyzerFromTimestamp: pastTimestamp, logsWindowDuration }
            );

            expect(result).toHaveProperty('jobId');

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, result.jobId);

            const response = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                result.jobId
            );

            expect(response).toBeDefined();
            expect(response.items.length).toBeGreaterThan(0);

            const report = response.items.find(item => item.latestReport.jobId === result.jobId);
            expect(report).toBeDefined();

            if (report && report.latestReport.startTime && report.latestReport.endTime) {
                const durationInHours =
                    (report.latestReport.endTime - report.latestReport.startTime) / (60 * 60 * 1000);
                // Duration should be exactly logsWindowDuration hours (with tolerance for processing)
                expect(durationInHours).toBeLessThanOrEqual(logsWindowDuration + 0.1);
                expect(durationInHours).toBeGreaterThan(0);

                // Verify endTime = startTime + logsWindowDuration
                const expectedEndTime = report.latestReport.startTime + logsWindowDuration * 60 * 60 * 1000;
                expect(report.latestReport.endTime).toBeLessThanOrEqual(expectedEndTime + 60000); // 1 min tolerance
            }
        });

        it('should use last analysis end time as start time for subsequent analysis', async () => {
            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, JOB_ID!);

            const firstResponse = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql'
            );
            const firstReportEndTime = firstResponse.items[0]?.latestReport?.endTime;

            const { jobId: secondJobId } = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                {}
            );

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, secondJobId);

            const secondResponse = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                secondJobId
            );
            const secondReportStartTime = secondResponse.items[0]?.latestReport?.startTime;

            if (firstReportEndTime !== undefined && secondReportStartTime !== undefined) {
                expect(secondReportStartTime).toBeGreaterThanOrEqual(firstReportEndTime);
            }
        });

        it('should handle timestamp value of 1 to use last analysis end time', async () => {
            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, JOB_ID!);

            // Get the previous report's end time
            const previousResponse = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql'
            );
            const previousEndTime = previousResponse.items[0]?.latestReport?.endTime;

            const result = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                { logsAnalyzerFromTimestamp: 1 }
            );

            expect(result).toHaveProperty('jobId');

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, result.jobId);

            const response = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                result.jobId
            );

            expect(response.items.length).toBeGreaterThan(0);
            const report = response.items.find(item => item.latestReport.jobId === result.jobId);
            expect(report).toBeDefined();

            // When timestamp is 1, startTime should be >= previous end time (if exists)
            if (previousEndTime !== undefined && report?.latestReport.startTime) {
                expect(report.latestReport.startTime).toBeGreaterThanOrEqual(previousEndTime);
            }
        });

        it('should cap endTime at current timestamp', async () => {
            const logsWindowDuration = 48; // 48 hours - longer than time since startTime
            const pastTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

            const result = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                { logsAnalyzerFromTimestamp: pastTimestamp, logsWindowDuration }
            );

            expect(result).toHaveProperty('jobId');

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, result.jobId);

            const response = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                result.jobId
            );

            expect(response.items.length).toBeGreaterThan(0);
            const report = response.items.find(item => item.latestReport.jobId === result.jobId);
            expect(report).toBeDefined();

            // endTime should be capped at current time, not startTime + 48 hours
            if (report?.latestReport.endTime && report?.latestReport.startTime) {
                // endTime should not exceed current time (with small buffer for execution time)
                expect(report.latestReport.endTime).toBeLessThanOrEqual(Date.now() + 60000);
                // endTime should be close to triggerTime, not pastTimestamp + 48 hours
                const expectedUncappedEnd = pastTimestamp + logsWindowDuration * 60 * 60 * 1000;
                expect(report.latestReport.endTime).toBeLessThan(expectedUncappedEnd);
            }
        });

        it('should accept current timestamp as valid logsAnalyzerFromTimestamp', async () => {
            const currentTimestamp = Date.now();

            const result = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                { logsAnalyzerFromTimestamp: currentTimestamp }
            );

            expect(result).toHaveProperty('jobId');

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, result.jobId);

            const response = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                result.jobId
            );

            expect(response.items.length).toBeGreaterThan(0);
            const report = response.items.find(item => item.latestReport.jobId === result.jobId);
            expect(report).toBeDefined();

            if (report?.latestReport.startTime && report?.latestReport.endTime) {
                // startTime should be close to currentTimestamp
                expect(report.latestReport.startTime).toBeGreaterThanOrEqual(currentTimestamp - 1000);
                // endTime should be close to startTime (since we started from current time)
                expect(report.latestReport.endTime).toBeGreaterThanOrEqual(report.latestReport.startTime);
                expect(report.latestReport.endTime).toBeLessThanOrEqual(Date.now() + 60000);
            }
        });

        it('should calculate analysisEndTimeFinal correctly with logsWindowDuration', async () => {
            const logsWindowDuration = 6; // 6 hours
            const pastTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

            const result = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                { logsAnalyzerFromTimestamp: pastTimestamp, logsWindowDuration }
            );

            expect(result).toHaveProperty('jobId');

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, result.jobId);

            const response = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                result.jobId
            );

            expect(response.items.length).toBeGreaterThan(0);
            const report = response.items.find(item => item.latestReport.jobId === result.jobId);
            expect(report).toBeDefined();
            if (report?.latestReport.endTime) {
                expect(report.latestReport.endTime).toBeLessThanOrEqual(Date.now());
            }
        });

        it('should store analysisStartTime and analysisEndTime from response when available', async () => {
            const result = await triggerLogsAnalysis(
                ACCOUNT_ID,
                TEST_CREDENTIALS_ID,
                TEST_REGION,
                TEST_RESOURCE_ID,
                'f4b7c5d3-e1f6-4g2a-9b5d',
                {}
            );

            await waitForJobCompletion(ACCOUNT_ID, TEST_CREDENTIALS_ID, TEST_REGION, result.jobId);

            const response = await getLatestLogsAnalysisReports(
                ACCOUNT_ID,
                TEST_REGION,
                TEST_CREDENTIALS_ID,
                'mssql',
                result.jobId
            );

            expect(response.items.length).toBeGreaterThan(0);
            const report = response.items.find(item => item.latestReport.jobId === result.jobId);
            expect(report).toBeDefined();
            expect(report?.latestReport).toHaveProperty('startTime');
            expect(report?.latestReport).toHaveProperty('endTime');
        });
    });
});
