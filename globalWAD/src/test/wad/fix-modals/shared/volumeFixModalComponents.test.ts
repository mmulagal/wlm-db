import { describe, it, expect } from 'vitest';

import { volumeFixModalComponents } from '@wad/fix-modals/shared/volumeFixModalComponents';

describe('volumeFixModalComponents', () => {
    it('maps all supported volume configuration ids to components', () => {
        expect(Object.keys(volumeFixModalComponents).sort()).toEqual(
            [
                'wlmdb-snapcenter-snapshot',
                'wlmdb-snapshot-policy',
                'wlmdb-storage-efficiencies',
                'wlmdb-thin-provision',
                'wlmdb-tiering-tco-optimization'
            ].sort()
        );
    });
});
