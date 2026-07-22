import { describe, it, expect } from 'vitest';

import { volumeFixModalComponents } from '@wad/fix-modals/shared/volumeFixModalComponents';
import { volumeWadModals } from '@wad/fix-modals/wad/volumeWadModals';

describe('volumeWadModals', () => {
    it('re-exports volume fix modal components', () => {
        expect(volumeWadModals).toBe(volumeFixModalComponents);
    });
});
