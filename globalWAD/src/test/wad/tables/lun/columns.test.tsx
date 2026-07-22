import { describe, it, expect } from 'vitest';

import { TableScope } from '@tlveng/workload-factory-components';

import { DEFAULT_LUN_COLUMNS_BY_SCOPE, lunNameColumn } from '@wad/tables/lun/columns';

describe('lun columns', () => {
    it('uses lun name header on the name column', () => {
        expect(lunNameColumn.header).toBe('LUN name');
    });

    it('includes os type columns in the default global wad columns', () => {
        expect(DEFAULT_LUN_COLUMNS_BY_SCOPE[TableScope.GLOBAL_WAD].map(column => column.id)).toEqual([
            'name',
            'fileSystem',
            'optimizationStatus',
            'currentOsType',
            'recommendedOsType',
            'workload',
            'lastAnalyzed'
        ]);
    });
});
