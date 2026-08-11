import { describe, it, expect } from 'vitest';

import { mergeUnregisteredFlatAssessmentData } from './DatabaseHomeUtils';

describe('mergeUnregisteredFlatAssessmentData', () => {
    const localAssessment = {
        vmInstanceId: 'i-ec2',
        databaseInstanceName: 'DOMAINLOGIN1',
        credentialId: 'cred-a',
        assessments: { metadata: { lastAssessmentTimestamp: 2000, source: 'unregistered' } },
        isUnregistered: true
    };

    it('keeps locally synced assessments when bulk API refresh returns empty', () => {
        expect(mergeUnregisteredFlatAssessmentData([localAssessment], [])).toEqual([localAssessment]);
    });

    it('prefers newer assessment timestamp for the same ec2 + instance', () => {
        const apiAssessment = {
            resourceId: 'i-ec2',
            databaseInstanceName: 'domainlogin1',
            assessments: { metadata: { lastAssessmentTimestamp: 1000, source: 'unregistered' } }
        };
        expect(mergeUnregisteredFlatAssessmentData([localAssessment], [apiAssessment])).toEqual([localAssessment]);
    });

    it('accepts API assessment when it is newer than the local copy', () => {
        const apiAssessment = {
            resourceId: 'i-ec2',
            databaseInstanceName: 'DOMAINLOGIN1',
            assessments: { metadata: { lastAssessmentTimestamp: 3000, source: 'unregistered' } }
        };
        expect(mergeUnregisteredFlatAssessmentData([localAssessment], [apiAssessment])).toEqual([apiAssessment]);
    });
});
