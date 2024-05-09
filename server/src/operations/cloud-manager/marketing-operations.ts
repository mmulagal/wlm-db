import createError from 'http-errors';
import { compact } from 'lodash-es';
import { getHostAndSqlServerInfo } from '../discover-operations';
import { HttpErrorCodes } from '../../utils/consts';
import getLogger from '../../utils/logger';
import getStorageSavings from '../../lib/cloud-manager/marketing';
import { StorageSavingsRequestBodyType, StorageSavingsResponseType } from '../../routes/types/storage-savings.types';
import { camelizeKeys, convertToBytes } from '../../utils/utils';

const logger = getLogger();

function getMarketingApiRequestBody(ebsVolumeIds: string[], params: StorageSavingsRequestBodyType) {
    const { snapshotFrequency, clonedCopiesCount, cloneRefreshFrequency, monthlyChangeRatePercentage } = params || {};

    const snapshotFrequencyLowerCase = snapshotFrequency.toLowerCase();
    const cloneRefreshFrequencyLowerCase = cloneRefreshFrequency.toLowerCase();

    return {
        useCase: 'Backup Data',
        volumeIds: ebsVolumeIds,
        includeSnapshots: true,
        deploymentType: 'Single',
        snapshots: {
            snapshotFreq: snapshotFrequencyLowerCase,
            snapshotPercentageChange: monthlyChangeRatePercentage
        },
        clones: {
            monthlyCloneNumber: clonedCopiesCount,
            changeRate: monthlyChangeRatePercentage,
            numberOfCloneEnvs:
                cloneRefreshFrequencyLowerCase === 'daily' ? 30 : cloneRefreshFrequencyLowerCase === 'weekly' ? 4 : 1,
            ssdStorage: 100,
            savings: 0
        }
    };
}

async function performStorageSavingsCalculations(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    params: StorageSavingsRequestBodyType
): Promise<StorageSavingsResponseType> {
    logger.info('Performing storage savings calculations ', { accountId, credentialsId, region, instanceId, params });

    const {
        items: [ec2HostDetails]
    } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [instanceId]);

    const sqlServerInstances = ec2HostDetails?.sqlServerInstances;
    const ebsVolumeIds = compact(
        sqlServerInstances
            ?.filter(({ storage }) => storage?.find(sqlStorage => sqlStorage.type === 'EBS'))
            .map(({ storage }) => storage?.find(sqlStorage => sqlStorage.type === 'EBS')?.id)
    );

    if (!ebsVolumeIds.length) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No EBS volumes found for the provided instance: ${instanceId}`);
    }
    const {
        ebs,
        fsx,
        fsx_calculation: fsxCalculationData
    } = await getStorageSavings(accountId, credentialsId, region, getMarketingApiRequestBody(ebsVolumeIds, params));
    const fsxCalculationObject = camelizeKeys(fsxCalculationData);

    const { totalStorageCapacity, effectiveCapacity, ssdTierReqCapacity, capacityPoolTier, monthlySnapshotCapacity } =
        fsxCalculationObject;
    const capacities = [
        { totalStorageCapacity },
        { effectiveCapacity },
        { ssdTierReqCapacity },
        { capacityPoolTier },
        { monthlySnapshotCapacity }
    ];

    capacities.forEach(capacity => {
        const [key] = Object.keys(capacity);
        const { size, unit } = (capacity as any)[key] as { size: number; unit: string };
        fsxCalculationObject[`${key}`] = convertToBytes(size, unit);
    });

    return {
        ebs,
        fsx,
        fsxCalculation: fsxCalculationObject
    };
}

async function getStorageSavingsCalculationMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    params: StorageSavingsRequestBodyType
) {
    logger.info('Getting storage savings calculation metrics ', {
        accountId,
        credentialsId,
        region,
        instanceId,
        params
    });

    const {
        items: [ec2HostDetails]
    } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [instanceId]);

    const sqlServerInstances = ec2HostDetails?.sqlServerInstances;
    const ebsVolumeIds = compact(
        sqlServerInstances
            ?.filter(({ storage }) => storage?.find(sqlStorage => sqlStorage.type === 'EBS'))
            .map(({ storage }) => storage?.find(sqlStorage => sqlStorage.type === 'EBS')?.id)
    );

    const {
        fsx_cost_calculation_no_snapshot: {
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
            ratioAfterSavings: ratioAfterSavingsWithohutSnapshot,
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
            totalThroughputIOPSRequestsChargeMonthly: totalThroughputAndIopsMonthly
        },
        fsx_snapshot_cost_calculation: {
            desiredStorageCapacityGB: { size: desiredStorageCapacitySize, unit: desiredStorageCapacityUnit },
            percentageOfDataOnSSDStorage: percentageOfDataOnSsdStorage,
            savingsFromCompressionAndDeduplication,
            storageSavingsFromCompressionAndDeduplication: {
                size: storageSavingsFromCompressionAndDeduplicationSize,
                unit: storageSavingsFromCompressionAndDeduplicationUnit
            },
            effectiveStorageCapacityForFSxForONTAP: {
                size: effectiveStorageCapacityForFSxForONTAPSize,
                unit: effectiveStorageCapacityForFSxForONTAPUnit
            },
            SSDStorageGBPerMonth: { size: ssdStorageGBPerMonthSize, unit: ssdStorageGBPerMonthUnit },
            SSDMonthlyCost: ssdMonthlyCost,
            totalMonthlyCostForFSxSSD: totalMonthlyCostForFsxSsd,
            ratioAfterSavings,
            dataOnCapacityPoolStorageFactor,
            capacityPoolStorage: { size: capacityPoolStorageSize, unit: capacityPoolStorageUnit },
            capacityMonthlyCost,
            totalMonthlyCostForCapacity
        },
        ebs_cost_calculation: {
            storageAmountPerVol: { size: storageAmountPerVolSize, unit: storageAmountPerVolUnit },
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
            initialSnapshotCost,
            monthlyCostPerSnapshot,
            discountForPartialStorageMonth,
            incrementalSnapshotCost,
            totalSnapshotCost,
            totalEBSSnapshotCost: totalEbsSnapshotCost,
            ebsSnapshotCost
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
            SSDCloneStorageGBPerMonth: { size: cloneSSDStorageGBPerMonth, unit: cloneSSDStorageGBPerMonthUnit },
            SSDMonthlyCost,
            totalCloneMonthlyCost
        }
    } = await getStorageSavings(accountId, credentialsId, region, getMarketingApiRequestBody(ebsVolumeIds, params));
    return {
        fsxOntapCalculation: {
            desiredStorageCapacity: convertToBytes(ebsCapacity, ebsCapacityUnit) || 0,
            percentageOfDataOnSsdStorage: percentageDataSsdStorage,
            savingsFromCompressionAndDeduplication: savingsCd,
            storageSavingsFromCompressionAndDeduplication: convertToBytes(ssCDSize, ssCDUnit) || 0,
            effectiveFsxnStorageCapacity: convertToBytes(effStorageCapacityFsxn, effStorageCapacityFsxnUnit) || 0,
            ssdStoragePerMonth:
                convertToBytes(ssdStorageGBPerMonthSizeWithoutSnapshot, ssdStorageGBPerMonthUnitWithoutSnapshot) || 0,
            greaterOfSsdAndMinAllowedSsd: convertToBytes(effectiveFSXnSSDSize, effectiveFSXnSSDUnit) || 0,
            ssdMonthlyCost: ssdMonthlyCostWithoutSnapshot,
            totalMonthlyCostForFSxSsd: totalMonthlyCostForFSxSsdWithoutSnapshot,
            ratioAfterSavings: ratioAfterSavingsWithohutSnapshot,
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
            totalThroughputAndIopsMonthly
        },
        fsxOntapSnapshotCalculation: {
            desiredStorageCapacity: convertToBytes(desiredStorageCapacitySize, desiredStorageCapacityUnit) || 0,
            percentageOfDataOnSsdStorage,
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
            totalMonthlyCostForFsxSsd,
            ratioAfterSavings,
            dataOnCapacityPoolStorageFactor,
            capacityPoolStorage: convertToBytes(capacityPoolStorageSize, capacityPoolStorageUnit) || 0,
            capacityMonthlyCost,
            totalMonthlyCostForCapacity
        },
        ebsCalculation: {
            storageAmountPerVol: convertToBytes(storageAmountPerVolSize, storageAmountPerVolUnit) || 0,
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
            totalSnapshots,
            initialSnapshotCost,
            monthlyCostPerSnapshot,
            discountForPartialStorageMonth,
            incrementalSnapshotCost,
            totalSnapshotCost,
            totalEbsSnapshotCost,
            ebsSnapshotCost
        },
        fsxCloneCalculation: {
            cloneRefreshFrequency: params.cloneRefreshFrequency,
            monthlyChangeRatePercentage: params.monthlyChangeRatePercentage,
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

export { performStorageSavingsCalculations, getStorageSavingsCalculationMetrics, getMarketingApiRequestBody };
