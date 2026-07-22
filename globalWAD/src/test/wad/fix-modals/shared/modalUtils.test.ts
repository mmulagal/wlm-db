import { describe, it, expect } from 'vitest';

import { buildFileSystemFixTargets, buildVolumeFixTargets } from '@wad/fix-modals/shared/modalUtils';
import { createMockResource } from '@test/helpers/testUtils';

describe('modalUtils', () => {
    describe('buildVolumeFixTargets', () => {
        it('maps selected resources using resource id as fix id', () => {
            const resources = [createMockResource('vol-1', { subConfig: 'dedupe' }), createMockResource('vol-2')];

            expect(buildVolumeFixTargets(resources, ['vol-1'])).toEqual([{ id: 'vol-1', subConfig: 'dedupe' }]);
        });
    });

    describe('buildFileSystemFixTargets', () => {
        it('uses parent resource id when present', () => {
            const resources = [
                createMockResource('fs-child', {
                    parentResource: { id: 'fs-parent', type: 'FileSystem' }
                })
            ];

            expect(buildFileSystemFixTargets(resources, ['fs-child'])).toEqual([
                { id: 'fs-parent', parentResource: { id: 'fs-parent', type: 'FileSystem' } }
            ]);
        });
    });
});
