import { describe, it, expect, vi } from 'vitest';

import { BulkActionId, BulkActionLabel, createFixBulkAction } from '@wad/tables/shared/bulkActions';

describe('bulkActions', () => {
    it('creates a fix bulk action with optional disabled state and tooltip', () => {
        const onFix = vi.fn();
        const action = createFixBulkAction(onFix, { isDisabled: true, tooltip: 'Unavailable' });

        expect(action).toEqual({
            id: BulkActionId.FIX,
            label: BulkActionLabel.FIX,
            onClick: onFix,
            isDisabled: true,
            tooltip: 'Unavailable'
        });
    });
});
