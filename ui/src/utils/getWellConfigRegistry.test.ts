import { describe, it, expect } from 'vitest';

import { buildSubConfigValues } from './configRegistry';

describe('buildSubConfigValues', () => {
    // MSSQL storage-efficiencies: single `recommended` per sub-config, current from violatedConfigs
    it('uses recommended as current for sub-configs not in violation', () => {
        const row = {
            objectName: 'wlmdb_sqldata_1735808882',
            violatedConfigs: [
                { name: 'deduplication', current: 'none' },
                { name: 'compaction', current: 'none' }
            ]
        };
        const configDetails = [
            { name: 'compression', recommended: 'adaptive' },
            { name: 'deduplication', recommended: 'inline' },
            { name: 'compaction', recommended: 'enabled' }
        ];

        const { current, recommended } = buildSubConfigValues(row, configDetails);

        // compression not in violation -> falls back to its recommended value
        expect(current).toBe('compression=adaptive, deduplication=none, compaction=none');
        expect(recommended).toBe('compression=adaptive, deduplication=inline, compaction=enabled');
    });

    // Oracle storage-efficiencies: recommended resolved per row.dataCategory
    it('resolves recommended by dataCategory when no flat recommended exists', () => {
        const row = {
            objectName: 'data_dnfs3',
            dataCategory: 'non-log-files',
            violatedConfigs: [{ name: 'deduplication', current: 'background' }]
        };
        const configDetails = [
            {
                name: 'compression',
                recommended: '',
                recommendedByDataCategory: { 'log-files': 'none', 'non-log-files': 'adaptive', mixed: 'varies' }
            },
            {
                name: 'deduplication',
                recommended: '',
                recommendedByDataCategory: { 'log-files': 'none', 'non-log-files': 'inline', mixed: 'varies' }
            },
            {
                name: 'compaction',
                recommended: '',
                recommendedByDataCategory: { 'log-files': 'none', 'non-log-files': 'enabled', mixed: 'varies' }
            }
        ];

        const { current, recommended } = buildSubConfigValues(row, configDetails);

        expect(recommended).toBe('compression=adaptive, deduplication=inline, compaction=enabled');
        // deduplication keeps its own current; others fall back to category recommended
        expect(current).toBe('compression=adaptive, deduplication=background, compaction=enabled');
    });

    // block-device-space-management: a LUN row violates the two LUN settings; the volume-only
    // fractional-reserve sub-config is not in violation and falls back to its recommended value.
    it('builds block-device-space-management values for a LUN in violation', () => {
        const row = {
            objectName: '/vol/wlmdb_sqldata/sqldata',
            objectType: 'Lun',
            violatedConfigs: [
                { name: 'space-reservation-enabled', current: 'false' },
                { name: 'space-allocation-allocated', current: 'false' }
            ]
        };
        const configDetails = [
            { name: 'space-reservation-enabled', recommended: 'true', objectType: 'Lun' },
            { name: 'space-allocation-allocated', recommended: 'true', objectType: 'Lun' },
            { name: 'fractional-reserve', recommended: '0', objectType: 'Volume' }
        ];

        const { current, recommended } = buildSubConfigValues(row, configDetails);

        expect(current).toBe('space-reservation-enabled=false, space-allocation-allocated=false, fractional-reserve=0');
        expect(recommended).toBe(
            'space-reservation-enabled=true, space-allocation-allocated=true, fractional-reserve=0'
        );
    });
});
