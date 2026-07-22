import { describe, it, expect } from 'vitest';

import tablesEntry from '@wad/tables';
import WadDbTablesEntry from '@wad/WadDbTablesEntry';

describe('tables', () => {
    it('re-exports the WAD tables mount entry', () => {
        expect(tablesEntry).toBe(WadDbTablesEntry);
    });
});
