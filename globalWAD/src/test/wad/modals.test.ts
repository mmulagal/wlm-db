import { describe, it, expect } from 'vitest';

import modalsEntry from '@wad/modals';
import WadDbModalsEntry from '@wad/WadDbModalsEntry';

describe('modals', () => {
    it('re-exports the WAD modals mount entry', () => {
        expect(modalsEntry).toBe(WadDbModalsEntry);
    });
});
