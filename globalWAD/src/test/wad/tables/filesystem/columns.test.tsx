import { describe, it, expect } from 'vitest';

import { TableScope } from '@tlveng/workload-factory-components/wad';

import {
    DEFAULT_FILE_SYSTEM_COLUMNS_BY_SCOPE,
    fileSystemNameColumn,
    headroomFileSystemColumns
} from '@wad/tables/filesystem/columns';

describe('filesystem columns', () => {
    it('uses file system name header on the name column', () => {
        expect(fileSystemNameColumn.header).toBe('File system name');
    });

    it('uses headroom columns for the default global wad scope', () => {
        expect(DEFAULT_FILE_SYSTEM_COLUMNS_BY_SCOPE[TableScope.GLOBAL_WAD]).toBe(headroomFileSystemColumns);
    });
});
