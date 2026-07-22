import { describe, it, expect } from 'vitest';

import WadDbTablesEntry from '@wad/WadDbTablesEntry';
import { FixPageRouter } from '@wad/FixPageRouter';

describe('WadDbTablesEntry', () => {
    it('exports the fix page router mount component', () => {
        expect(WadDbTablesEntry).toBe(FixPageRouter);
    });
});
