import { describe, it, expect } from 'vitest';

import { fetchLunResourceMetadata } from '@wad/tables/lun/fetchLunResourceMetadata';

describe('fetchLunResourceMetadata', () => {
    it('returns empty metadata for each resource', async () => {
        const results = await fetchLunResourceMetadata(
            [{ id: 'lun-1', configurationId: 'wlmdb-os-type' }],
            new AbortController().signal
        );

        expect(results).toEqual([{ id: 'lun-1', metadata: {} }]);
    });
});
