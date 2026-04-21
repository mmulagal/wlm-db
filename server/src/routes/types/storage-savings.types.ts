import { Static, Type } from '@fastify/type-provider-typebox';
import { CredentialsIdParams } from './generic.types';
import { FINDING } from '../../utils/consts';

const InternalUpdateInstRecQueryString = Type.Object({
    fields: Type.Optional(Type.String())
});

const StorageSavingsRequestParams = Type.Intersect([
    CredentialsIdParams,
    Type.Object({
        instanceId: Type.String({ description: 'AWS EC2 instance ID' })
    })
]);

const StorageSavingsRequestBody = Type.Object({
    snapshotFrequency: Type.String({
        enum: ['NoSnapShotStorage', 'Hourly', 'Daily', 'Weekly', 'Monthly', '2xDaily', '3xDaily', '4xDaily', '6xDaily']
    }),
    clonedCopiesCount: Type.Number({
        minimum: 0
    }),
    cloneRefreshFrequency: Type.Optional(Type.String({ enum: ['Daily', 'Weekly', 'Monthly'] })), // TODO: to be removed depending as per remove clone frequency input UX
    monthlyChangeRatePercentage: Type.Number({
        minimum: 0,
        maximum: 100
    }),
    monthlySqlByolCost: Type.Optional(Type.Number())
});

/**
 * Shared between MSSQL bulk and Oracle bulk host lists.
 * Minimum 1 host ensures the request targets at least one instance.
 * Maximum 5 hosts keeps bulk estimation requests intentionally small so they remain
 * predictable for API consumers and avoid oversized multi-instance calculations in a
 * single call.
 */
const bulkStorageSavingsHostsArray = { minItems: 1, maxItems: 5, uniqueItems: true } as const;

const Ec2InstanceIdForBulkStorageSavings = Type.String({
    pattern: '^i-[0-9a-f]{8,17}$',
    description: 'AWS EC2 instance IDs'
});

const BulkStorageSavingsHostWithOptionalByol = Type.Object({
    ec2InstanceId: Ec2InstanceIdForBulkStorageSavings,
    monthlySqlByolCost: Type.Optional(Type.Number())
});

const BulkStorageSavingsHostEc2IdOnly = Type.Object({
    ec2InstanceId: Ec2InstanceIdForBulkStorageSavings
});

const BulkStorageSavingsRequestBody = Type.Object({
    ...StorageSavingsRequestBody.properties,
    hosts: Type.Array(BulkStorageSavingsHostWithOptionalByol, bulkStorageSavingsHostsArray)
});

const OracleBulkStorageSavingsRequestBody = Type.Intersect([
    Type.Pick(StorageSavingsRequestBody, ['clonedCopiesCount', 'cloneRefreshFrequency', 'monthlyChangeRatePercentage']),
    // `snapshotFrequency` is optional for Oracle bulk: downstream marketing helpers treat
    // undefined the same as `NoSnapShotStorage` (no snapshot block), so direct API callers
    // can omit it. The UI continues to send a value via its shared default.
    Type.Partial(Type.Pick(StorageSavingsRequestBody, ['snapshotFrequency'])),
    Type.Object({
        hosts: Type.Array(BulkStorageSavingsHostEc2IdOnly, bulkStorageSavingsHostsArray)
    })
]);

const ManualStorageSavingsRequestParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    region: Type.String({ minLength: 1 })
});

const ManualModeInstances = Type.Array(
    Type.Object({
        ec2InstanceDescription: Type.String(),
        ec2InstanceType: Type.String(),
        isPrimary: Type.Boolean(),
        volumes: Type.Optional(
            Type.Array(
                Type.Object({
                    volumeType: Type.String({ enum: ['gp2', 'gp3', 'io1', 'io2', 'st1'] }),
                    volumeNumber: Type.Number({
                        minimum: 1
                    }),
                    storageAmount: Type.Number({
                        minimum: 1024 * 1024 * 1024, // 1 GB
                        maximum: 16 * 1024 * 1024 * 1024 * 1024 // 16 TB
                    }),
                    volumeIops: Type.Optional(
                        Type.Number({
                            minimum: 100,
                            maximum: 256000 // io2 supportes upto 256000 IOPS
                        })
                    ),
                    throughput: Type.Optional(
                        Type.Number({
                            minimum: 125,
                            maximum: 1000
                        })
                    )
                })
            )
        ),
        fsxw: Type.Optional(
            Type.Object({
                deploymentType: Type.String({ enum: ['Single', 'Multi'] }),
                storageVolumeType: Type.String({ enum: ['SSD', 'HDD'] }),
                storageAmount: Type.Number({
                    minimum: 1024 * 1024 * 1024, // 1 GB
                    maximum: 64 * 1024 * 1024 * 1024 * 1024 // 64 TB
                }),
                volumeIops: Type.Number({
                    minimum: 96,
                    maximum: 400000
                }),
                throughput: Type.Number({
                    minimum: 8,
                    maximum: 12288
                })
            })
        )
    })
);

const ManualStorageSavingsRequestBody = Type.Object({
    sqlServerDeploymentType: Type.String(),
    sqlServerEdition: Type.String({
        enum: ['Standard Edition', 'Enterprise Edition', 'Web Edition', 'Express Edition', 'Developer Edition']
    }),
    monthlyChangeRatePercentage: Type.Number({
        minimum: 0,
        maximum: 100
    }),
    snapshotFrequency: Type.String({
        enum: ['NoSnapShotStorage', 'Hourly', 'Daily', 'Weekly', 'Monthly', '2xDaily', '3xDaily', '4xDaily', '6xDaily']
    }),
    clonedCopiesCount: Type.Number({
        minimum: 0
    }),
    monthlySqlByolCost: Type.Optional(Type.Number()),
    ec2Instances: ManualModeInstances
});

const StorageMetrics = Type.Object({
    capacity: Type.Number(),
    iops: Type.Number(),
    throughput: Type.Number(),
    snapshots: Type.Number(),
    clones: Type.Optional(Type.Number()),
    total: Type.Number()
});

const MachinePriceDetails = Type.Array(
    Type.Object({
        instanceType: Type.String(),
        price: Type.Optional(Type.Number()),
        basePrice: Type.Optional(Type.Number()),
        computeMonthlyPrice: Type.Optional(Type.Number()),
        instanceMonthlyPrice: Type.Optional(Type.Number()),
        hoursInMonth: Type.Number(),
        licenseIncluded: Type.Optional(Type.Boolean()),
        licenseMonthlyPrice: Type.Optional(Type.Number())
    })
);

const RecommendationOption = Type.Object({
    instanceType: Type.Optional(Type.String()),
    pricingDetails: Type.Optional(Type.Unknown())
});

const StorageSavingsCompute = Type.Object({
    instanceType: Type.String(),
    computeMonthlyPrice: Type.Optional(Type.Number()),
    windowsOsVersion: Type.Optional(Type.String()),
    finding: Type.Optional(
        Type.String({ enum: [FINDING.OPTIMIZED, FINDING.NOT_OPTIMIZED, FINDING.INSUFFICIENT_DATA] })
    ),
    message: Type.Optional(Type.String()),
    machineDetails: Type.Optional(MachinePriceDetails),
    recommendationOptions: Type.Optional(MachinePriceDetails)
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
        monthlySnapshotCapacity: Type.Number(),
        desiredStorageCapacity: Type.Optional(Type.Number()),
        ebsCapacity: Type.Optional(Type.Number())
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

const StorageSavingsCapacityResponse = Type.Object({
    ebs: Type.Optional(StorageMetrics),
    fsxw: Type.Optional(StorageMetrics),
    fsx: StorageMetrics,
    totalSummary: Type.Object({
        existing: Type.Number(),
        recommended: Type.Number(),
        optimized: Type.Optional(Type.Number())
    }),
    single: Type.Optional(fsxCalculationData),
    multi: Type.Optional(fsxCalculationData),
    fsxOptimizedSingle: Type.Optional(fsxCalculationData),
    fsxOptimized: Type.Optional(StorageMetrics)
});

const additionalParams = {
    hostname: Type.Optional(Type.String()),
    deploymentType: Type.Optional(Type.String()),
    resourceName: Type.Optional(Type.String())
};

const StorageSavingsResponse = Type.Intersect([
    StorageSavingsCapacityResponse,
    Type.Object({
        compute: Type.Object({
            ...additionalParams,
            existing: StorageSavingsCompute,
            recommended: StorageSavingsCompute
        }),
        license: Type.Object({
            ...additionalParams,
            existing: StorageSavingsLicense,
            recommended: StorageSavingsLicense
        })
    })
]);

const BulkStorageSavingsResponse = Type.Intersect([
    StorageSavingsCapacityResponse,
    Type.Object({
        compute: Type.Array(
            Type.Object({
                ...additionalParams,
                existing: StorageSavingsCompute,
                recommended: StorageSavingsCompute
            })
        ),
        license: Type.Array(
            Type.Object({
                ...additionalParams,
                existing: StorageSavingsLicense,
                recommended: StorageSavingsLicense
            })
        )
    })
]);

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
    computeMonthlyPrice: Type.Optional(Type.Number()),
    machineDetails: Type.Optional(MachinePriceDetails),
    recommendationOptions: Type.Optional(Type.Array(RecommendationOption))
});
const LicenseCalculationObject = Type.Object({
    sqlServerEdition: Type.Optional(Type.String()),
    licenseHourlyPrice: Type.Optional(Type.Number()),
    licenseIncluded: Type.Optional(Type.Boolean()),
    hoursInMonth: Type.Number()
});
const EbsCostCalculation = Type.Object({
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
const EbsCloneCalculation = Type.Object({
    clonedCopiesCount: Type.Number(),
    capacity: Type.Number(),
    iops: Type.Number(),
    throughput: Type.Number(),
    totalCloneMonthlyCost: Type.Number()
});
const EbsSnapshotCalculation = Type.Object({
    storageAmount: Type.Number(),
    numberOfVolumes: Type.Number(),
    ebsSnapshotPrice: PriceUnitObject,
    amountChangedPerSnapshot: Type.Number(),
    monthlyCostOfSnapshots: Type.Number(),
    monthlyChangeRatePercentage: Type.Number(),
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

const FsxOntapCalculation = Type.Object({
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
});

const FsxOntapSnapshotCalculation = Type.Object({
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
});

const FsxCloneCalculation = Type.Object({
    clonedCopiesCount: Type.Number(),
    changeRateBetweenClones: Type.Number(),
    totalFsxnCapacity: Type.Number(),
    fsxnSsdPrice: PriceUnitObject,
    monthlyChangeRatePercentage: Type.Number(),
    desiredStorageCapacity: Type.Number(),
    percentageOfDataOnSsdStorage: Type.Number(),
    savingsFromCompressionAndDeduplication: Type.Number(),
    storageSavingsFromCompressionAndDeduplication: Type.Number(),
    effectiveFsxnStorageCapacity: Type.Number(),
    ssdStoragePerMonth: Type.Number(),
    ssdMonthlyCost: Type.Number(),
    totalCloneMonthlyCost: Type.Number()
});

const FsxwCalculationResp = Type.Object({
    storageSavings: Type.Number(),
    provisionedStorageCapacity: Type.Number(),
    desiredStorageCapacity: Type.Number(),
    deduplicationSavings: Type.Number(),
    monthlyCostForStorageCapacity: Type.Number(),
    totalDefaultProvisionedIops: Type.Number(),
    additionalUserProvisionedIops: Type.Number(),
    billedIops: Type.Number(),
    totalMonthlyCostForProvisionedSsdIops: Type.Number(),
    fsxwIopsPrice: Type.Number(),
    numberOfFileSystemsRequiredForStorageCapacity: Type.Number(),
    numberOfFileSystemsRequiredForThroughputCapacity: Type.Number(),
    fsxwMaxThroughput: Type.Number(),
    requiredFractionalFileSystems: Type.Number(),
    requiredFileSystems: Type.Number(),
    minThroughputCapacityRequired: Type.Number(),
    provisionedThroughputCapacity: Type.Number(),
    totalMonthlyCostForThroughputCapacity: Type.Number(),
    totalMonthlyCost: Type.Number(),
    fsxwSsdPrice: Type.Object({
        price: Type.Number(),
        unit: Type.String()
    }),
    fsxwMaxCapacity: Type.Number(),
    throughput: Type.Number(),
    fsxwMinThroughput: Type.Number(),
    fsxwThroughputPrice: Type.Number()
});

const FsxwSnapshotCalculationResp = Type.Object({
    desiredSnapshotStorageCapacity: Type.Number(),
    storageSavingSnapshot: Type.Number(),
    provisionedStorageCapacityForFsxwSnapshot: Type.Number(),
    monthlyCostForFsxwSnapshotStorageCapacity: Type.Number(),
    totalMonthlyCostForFsxwSnapshotStorageCapacity: Type.Number()
});

const FsxwCloneCalculationResp = Type.Object({
    clonedCopiesCount: Type.Number(),
    capacity: Type.Number(),
    iops: Type.Number(),
    throughput: Type.Number(),
    totalCloneMonthlyCost: Type.Number()
});

const FsxCalculationResp = Type.Object({
    fsxOntapCalculation: Type.Optional(FsxOntapCalculation),
    fsxOntapSnapshotCalculation: Type.Optional(FsxOntapSnapshotCalculation),
    fsxCloneCalculation: Type.Optional(FsxCloneCalculation)
});

const EBSCostCalculationResp = Type.Object({
    gp2: Type.Optional(EbsCostCalculation),
    gp3: Type.Optional(EbsCostCalculation),
    io1: Type.Optional(EbsCostCalculation),
    io2: Type.Optional(EbsCostCalculation),
    st1: Type.Optional(EbsCostCalculation)
});

const EBSCloneCostCalculationResp = Type.Object({
    gp2: Type.Optional(EbsCloneCalculation),
    gp3: Type.Optional(EbsCloneCalculation),
    io1: Type.Optional(EbsCloneCalculation),
    io2: Type.Optional(EbsCloneCalculation),
    st1: Type.Optional(EbsCloneCalculation)
});

const EBSSnapshotCalculationResp = Type.Object({
    gp2: Type.Optional(EbsSnapshotCalculation),
    gp3: Type.Optional(EbsSnapshotCalculation),
    io1: Type.Optional(EbsSnapshotCalculation),
    io2: Type.Optional(EbsSnapshotCalculation),
    st1: Type.Optional(EbsSnapshotCalculation)
});

const StorageSavingsCapacityCalculationsMetricsResponse = Type.Object({
    ebsCalculation: Type.Optional(EBSCostCalculationResp),
    ebsCloneCalculation: Type.Optional(EBSCloneCostCalculationResp),
    ebsSnapshotCalculation: Type.Optional(EBSSnapshotCalculationResp),
    single: Type.Optional(FsxCalculationResp),
    multi: Type.Optional(FsxCalculationResp),
    fsxOptimizedSingle: Type.Optional(FsxCalculationResp),
    fsxwCalculation: Type.Optional(FsxwCalculationResp),
    fsxwSnapshotCalculation: Type.Optional(FsxwSnapshotCalculationResp),
    fsxwCloneCalculation: Type.Optional(FsxwCloneCalculationResp),
    totalSummary: Type.Object({
        existing: Type.Number(),
        recommended: Type.Number()
    })
});

const StorageSavingsCalculationsMetricsResponse = Type.Intersect([
    StorageSavingsCapacityCalculationsMetricsResponse,
    Type.Object({
        recommendedComputeCalculation: Type.Intersect([ComputeCalculationObject, Type.Object(additionalParams)]),
        recommendedLicenseCalculation: Type.Intersect([LicenseCalculationObject, Type.Object(additionalParams)]),
        existingComputeCalculation: Type.Intersect([ComputeCalculationObject, Type.Object(additionalParams)]),
        existingLicenseCalculation: Type.Intersect([LicenseCalculationObject, Type.Object(additionalParams)])
    })
]);

const BulkStorageSavingsCalculationsMetricsResponse = Type.Intersect([
    StorageSavingsCapacityCalculationsMetricsResponse,
    Type.Object({
        recommendedComputeCalculation: Type.Array(
            Type.Intersect([ComputeCalculationObject, Type.Object(additionalParams)])
        ),
        recommendedLicenseCalculation: Type.Array(
            Type.Intersect([LicenseCalculationObject, Type.Object(additionalParams)])
        ),
        existingComputeCalculation: Type.Array(
            Type.Intersect([ComputeCalculationObject, Type.Object(additionalParams)])
        ),
        existingLicenseCalculation: Type.Array(
            Type.Intersect([LicenseCalculationObject, Type.Object(additionalParams)])
        )
    })
]);

const StorageSavingsCalculationsMetrics = Type.Object({
    ebs: Type.Optional(StorageMetrics),
    ebsCalculation: Type.Optional(EBSCostCalculationResp),
    ebsCloneCalculation: Type.Optional(EBSCloneCostCalculationResp),
    ebsSnapshotCalculation: Type.Optional(EBSSnapshotCalculationResp),
    single: Type.Optional(FsxCalculationResp),
    multi: Type.Optional(FsxCalculationResp),
    fsxOptimizedSingle: Type.Optional(FsxCalculationResp),
    fsxwCalculation: Type.Optional(FsxwCalculationResp),
    fsxwSnapshotCalculation: Type.Optional(FsxwSnapshotCalculationResp),
    fsxwCloneCalculation: Type.Optional(FsxwCloneCalculationResp),
    fsxw: Type.Optional(StorageMetrics),
    fsx: Type.Optional(StorageMetrics),
    fsxOptimized: Type.Optional(StorageMetrics)
});

type EbsCloneCalculationType = Static<typeof EbsCloneCalculation>;
type EbsSnapshotCalculationType = Static<typeof EbsSnapshotCalculation>;
type EbsCostCalculationType = Static<typeof EbsCostCalculation>;

type StorageSavingsResponseType = Static<typeof StorageSavingsResponse>;
type StorageSavingsRequestBodyType = Static<typeof StorageSavingsRequestBody>;

/** Fields passed to the marketing storage API for automatic EBS/FSx savings (MSSQL and Oracle). */
type AutomaticModeStorageSavingsMarketingParams = Pick<
    StorageSavingsRequestBodyType,
    'cloneRefreshFrequency' | 'clonedCopiesCount' | 'monthlyChangeRatePercentage'
> & {
    /** Optional: Oracle bulk callers may omit it; downstream helpers treat undefined as no snapshots. */
    snapshotFrequency?: StorageSavingsRequestBodyType['snapshotFrequency'];
};

type ManualStorageSavingsRequestBodyType = Static<typeof ManualStorageSavingsRequestBody>;

const ComputeDetails = Type.Object({
    instanceType: Type.String(),
    windowsOsVersion: Type.Optional(Type.String()),
    computeHourlyPrice: Type.Optional(Type.Number()),
    instanceHourlyPrice: Type.Optional(Type.Number()),
    computeMonthlyPrice: Type.Optional(Type.Number()),
    instanceMonthlyPrice: Type.Optional(Type.Number()),
    hoursInMonth: Type.Number(),
    message: Type.Optional(Type.String()),
    finding: Type.Optional(Type.String()),
    machineDetails: Type.Optional(MachinePriceDetails),
    recommendationOptions: Type.Optional(Type.Array(RecommendationOption))
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
    deploymentType: Type.Optional(Type.String()),
    hostname: Type.Optional(Type.String()),
    compute: Compute,
    license: License
});

type ComputeLicenseCostType = Static<typeof ComputeLicenseCost>;

type StorageSavingsMetricsCalculationsResponseType = Static<typeof StorageSavingsCalculationsMetricsResponse>;
type StorageSavingsCalculationsMetricsType = Static<typeof StorageSavingsCalculationsMetrics>;

type ComputeDetailsType = Static<typeof ComputeDetails>;
type LicenseDetailsType = Static<typeof LicenseDetails>;

type FsxwCalculationRespType = Static<typeof FsxwCalculationResp>;
type FsxwSnapshotCalculationRespType = Static<typeof FsxwSnapshotCalculationResp>;
type FsxwCloneCalculationRespType = Static<typeof FsxwCloneCalculationResp>;

type FsxCalculationRespType = Static<typeof FsxCalculationResp>;
type EBSCostCalculationRespType = Static<typeof EBSCostCalculationResp>;
type EBSCloneCostCalculationRespType = Static<typeof EBSCloneCostCalculationResp>;
type EBSSnapshotCalculationRespType = Static<typeof EBSSnapshotCalculationResp>;

type ManualModeInstancesType = Static<typeof ManualModeInstances>;

type BulkStorageSavingsRequestBodyType = Static<typeof BulkStorageSavingsRequestBody> & { bulk?: boolean };
type OracleBulkStorageSavingsRequestBodyType = Static<typeof OracleBulkStorageSavingsRequestBody> & {
    bulk?: boolean;
};
type BulkStorageSavingsCalculationsMetricsResponseType = Static<typeof BulkStorageSavingsCalculationsMetricsResponse>;
type BulkStorageSavingsResponseType = Static<typeof BulkStorageSavingsResponse>;

/** Union of single-host vs bulk SQL Server EBS/FSxW metrics responses from `getStorageSavingsCalculationMetrics`. */
type StorageSavingsCalculationMetricsOperationResultType =
    | StorageSavingsMetricsCalculationsResponseType
    | BulkStorageSavingsCalculationsMetricsResponseType;

export {
    InternalUpdateInstRecQueryString,
    EbsCostCalculationType,
    EbsCloneCalculationType,
    EbsSnapshotCalculationType,
    StorageSavingsRequestParams,
    StorageSavingsRequestBody,
    ManualStorageSavingsRequestParams,
    ManualStorageSavingsRequestBody,
    ManualModeInstances,
    StorageSavingsRequestBodyType,
    AutomaticModeStorageSavingsMarketingParams,
    ManualStorageSavingsRequestBodyType,
    StorageSavingsResponse,
    StorageSavingsResponseType,
    StorageSavingsCalculationsMetricsResponse,
    StorageSavingsMetricsCalculationsResponseType,
    ComputeLicenseCostType,
    ComputeDetailsType,
    LicenseDetailsType,
    FsxwCalculationRespType,
    FsxwSnapshotCalculationRespType,
    FsxwCloneCalculationRespType,
    FsxCalculationRespType,
    EBSCostCalculationRespType,
    EBSCloneCostCalculationRespType,
    EBSSnapshotCalculationRespType,
    StorageSavingsCalculationsMetricsType,
    ManualModeInstancesType,
    BulkStorageSavingsRequestBody,
    BulkStorageSavingsRequestBodyType,
    OracleBulkStorageSavingsRequestBody,
    OracleBulkStorageSavingsRequestBodyType,
    BulkStorageSavingsCalculationsMetricsResponse,
    BulkStorageSavingsResponse,
    BulkStorageSavingsCalculationsMetricsResponseType,
    BulkStorageSavingsResponseType,
    StorageSavingsCalculationMetricsOperationResultType
};
