import getLogger from '../../../utils/logger';
import { AutomaticModeStorageSavingsMarketingParams } from '../../../routes/types/storage-savings.types';
import { convertToBytes, sizeInGigaBytes, IS_DEMO_FLOW } from '../../../utils/utils';
import {
    AutomaticModeMarketingRequestBody,
    EbsCostCalculation,
    FsxCostCalculations,
    FsxwCostCalculation,
    StorageSummary
} from '../../../utils/marketing-types';
import { getStorageSavings } from '../../../lib/cloud-manager/marketing';
import {
    ebsAutomaticDemoModeCallingManualApi,
    fsxwAutomaticDemoModeCallingManualApi
} from './marketing-operations-demo';

import {
    HOURS_IN_MONTH,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG,
    SqlServerDeploymentModel,
    STORAGE_SERVICE_DEFAULT_REGION
} from '../../../utils/consts';

const logger = getLogger();

/* eslint-disable camelcase */
function formatFsxwCalculationObject(fsxwSummary: StorageSummary, fsxwCostCalculationObject: FsxwCostCalculation) {
    logger.debug('Formatting FSxw calculation object', fsxwSummary, fsxwCostCalculationObject);

    const {
        desiredStorageCapacityGb: { size: desiredStorageCapacitySize, unit: desiredStorageCapacityUnit },
        deduplicationSavings,
        totalDefaultProvisionedIops,
        additionalUserProvisionedIops,
        totalMonthlyCostForFsxwProvisionedSsdIops: totalMonthlyCostForProvisionedSsdIops,
        fsxwIopsPrice,
        billedIops,
        numberOfFileSystemsRequiredForStorageCapacity,
        numberOfFileSystemsRequiredForThroughputCapacity,
        monthlyCostForFsxwStorageCapacity: monthlyCostForStorageCapacity,
        fsxwMaxThroughput,
        requiredNumberOfFsxwFileSystemsFractional: requiredFractionalFileSystems,
        requiredNumberOfFsxwFileSystemsRoundUp: requiredFileSystems,
        minimumThroughputCapacityRequiredToProvisionFileSystems: minThroughputCapacityRequired,
        provisionedThroughputCapacity,
        fsxwSsdPrice,
        fsxwMaxCapacity: { size: fsxwMaxCapacitySize, unit: fsxwMaxCapacityUnit },
        totalMonthlyCostForFsxwThroughputCapacity: totalMonthlyCostForThroughputCapacity,
        totalStorageChargeMonthly: totalMonthlyCost,
        throughput,
        fsxwMinThroughput,
        fsxwThroughputPrice
    } = fsxwCostCalculationObject;

    const storageSavings = desiredStorageCapacitySize * deduplicationSavings;
    const provisionedStorageCapacity = desiredStorageCapacitySize - storageSavings;

    return {
        storageSavings:
            (convertToBytes(desiredStorageCapacitySize, desiredStorageCapacityUnit) || 0) * deduplicationSavings,
        provisionedStorageCapacity,
        desiredStorageCapacity: convertToBytes(desiredStorageCapacitySize, desiredStorageCapacityUnit) || 0,
        deduplicationSavings,
        monthlyCostForStorageCapacity,
        totalDefaultProvisionedIops,
        additionalUserProvisionedIops,
        billedIops,
        totalMonthlyCostForProvisionedSsdIops,
        fsxwIopsPrice,
        numberOfFileSystemsRequiredForStorageCapacity,
        numberOfFileSystemsRequiredForThroughputCapacity,
        fsxwMaxThroughput,
        requiredFractionalFileSystems,
        requiredFileSystems,
        minThroughputCapacityRequired,
        provisionedThroughputCapacity,
        totalMonthlyCostForThroughputCapacity,
        totalMonthlyCost,
        fsxwSsdPrice,
        fsxwMaxCapacity: convertToBytes(fsxwMaxCapacitySize, fsxwMaxCapacityUnit) || 0,
        throughput,
        fsxwMinThroughput,
        fsxwThroughputPrice
    };
}

function derivePropertiesBasedOnDeploymentType(
    fsxCostCalculations: FsxCostCalculations,
    params: AutomaticModeStorageSavingsMarketingParams
) {
    const {
        fsx_cost_calculation_no_snapshot: {
            provisionedThroughputCapacity: suggestedFsxnThroughputCapacity,
            desiredStorageCapacityGB: { size: desiredStorageCapacitySize, unit: desiredStorageCapacityUnit },
            numberOfVolumes,
            FSXnCapacityPrice: { price: fsxnCapacityPriceWithoutSnapshot, unit: fsxnCapacityUnitWithoutSnapshot },
            percentageOfDataOnSSDStorage,
            maxSSDTierSizeGB: { size: maxSsdTierSize, unit: maxSsdTierSizeUnit },
            maxThroughput,
            FSXnThroughputPrice: fsxnThroughputPrice,
            provisionedSSDIOPS: provisionedSsdIops,
            includedIOPS: includedIops,
            maxSSDIOPS: maxSsdIops,
            EBSCapacity: { size: ebsCapacity, unit: ebsCapacityUnit },
            percentageOfDataOnSSDStorage: percentageDataSsdStorage,
            savingsFromCompressionAndDeduplication: savingsCd,
            storageSavingsFromCompressionAndDeduplication: { size: ssCDSize, unit: ssCDUnit },
            effectiveStorageCapacityForFSxForONTAP: { size: effStorageCapacityFsxn, unit: effStorageCapacityFsxnUnit },
            SSDStorageGBPerMonth: {
                size: ssdStorageGBPerMonthSizeWithoutSnapshot,
                unit: ssdStorageGBPerMonthUnitWithoutSnapshot
            },
            effectiveFSXnSSD: { size: effectiveFSXnSSDSize, unit: effectiveFSXnSSDUnit },
            SSDMonthlyCost: ssdMonthlyCostWithoutSnapshot,
            totalMonthlyCostForFSxSSD: totalMonthlyCostForFSxSsdWithoutSnapshot,
            ratioAfterSavings: ratioAfterSavingsWithoutSnapshot,
            dataOnCapacityPoolStorageFactor: dataOnCapacityPoolStorageFactorWithoutSnapshot,
            capacityPoolStorage: {
                size: capacityPoolStorageWithoutSnapshotSize,
                unit: capacityPoolStorageWithoutSnapshotUnit
            },
            capacityMonthlyCost: capacityMonthlyCostWithoutSnapshot,
            totalMonthlyCostForCapacity: totalMonthlyCostForCapacityWithoutSnapshot,
            totalMonthlyStorageCharge,
            minFileSystemsNumForStorage,
            minFileSystemsForThroughputCapacity,
            minFileSystemsRequiredForSSDIOPS: minFileSystemsNumForSsdIops,
            requiredNumOfFSx_fractional: requiredNumOfFsxFractional,
            requiredNumOfFSx_roundUp: requiredNumOfFsx,
            minThroughputCapacityRequired,
            provisionedThroughputCapacity,
            totalMonthlyCostFSXnThroughputCapacity: totalMonthlyFsxnThroughputCapacityCost,
            includedSSDIOPS: includedSsdIops,
            additionalSSDIOPS: additionalSsdIops,
            billedAdditionalSSDIOPS: billedAdditionalSsdIops,
            additionalBilledCostForSSDIOPS: additionalBilledCostForSsdIops,
            totalThroughputIOPSRequestsChargeMonthly: totalThroughputAndIopsMonthly,
            FSXnIOPSPrice
        },
        fsx_snapshot_cost_calculation: {
            FSXnSSDPrice: { price: fsxnSsdPrice, unit: fsxnSsdPriceUnit },
            FSXnCapacityPrice: { price: fsxnCapacityPrice, unit: fsxnCapacityPriceUnit },
            desiredSnapshotStorageCapacityGB: {
                size: desiredSnapshotStorageCapacityGBSize,
                unit: desiredSnapshotStorageCapacityGBUnit
            },
            dataOnSSDStoragePercentage,
            savingsFromCompressionAndDeduplication,
            storageSavingsFromCompressionAndDeduplication: {
                size: storageSavingsFromCompressionAndDeduplicationSize,
                unit: storageSavingsFromCompressionAndDeduplicationUnit
            },
            effectiveStorageCapacityForFSxForONTAP: {
                size: effectiveStorageCapacityForFSxForONTAPSize,
                unit: effectiveStorageCapacityForFSxForONTAPUnit
            },
            SSDSnapshotStorageGBPerMonth: { size: ssdStorageGBPerMonthSize, unit: ssdStorageGBPerMonthUnit },
            SSDMonthlyCost: ssdMonthlyCost,
            totalSnapshotMonthlyCostForFSxSSD: totalSnapshotMonthlyCostForFsxSsd,
            ratioAfterSavings,
            snapshotDataOnCapacityPoolStorageFactor,
            capacityPoolStorage: { size: capacityPoolStorageSize, unit: capacityPoolStorageUnit },
            capacityMonthlyCost,
            totalMonthlyCostForCapacity,
            totalSnapshotMonthlyCost
        },
        fsx_clone_cost_calculation: {
            desiredStorageCapacityGB: { size: cloneDesiredStorageCapacityGB, unit: cloneDesiredStorageCapacityGBUnit },
            percentageOfDataOnSSDStorage: percentageOfDataOnSSDStorageClone,
            savingsFromCompressionAndDeduplication: savingsFromCompressionAndDeduplicationClone,
            storageSavingsFromCompressionAndDeduplication: {
                size: cloneStorageSavingsFromCompressionAndDeduplication,
                unit: cloneStorageSavingsFromCompressionAndDeduplicationUnit
            },
            effectiveStorageCapacityForFSxForONTAP: {
                size: cloneEffectiveStorageCapacityForFSxForONTAP,
                unit: cloneEffectiveStorageCapacityForFSxForONTAPUnit
            },
            FSXnSSDPrice: { price: fsxnSsdClonePrice, unit: fsxnSsdClonePriceUnit },
            SSDCloneStorageGBPerMonth: { size: cloneSSDStorageGBPerMonth, unit: cloneSSDStorageGBPerMonthUnit },
            SSDStorageGBPerMonth: { size: totalSsdStorageGBPerMonthSize, unit: totalSsdStorageGBPerMonthUnit },
            SSDMonthlyCost,
            totalCloneMonthlyCost,
            changeRateBetweenClones
        }
    } = fsxCostCalculations;

    return {
        fsxOntapCalculation: {
            numberOfVolumes,
            percentageOfDataOnSSDStorage,
            fsxnCapacityPrice: { price: fsxnCapacityPriceWithoutSnapshot, unit: fsxnCapacityUnitWithoutSnapshot },
            maxSsdTierSize: convertToBytes(maxSsdTierSize, maxSsdTierSizeUnit) || 0,
            suggestedFsxnThroughputCapacity,
            maxThroughput,
            fsxnThroughputPrice,
            provisionedSsdIops,
            includedIops,
            maxSsdIops,
            fsxnStoragePrice: {
                price: fsxnSsdPrice,
                unit: fsxnSsdPriceUnit
            },
            desiredStorageCapacity: convertToBytes(desiredStorageCapacitySize, desiredStorageCapacityUnit) || 0,
            ebsCapacity: convertToBytes(ebsCapacity, ebsCapacityUnit) || 0,
            percentageOfDataOnSsdStorage: percentageDataSsdStorage,
            savingsFromCompressionAndDeduplication: savingsCd,
            storageSavingsFromCompressionAndDeduplication: convertToBytes(ssCDSize, ssCDUnit) || 0,
            effectiveFsxnStorageCapacity: convertToBytes(effStorageCapacityFsxn, effStorageCapacityFsxnUnit) || 0,
            ssdStoragePerMonth:
                convertToBytes(ssdStorageGBPerMonthSizeWithoutSnapshot, ssdStorageGBPerMonthUnitWithoutSnapshot) || 0,
            greaterOfSsdAndMinAllowedSsd: convertToBytes(effectiveFSXnSSDSize, effectiveFSXnSSDUnit) || 0,
            ssdMonthlyCost: ssdMonthlyCostWithoutSnapshot,
            totalMonthlyCostForFSxSsd: totalMonthlyCostForFSxSsdWithoutSnapshot,
            ratioAfterSavings: ratioAfterSavingsWithoutSnapshot,
            dataOnCapacityPoolStorageFactor: dataOnCapacityPoolStorageFactorWithoutSnapshot,
            capacityPoolStorage:
                convertToBytes(capacityPoolStorageWithoutSnapshotSize, capacityPoolStorageWithoutSnapshotUnit) || 0,
            capacityMonthlyCost: capacityMonthlyCostWithoutSnapshot,
            totalMonthlyCostForCapacity: totalMonthlyCostForCapacityWithoutSnapshot,
            totalMonthlyStorageCharge,
            minFileSystemsNumForStorage,
            minFileSystemsNumForThroughputCapacity: minFileSystemsForThroughputCapacity,
            minFileSystemsNumForSsdIops,
            requiredNumOfFsxFractional,
            requiredNumOfFsx,
            minThroughputCapacityRequired,
            provisionedThroughputCapacity,
            totalMonthlyFsxnThroughputCapacityCost,
            includedSsdIops,
            additionalSsdIops,
            billedAdditionalSsdIops,
            additionalBilledCostForSsdIops,
            totalThroughputAndIopsMonthly,
            fsxnIopsPrice: FSXnIOPSPrice
        },
        fsxOntapSnapshotCalculation: {
            fsxnSsdPrice: { price: fsxnSsdPrice, unit: fsxnSsdPriceUnit },
            fsxnCapacityPrice: { price: fsxnCapacityPrice, unit: fsxnCapacityPriceUnit },

            desiredStorageCapacity:
                convertToBytes(desiredSnapshotStorageCapacityGBSize, desiredSnapshotStorageCapacityGBUnit) || 0,
            percentageOfDataOnSsdStorage: dataOnSSDStoragePercentage,
            savingsFromCompressionAndDeduplication,
            storageSavingsFromCompressionAndDeduplication:
                convertToBytes(
                    storageSavingsFromCompressionAndDeduplicationSize,
                    storageSavingsFromCompressionAndDeduplicationUnit
                ) || 0,
            effectiveFsxnStorageCapacity:
                convertToBytes(
                    effectiveStorageCapacityForFSxForONTAPSize,
                    effectiveStorageCapacityForFSxForONTAPUnit
                ) || 0,
            ssdStoragePerMonth: convertToBytes(ssdStorageGBPerMonthSize, ssdStorageGBPerMonthUnit) || 0,
            ssdMonthlyCost,
            totalSnapshotMonthlyCostForFsxSsd,
            ratioAfterSavings,
            dataOnCapacityPoolStorageFactor: snapshotDataOnCapacityPoolStorageFactor,
            capacityPoolStorage: convertToBytes(capacityPoolStorageSize, capacityPoolStorageUnit) || 0,
            capacityMonthlyCost,
            totalMonthlyCostForCapacity,
            totalSnapshotMonthlyCost
        },
        fsxCloneCalculation: {
            monthlyChangeRatePercentage: params.monthlyChangeRatePercentage,
            clonedCopiesCount: params.clonedCopiesCount,
            changeRateBetweenClones,
            totalFsxnCapacity: convertToBytes(totalSsdStorageGBPerMonthSize, totalSsdStorageGBPerMonthUnit) || 0,
            fsxnSsdPrice: { price: fsxnSsdClonePrice, unit: fsxnSsdClonePriceUnit },
            desiredStorageCapacity:
                convertToBytes(cloneDesiredStorageCapacityGB, cloneDesiredStorageCapacityGBUnit) || 0,
            percentageOfDataOnSsdStorage: percentageOfDataOnSSDStorageClone,
            savingsFromCompressionAndDeduplication: savingsFromCompressionAndDeduplicationClone,
            storageSavingsFromCompressionAndDeduplication:
                convertToBytes(
                    cloneStorageSavingsFromCompressionAndDeduplication,
                    cloneStorageSavingsFromCompressionAndDeduplicationUnit
                ) || 0,
            effectiveFsxnStorageCapacity:
                convertToBytes(
                    cloneEffectiveStorageCapacityForFSxForONTAP,
                    cloneEffectiveStorageCapacityForFSxForONTAPUnit
                ) || 0,
            ssdStoragePerMonth: convertToBytes(cloneSSDStorageGBPerMonth, cloneSSDStorageGBPerMonthUnit) || 0,
            ssdMonthlyCost: SSDMonthlyCost,
            totalCloneMonthlyCost
        }
    };
}

function formatEbsCalculationObject(
    ebsSummary: StorageSummary,
    ebsCostCalculationObject: EbsCostCalculation,
    clonedCopiesCount: number,
    monthlyChangeRatePercentage: number
) {
    const { capacity, iops, throughput } = ebsSummary;

    const {
        instanceAvgDuration,
        EBSCapacityPrice: { price: ebsCapacityPrice, unit: ebsCapacityPriceUnit },
        numberOfVolumes: ebsNumberOfVolumes,
        storageAmount: { size: storageAmountSize, unit: storageAmountUnit } = {}, // in case of marketing API manual mode
        storageAmountPerVol: { size: storageAmountSizeAutoMode, unit: storageAmountUnitAutoMode } = {}, // in case of marketing API auto mode
        totalInstanceHours,
        EBSInstanceMonth: ebsInstanceMonth,
        EBSStorageCost: ebsStorageCost,
        billableIops,
        totalBillableIops,
        EBSIopsCost: ebsIopsCost,
        billableMBps: billableMbps,
        billableThroughputMBps: billableThroughputMbps,
        billableThroughputGBps: billableThroughputGbps,
        EBSThroughputCost: ebsThroughputCost,
        totalSnapshot: totalSnapshots,
        // Per-volume snapshot chain (`monthlyCostPerSnapshot`, `discountForPartialStorageMonth`,
        // `incrementalSnapshotCost`) is intentionally not destructured — derived below from
        // `amountChangedPerSnapshot` × `ebsSnapshotPrice` (GH-9225 follow-up).
        AWSEBSTotalCostMonthly: ebsTotalCostMonthly,
        ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: ebsSnapshotPriceUnit },
        amountChangedPerSnapshot: { size: amountChangedPerSnapshotSize, unit: amountChangedPerSnapshotUnit }
    } = ebsCostCalculationObject;

    // Detect mode by presence (not truthiness) so a valid `size: 0` from manual mode still routes
    // through the manual branch instead of falling through to auto mode.
    const usesTotalStorageAmount = storageAmountSize !== undefined && storageAmountUnit !== undefined;
    // Manual mode supplies total storage; auto mode supplies per-volume — roll up so the displayed
    // `storageAmount` is always across-all-volumes-in-class (bytes).
    const ebsStorageAmountSize = usesTotalStorageAmount
        ? convertToBytes(storageAmountSize, storageAmountUnit) || 0
        : storageAmountSizeAutoMode !== undefined && storageAmountUnitAutoMode !== undefined
        ? (convertToBytes(storageAmountSizeAutoMode, storageAmountUnitAutoMode) || 0) * ebsNumberOfVolumes
        : 0;

    const ebsCostCalculation = {
        numberOfVolumes: ebsNumberOfVolumes,
        // V2 API gives total duration for all volumes; divide by number of volumes to get avg duration per volume.
        // Guard against 0 volumes (e.g., mock fixtures) to avoid NaN/Infinity propagating to the UI.
        instanceAvgDuration: ebsNumberOfVolumes > 0 ? instanceAvgDuration / ebsNumberOfVolumes : 0,
        hoursInAMonth: HOURS_IN_MONTH, // (365 * 24) / 12
        ebsCapacityPrice: { price: ebsCapacityPrice, unit: ebsCapacityPriceUnit },
        storageAmountPerVol: ebsStorageAmountSize,
        totalInstanceHours,
        ebsInstanceMonth,
        ebsStorageCost,
        billableIops,
        totalBillableIops,
        ebsIopsCost,
        billableMbps,
        billableThroughputMbps,
        billableThroughputGbps,
        ebsThroughputCost,
        ebsTotalCostMonthly
    };
    const ebsCloneCalculation = {
        clonedCopiesCount,
        capacity,
        iops,
        throughput,
        totalCloneMonthlyCost: clonedCopiesCount * (capacity + iops + throughput)
    };

    // GH-9225 follow-up: marketing returns the per-snapshot chain (`amountChangedPerSnapshot`,
    // `monthlyCostPerSnapshot`, `discountForPartialStorageMonth`, `incrementalSnapshotCost`) per
    // volume. Roll up by `ebsNumberOfVolumes` so the displayed values match the UI tooltip math
    // `(monthlyChangeRate / totalSnapshots) × Total storage`. Initial cost stays asymmetric:
    // manual mode = `total × price` (already all-volumes); auto mode scales by
    // `instanceMonthsPerVolume = ebsInstanceMonth / numberOfVolumes` (= prior `perVol × ebsInstanceMonth`).
    const amountChangedPerSnapshotPerVolume =
        convertToBytes(amountChangedPerSnapshotSize, amountChangedPerSnapshotUnit) || 0;
    const amountChangedPerSnapshotForAllVolumes = amountChangedPerSnapshotPerVolume * ebsNumberOfVolumes;
    const monthlyCostPerSnapshotForAllVolumes =
        sizeInGigaBytes(amountChangedPerSnapshotForAllVolumes, 'B') * ebsSnapshotPrice;
    const discountForPartialStorageMonthForAllVolumes = monthlyCostPerSnapshotForAllVolumes * 0.5;
    const incrementalSnapshotCostForAllVolumesPerInstanceMonth =
        discountForPartialStorageMonthForAllVolumes * totalSnapshots;

    const instanceMonthsPerVolume = ebsNumberOfVolumes > 0 ? ebsInstanceMonth / ebsNumberOfVolumes : 0;
    const initialSnapshotCostPerVolumeOrTotal = sizeInGigaBytes(ebsStorageAmountSize, 'B') * ebsSnapshotPrice;
    const initialSnapshotCostForAllVolumes = usesTotalStorageAmount
        ? initialSnapshotCostPerVolumeOrTotal
        : initialSnapshotCostPerVolumeOrTotal * instanceMonthsPerVolume;
    const incrementalSnapshotCostForPeriod =
        incrementalSnapshotCostForAllVolumesPerInstanceMonth * instanceMonthsPerVolume;
    const totalSnapshotCostForAllVolumes = initialSnapshotCostForAllVolumes + incrementalSnapshotCostForPeriod;

    const ebsSnapshotCalculation = {
        storageAmount: ebsStorageAmountSize,
        numberOfVolumes: ebsNumberOfVolumes,
        ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: ebsSnapshotPriceUnit },
        amountChangedPerSnapshot: amountChangedPerSnapshotForAllVolumes,
        monthlyCostOfSnapshots: monthlyCostPerSnapshotForAllVolumes,
        monthlyChangeRatePercentage,
        ebsInstanceMonth,
        totalSnapshots,
        initialSnapshotCost: initialSnapshotCostForAllVolumes,
        monthlyCostPerSnapshot: monthlyCostPerSnapshotForAllVolumes,
        discountForPartialStorageMonth: discountForPartialStorageMonthForAllVolumes,
        // Return the period-scaled incremental cost (not the per-instance-month figure) so the UI
        // tooltip identity holds: `totalSnapshotCost === initialSnapshotCost + incrementalSnapshotCost`.
        incrementalSnapshotCost: incrementalSnapshotCostForPeriod,
        totalSnapshotCost: totalSnapshotCostForAllVolumes,
        // Same value — `instanceMonthsPerVolume` is already folded into `incrementalSnapshotCostForPeriod`.
        totalEbsSnapshotCost: totalSnapshotCostForAllVolumes,
        ebsSnapshotCost: totalSnapshotCostForAllVolumes
    };

    return {
        ebsCostCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation
    };
}

function deriveFsxCostCalculation(
    fsxwSummary: StorageSummary,
    fsxwCostCalculations: FsxwCostCalculation,
    clonedCopiesCount: number,
    monthlyChangeRatePercentage: number
) {
    logger.info('Deriving FSx cost calculation', {
        fsxwSummary,
        fsxwCostCalculations,
        clonedCopiesCount,
        monthlyChangeRatePercentage
    });

    const { capacity, iops, throughput } = fsxwSummary;

    const fsxwCalculationBreakdown = formatFsxwCalculationObject(fsxwSummary, fsxwCostCalculations);
    const fsxwCloneCalculation = {
        clonedCopiesCount,
        capacity,
        iops,
        throughput,
        totalCloneMonthlyCost: clonedCopiesCount * (capacity + iops + throughput)
    };

    const {
        desiredSnapshotStorageCapacity: {
            size: desiredSnapshotStorageCapacitySize,
            unit: desiredSnapshotStorageCapacityUnit
        },
        storageSavingSnapshot: { size: storageSavingSnapshotSize, unit: storageSavingSnapshotUnit },
        effectiveProvisionedStorageCapacityForFsxwSnapshot: {
            size: effProvStorageCapacityForFsxwSnapshotSize,
            unit: effProvStorageCapacityForFsxwSnapshotUnit
        },
        monthlyCostForFsxwSnapshotStorageCapacity,
        totalMonthlyCostForFsxwSnapshotStorageCapacity
    } = fsxwCostCalculations;

    const fsxwSnapshotCalculation = {
        desiredSnapshotStorageCapacity:
            convertToBytes(desiredSnapshotStorageCapacitySize, desiredSnapshotStorageCapacityUnit) || 0,
        storageSavingSnapshot: convertToBytes(storageSavingSnapshotSize, storageSavingSnapshotUnit) || 0,
        provisionedStorageCapacityForFsxwSnapshot:
            convertToBytes(effProvStorageCapacityForFsxwSnapshotSize, effProvStorageCapacityForFsxwSnapshotUnit) || 0,
        monthlyCostForFsxwSnapshotStorageCapacity,
        totalMonthlyCostForFsxwSnapshotStorageCapacity
    };

    return {
        fsxwCalculation: fsxwCalculationBreakdown,
        fsxwCloneCalculation,
        fsxwSnapshotCalculation
    };
}

/* eslint-disable camelcase */
interface MarketingApiResponse {
    ebsClassification?: {
        gp2?: {
            ebs: StorageSummary;
            ebs_cost_calculation: EbsCostCalculation;
        };
        gp3?: {
            ebs: StorageSummary;
            ebs_cost_calculation: EbsCostCalculation;
        };
        io1?: {
            ebs: StorageSummary;
            ebs_cost_calculation: EbsCostCalculation;
        };
        io2?: {
            ebs: StorageSummary;
            ebs_cost_calculation: EbsCostCalculation;
        };
        st1?: {
            ebs: StorageSummary;
            ebs_cost_calculation: EbsCostCalculation;
        };
    };
    ebs?: StorageSummary;
    fsx?: any;
    single?: FsxCostCalculations;
    multi?: FsxCostCalculations;
    fsxw?: StorageSummary;
    fsxOptimized?: any;
    fsxOptimizedSingle?: FsxCostCalculations;
}

function getMonthlyCloneCountFromFrequency(cloneRefreshFrequency: string) {
    const cloneRefreshFrequencyLowerCase = cloneRefreshFrequency.toLowerCase();
    return cloneRefreshFrequencyLowerCase === 'daily' ? 30 : cloneRefreshFrequencyLowerCase === 'weekly' ? 3 : 1;
}

/**
 * Builds the automatic-mode marketing request body. `marketingApiDeploymentType` is the workload-specific
 * deployment label used only to set `deploymentType` to Multi vs Single for the storage marketing service:
 * Multi when SQL Server is `SQL_AOAG_SHORT` or Oracle is `DG`; otherwise Single (including Oracle `Standalone`).
 */
function getMarketingApiRequestBody(
    ebsVolumeIds: string[],
    params: AutomaticModeStorageSavingsMarketingParams,
    marketingApiDeploymentType: string,
    fileSystemsIds?: string[]
) {
    const { snapshotFrequency, cloneRefreshFrequency, clonedCopiesCount, monthlyChangeRatePercentage } = params || {};

    if (fileSystemsIds && fileSystemsIds.length > 0) {
        return {
            useCase: 'Low-latency',
            fileSystemsIds,
            snapshotFreq: snapshotFrequency,
            cloneEnvs: clonedCopiesCount,
            monthlyChangeRate: monthlyChangeRatePercentage
        };
    }

    const monthlyCloneCount = getMonthlyCloneCountFromFrequency(cloneRefreshFrequency!);
    return {
        useCase: 'Low-latency',
        volumeIds: ebsVolumeIds,
        includeSnapshots: false,
        deploymentType:
            marketingApiDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT ||
            marketingApiDeploymentType === ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG
                ? 'Multi'
                : 'Single',
        snapshots: {
            snapshotFreq: snapshotFrequency,
            snapshotPercentageChange: monthlyChangeRatePercentage
        },
        clones: {
            monthlyCloneNumber: clonedCopiesCount > 0 ? monthlyCloneCount : 0,
            changeRate: monthlyChangeRatePercentage,
            numberOfCloneEnvs: clonedCopiesCount > 0 ? clonedCopiesCount : 0,
            ssdStorage: 100,
            savings: 0
        }
    };
}

/**
 * Calls the storage marketing API for automatic-mode savings. `marketingApiDeploymentType` is not SQL-Server–specific:
 * pass the same deployment label used elsewhere for that workload (e.g. SQL Server `SqlServerDeploymentModel` values,
 * or Oracle `DG` / `Standalone` for Data Guard vs single instance). See `getMarketingApiRequestBody` for Multi/Single mapping.
 */
async function invokeMarketingApi(
    accountId: string,
    credentialsId: string,
    region: string,
    marketingApiDeploymentType: string,
    ebsVolumeIds: string[],
    params: AutomaticModeStorageSavingsMarketingParams,
    instanceIds?: string[],
    fileSystemsIds?: string[]
): Promise<MarketingApiResponse> {
    // Here getting the instances and volume details from the storage service and using that to retrieve the correct calculations for demo
    if (IS_DEMO_FLOW) {
        // Setting to default region as us-east-1 to make the call to storage service, where we have the instance and volume details for demo
        // The SQL server instances list in our  application and the instances list in storage service application are different.
        // We are using manual API in demo for automatic mode as well as it gives us more room to play around with volume sizes to suit our demo workflows, this gives us flexibility by not mandating us to retrieve the same volumes IDs as associated with instances in storage application; that way storage service also wouldnt have to maintain a list specific to our requirements

        const { clonedCopiesCount, monthlyChangeRatePercentage, snapshotFrequency } = params;
        region = STORAGE_SERVICE_DEFAULT_REGION;

        if (fileSystemsIds && fileSystemsIds.length > 0) {
            return fsxwAutomaticDemoModeCallingManualApi(
                region,
                clonedCopiesCount,
                marketingApiDeploymentType,
                monthlyChangeRatePercentage,
                accountId,
                snapshotFrequency
            );
        }
        return ebsAutomaticDemoModeCallingManualApi(
            marketingApiDeploymentType,
            instanceIds,
            region,
            clonedCopiesCount,
            monthlyChangeRatePercentage,
            accountId,
            snapshotFrequency
        );
    }

    const { gp2, gp3, io1, io2, st1, fsx, ebs, single, multi, fsxw, fsx_optimized, fsx_optimized_single } =
        await getStorageSavings(
            accountId,
            credentialsId,
            region,
            getMarketingApiRequestBody(
                ebsVolumeIds,
                params,
                marketingApiDeploymentType,
                fileSystemsIds
            ) as AutomaticModeMarketingRequestBody
        );

    return {
        ebsClassification: { gp2, gp3, io1, io2, st1 },
        ebs,
        fsx,
        single,
        multi,
        fsxw,
        fsxOptimizedSingle: fsx_optimized_single,
        fsxOptimized: fsx_optimized
    };
}

export {
    formatEbsCalculationObject,
    formatFsxwCalculationObject,
    derivePropertiesBasedOnDeploymentType,
    deriveFsxCostCalculation,
    invokeMarketingApi,
    getMarketingApiRequestBody
};

export type { MarketingApiResponse };
