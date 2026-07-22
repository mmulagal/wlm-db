import { describe, it, expect } from 'vitest';

import { LunConfigurationIds, resolveLunConfiguration } from '@wad/tables/lun/configurations';

describe('lun configurations', () => {
    it('registers all supported lun configuration ids', () => {
        expect([...LunConfigurationIds].sort()).toEqual(
            ['wlmdb-block-device-space-management', 'wlmdb-os-type'].sort()
        );
    });

    it('disables bulk fix for os type configuration', () => {
        expect(resolveLunConfiguration('wlmdb-os-type').supportsBulkFix).toBe(false);
    });

    it('uses multi-component columns for block device space management', () => {
        expect(resolveLunConfiguration('wlmdb-block-device-space-management').columns?.length).toBeGreaterThan(0);
    });
});
