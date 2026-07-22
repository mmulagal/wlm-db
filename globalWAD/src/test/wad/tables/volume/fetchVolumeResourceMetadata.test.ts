import { describe, it, expect, vi } from 'vitest';

import { fetchVolumeResourceMetadata } from '@wad/tables/volume/fetchVolumeResourceMetadata';

describe('fetchVolumeResourceMetadata', () => {
    it('returns mocked size metadata for each resource', async () => {
        vi.useFakeTimers();

        const promise = fetchVolumeResourceMetadata(
            [{ id: 'vol-1', configurationId: 'wlmdb-thin-provision' }],
            new AbortController().signal
        );
        await vi.runAllTimersAsync();
        const results = await promise;

        expect(results).toEqual([{ id: 'vol-1', metadata: { sizeInBytes: 107374182400 } }]);

        vi.useRealTimers();
    });
});
