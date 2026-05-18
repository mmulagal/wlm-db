import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import type {
    ComputeLicenseCostType,
    ManualModeInstancesType,
    ManualStorageSavingsRequestBodyType,
    StorageSavingsCalculationsMetricsType,
    StorageSavingsResponseType
} from '../routes/types/storage-savings.types';
import { HttpErrorCodes } from '../utils/consts';
import getLogger from '../utils/logger';
import type {
    FsxCalculation,
    FsxNoSnapshotCalculation,
    ManualModeEbsComparisonV2Response,
    ManualModeFsxwComparisonResponse
} from '../utils/marketing-types';
import { fsxStorageCapacityBreakdown, isMultiAzDeployment } from '../utils/utils';
import { getEbsManualModeStorageSavings, getFsxwManualModeStorageSavings } from '../lib/cloud-manager/marketing';
import {
    formatManualStorageSavingsCalculationMetrics,
    handleMarketingApiFsxCalculationObject
} from './cloud-manager/marketing/marketing-operations';
import {
    getEbsMarketingApiManualModeRequestBody,
    getFsxwMarketingApiManualModeRequestBody
} from './cloud-manager/marketing/marketing-request-utils';

const logger = getLogger();

type FsxSlot =
    | { fsx_calculation?: FsxCalculation; fsx_cost_calculation_no_snapshot?: FsxNoSnapshotCalculation }
    | undefined;

type ManualEbsFsxnCoreParams = {
    deploymentType: string;
    snapshotFrequency: ManualStorageSavingsRequestBodyType['snapshotFrequency'];
    clonedCopiesCount: number;
    monthlyChangeRatePercentage: number;
    ec2Instances: Array<
        Omit<ManualModeInstancesType[number], 'ec2InstanceDescription'> & { ec2InstanceDescription?: string }
    >;
};

type ManualStorageCoreResult = Omit<StorageSavingsResponseType, 'compute' | 'license'>;

/**
 * Extracts and normalises FSx calculation data from a marketing-API response slot.
 *
 * Delegates to {@link handleMarketingApiFsxCalculationObject} to convert raw
 * snake_case capacity fields into camelCase byte values. Returns `undefined`
 * when the slot is absent or contains no `fsx_calculation` payload, allowing
 * callers to conditionally spread the result without extra null-checks.
 *
 * @param slot - Optional object containing `fsx_calculation` (required) and
 *   `fsx_cost_calculation_no_snapshot` (optional, used to supplement
 *   desired-storage and EBS capacity fields that are absent in the snapshot path).
 * @returns The normalised FSx calculation object, or `undefined` if `fsx_calculation` is missing.
 */
const extractFsxSlotCalculation = (slot: FsxSlot) =>
    slot?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(slot.fsx_calculation, slot.fsx_cost_calculation_no_snapshot)
        : undefined;

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

/**
 * Single source of truth for the `ec2InstanceDescription` defaulting applied to instance
 * arrays sent to the marketing API. The marketing storage pipeline is typed against the MSSQL
 * manual-params shape (`ManualModeInstancesType`) which requires `ec2InstanceDescription`,
 * but Oracle's `OracleManualModeInstanceItem` does not carry the field at all. Use this helper
 * at every entry point that crosses Oracle → marketing (or any caller whose `ec2Instances`
 * may omit the description) so the empty-string default is applied consistently.
 */
function normalizeInstancesForMarketing(
    ec2Instances: ManualEbsFsxnCoreParams['ec2Instances']
): ManualModeInstancesType {
    return ec2Instances.map(node => ({
        ...node,
        ec2InstanceDescription: node.ec2InstanceDescription || ''
    }));
}

function toMarketingCompatibleManualParams(coreParams: ManualEbsFsxnCoreParams): ManualStorageSavingsRequestBodyType {
    // Marketing helpers are typed against MSSQL manual params but only read these fields for storage calculations.
    // Keep the conversion local to avoid a large type refactor in the marketing pipeline.
    return {
        sqlServerDeploymentType: coreParams.deploymentType,
        sqlServerEdition: 'NA',
        monthlyChangeRatePercentage: coreParams.monthlyChangeRatePercentage,
        snapshotFrequency: coreParams.snapshotFrequency,
        clonedCopiesCount: coreParams.clonedCopiesCount,
        ec2Instances: normalizeInstancesForMarketing(coreParams.ec2Instances)
    };
}

async function performManualEbsFsxnStorageCalculations(
    accountId: string,
    region: string,
    storageParams: ManualEbsFsxnCoreParams
): Promise<ManualStorageCoreResult> {
    logger.info('Performing manual storage-only calculations', { accountId, region, storageParams });

    const marketingParams = toMarketingCompatibleManualParams(storageParams);

    const { ec2Instances = [] } = marketingParams;
    const hasEbsVolumes = ec2Instances.some(({ volumes }) => !isEmpty(volumes));
    if (hasEbsVolumes) {
        const { sqlServerDeploymentType } = marketingParams;
        const ebsMarketingRequestBody = getEbsMarketingApiManualModeRequestBody(region, marketingParams);

        const {
            ebsTotal,
            fsx,
            fsx_calculation: fsxCalculation,
            fsx_cost_calculation_no_snapshot: fsxCostCalculationNoSnapshot
        } = await getEbsManualModeStorageSavings<ManualModeEbsComparisonV2Response>(accountId, ebsMarketingRequestBody);

        const isMultiAz = isMultiAzDeployment(sqlServerDeploymentType);
        const fsxCalculationData = handleMarketingApiFsxCalculationObject(fsxCalculation, fsxCostCalculationNoSnapshot);

        return {
            ebs: ebsTotal,
            fsx,
            ...(!isMultiAz && {
                single: {
                    fsxCalculation: fsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        fsxCalculationData.totalStorageCapacity,
                        sqlServerDeploymentType
                    )
                }
            }),
            ...(isMultiAz && {
                multi: {
                    fsxCalculation: fsxCalculationData,
                    fsxBreakdown: fsxStorageCapacityBreakdown(
                        fsxCalculationData.totalStorageCapacity,
                        sqlServerDeploymentType
                    )
                }
            }),
            totalSummary: {
                existing: Number(ebsTotal.total || 0),
                recommended: Number(fsx.total || 0)
            }
        };
    }

    const fsxwMarketingRequestBody = getFsxwMarketingApiManualModeRequestBody(region, marketingParams);
    if (!fsxwMarketingRequestBody) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            'No FSxW configuration found for the provided manual mode parameters. Please ensure that the request includes valid FSxW configuration details such as file system type, storage capacity, and deployment type.'
        );
    }

    const {
        fsx_calculation: fsxCalculation,
        fsx_cost_calculation_no_snapshot: fsxCalculationDataNoSnapshot,
        fsx,
        fsxw
    } = await getFsxwManualModeStorageSavings<ManualModeFsxwComparisonResponse>(accountId, fsxwMarketingRequestBody);

    const fsxCalculationData = fsxCalculation
        ? handleMarketingApiFsxCalculationObject(fsxCalculation, fsxCalculationDataNoSnapshot)
        : undefined;

    return {
        fsx,
        fsxw,
        ...(fsxCalculationData && {
            [isMultiAzDeployment(marketingParams.sqlServerDeploymentType) ? 'multi' : 'single']: {
                fsxCalculation: fsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    fsxCalculationData.totalStorageCapacity,
                    marketingParams.sqlServerDeploymentType
                )
            }
        }),
        totalSummary: {
            existing: Number(fsxw?.total || 0),
            recommended: Number(fsx?.total || 0)
        }
    };
}

async function getManualEbsFsxnStorageCalculationMetrics(
    accountId: string,
    region: string,
    storageParams: ManualEbsFsxnCoreParams
): Promise<StorageSavingsCalculationsMetricsType> {
    logger.info('Getting manual storage-only calculation metrics', { accountId, region, storageParams });

    return formatManualStorageSavingsCalculationMetrics(
        accountId,
        region,
        toMarketingCompatibleManualParams(storageParams)
    );
}

export {
    settledFulfilledValues,
    getExistingAndRecommendedComputeAndLicense,
    extractFsxSlotCalculation,
    normalizeInstancesForMarketing,
    type ManualEbsFsxnCoreParams,
    type ManualStorageCoreResult,
    performManualEbsFsxnStorageCalculations,
    getManualEbsFsxnStorageCalculationMetrics
};
