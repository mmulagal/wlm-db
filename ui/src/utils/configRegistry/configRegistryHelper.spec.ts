import { describe, expect, it, vi } from 'vitest';

import { ASSESSMENT_CONFIG_IDS, DBType } from '../consts';
import { getButtonText, getColumnConfig } from './configRegistryHelper';

vi.mock('i18next', () => ({
    t: (key: string) => key
}));

vi.mock('../resourceUtils', () => ({
    normalizeResourceTypeCasing: (value: string) => value
}));

describe('getButtonText', () => {
    it('returns view-and-fix for MSSQL snapcenter-snapshot despite viewOnly registry', () => {
        expect(getButtonText(ASSESSMENT_CONFIG_IDS.SNAPCENTER_SNAPSHOT, DBType.MSSQL)).toBe(
            'databases.general.view-and-fix'
        );
    });

    it('returns view-and-fix for Oracle snapcenter-snapshot (view-only)', () => {
        expect(getButtonText(ASSESSMENT_CONFIG_IDS.SNAPCENTER_SNAPSHOT, DBType.ORACLE)).toBe(
            'databases.general.view-and-fix'
        );
    });
});

describe('getColumnConfig', () => {
    // ── objectNameSource ──────────────────────────────────────────────────────

    it('returns objectNameSource: objectsInViolation for cluster-quorum (MSSQL)', () => {
        const config = getColumnConfig('cluster-quorum', DBType.MSSQL);
        expect(config?.objectNameSource).toBe('objectsInViolation');
    });

    it('cluster-quorum columns include configName accessor', () => {
        const config = getColumnConfig('cluster-quorum', DBType.MSSQL);
        const configNameCol = config?.columns.find(c => c.accessor === 'configName');
        expect(configNameCol).toBeDefined();
        expect(configNameCol?.label).toBe('Configuration name');
    });

    // ── injectMetadataFields ──────────────────────────────────────────────────

    it('returns injectMetadataFields: true for iscsi-replacement-timeout (Oracle)', () => {
        const config = getColumnConfig('iscsi-replacement-timeout', DBType.ORACLE);
        expect(config?.injectMetadataFields).toBe(true);
    });

    it('iscsi-replacement-timeout first column accessor is databaseHostName', () => {
        const config = getColumnConfig('iscsi-replacement-timeout', DBType.ORACLE);
        expect(config?.columns[0]?.accessor).toBe('databaseHostName');
        expect(config?.columns[0]?.label).toBe('Host name');
    });

    it('returns injectMetadataFields: true for multipath-friendly-names (Oracle)', () => {
        const config = getColumnConfig('multipath-friendly-names', DBType.ORACLE);
        expect(config?.injectMetadataFields).toBe(true);
    });

    // ── combineRows + injectMetadataFields ────────────────────────────────────

    it('returns combineRows: true and injectMetadataFields: true for heartbeat-settings (MSSQL)', () => {
        const config = getColumnConfig('heartbeat-settings', DBType.MSSQL);
        expect(config?.combineRows).toBe(true);
        expect(config?.injectMetadataFields).toBe(true);
    });

    it('heartbeat-settings first column accessor is databaseHostName', () => {
        const config = getColumnConfig('heartbeat-settings', DBType.MSSQL);
        expect(config?.columns[0]?.accessor).toBe('databaseHostName');
        expect(config?.columns[0]?.label).toBe('Host name');
    });

    // ── combineRows + injectMetadataFields ──────────────────────────────────────

    it('returns combineRows: true for tcp-advanced-options (Oracle)', () => {
        const config = getColumnConfig('tcp-advanced-options', DBType.ORACLE);
        expect(config?.combineRows).toBe(true);
        expect(config?.injectMetadataFields).toBeTruthy();
    });

    // ── fallback (no dbType) ──────────────────────────────────────────────────

    it('falls back to MSSQL registry when dbType is omitted for a MSSQL-only config', () => {
        const config = getColumnConfig('cluster-quorum');
        expect(config).toBeDefined();
        expect(config?.objectNameSource).toBe('objectsInViolation');
    });

    it('falls back to Oracle registry when dbType is omitted for an Oracle-only config', () => {
        const config = getColumnConfig('iscsi-replacement-timeout');
        expect(config).toBeDefined();
        expect(config?.injectMetadataFields).toBe(true);
    });

    // ── unknown config ────────────────────────────────────────────────────────

    it('returns undefined for an unknown configId', () => {
        expect(getColumnConfig('non-existent-config-xyz', DBType.MSSQL)).toBeUndefined();
    });

    it('returns undefined for an unknown configId without dbType', () => {
        expect(getColumnConfig('non-existent-config-xyz')).toBeUndefined();
    });
});
