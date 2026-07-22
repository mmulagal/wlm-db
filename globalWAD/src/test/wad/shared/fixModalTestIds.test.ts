import { describe, it, expect } from 'vitest';

import { FixModalRouterTestIds, FixPageRouterTestIds, PlaceholderFixModalTestIds } from '@wad/shared/fixModalTestIds';

describe('fixModalTestIds', () => {
    it('defines stable router and modal test ids', () => {
        expect(FixModalRouterTestIds.unsupported).toBe('fix-modal-router-unsupported');
        expect(FixPageRouterTestIds.unsupported).toBe('fix-page-router-unsupported');
        expect(PlaceholderFixModalTestIds.modal).toBe('placeholder-fix-modal');
        expect(PlaceholderFixModalTestIds.cancelButton).toBe('placeholder-fix-modal-cancel');
    });
});
