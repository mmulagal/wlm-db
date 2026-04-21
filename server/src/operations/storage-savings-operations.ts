import type { ComputeLicenseCostType } from '../routes/types/storage-savings.types';

function settledFulfilledValues<T>(results: PromiseSettledResult<T>[]): T[] {
    return results.filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled').map(r => r.value);
}

function getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList: ComputeLicenseCostType[]) {
    return computeAndLicenseCostList.reduce(
        (acc, curr) => {
            acc.existingComputeLicensePrice += Number(curr.compute.existing?.instanceMonthlyPrice || 0);
            acc.recommendedComputeLicensePrice += Number(curr.compute.recommended?.instanceMonthlyPrice || 0);
            return acc;
        },
        {
            existingComputeLicensePrice: 0,
            recommendedComputeLicensePrice: 0
        }
    );
}

export { settledFulfilledValues, getExistingAndRecommendedComputeAndLicense };
