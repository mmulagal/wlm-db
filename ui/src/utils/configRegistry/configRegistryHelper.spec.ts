import { describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({
    t: (key: string) => key
}));

vi.mock('../resourceUtils', () => ({
    normalizeResourceTypeCasing: (value: string) => value
}));

import { ASSESSMENT_CONFIG_IDS, DBType } from '../consts';
import { getButtonText } from './configRegistryHelper';

describe('getButtonText', () => {
    it('returns view-and-fix for MSSQL snapcenter-snapshot despite viewOnly registry', () => {
        expect(getButtonText(ASSESSMENT_CONFIG_IDS.SNAPCENTER_SNAPSHOT, DBType.MSSQL)).toBe(
            'databases.general.view-and-fix'
        );
    });

    it('returns view for Oracle snapcenter-snapshot (view-only)', () => {
        expect(getButtonText(ASSESSMENT_CONFIG_IDS.SNAPCENTER_SNAPSHOT, DBType.ORACLE)).toBe(
            'databases.general.view'
        );
    });
});
