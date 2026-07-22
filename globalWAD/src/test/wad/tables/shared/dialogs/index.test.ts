import { describe, it, expect } from 'vitest';

import { ResourceTagsDialog as DialogFromIndex } from '@wad/tables/shared/dialogs/index';
import { ResourceTagsDialog } from '@wad/tables/shared/dialogs/ResourceTagsDialog';

describe('dialogs/index', () => {
    it('re-exports ResourceTagsDialog', () => {
        expect(DialogFromIndex).toBe(ResourceTagsDialog);
    });
});
