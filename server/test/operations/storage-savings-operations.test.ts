import { describe, expect, it } from 'vitest';

import type { ComputeLicenseCostType } from '../../src/routes/types/storage-savings.types';
import {
    getExistingAndRecommendedComputeAndLicense,
    settledFulfilledValues
} from '../../src/operations/storage-savings-operations';

describe('storage-savings-operations (shared helpers)', () => {
    it('should return only fulfilled promise values', () => {
        const results: PromiseSettledResult<number>[] = [
            { status: 'fulfilled', value: 1 },
            { status: 'rejected', reason: new Error('x') },
            { status: 'fulfilled', value: 2 }
        ];
        expect(settledFulfilledValues(results)).toEqual([1, 2]);
    });

    it('should sum existing and recommended compute license prices', () => {
        const list = [
            {
                compute: {
                    existing: { instanceMonthlyPrice: '10' },
                    recommended: { instanceMonthlyPrice: '20' }
                }
            },
            {
                compute: {
                    existing: { instanceMonthlyPrice: undefined },
                    recommended: { instanceMonthlyPrice: '5' }
                }
            }
        ] as unknown as ComputeLicenseCostType[];

        expect(getExistingAndRecommendedComputeAndLicense(list)).toEqual({
            existingComputeLicensePrice: 10,
            recommendedComputeLicensePrice: 25
        });
    });
});
