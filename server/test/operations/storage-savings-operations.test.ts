import { afterEach, describe, expect, it, vi } from 'vitest';

import * as ec2Lib from '../../src/lib/aws/ec2';
import type { ComputeLicenseCostType } from '../../src/routes/types/storage-savings.types';
import {
    filterSupportedEbsVolumeIds,
    getExistingAndRecommendedComputeAndLicense,
    settledFulfilledValues
} from '../../src/operations/storage-savings-operations';
import { DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';

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

    describe('filterSupportedEbsVolumeIds', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should return an empty list when there are no volume ids', async () => {
            await expect(
                filterSupportedEbsVolumeIds(DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [])
            ).resolves.toEqual([]);
        });

        it('should keep only volume ids whose DescribeVolumes volume type is supported for marketing', async () => {
            vi.spyOn(ec2Lib, 'describeVolumes').mockResolvedValueOnce({
                Volumes: [
                    { VolumeId: 'vol-gp3', VolumeType: 'gp3' },
                    { VolumeId: 'vol-st1', VolumeType: 'st1' },
                    { VolumeId: 'vol-io2', VolumeType: 'io2' }
                ],
                $metadata: {}
            });

            const input = ['vol-gp3', 'vol-st1', 'vol-io2', 'vol-missing'];
            const out = await filterSupportedEbsVolumeIds(DEFAULT_AWS_CREDENTIALS_ID, 'us-west-2', input);

            expect(out).toEqual(['vol-gp3', 'vol-io2']);
        });

        it('should return the original volume ids when DescribeVolumes fails', async () => {
            vi.spyOn(ec2Lib, 'describeVolumes').mockRejectedValueOnce(new Error('EC2 throttled'));
            const input = ['vol-a', 'vol-b'];
            await expect(filterSupportedEbsVolumeIds(DEFAULT_AWS_CREDENTIALS_ID, 'eu-west-1', input)).resolves.toEqual(
                input
            );
        });
    });
});
