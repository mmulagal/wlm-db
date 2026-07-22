import { describe, it, expect } from 'vitest';

import { resolveVolumeConfiguration, VolumeConfigurationIds } from '@wad/tables/volume/configurations';

describe('volume configurations', () => {
    it('registers all supported volume configuration ids', () => {
        expect([...VolumeConfigurationIds].sort()).toEqual(
            [
                'wlmdb-snapcenter-snapshot',
                'wlmdb-snapshot-policy',
                'wlmdb-storage-efficiencies',
                'wlmdb-thin-provision',
                'wlmdb-tiering-tco-optimization'
            ].sort()
        );
    });

    it('disables bulk fix for snapcenter snapshot configuration', () => {
        expect(resolveVolumeConfiguration('wlmdb-snapcenter-snapshot').supportsBulkFix).toBe(false);
    });

    it('allows guidance-only snapcenter fix modal without FSx parent context', () => {
        expect(resolveVolumeConfiguration('wlmdb-snapcenter-snapshot').requiresFsxContext).toBe(false);
    });

    it('restricts bulk selection to same workload for snapshot policy', () => {
        expect(resolveVolumeConfiguration('wlmdb-snapshot-policy').restrictBulkSelectionToSameWorkload).toBe(true);
    });
});
