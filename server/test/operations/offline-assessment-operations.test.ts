import { describe, it, expect } from 'vitest';
import {
    uploadOfflineAssessment,
    downloadOfflineAssessmentScript
} from '../../src/operations/offline-assessment-operations';
import { ACCOUNT_ID } from '../utils/consts';

// Sample valid assessment data
const createValidMssqlAssessmentData = () => ({
    metadata: {
        ec2InstanceId: 'i-test-generic',
        hostname: 'test-host',
        fsxId: 'fs-test',
        assessmentTimestamp: new Date().toISOString(),
        osVersion: 'Windows Server 2019'
    },
    rawdata: {
        hostLevelDetails: {
            rssConfig: {}
        },
        instanceLevelDetails: {
            MSSQLSERVER: {
                instanceDetails: {
                    databaseInstanceId: 'generic-test-instance',
                    deploymentType: 'Standalone',
                    isClustered: false,
                    isHadrEnabled: false,
                    databaseVersion: '15.0.4355.3',
                    databaseEdition: 'Standard',
                    hostname: 'test-host',
                    assessmentTimestamp: new Date().toISOString(),
                    databaseInstanceName: 'MSSQLSERVER'
                },
                assessment: {}
            }
        }
    }
});

describe('Generic Offline Assessment Operations', () => {
    describe('uploadOfflineAssessment', () => {
        it('should route mssql database type to MSSQL handler', async () => {
            const assessmentData = createValidMssqlAssessmentData();
            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test.json',
                'mssql'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });

        it('should handle MS_SQL_SERVER database type (case insensitive)', async () => {
            const assessmentData = createValidMssqlAssessmentData();
            // Modify the ec2InstanceId to avoid duplicate key
            assessmentData.metadata.ec2InstanceId = 'i-test-case-insensitive';
            assessmentData.rawdata.instanceLevelDetails.MSSQLSERVER.instanceDetails.databaseInstanceId =
                'case-test-instance';

            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test.json',
                'MSSQL'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });

        it('should throw error for unsupported database type', async () => {
            const assessmentData = createValidMssqlAssessmentData();

            await expect(
                uploadOfflineAssessment(ACCOUNT_ID, JSON.stringify(assessmentData), 'test.json', 'postgresql')
            ).rejects.toThrow('Offline assessment upload not yet implemented for database type: postgresql');
        });

        it('should pass credentialsId and region to handler', async () => {
            const assessmentData = createValidMssqlAssessmentData();
            assessmentData.metadata.ec2InstanceId = 'i-test-with-params';
            assessmentData.rawdata.instanceLevelDetails.MSSQLSERVER.instanceDetails.databaseInstanceId =
                'params-test-instance';

            const result = await uploadOfflineAssessment(
                ACCOUNT_ID,
                JSON.stringify(assessmentData),
                'test.json',
                'mssql',
                'credentials-123',
                'us-west-2'
            );

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });

        it('should default to mssql when databaseType is not provided', async () => {
            const assessmentData = createValidMssqlAssessmentData();
            assessmentData.metadata.ec2InstanceId = 'i-test-default-type';
            assessmentData.rawdata.instanceLevelDetails.MSSQLSERVER.instanceDetails.databaseInstanceId =
                'default-type-instance';

            const result = await uploadOfflineAssessment(ACCOUNT_ID, JSON.stringify(assessmentData), 'test.json');

            expect(result).toBeDefined();
            expect(result.jobId).toBeDefined();
        });
    });

    describe('downloadOfflineAssessmentScript', () => {
        it('should generate streaming ZIP for mssql database type', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID, 'mssql');

            expect(result).toBeDefined();
            expect(result.archive).toBeDefined();
            expect(result.filename).toBeDefined();
            expect(result.archive).toHaveProperty('readable');
            expect(result.archive).toHaveProperty('pipe');
            expect(result.filename).toContain('.zip');
        });

        it('should default to mssql when databaseType is not provided', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID);

            expect(result).toBeDefined();
            expect(result.archive).toBeDefined();
            expect(result.filename).toBeDefined();
        });

        it('should throw error for unsupported database type', async () => {
            await expect(downloadOfflineAssessmentScript(ACCOUNT_ID, 'unsupported')).rejects.toThrow(
                'Unsupported database type: unsupported'
            );
        });

        it('should throw error for oracle (not yet implemented)', async () => {
            await expect(downloadOfflineAssessmentScript(ACCOUNT_ID, 'oracle')).rejects.toThrow(
                'Script generation not yet implemented for database type: oracle'
            );
        });

        it('should produce valid zip stream data', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID, 'mssql');

            // Collect stream data to verify it produces valid zip content
            const chunks: Buffer[] = [];
            for await (const chunk of result.archive) {
                chunks.push(chunk as Buffer);
            }

            const zipBuffer = Buffer.concat(chunks);

            // Verify zip file signature (PK\x03\x04)
            expect(zipBuffer.length).toBeGreaterThan(0);
            expect(zipBuffer[0]).toBe(0x50); // 'P'
            expect(zipBuffer[1]).toBe(0x4b); // 'K'
            expect(zipBuffer[2]).toBe(0x03);
            expect(zipBuffer[3]).toBe(0x04);
        });
    });
});
