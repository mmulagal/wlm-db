import { describe, it, expect } from 'vitest';

import { spliceExtras } from '@wad/tables/shared/columns';

describe('spliceExtras', () => {
    const defaults = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    it('returns defaults when extras are empty', () => {
        expect(spliceExtras(defaults, [], 'b')).toBe(defaults);
    });

    it('inserts extras before the anchor column', () => {
        expect(spliceExtras(defaults, [{ id: 'x' }], 'b').map(column => column.id)).toEqual(['a', 'x', 'b', 'c']);
    });

    it('appends extras when the anchor is missing', () => {
        expect(spliceExtras(defaults, [{ id: 'x' }], 'missing').map(column => column.id)).toEqual(['a', 'b', 'c', 'x']);
    });
});
