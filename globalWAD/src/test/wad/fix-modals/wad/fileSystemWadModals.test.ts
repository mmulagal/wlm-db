import { describe, it, expect } from 'vitest';

import { FileSystemHeadroomFixModal } from '@wad/fix-modals/filesystem/headroom/FileSystemHeadroomFixModal';
import { fileSystemWadModals } from '@wad/fix-modals/wad/fileSystemWadModals';

describe('fileSystemWadModals', () => {
    it('maps headroom configuration to its fix modal', () => {
        expect(fileSystemWadModals['wlmdb-headroom']).toBe(FileSystemHeadroomFixModal);
    });
});
