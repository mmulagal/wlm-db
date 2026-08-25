import { describe, expect, it } from 'vitest';

import { mergeAwsBackupAssessments } from '../../../src/operations/continuous-optimization/resilience-awsBackup-operations';

describe('mergeAwsBackupAssessments', () => {
    it('should aggregate volume results across filesystems and combine collection errors', () => {
        const result = mergeAwsBackupAssessments([
            {
                fileSystemId: 'fs-1',
                isAWSBackupEnabled: true,
                volumeBackupDetails: [{ uuid: 'vol-1', name: 'data-1', isAWSBackupEnabled: true }]
            },
            {
                fileSystemId: 'fs-2',
                isAWSBackupEnabled: false,
                volumeBackupDetails: [{ uuid: 'vol-2', name: 'data-2', isAWSBackupEnabled: false }]
            }
        ]);

        expect(result).toEqual({
            fileSystemId: 'fs-1,fs-2',
            isAWSBackupEnabled: false,
            volumeBackupDetails: [
                { uuid: 'vol-1', name: 'data-1', isAWSBackupEnabled: true },
                { uuid: 'vol-2', name: 'data-2', isAWSBackupEnabled: false }
            ]
        });

        expect(
            mergeAwsBackupAssessments([
                {
                    fileSystemId: 'fs-1',
                    isAWSBackupEnabled: false,
                    errorMessage: 'first failure',
                    volumeBackupDetails: []
                },
                {
                    fileSystemId: 'fs-2',
                    isAWSBackupEnabled: false,
                    errorMessage: 'second failure',
                    volumeBackupDetails: []
                }
            ])
        ).toEqual({
            fileSystemId: 'fs-1,fs-2',
            isAWSBackupEnabled: false,
            errorMessage: 'first failure; second failure',
            volumeBackupDetails: []
        });
    });
});
