import { compact, isEmpty } from 'lodash-es';
import {
    SqlServerDeploymentModel,
    HOURS_IN_MONTH,
    STORAGE_SERVICE_DEFAULT_REGION,
    DEMO_STANADLONE_INSTANCE_ID
} from '../../utils/consts';
import getLogger from '../../utils/logger';
import { getManualModeStorageSavings, getStorageSavings } from '../../lib/cloud-manager/marketing';
import {
    EbsCloneCalculationType,
    EbsCostCalculationType,
    EbsSnapshotCalculationType,
    ManualStorageSavingsRequestBodyType,
    StorageSavingsCalculationsMetricsType,
    StorageSavingsRequestBodyType
} from '../../routes/types/storage-savings.types';
import { camelizeKeys, convertToBytes, sizeInGigaBytes } from '../../utils/utils';
import {
    AutomaticModeMarketingRequestBody,
    EbsCostCalculation,
    FsxCalculation,
    FsxCostCalculations,
    FsxwCostCalculation,
    InstanceEbsData,
    ManualModeComparisionResponse,
    ManualModeEbsComparisonResponse,
    ManualModeFsxwComparisonResponse,
    ManualModeMarketingRequestBody,
    StorageSummary
} from '../../utils/marketing-types';

const logger = getLogger();

/* eslint-disable camelcase */

function getMonthlyCloneCountFromFrequency(cloneRefreshFrequency: string) {
    const cloneRefreshFrequencyLowerCase = cloneRefreshFrequency.toLowerCase();
    return cloneRefreshFrequencyLowerCase === 'daily' ? 30 : cloneRefreshFrequencyLowerCase === 'weekly' ? 3 : 1;
}

function getMarketingApiRequestBody(
    ebsVolumeIds: string[],
    params: StorageSavingsRequestBodyType,
    sqlServerDeploymentType: string,
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

function hasDuplicateVolumeType(volumes: any[]) {
    const volumeTypes = volumes.map((volume: { volumeType: string }) => volume.volumeType);
    const uniqueVolumeTypes = new Set(volumeTypes);
    return volumeTypes.length > uniqueVolumeTypes.size;
}

function isMultiAzDeployment(sqlServerDeploymentType: string) {
    return [SqlServerDeploymentModel.SQL_AOAG_SHORT, SqlServerDeploymentModel.SQL_FCI_SHORT].includes(
        sqlServerDeploymentType as SqlServerDeploymentModel
    );
}

function getMarketingApiManualModeRequestBody(region: string, params: ManualStorageSavingsRequestBodyType) {
    logger.info('Handling marketing manual mode request body', params);

    const { snapshotFrequency, sqlServerDeploymentType, clonedCopiesCount, monthlyChangeRatePercentage, ec2Instances } =
        params || {};

    const instancesObject = compact(
        ec2Instances?.map(instance => {
            const { ec2InstanceDescription, isPrimary, volumes } = instance;

            if (volumes) {
                // volumes is sent only in case of EBS
                if (hasDuplicateVolumeType(volumes)) {
                    throw new Error('Duplicate volume types are not allowed');
                }

                const volumeArray = volumes.map(volume => {
                    const { volumeType, volumeNumber, storageAmount, volumeIops, throughput } = volume;
                    return {
                        volumeType,
                        volumeNumber,
                        storageAmount: {
                            size: sizeInGigaBytes(storageAmount, 'B') * volumeNumber, // As per GROGU-5182 , marketing API expects total storage amount for all volumes
                            unit: 'GiB'
                        },
                        volumeIops: volumeIops && volumeIops > 0 ? volumeIops : 0,
                        throughput: throughput && throughput > 0 ? throughput : 0
                    };
                });

                return {
                    instanceName: ec2InstanceDescription,
                    isPrimary,
                    volumes: volumeArray
                };
            }
            return null;
        })
    );

    const fsxObject = compact(
        ec2Instances?.map(instance => {
            const { fsxw } = instance;
            if (fsxw) {
                const { storageAmount, deploymentType, volumeIops, throughput, storageVolumeType } = fsxw;
                return {
                    useCase: 'Low-latency',
                    region,
                    deploymentType: deploymentType === 'Single' ? 'Single' : 'Multi',
                    storageAmount: {
                        size: sizeInGigaBytes(storageAmount, 'B'),
                        unit: 'GiB'
                    },
                    iops: volumeIops,
                    throughput,
                    storageVolumeType,
                    snapshotFreq: snapshotFrequency,
                    deduplicationSavings: 0,
                    cloneEnvs: clonedCopiesCount,
                    monthlyChangeRate: monthlyChangeRatePercentage
                };
            }
            return null;
        })
    );

    if (fsxObject.length) {
        return fsxObject[0];
    }

    return {
        useCase: 'Low-latency',
        region,
        deploymentType: isMultiAzDeployment(sqlServerDeploymentType) ? 'Multi' : 'Single',
        snapshots: {
            snapshotFreq: snapshotFrequency,
            snapshotPercentageChange: snapshotFrequency === 'NoSnapShotStorage' ? 0 : monthlyChangeRatePercentage
        },
        clones: {
            changeRate: monthlyChangeRatePercentage,
            cloneEnvs: clonedCopiesCount > 0 ? clonedCopiesCount : 0
        },
        instances: instancesObject
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
    params: StorageSavingsRequestBodyType,
    instanceId?: string,
    fileSystemsIds?: string[]
) {
    // Here getting the instances and volume details from the storage service and using that to retrieve the correct calculations for demo
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        // Setting to default region as us-east-1 to make the call to storage service, where we have the instance and volume details for demo

        const { clonedCopiesCount, monthlyChangeRatePercentage } = params;
        region = STORAGE_SERVICE_DEFAULT_REGION;

        if (fileSystemsIds && fileSystemsIds.length > 0) {
            const marketingRequestBody = getMarketingApiManualModeRequestBody(region, {
                clonedCopiesCount,
                sqlServerDeploymentType,
                monthlyChangeRatePercentage,
                snapshotFrequency: 'Daily',
                sqlServerEdition: 'Enterprise',
                ec2Instances: [
                    {
                        ec2InstanceDescription: 'Primary',
                        ec2InstanceType: 'm5.large',
                        isPrimary: true,
                        fsxw: {
                            storageAmount: 640000000000,
                            deploymentType: 'Multi',
                            volumeIops: 600,
                            throughput: 32,
                            storageVolumeType: 'SSD'
                        }
                    }
                ]
            }) as ManualModeMarketingRequestBody;

            const {
                fsxw,
                fsx,
                fsx_calculation,
                fsxw_cost_calculation,
                fsx_cost_calculation_no_snapshot,
                fsx_snapshot_cost_calculation,
                fsx_clone_cost_calculation
            } = await getManualModeStorageSavings<ManualModeFsxwComparisonResponse>(accountId, marketingRequestBody);

            return {
                fsxw,
                fsx,
                [sqlServerDeploymentType === 'FCI' ? 'multi' : 'single']: {
                    fsxw_cost_calculation,
                    fsx_calculation,
                    fsx_cost_calculation_no_snapshot,
                    fsx_snapshot_cost_calculation,
                    fsx_clone_cost_calculation
                }
            };
        }

        let volumes = [
            {
                volumeType: 'io2',
                volumeNumber: 2,
                storageAmount: convertToBytes(1024 * 2, 'GiB') || 0,
                volumeIops: 40000,
                throughput: 128
            }
        ];
        if (
            sqlServerDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT &&
            instanceId === DEMO_STANADLONE_INSTANCE_ID
        ) {
            volumes = [
                {
                    volumeType: 'io2',
                    volumeNumber: 1,
                    storageAmount: convertToBytes(1024 * 2, 'GiB') || 0,
                    volumeIops: 40000,
                    throughput: 128
                },
                {
                    volumeType: 'io1',
                    volumeNumber: 1,
                    storageAmount: convertToBytes(1024 * 2, 'GiB') || 0,
                    volumeIops: 40000,
                    throughput: 128
                }
            ];
        }

        if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
            volumes = [
                {
                    volumeType: 'io2',
                    volumeNumber: 2,
                    storageAmount: convertToBytes(1024 * 10, 'GiB') || 0,
                    volumeIops: 40000,
                    throughput: 128
                }
            ];
        }

        const marketingRequestBody = getMarketingApiManualModeRequestBody(region, {
            clonedCopiesCount,
            sqlServerDeploymentType,
            monthlyChangeRatePercentage,
            snapshotFrequency: 'Daily',
            sqlServerEdition: 'Enterprise',
            ec2Instances: [
                {
                    ec2InstanceDescription: 'Primary',
                    ec2InstanceType: 'm5.4xlarge',
                    isPrimary: true,
                    volumes
                }
            ]
        }) as ManualModeMarketingRequestBody;

        const { ebsTotal, instanceEbs, fsx, single, multi } =
            await getManualModeStorageSavings<ManualModeEbsComparisonResponse>(accountId, marketingRequestBody);

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
    const { gp2, gp3, io1, io2, st1, fsx, ebs, single, multi, fsxw } = await getStorageSavings(
        accountId,
        credentialsId,
        region,
        getMarketingApiRequestBody(
            ebsVolumeIds,
            params,
            sqlServerDeploymentType,
            fileSystemsIds
        ) as AutomaticModeMarketingRequestBody
    );

    return {
        ebsClassification: { gp2, gp3, io1, io2, st1 },
        ebs,
        fsx,
        single,
        multi,
        fsxw
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

    const ebsStorageAmountSize =
        storageAmountSize && storageAmountUnit
            ? convertToBytes(storageAmountSize, storageAmountUnit) || 0
            : storageAmountSizeAutoMode && storageAmountUnitAutoMode
            ? convertToBytes(storageAmountSizeAutoMode, storageAmountUnitAutoMode) || 0
            : 0;

    const ebsCostCalculation = {
        numberOfVolumes: ebsNumberOfVolumes,
        instanceAvgDuration,
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

    const amountChangedPerSnapshot = convertToBytes(amountChangedPerSnapshotSize, amountChangedPerSnapshotUnit) || 0;

    const ebsSnapshotCalculation = {
        storageAmount: ebsStorageAmountSize * ebsNumberOfVolumes,
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
    params: StorageSavingsRequestBodyType
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

async function formatStorageSavingsCalculationMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    ebsVolumeIds: string[],
    params: StorageSavingsRequestBodyType,
    sqlServerDeploymentType: string,
    instanceId?: string,
    fileSystemsIds?: string[]
): Promise<StorageSavingsCalculationsMetricsType> {
    logger.debug('Formatting storage savings calculation metrics', {
        accountId,
        credentialsId,
        region,
        ebsVolumeIds,
        params,
        instanceId
    });

    const {
        ebsClassification: { gp2, gp3, io1, st1, io2 } = {},
        ebs,
        single,
        multi,
        fsxw
    } = await invokeMarketingApi(
        accountId,
        credentialsId,
        region,
        sqlServerDeploymentType,
        ebsVolumeIds,
        params,
        instanceId,
        fileSystemsIds
    );

    if (fileSystemsIds && fileSystemsIds.length > 0) {
        const fsxwCostCalculation = single?.fsxw_cost_calculation || multi?.fsxw_cost_calculation;
        let fsxwCalculation;
        let fsxwCloneCalculation;
        let fsxwSnapshotCalculation;
        if (fsxw && fsxwCostCalculation) {
            ({ fsxwCalculation, fsxwCloneCalculation, fsxwSnapshotCalculation } = deriveFsxCostCalculation(
                fsxw,
                fsxwCostCalculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            ));
        }
        return {
            ...(single && { single: derivePropertiesBasedOnDeploymentType(single, params) }),
            ...(multi && { multi: derivePropertiesBasedOnDeploymentType(multi, params) }),
            fsxwCalculation,
            fsxwCloneCalculation,
            fsxwSnapshotCalculation
        };
    }

    const ebsCalculationBreakdown = {
        ...(gp2 && {
            gp2: formatEbsCalculationObject(
                gp2.ebs,
                gp2.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(gp3 && {
            gp3: formatEbsCalculationObject(
                gp3.ebs,
                gp3.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(io1 && {
            io1: formatEbsCalculationObject(
                io1.ebs,
                io1.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(io2 && {
            io2: formatEbsCalculationObject(
                io2.ebs,
                io2.ebs_cost_calculation,
                params.clonedCopiesCount,
                params.monthlyChangeRatePercentage
            )
        }),
        ...(st1 && {
            st1: formatEbsCalculationObject(
                st1.ebs,
                st1.ebs_cost_calculation,
                params.clonedCopiesCount,
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

// InstanceEbsData is the response from marketing API for the manual mode. This contains ebs volume level breakdown per disk type at each instance level. However, we would like to aggregate the data from all instances to derive storage related metrics (snapshots and clones are from primary instance only)
// Map volumes function is used to collect ebsCostCalculation at each disk type from all instances
function mapVolumes(
    instanceEbs: InstanceEbsData[],
    volumeTypes: string[],
    clonedCopiesCount: number,
    monthlyChangeRatePercentage: number
) {
    logger.info('Mapping volumes from manual mode response', {
        instanceEbs,
        volumeTypes,
        clonedCopiesCount,
        monthlyChangeRatePercentage
    });

    const volumesCalculationsList: VolumeCalculationObject = {
        gp2: [],
        gp3: [],
        io2: [],
        st1: [],
        io1: []
    };

    instanceEbs.forEach((instance: InstanceEbsData) => {
        volumeTypes.forEach((volumeType: string) => {
            const instanceVolumeTypeData = instance[volumeType as keyof InstanceEbsData] as any;
            if (instanceVolumeTypeData) {
                volumesCalculationsList[volumeType as keyof VolumeCalculationObject].push(
                    formatEbsCalculationObject(
                        instanceVolumeTypeData.ebs as StorageSummary,
                        instanceVolumeTypeData.ebs_cost_calculation as EbsCostCalculation,
                        clonedCopiesCount,
                        monthlyChangeRatePercentage
                    ).ebsCostCalculation
                );
            }
        });
    });

    return volumesCalculationsList;
}

// Once we have the list of ebsCostCalculation for each disk type from all instances, we aggregate the data to derive the total cost for each disk type
function aggregateData(volumeList: EbsCostCalculationType[]): EbsCostCalculationType {
    const excludedKeys = ['instanceAvgDuration', 'hoursInAMonth', 'ebsCapacityPrice']; // these are static values and should not be aggregated
    const aggregatedData: { [key: string]: any } = {};
    volumeList.forEach((item: any) => {
        for (const key in item) {
            if (!excludedKeys.includes(key)) {
                aggregatedData[key] = (aggregatedData[key] || 0) + item[key];
            } else {
                aggregatedData[key] = item[key];
            }
        }
    });
    return aggregatedData as EbsCostCalculationType;
}

interface VolumeCalculationObject {
    gp2: EbsCostCalculationType[];
    gp3: EbsCostCalculationType[];
    io1: EbsCostCalculationType[];
    io2: EbsCostCalculationType[];
    st1: EbsCostCalculationType[];
}

// Snapshot and clone calculations are derived from primary instance only.
async function derivePrimaryInstanceEbsCostCalculation(
    instanceEbs: InstanceEbsData[],
    clonedCopiesCount: number,
    monthlyChangeRatePercentage: number
) {
    logger.info('Deriving primary instance EBS cost calculation', {
        instanceEbs,
        clonedCopiesCount,
        monthlyChangeRatePercentage
    });

    const primaryInstance = instanceEbs.find(instance => instance.isPrimary);

    const { gp2, gp3, io1, io2, st1 } = primaryInstance || {};
    const ebsCalculationBreakdown = {
        ...(gp2 && {
            gp2: formatEbsCalculationObject(
                gp2.ebs,
                gp2.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        }),
        ...(gp3 && {
            gp3: formatEbsCalculationObject(
                gp3.ebs,
                gp3.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        }),
        ...(io1 && {
            io1: formatEbsCalculationObject(
                io1.ebs,
                io1.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        }),
        ...(io2 && {
            io2: formatEbsCalculationObject(
                io2.ebs,
                io2.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
            )
        }),
        ...(st1 && {
            st1: formatEbsCalculationObject(
                st1.ebs,
                st1.ebs_cost_calculation,
                clonedCopiesCount,
                monthlyChangeRatePercentage
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

async function formatManualStorageSavingsCalculationMetrics(
    accountId: string,
    region: string,
    params: ManualStorageSavingsRequestBodyType
) {
    logger.info('Formatting manual storage savings calculation metrics', { accountId, region, params });

    const marketingRequestBody = getMarketingApiManualModeRequestBody(region, params) as ManualModeMarketingRequestBody;

    const resp = await getManualModeStorageSavings<ManualModeComparisionResponse>(accountId, marketingRequestBody);

    if (marketingRequestBody.instances) {
        const { instanceEbs, single, multi, ebsTotal } = resp as ManualModeEbsComparisonResponse;
        const { ebsSnapshotCalculation, ebsCloneCalculation } = await derivePrimaryInstanceEbsCostCalculation(
            instanceEbs,
            params.clonedCopiesCount,
            params.monthlyChangeRatePercentage
        );

        const volumeTypes = ['gp2', 'gp3', 'io2', 'st1', 'io1'];
        const volumesList = mapVolumes(
            instanceEbs,
            volumeTypes,
            params.clonedCopiesCount,
            params.monthlyChangeRatePercentage
        );

        const { gp2, gp3, io2, st1, io1 } = volumesList;

        const allVolumesEbsCalculation = {
            ...(!isEmpty(gp2) && { gp2: aggregateData(gp2) }),
            ...(!isEmpty(gp3) && { gp3: aggregateData(gp3) }),
            ...(!isEmpty(io2) && { io2: aggregateData(io2) }),
            ...(!isEmpty(st1) && { st1: aggregateData(st1) }),
            ...(!isEmpty(io1) && { io1: aggregateData(io1) })
        };

        const reqObject = {
            clonedCopiesCount: params.clonedCopiesCount,
            monthlyChangeRatePercentage: params.monthlyChangeRatePercentage,
            snapshotFrequency: params.snapshotFrequency
        };

        return {
            ...(single && { single: derivePropertiesBasedOnDeploymentType(single, reqObject) }),
            ...(multi && { multi: derivePropertiesBasedOnDeploymentType(multi, reqObject) }),
            ebs: ebsTotal,
            ebsCalculation: allVolumesEbsCalculation,
            ebsCloneCalculation,
            ebsSnapshotCalculation
        };
    }

    const {
        fsxw,
        fsxw_cost_calculation,
        fsx_cost_calculation_no_snapshot,
        fsx_snapshot_cost_calculation,
        fsx_calculation,
        fsx_clone_cost_calculation
    } = resp as ManualModeFsxwComparisonResponse;
    const { fsxwCalculation, fsxwCloneCalculation, fsxwSnapshotCalculation } = deriveFsxCostCalculation(
        fsxw,
        fsxw_cost_calculation,
        params.clonedCopiesCount,
        params.monthlyChangeRatePercentage
    );

    const depType = params.ec2Instances[0].fsxw?.deploymentType || 'single';

    logger.info('DEPTYPE', depType);

    return {
        ...(depType.toLowerCase() === 'single' && {
            single: derivePropertiesBasedOnDeploymentType(
                {
                    fsx_calculation,
                    fsx_cost_calculation_no_snapshot,
                    fsx_snapshot_cost_calculation,
                    fsx_clone_cost_calculation
                },
                params
            )
        }),
        ...(depType.toLowerCase() === 'multi' && {
            multi: derivePropertiesBasedOnDeploymentType(
                {
                    fsx_calculation,
                    fsx_cost_calculation_no_snapshot,
                    fsx_snapshot_cost_calculation,
                    fsx_clone_cost_calculation
                },
                params
            )
        }),
        fsxwCalculation,
        fsxwCloneCalculation,
        fsxwSnapshotCalculation
    };
}
export {
    invokeMarketingApi,
    handleMarketingApiFsxCalculationObject,
    formatStorageSavingsCalculationMetrics,
    getMarketingApiRequestBody,
    getMarketingApiManualModeRequestBody,
    formatManualStorageSavingsCalculationMetrics,
    derivePropertiesBasedOnDeploymentType
};
