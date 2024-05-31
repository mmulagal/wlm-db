import { Static, Type } from '@fastify/type-provider-typebox';
import { CredentialsIdParams } from './generic.types';

const StorageSavingsRequestParams = Type.Composite([
    CredentialsIdParams,
    Type.Object({
        instanceId: Type.String()
    })
]);

const StorageSavingsRequestBody = Type.Object({
    snapshotFrequency: Type.String({
        enum: ['NoSnapShotStorage', 'Hourly', 'Daily', 'Weekly', 'Monthly', '2xDaily', '3xDaily', '4xDaily', '6xDaily']
    }),
    clonedCopiesCount: Type.Number({
        minimum: 0
    }),
    cloneRefreshFrequency: Type.String({ enum: ['Daily', 'Weekly', 'Monthly'] }),
    monthlyChangeRatePercentage: Type.Number({
        minimum: 0,
        maximum: 100
    })
});

const StorageMetrics = Type.Object({
    capacity: Type.Number(),
    iops: Type.Number(),
    throughput: Type.Number(),
    snapshots: Type.Number(),
    clones: Type.Number(),
    total: Type.Number()
});

const StorageSavingsCompute = Type.Object({
    instanceType: Type.String(),
    computeMonthlyPrice: Type.Optional(Type.Number())
});

const StorageSavingsLicense = Type.Object({
    licenseType: Type.String(),
    licenseMonthlyPrice: Type.Optional(Type.Number())
});
const StorageSavingsResponse = Type.Object({
    compute: Type.Object({ existing: StorageSavingsCompute, recommended: StorageSavingsCompute }),
    license: Type.Object({ existing: StorageSavingsLicense, recommended: StorageSavingsLicense }),
    ebs: StorageMetrics,
    fsx: StorageMetrics,
    totalSummary: Type.Object({
        existing: Type.Number(),
        recommended: Type.Number()
    }),
    fsxCalculation: Type.Object({
        deploymentType: Type.String(),
        numberOfVolumes: Type.Number(),
        throughput: Type.Number(),
        totalStorageCapacity: Type.Number(),
        percentageSsd: Type.Number(),
        savings: Type.Number(),
        effectiveCapacity: Type.Number(),
        ssdTierReqCapacity: Type.Number(),
        capacityPoolTier: Type.Number(),
        ssdIop: Type.Number(),
        throughputCapacity: Type.Number(),
        useCase: Type.String(),
        regionName: Type.String(),
        monthlySnapshotCapacity: Type.Number()
    })
});

const PriceUnitObject = Type.Object({
    price: Type.Number(),
    unit: Type.String()
});

const ComputeCalculationObject = Type.Object({
    instanceType: Type.String(),
    computeHourlyPrice: Type.Optional(Type.Number()),
    instanceHourlyPrice: Type.Optional(Type.Number()),
    hoursInAMonth: Type.Number(),
    instanceMonthlyPrice: Type.Number()
});
const LicenseCalculationObject = Type.Object({
    sqlServerEdition: Type.String(),
    licenseType: Type.String(),
    licenseHourlyPrice: Type.Optional(Type.Number()),
    licenseIncluded: Type.Optional(Type.Boolean())
});
const StorageSavingsCalculationsMetricsResponse = Type.Object({
    recommendedComputeCalculation: Type.Array(ComputeCalculationObject),
    recommendedLicenseCalculation: Type.Array(LicenseCalculationObject),
    existingComputeCalculation: Type.Array(ComputeCalculationObject),
    existingLicenseCalculation: Type.Array(LicenseCalculationObject),
    fsxOntapCalculation: Type.Object({
        numberOfVolumes: Type.Number(),
        percentageOfDataOnSSDStorage: Type.Number(),
        fsxnCapacityPrice: PriceUnitObject,
        maxSsdTierSize: Type.Number(),
        suggestedFsxnThroughputCapacity: Type.Number(),
        maxThroughput: Type.Number(),
        fsxnThroughputPrice: Type.Number(),
        fsxnIopsPrice: Type.Number(),
        provisionedSsdIops: Type.Number(),
        includedIops: Type.Number(),
        maxSsdIops: Type.Number(),
        fsxnStoragePrice: PriceUnitObject,
        desiredStorageCapacity: Type.Number(),
        ebsCapacity: Type.Number(),
        percentageOfDataOnSsdStorage: Type.Number(),
        savingsFromCompressionAndDeduplication: Type.Number(),
        storageSavingsFromCompressionAndDeduplication: Type.Number(),
        effectiveFsxnStorageCapacity: Type.Number(),
        ssdStoragePerMonth: Type.Number(),
        greaterOfSsdAndMinAllowedSsd: Type.Number(),
        ssdMonthlyCost: Type.Number(),
        totalMonthlyCostForFSxSsd: Type.Number(),
        ratioAfterSavings: Type.Number(),
        dataOnCapacityPoolStorageFactor: Type.Number(),
        capacityPoolStorage: Type.Number(),
        capacityMonthlyCost: Type.Number(),
        totalMonthlyCostForCapacity: Type.Number(),
        totalMonthlyStorageCharge: Type.Number(),
        minFileSystemsNumForStorage: Type.Number(),
        minFileSystemsNumForThroughputCapacity: Type.Number(),
        minFileSystemsNumForSsdIops: Type.Number(),
        requiredNumOfFsxFractional: Type.Number(),
        requiredNumOfFsx: Type.Number(),
        minThroughputCapacityRequired: Type.Number(),
        provisionedThroughputCapacity: Type.Number(),
        totalMonthlyFsxnThroughputCapacityCost: Type.Number(),
        includedSsdIops: Type.Number(),
        additionalSsdIops: Type.Number(),
        billedAdditionalSsdIops: Type.Number(),
        additionalBilledCostForSsdIops: Type.Number(),
        totalThroughputAndIopsMonthly: Type.Number()
    }),
    fsxOntapSnapshotCalculation: Type.Object({
        fsxnSsdPrice: PriceUnitObject,
        fsxnCapacityPrice: PriceUnitObject,
        desiredStorageCapacity: Type.Number(),
        percentageOfDataOnSsdStorage: Type.Number(),
        savingsFromCompressionAndDeduplication: Type.Number(),
        storageSavingsFromCompressionAndDeduplication: Type.Number(),
        effectiveFsxnStorageCapacity: Type.Number(),
        ssdStoragePerMonth: Type.Number(),
        ssdMonthlyCost: Type.Number(),
        totalSnapshotMonthlyCostForFsxSsd: Type.Number(),
        ratioAfterSavings: Type.Number(),
        dataOnCapacityPoolStorageFactor: Type.Number(),
        capacityPoolStorage: Type.Number(),
        capacityMonthlyCost: Type.Number(),
        totalMonthlyCostForCapacity: Type.Number(),
        totalSnapshotMonthlyCost: Type.Number()
    }),
    ebsCalculation: Type.Object({
        numberOfVolumes: Type.Number(),
        instanceAvgDuration: Type.Number(),
        hoursInAMonth: Type.Number(),
        ebsCapacityPrice: PriceUnitObject,
        storageAmountPerVol: Type.Number(),
        totalInstanceHours: Type.Number(),
        ebsInstanceMonth: Type.Number(),
        ebsStorageCost: Type.Number(),
        billableIops: Type.Number(),
        totalBillableIops: Type.Number(),
        ebsIopsCost: Type.Number(),
        billableMbps: Type.Number(),
        billableThroughputMbps: Type.Number(),
        billableThroughputGbps: Type.Number(),
        ebsThroughputCost: Type.Number(),
        ebsTotalCostMonthly: Type.Number()
    }),
    fsxCloneCalculation: Type.Object({
        clonedCopiesCount: Type.Number(),
        numberOfClonesInAMonth: Type.Number(),
        changeRateBetweenClones: Type.Number(),
        totalFsxnCapacity: Type.Number(),
        fsxnSsdPrice: PriceUnitObject,
        cloneRefreshFrequency: Type.String(),
        monthlyChangeRatePercentage: Type.Number(),
        desiredStorageCapacity: Type.Number(),
        percentageOfDataOnSsdStorage: Type.Number(),
        savingsFromCompressionAndDeduplication: Type.Number(),
        storageSavingsFromCompressionAndDeduplication: Type.Number(),
        effectiveFsxnStorageCapacity: Type.Number(),
        ssdStoragePerMonth: Type.Number(),
        ssdMonthlyCost: Type.Number(),
        totalCloneMonthlyCost: Type.Number()
    }),
    ebsCloneCalculation: Type.Object({
        clonedCopiesCount: Type.Number(),
        capacity: Type.Number(),
        iops: Type.Number(),
        throughput: Type.Number(),
        totalCloneMonthlyCost: Type.Number()
    }),
    ebsSnapshotCalculation: Type.Object({
        ebsInstanceMonth: Type.Number(),
        totalSnapshots: Type.Number(),
        initialSnapshotCost: Type.Number(),
        monthlyCostPerSnapshot: Type.Number(),
        discountForPartialStorageMonth: Type.Number(),
        incrementalSnapshotCost: Type.Number(),
        totalSnapshotCost: Type.Number(),
        totalEbsSnapshotCost: Type.Number(),
        ebsSnapshotCost: Type.Number()
    })
});

type StorageSavingsResponseType = Static<typeof StorageSavingsResponse>;
type StorageSavingsRequestBodyType = Static<typeof StorageSavingsRequestBody>;

const ComputeHourlyDetails = Type.Object({
    instanceType: Type.String(),
    computeHourlyPrice: Type.Optional(Type.Number()),
    instanceHourlyPrice: Type.Optional(Type.Number())
});

const LicenseHourlyDetails = Type.Object({
    sqlServerEdition: Type.String(),
    licenseType: Type.String(),
    licenseHourlyPrice: Type.Optional(Type.Number()),
    licenseIncluded: Type.Optional(Type.Boolean())
});

const ComputeHourly = Type.Object({
    existing: ComputeHourlyDetails,
    recommended: ComputeHourlyDetails
});

const LicenseHourly = Type.Object({
    existing: LicenseHourlyDetails,
    recommended: LicenseHourlyDetails
});

const ComputeLicenseHourlyCost = Type.Object({
    ec2InstanceId: Type.String(),
    ec2InstanceType: Type.String(),
    compute: ComputeHourly,
    license: LicenseHourly
});

type ComputeLicenseHourlyCostType = Static<typeof ComputeLicenseHourlyCost>;

type StorageSavingsMetricsCalculationsResponseType = Static<typeof StorageSavingsCalculationsMetricsResponse>;
export {
    StorageSavingsRequestParams,
    StorageSavingsRequestBody,
    StorageSavingsRequestBodyType,
    StorageSavingsResponse,
    StorageSavingsResponseType,
    StorageSavingsCalculationsMetricsResponse,
    StorageSavingsMetricsCalculationsResponseType,
    ComputeLicenseHourlyCostType
};
