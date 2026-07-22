import { describe, it, expect } from 'vitest';

import { lunFixModalComponents } from '@wad/fix-modals/shared/lunFixModalComponents';

describe('lunFixModalComponents', () => {
    it('maps all supported lun configuration ids to components', () => {
        expect(Object.keys(lunFixModalComponents).sort()).toEqual(
            ['wlmdb-block-device-space-management', 'wlmdb-os-type'].sort()
        );
    });
});
