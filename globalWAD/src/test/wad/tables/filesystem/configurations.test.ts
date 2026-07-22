import { describe, it, expect } from 'vitest';

import { FileSystemConfigurationIds, resolveFileSystemConfiguration } from '@wad/tables/filesystem/configurations';

describe('filesystem configurations', () => {
    it('registers headroom configuration', () => {
        expect([...FileSystemConfigurationIds]).toEqual(['wlmdb-headroom']);
    });

    it('restricts bulk selection to same workload for headroom', () => {
        expect(resolveFileSystemConfiguration('wlmdb-headroom').restrictBulkSelectionToSameWorkload).toBe(true);
    });
});
