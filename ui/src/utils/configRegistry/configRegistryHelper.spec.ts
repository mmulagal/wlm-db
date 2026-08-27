import { describe, expect, it, vi } from 'vitest';

import { ASSESSMENT_CONFIG_IDS, DBType } from '../consts';
import { buildSubConfigValues, getButtonText, getColumnConfig } from './configRegistryHelper';

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

describe('buildSubConfigValues', () => {
    const configDetails = [
        { name: 'tiering-policy', recommended: 'auto' },
        { name: 'tiering-min-cooling-days', recommended: '31' }
    ];

    it('shows all sub-configs from configDetails', () => {
        const row = {
            violatedConfigs: [{ name: 'tiering-policy', current: 'none' }]
        };
        const result = buildSubConfigValues(row, configDetails);
        // Shows all configDetails; uses current from violatedConfigs if present, otherwise uses recommended
        expect(result.current).toBe('tiering-policy=none, tiering-min-cooling-days=31');
        expect(result.recommended).toBe('tiering-policy=auto, tiering-min-cooling-days=31');
    });

    it('uses recommended value when sub-config is not in violatedConfigs', () => {
        const row = {
            violatedConfigs: [{ name: 'tiering-policy', current: 'none' }]
        };
        const result = buildSubConfigValues(row, configDetails);
        expect(result.current).toContain('tiering-min-cooling-days=31');
        expect(result.recommended).toContain('tiering-min-cooling-days=31');
    });

    it('uses current value when sub-config is in violatedConfigs', () => {
        const row = {
            violatedConfigs: [
                { name: 'tiering-policy', current: 'none' },
                { name: 'tiering-min-cooling-days', current: '10' }
            ]
        };
        const result = buildSubConfigValues(row, configDetails);
        expect(result.current).toBe('tiering-policy=none, tiering-min-cooling-days=10');
        expect(result.recommended).toBe('tiering-policy=auto, tiering-min-cooling-days=31');
    });

    it('shows all configDetails with recommended values when violatedConfigs is empty', () => {
        const row = { violatedConfigs: [] };
        const result = buildSubConfigValues(row, configDetails);
        expect(result.current).toBe('tiering-policy=auto, tiering-min-cooling-days=31');
        expect(result.recommended).toBe('tiering-policy=auto, tiering-min-cooling-days=31');
    });

    it('shows all configDetails with recommended values when row has no violatedConfigs', () => {
        const result = buildSubConfigValues({}, configDetails);
        expect(result.current).toBe('tiering-policy=auto, tiering-min-cooling-days=31');
        expect(result.recommended).toBe('tiering-policy=auto, tiering-min-cooling-days=31');
    });

    it('filters out empty recommended values only for cold data tiering config', () => {
        const configDetailsWithEmpty = [
            { name: 'tiering-policy', recommended: 'auto' },
            { name: 'tiering-min-cooling-days', recommended: '' }
        ];
        const row = {
            violatedConfigs: [{ name: 'tiering-policy', current: 'none' }]
        };

        // With cold data tiering config, empty recommended should be filtered out
        const resultTiering = buildSubConfigValues(
            row,
            configDetailsWithEmpty,
            ASSESSMENT_CONFIG_IDS.TIERING_TCO_OPTIMIZATION
        );
        expect(resultTiering.current).toBe('tiering-policy=none');
        expect(resultTiering.recommended).toBe('tiering-policy=auto');
        expect(resultTiering.current).not.toContain('tiering-min-cooling-days');

        // For other configs, empty recommended should NOT be filtered out
        const resultNonTiering = buildSubConfigValues(
            row,
            configDetailsWithEmpty,
            ASSESSMENT_CONFIG_IDS.BLOCK_DEVICE_SPACE_MANAGEMENT
        );
        expect(resultNonTiering.current).toBe('tiering-policy=none, tiering-min-cooling-days=');
        expect(resultNonTiering.recommended).toBe('tiering-policy=auto, tiering-min-cooling-days=');
    });

    it('includes all sub-configs for storage-efficiencies regardless of violatedConfigs', () => {
        const configDetailsStorageEfficiencies = [
            {
                id: 'compression',
                recommended: '',
                recommendedByDataCategory: { 'non-log-files': 'adaptive', 'log-files': 'none' }
            },
            {
                id: 'deduplication',
                recommended: '',
                recommendedByDataCategory: { 'non-log-files': 'inline', 'log-files': 'none' }
            },
            {
                id: 'compaction',
                recommended: '',
                recommendedByDataCategory: { 'non-log-files': 'enabled', 'log-files': 'none' }
            }
        ];
        const row = {
            dataCategory: 'non-log-files',
            violatedConfigs: [{ id: 'deduplication', current: 'background' }]
        };

        // For storage-efficiencies, all sub-configs should be shown even if not in violatedConfigs
        const result = buildSubConfigValues(
            row,
            configDetailsStorageEfficiencies,
            ASSESSMENT_CONFIG_IDS.STORAGE_EFFICIENCIES
        );
        expect(result.current).toBe('compression=adaptive, deduplication=background, compaction=enabled');
        expect(result.recommended).toBe('compression=adaptive, deduplication=inline, compaction=enabled');
        expect(result.current).toContain('compression');
        expect(result.current).toContain('deduplication');
        expect(result.current).toContain('compaction');
    });
});
