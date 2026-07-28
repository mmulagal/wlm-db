import { describe, it, expect, vi } from 'vitest';
import { OptimizationStatus } from '@tlveng/workload-factory-components/wad';

import {
    BulkActionId,
    BulkActionLabel,
    createFixBulkAction,
    filterNeedsOptimizationResources
} from '@wad/tables/shared/bulkActions';
import { createMockResource } from '@test/helpers/testUtils';

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

    it('filters bulk fix selection to needs-optimization resources only', () => {
        const needsOptimization = createMockResource('needs-opt', {
            optimizationStatus: OptimizationStatus.NOT_OPTIMIZED
        });
        const optimized = createMockResource('optimized', {
            optimizationStatus: OptimizationStatus.OPTIMIZED
        });

        expect(filterNeedsOptimizationResources([needsOptimization, optimized])).toEqual([needsOptimization]);
        expect(filterNeedsOptimizationResources([optimized])).toEqual([]);
    });
});
