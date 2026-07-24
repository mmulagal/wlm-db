import { describe, it, expect } from 'vitest';
import { formatOfflineDataToAssessmentFormat } from './DatabaseHomeUtils';
import { DBType } from '../../utils/consts';

describe('formatOfflineDataToAssessmentFormat', () => {
    const baseItem = {
        resourceId: 'i-case2-full-fsxn-linked',
        credentialId: 'cred-1',
        regionId: 'ap-southeast-1',
        databaseInstanceId: 'inst-1',
        databaseInstanceName: 'CASE2SQL',
        assessments: { metadata: { databaseHostName: 'case2-host' } }
    };

    it('marks WAD hosts as isWad and not isUnregistered', () => {
        const [host] = formatOfflineDataToAssessmentFormat([{ ...baseItem, isUnregistered: false }], DBType.MSSQL);

        expect(host.isWad).toBe(true);
        expect(host.isUnregistered).toBe(false);
    });

    it('marks unregistered on-demand hosts as isUnregistered and not isWad', () => {
        const [host] = formatOfflineDataToAssessmentFormat([{ ...baseItem, isUnregistered: true }], DBType.MSSQL);

        expect(host.isWad).toBe(false);
        expect(host.isUnregistered).toBe(true);
    });
});
