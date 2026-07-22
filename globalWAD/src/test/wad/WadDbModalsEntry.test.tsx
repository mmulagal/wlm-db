import { describe, it, expect } from 'vitest';

import WadDbModalsEntry from '@wad/WadDbModalsEntry';
import { FixModalRouter } from '@wad/FixModalRouter';

describe('WadDbModalsEntry', () => {
    it('exports the fix modal router mount component', () => {
        expect(WadDbModalsEntry).toBe(FixModalRouter);
    });
});
