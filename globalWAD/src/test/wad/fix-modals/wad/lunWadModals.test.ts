import { describe, it, expect } from 'vitest';

import { lunFixModalComponents } from '@wad/fix-modals/shared/lunFixModalComponents';
import { lunWadModals } from '@wad/fix-modals/wad/lunWadModals';

describe('lunWadModals', () => {
    it('re-exports lun fix modal components', () => {
        expect(lunWadModals).toBe(lunFixModalComponents);
    });
});
