import { describe, it, expect } from 'vitest';

import { TableScope } from '@tlveng/workload-factory-components';

import {
    DEFAULT_VOLUME_COLUMNS_BY_SCOPE,
    multiComponentVolumeColumns,
    volumeNameColumn
} from '@wad/tables/volume/columns';

describe('volume columns', () => {
    it('uses volume name header on the name column', () => {
        expect(volumeNameColumn.header).toBe('Volume name');
    });

    it('includes workload in the default global wad columns', () => {
        expect(DEFAULT_VOLUME_COLUMNS_BY_SCOPE[TableScope.GLOBAL_WAD].some(column => column.id === 'workload')).toBe(
            true
        );
    });

    it('uses wider multi-component current and recommended columns', () => {
        expect(multiComponentVolumeColumns.map(column => column.id)).toEqual([
            'name',
            'fileSystem',
            'optimizationStatus',
            'volumeMultiComponentCurrent',
            'volumeMultiComponentRecommended',
            'workload',
            'lastAnalyzed'
        ]);
    });
});
