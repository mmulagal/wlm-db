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
        it('should generate ZIP for mssql database type', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID, 'mssql');

            expect(result).toBeDefined();
            expect(result.zipBuffer).toBeDefined();
            expect(result.filename).toBeDefined();
            expect(result.zipBuffer).toBeInstanceOf(Buffer);
            expect(result.filename).toContain('.zip');
        });

        it('should default to mssql when databaseType is not provided', async () => {
            const result = await downloadOfflineAssessmentScript(ACCOUNT_ID);

            expect(result).toBeDefined();
            expect(result.zipBuffer).toBeDefined();
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
    });
});
