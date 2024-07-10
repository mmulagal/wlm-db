import { Static, Type } from '@fastify/type-provider-typebox';
import { CredentialsIdParams } from './generic.types';
import { FINDING } from '../../utils/consts';

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
    computeMonthlyPrice: Type.Optional(Type.Number()),
    windowsOsVersion: Type.Optional(Type.String()),
    finding: Type.Optional(
        Type.String({ enum: [FINDING.OPTIMIZED, FINDING.NOT_OPTIMIZED, FINDING.INSUFFICIENT_DATA] })
    ),
    message: Type.Optional(Type.String())
});

const StorageSavingsLicense = Type.Object({
    sqlServerEdition: Type.Optional(Type.String()),
    licenseMonthlyPrice: Type.Optional(Type.Number()),
    finding: Type.Optional(
        Type.String({ enum: [FINDING.OPTIMIZED, FINDING.NOT_OPTIMIZED, FINDING.INSUFFICIENT_DATA] })
    ),
    message: Type.Optional(Type.String())
});

const fsxCalculationData = Type.Object({
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
    }),
    fsxBreakdown: Type.Object({
        fsxDataLunSize: Type.Number(),
        fsxDataVolumeSize: Type.Number(),
        fsxLogVolumeSize: Type.Number(),
        fsxTempDbVolumeSize: Type.Number(),
        fsxQuorumVolumeSize: Type.Number(),
        fsxBufferVolumeSize: Type.Number(),
        fsxStorageCapacity: Type.Number()
    })
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
    single: fsxCalculationData,
    multi: fsxCalculationData
});

const PriceUnitObject = Type.Object({
    price: Type.Number(),
    unit: Type.String()
});

const ComputeCalculationObject = Type.Object({
    instanceType: Type.String(),
    computeHourlyPrice: Type.Optional(Type.Number()),
    instanceHourlyPrice: Type.Optional(Type.Number()),
    hoursInMonth: Type.Number(),
    instanceMonthlyPrice: Type.Optional(Type.Number()),
    computeMonthlyPrice: Type.Optional(Type.Number())
});
const LicenseCalculationObject = Type.Object({
    sqlServerEdition: Type.Optional(Type.String()),
    licenseHourlyPrice: Type.Optional(Type.Number()),
    licenseIncluded: Type.Optional(Type.Boolean()),
    hoursInMonth: Type.Number()
});
const ebsCostCalculation = Type.Object({
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
});
const ebsCloneCalculation = Type.Object({
    clonedCopiesCount: Type.Number(),
    capacity: Type.Number(),
    iops: Type.Number(),
    throughput: Type.Number(),
    totalCloneMonthlyCost: Type.Number()
});
const ebsSnapshotCalculation = Type.Object({
    ebsInstanceMonth: Type.Number(),
    totalSnapshots: Type.Number(),
    initialSnapshotCost: Type.Number(),
    monthlyCostPerSnapshot: Type.Number(),
    discountForPartialStorageMonth: Type.Number(),
    incrementalSnapshotCost: Type.Number(),
    totalSnapshotCost: Type.Number(),
    totalEbsSnapshotCost: Type.Number(),
    ebsSnapshotCost: Type.Number()
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
    // ebsCalculation: Type.Array(Type.Mapped(Type.Union([Type.Optional(Type.Literal('gp2')),Type.Literal('gp3'),Type.Optional(Type.Literal('io1')),Type.Optional(Type.Literal('io2'))]), () =>
    //     ebsCostCalculation
    // )),
    // ebsCloneCalculation: Type.Array(Type.Mapped(Type.Union([Type.String()]), () => ebsCloneCalculation)),
    // ebsSnapshotCalculation: Type.Array(Type.Mapped(Type.Union([Type.String()]), () => ebsSnapshotCalculation)),
    ebsCalculation: Type.Array(
        Type.Object({
            gp2: Type.Optional(ebsCostCalculation),
            gp3: Type.Optional(ebsCostCalculation),
            io1: Type.Optional(ebsCostCalculation),
            io2: Type.Optional(ebsCostCalculation),
            st1: Type.Optional(ebsCostCalculation)
        })
    ),
    ebsCloneCalculation: Type.Array(
        Type.Object({
            gp2: Type.Optional(ebsCloneCalculation),
            gp3: Type.Optional(ebsCloneCalculation),
            io1: Type.Optional(ebsCloneCalculation),
            io2: Type.Optional(ebsCloneCalculation),
            st1: Type.Optional(ebsCloneCalculation)
        })
    ),
    ebsSnapshotCalculation: Type.Array(
        Type.Object({
            gp2: Type.Optional(ebsSnapshotCalculation),
            gp3: Type.Optional(ebsSnapshotCalculation),
            io1: Type.Optional(ebsSnapshotCalculation),
            io2: Type.Optional(ebsSnapshotCalculation),
            st1: Type.Optional(ebsSnapshotCalculation)
        })
    ),
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
    })
});

type StorageSavingsResponseType = Static<typeof StorageSavingsResponse>;
type StorageSavingsRequestBodyType = Static<typeof StorageSavingsRequestBody>;

const ComputeDetails = Type.Object({
    instanceType: Type.String(),
    windowsOsVersion: Type.Optional(Type.String()),
    computeHourlyPrice: Type.Optional(Type.Number()),
    instanceHourlyPrice: Type.Optional(Type.Number()),
    computeMonthlyPrice: Type.Optional(Type.Number()),
    instanceMonthlyPrice: Type.Optional(Type.Number()),
    hoursInMonth: Type.Number(),
    message: Type.Optional(Type.String()),
    finding: Type.Optional(Type.String())
});

const LicenseDetails = Type.Object({
    sqlServerEdition: Type.Optional(Type.String()),
    licenseHourlyPrice: Type.Optional(Type.Number()),
    licenseIncluded: Type.Optional(Type.Boolean()),
    licenseMonthlyPrice: Type.Optional(Type.Number()),
    hoursInMonth: Type.Number(),
    message: Type.Optional(Type.String()),
    finding: Type.Optional(Type.String())
});

const Compute = Type.Object({
    existing: ComputeDetails,
    recommended: ComputeDetails
});

const License = Type.Object({
    existing: LicenseDetails,
    recommended: LicenseDetails
});

const ComputeLicenseCost = Type.Object({
    ec2InstanceId: Type.String(),
    ec2InstanceType: Type.String(),
    compute: Compute,
    license: License
});

type ComputeLicenseCostType = Static<typeof ComputeLicenseCost>;

type StorageSavingsMetricsCalculationsResponseType = Static<typeof StorageSavingsCalculationsMetricsResponse>;
export {
    StorageSavingsRequestParams,
    StorageSavingsRequestBody,
    StorageSavingsRequestBodyType,
    StorageSavingsResponse,
    StorageSavingsResponseType,
    StorageSavingsCalculationsMetricsResponse,
    StorageSavingsMetricsCalculationsResponseType,
    ComputeLicenseCostType
};
