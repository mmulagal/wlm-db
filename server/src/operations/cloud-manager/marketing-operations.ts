import { SqlServerDeploymentModel, HOURS_IN_MONTH, STORAGE_SERVICE_DEFAULT_REGION } from '../../utils/consts';
import getLogger from '../../utils/logger';
import {
    StorageSummary,
    EbsCostCalculation,
    ManualModeMarketingRequestBody,
    getManualModeStorageSavings,
    getStorageSavings,
    FsxCostCalculations,
    FsxCalculation
} from '../../lib/cloud-manager/marketing';
import {
    EbsCloneCalculationType,
    EbsCostCalculationType,
    EbsSnapshotCalculationType,
    StorageSavingsRequestBodyType
} from '../../routes/types/storage-savings.types';
import { camelizeKeys, convertToBytes, sizeInGigaBytes } from '../../utils/utils';

const logger = getLogger();

/* eslint-disable camelcase */

function getMonthlyCloneCountFromFrequency(cloneRefreshFrequency: string) {
    const cloneRefreshFrequencyLowerCase = cloneRefreshFrequency.toLowerCase();
    return cloneRefreshFrequencyLowerCase === 'daily' ? 30 : cloneRefreshFrequencyLowerCase === 'weekly' ? 3 : 1;
}

function getMarketingApiRequestBody(
    ebsVolumeIds: string[],
    params: StorageSavingsRequestBodyType,
    sqlServerDeploymentType: string
) {
    const { snapshotFrequency, clonedCopiesCount, cloneRefreshFrequency, monthlyChangeRatePercentage } = params || {};

    const monthlyCloneCount = getMonthlyCloneCountFromFrequency(cloneRefreshFrequency);
    return {
        useCase: 'Low-latency',
        volumeIds: ebsVolumeIds,
        includeSnapshots: false,
        deploymentType: sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT ? 'Multi' : 'Single',
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

function getMarketingApiManualModeRequestBody(
    region: string,
    params: StorageSavingsRequestBodyType,
    sqlServerDeploymentType: string,
    items: { volumeType: string; volumeNumber: number; storageAmount: number; volumeIops: number; throughput: number }[]
) {
    const { snapshotFrequency, clonedCopiesCount, monthlyChangeRatePercentage } = params || {};

    return {
        useCase: 'Low-latency',
        region,
        deploymentType: sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT ? 'Multi' : 'Single',
        snapshots: {
            snapshotFreq: snapshotFrequency,
            snapshotPercentageChange: monthlyChangeRatePercentage
        },
        clones: {
            changeRate: monthlyChangeRatePercentage,
            cloneEnvs: clonedCopiesCount > 0 ? clonedCopiesCount : 0
        },
        instances: [
            {
                instanceName: undefined,
                isPrimary: true,
                volumes: items.map(volume => {
                    const { volumeType, volumeNumber, storageAmount, volumeIops, throughput } = volume;
                    return {
                        volumeType,
                        volumeNumber,
                        storageAmount: {
                            size: storageAmount,
                            unit: 'GiB'
                        },
                        volumeIops,
                        throughput
                    };
                })
            }
        ]
    };
}

function handleMarketingApiFsxCalculationObject(fsxCalculationData: FsxCalculation) {
    logger.debug('Handling marketing FSx calculation object', fsxCalculationData);
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

    return fsxCalculationObject;
}

async function invokeMarketingApi(
    accountId: string,
    credentialsId: string,
    region: string,
    sqlServerDeploymentType: string,
    ebsVolumeIds: string[],
    params: StorageSavingsRequestBodyType
) {
    // Here getting the instances and volume details from the storage service and using that to retrieve the correct calculations for demo
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        // Setting to default region as us-east-1 to make the call to storage service, where we have the instance and volume details for demo
        region = STORAGE_SERVICE_DEFAULT_REGION;
        let volumes = [
            { volumeType: 'io2', volumeNumber: 2, storageAmount: 1024 * 2, volumeIops: 40000, throughput: 128 }
        ];
        if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
            volumes = [
                { volumeType: 'io2', volumeNumber: 2, storageAmount: 1024 * 10, volumeIops: 40000, throughput: 128 }
            ];
        }
        const requestBody = getMarketingApiManualModeRequestBody(
            region,
            params,
            sqlServerDeploymentType,
            volumes
        ) as ManualModeMarketingRequestBody;
        const { ebsTotal, instanceEbs, fsx, single, multi } = await getManualModeStorageSavings(accountId, requestBody);

        return {
            ebs: ebsTotal,
            ebsClassification: instanceEbs[0],
            fsx,
            ...(sqlServerDeploymentType !== SqlServerDeploymentModel.SQL_AOAG_SHORT && {
                single
            }),
            ...(sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT && {
                multi
            })
        };
    }
    const { gp2, gp3, io1, io2, st1, fsx, ebs, single, multi } = await getStorageSavings(
        accountId,
        credentialsId,
        region,
        getMarketingApiRequestBody(ebsVolumeIds, params, sqlServerDeploymentType)
    );

    return {
        ebsClassification: { gp2, gp3, io1, io2, st1 },
        ebs,
        fsx,
        single,
        multi
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
        ebsSnapshotCost,
        AWSEBSTotalCostMonthly: ebsTotalCostMonthly,
        ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: ebsSnapshotPriceUnit },
        amountChangedPerSnapshot: { size: amountChangedPerSnapshotSize, unit: amountChangedPerSnapshotUnit }
    } = ebsCostCalculationObject;

    const ebsCostCalculation = {
        numberOfVolumes: ebsNumberOfVolumes,
        instanceAvgDuration,
        hoursInAMonth: HOURS_IN_MONTH, // (365 * 24) / 12
        ebsCapacityPrice: { price: ebsCapacityPrice, unit: ebsCapacityPriceUnit },
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
        ebsTotalCostMonthly
    };
    const ebsCloneCalculation = {
        clonedCopiesCount,
        capacity,
        iops,
        throughput,
        totalCloneMonthlyCost: clonedCopiesCount * (capacity + iops + throughput)
    };

    const storageAmountOfEbs = convertToBytes(storageAmountPerVolSize, storageAmountPerVolUnit) || 0;
    const amountChangedPerSnapshot = convertToBytes(amountChangedPerSnapshotSize, amountChangedPerSnapshotUnit) || 0;

    const ebsSnapshotCalculation = {
        storageAmount: storageAmountOfEbs * ebsNumberOfVolumes,
        numberOfVolumes: ebsNumberOfVolumes,
        ebsSnapshotPrice: { price: ebsSnapshotPrice, unit: ebsSnapshotPriceUnit },
        amountChangedPerSnapshot,
        monthlyCostOfSnapshots: sizeInGigaBytes(amountChangedPerSnapshot, 'B') * ebsSnapshotPrice,
        monthlyChangeRatePercentage,
        ebsInstanceMonth,
        totalSnapshots,
        initialSnapshotCost,
        monthlyCostPerSnapshot,
        discountForPartialStorageMonth,
        incrementalSnapshotCost,
        totalSnapshotCost,
        totalEbsSnapshotCost,
        ebsSnapshotCost
    };

    return {
        ebsCostCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation
    };
}

function derivePropertiesBasedOnDeploymentType(
    fsxCostCalculations: FsxCostCalculations,
    params: StorageSavingsRequestBodyType
) {
    const {
        fsx_cost_calculation_no_snapshot: {
            desiredStorageCapacityGB: { size: desiredStorageCapacitySize, unit: desiredStorageCapacityUnit },
            numberOfVolumes,
            FSXnCapacityPrice: { price: fsxnCapacityPriceWithoutSnapshot, unit: fsxnCapacityUnitWithoutSnapshot },
            percentageOfDataOnSSDStorage,
            maxSSDTierSizeGB: { size: maxSsdTierSize, unit: maxSsdTierSizeUnit },
            throughputCapacity: suggestedFsxnThroughputCapacity,
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
            totalCloneMonthlyCost
        }
    } = fsxCostCalculations;

    const totalMonthlyClonedCopiesCount =
        params.clonedCopiesCount > 0 ? getMonthlyCloneCountFromFrequency(params.cloneRefreshFrequency) : 0;

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
            cloneRefreshFrequency: params.cloneRefreshFrequency,
            monthlyChangeRatePercentage: params.monthlyChangeRatePercentage,
            clonedCopiesCount: params.clonedCopiesCount,
            changeRateBetweenClones:
                totalMonthlyClonedCopiesCount > 0
                    ? params.monthlyChangeRatePercentage / totalMonthlyClonedCopiesCount
                    : 0,
            totalFsxnCapacity: convertToBytes(totalSsdStorageGBPerMonthSize, totalSsdStorageGBPerMonthUnit) || 0,
            numberOfClonesInAMonth: totalMonthlyClonedCopiesCount,
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
async function formatStorageSavingsCalculationMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    ebsVolumeIds: string[],
    params: StorageSavingsRequestBodyType,
    sqlServerDeploymentType: string
) {
    logger.debug('Formatting storage savings calculation metrics', {
        accountId,
        credentialsId,
        region,
        ebsVolumeIds,
        params
    });

    const {
        ebsClassification: { gp2, gp3, io1, st1, io2 } = {},
        ebs,
        single,
        multi
    } = await invokeMarketingApi(accountId, credentialsId, region, sqlServerDeploymentType, ebsVolumeIds, params);

    const totalMonthlyClonedCopiesCount =
        params.clonedCopiesCount > 0 ? getMonthlyCloneCountFromFrequency(params.cloneRefreshFrequency) : 0;

    const ebsCalculationBreakdown = {
        ...(gp2 && {
            gp2: formatEbsCalculationObject(
                gp2.ebs,
                gp2.ebs_cost_calculation,
                totalMonthlyClonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(gp3 && {
            gp3: formatEbsCalculationObject(
                gp3.ebs,
                gp3.ebs_cost_calculation,
                totalMonthlyClonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(io1 && {
            io1: formatEbsCalculationObject(
                io1.ebs,
                io1.ebs_cost_calculation,
                totalMonthlyClonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(io2 && {
            io2: formatEbsCalculationObject(
                io2.ebs,
                io2.ebs_cost_calculation,
                totalMonthlyClonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(st1 && {
            st1: formatEbsCalculationObject(
                st1.ebs,
                st1.ebs_cost_calculation,
                totalMonthlyClonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        })
    };

    const ebsCalculation: { [key: string]: EbsCostCalculationType } = {};
    const ebsCloneCalculation: { [key: string]: EbsCloneCalculationType } = {};
    const ebsSnapshotCalculation: { [key: string]: EbsSnapshotCalculationType } = {};
    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        ebsCalculation[key] = value.ebsCostCalculation;
    });

    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        ebsCloneCalculation[key] = value.ebsCloneCalculation;
    });

    Object.entries(ebsCalculationBreakdown).forEach(([key, value]) => {
        ebsSnapshotCalculation[key] = value.ebsSnapshotCalculation;
    });

    return {
        ...(single && { single: derivePropertiesBasedOnDeploymentType(single, params) }),
        ...(multi && { multi: derivePropertiesBasedOnDeploymentType(multi, params) }),
        ebs,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation
    };
}

export {
    invokeMarketingApi,
    handleMarketingApiFsxCalculationObject,
    formatStorageSavingsCalculationMetrics,
    getMarketingApiRequestBody,
    getMarketingApiManualModeRequestBody
};
