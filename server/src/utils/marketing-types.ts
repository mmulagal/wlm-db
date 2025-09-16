interface StorageSummary {
    capacity: number;
    iops: number;
    throughput: number;
    snapshots: number;
    total: number;
    clones: number;
}
interface AutomaticModeEbsCostCalculation {
    storageAmountPerVol: {
        size: number;
        unit: string;
    };
}

interface ManualModeEbsCostCalculation {
    storageAmount: {
        size: number;
        unit: string;
    };
}

interface EbsCostCalculation extends AutomaticModeEbsCostCalculation, ManualModeEbsCostCalculation {
    storageVolumeType: string;
    totalInstanceHours: number;
    numberOfVolumes: number;
    instanceAvgDuration: number;
    EBSInstanceMonth: number;
    EBSStorageCost: number;
    EBSCapacityPrice: {
        price: number;
        unit: string;
    };
    billableIops: number;
    totalBillableIops: number;
    EBSIopsCost: number;
    billableMBps: number;
    billableThroughputMBps: number;
    billableThroughputGBps: number;
    EBSThroughputCost: number;
    totalSnapshot: number;
    initialSnapshotCost: number;
    monthlyCostPerSnapshot: number;
    discountForPartialStorageMonth: number;
    incrementalSnapshotCost: number;
    totalSnapshotCost: number;
    totalEBSSnapshotCost: number;
    ebsSnapshotCost: number;
    AWSEBSTotalCostMonthly: number;
    requestedThroughputMBps: number;
    includedThroughputMBps: number;
    ebsSnapshotPrice: {
        price: number;
        unit: string;
    };
    amountChangedPerSnapshot: {
        size: number;
        unit: string;
    };
}

interface FsxCalculation {
    deploymentType: string;
    numberOfVolumes: number;
    throughput: number;
    totalStorageCapacity: {
        size: number;
        unit: string;
    };
    percentageSSD: number;
    savings: number;
    effectiveCapacity: {
        size: number;
        unit: string;
    };
    ssdTierReqCapacity: {
        size: number;
        unit: string;
    };
    capacityPoolTier: {
        size: number;
        unit: string;
    };
    ssdIop: number;
    throughputCapacity: number;
    useCase: string;
    regionName: string;
    monthlySnapshotCapacity: {
        size: number;
        unit: string;
    };
}
interface FsxNoSnapshotCalculation {
    EBSCapacity: {
        size: number;
        unit: string;
    };
    numberOfVolumes: number;
    percentageOfDataOnSSDStorage: number;
    savingsFromCompressionAndDeduplication: number;
    storageSavingsFromCompressionAndDeduplication: {
        size: number;
        unit: string;
    };
    effectiveStorageCapacityForFSxForONTAP: {
        size: number;
        unit: string;
    };
    SSDStorageGBPerMonth: {
        size: number;
        unit: string;
    };
    effectiveFSXnSSD: {
        size: number;
        unit: string;
    };
    SSDMonthlyCost: number;
    totalMonthlyCostForFSxSSD: number;
    desiredStorageCapacityGB: {
        size: number;
        unit: string;
    };
    ratioAfterSavings: number;
    dataOnCapacityPoolStorageFactor: number;
    capacityPoolStorage: {
        size: number;
        unit: string;
    };
    capacityMonthlyCost: number;
    FSXnCapacityPrice: {
        price: number;
        unit: string;
    };
    totalMonthlyCostForCapacity: number;
    totalMonthlyStorageCharge: number;
    minFileSystemsNumForStorage: number;
    maxSSDTierSizeGB: {
        size: number;
        unit: string;
    };
    minFileSystemsForThroughputCapacity: number;
    throughputCapacity: number;
    maxThroughput: number;
    minFileSystemsRequiredForSSDIOPS: number;
    maxSSDIOPS: number;
    requiredNumOfFSx_fractional: number;
    requiredNumOfFSx_roundUp: number;
    minThroughputCapacityRequired: number;
    provisionedThroughputCapacity: number;
    totalMonthlyCostFSXnThroughputCapacity: number;
    FSXnThroughputPrice: number;
    includedSSDIOPS: number;
    includedIOPS: number;
    additionalSSDIOPS: number;
    provisionedSSDIOPS: number;
    billedAdditionalSSDIOPS: number;
    additionalBilledCostForSSDIOPS: number;
    FSXnIOPSPrice: number;
    totalThroughputIOPSRequestsChargeMonthly: number;
    totalMonthlyCost: number;
}

interface FsxSnapshotCalculation {
    desiredSnapshotStorageCapacityGB: {
        size: number;
        unit: string;
    };
    percentageOfDataOnSSDStorage: number;
    savingsFromCompressionAndDeduplication: number;
    storageSavingsFromCompressionAndDeduplication: {
        size: number;
        unit: string;
    };
    effectiveStorageCapacityForFSxForONTAP: {
        size: number;
        unit: string;
    };
    SSDSnapshotStorageGBPerMonth: {
        size: number;
        unit: string;
    };
    dataOnSSDStoragePercentage: number;
    SSDStorageGBPerMonth: {
        size: number;
        unit: string;
    };
    SSDMonthlyCost: number;
    FSXnSSDPrice: {
        price: number;
        unit: string;
    };
    totalMonthlyCostForFSxSSD: number;
    totalSnapshotMonthlyCostForFSxSSD: number;
    ratioAfterSavings: number;
    dataOnCapacityPoolStorageFactor: number;
    capacityPoolStorage: {
        size: number;
        unit: string;
    };
    snapshotRatioAfterSavings: number;
    snapshotDataOnCapacityPoolStorageFactor: number;
    capacityMonthlyCost: number;
    FSXnCapacityPrice: {
        price: number;
        unit: string;
    };
    totalMonthlyCostForCapacity: number;
    totalSnapshotMonthlyCost: number;
}

interface FsxCloneCalculation {
    desiredStorageCapacityGB: {
        size: number;
        unit: string;
    };
    percentageOfDataOnSSDStorage: number;
    savingsFromCompressionAndDeduplication: number;
    storageSavingsFromCompressionAndDeduplication: {
        size: number;
        unit: string;
    };
    effectiveStorageCapacityForFSxForONTAP: {
        size: number;
        unit: string;
    };
    SSDCloneStorageGBPerMonth: {
        size: number;
        unit: string;
    };
    dataOnSSDStoragePercentage: number;
    SSDStorageGBPerMonth: {
        size: number;
        unit: string;
    };
    SSDMonthlyCost: number;
    FSXnSSDPrice: {
        price: number;
        unit: string;
    };
    totalMonthlyCostForFSxSSD: number;
    totalCloneMonthlyCostForFSxSSD: number;
    ratioAfterSavings: number;
    dataOnCapacityPoolStorageFactor: number;
    capacityPoolStorage: {
        size: number;
        unit: string;
    };
    cloneRatioAfterSavings: number;
    cloneDataOnCapacityPoolStorageFactor: number;
    capacityMonthlyCost: number;
    FSXnCapacityPrice: {
        price: number;
        unit: string;
    };
    totalMonthlyCostForCapacity: number;
    totalCloneMonthlyCost: number;
    changeRateBetweenClones: number;
}

interface FsxCostCalculations {
    fsx_calculation: FsxCalculation;
    fsx_cost_calculation_no_snapshot: FsxNoSnapshotCalculation;
    fsx_snapshot_cost_calculation: FsxSnapshotCalculation;
    fsx_clone_cost_calculation: FsxCloneCalculation;
    fsxw_cost_calculation?: FsxwCostCalculation;
}

interface EbsVolumeTypesCalculation {
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
}
interface CalculateEbsComparisonResponse extends EbsVolumeTypesCalculation {
    ebs?: StorageSummary;
    fsx: StorageSummary;
    single?: FsxCostCalculations;
    multi?: FsxCostCalculations;
    fsxw?: StorageSummary;
    fsx_optimized?: StorageSummary;
    fsx_optimized_single?: FsxCostCalculations;
}

interface InstanceEbsData extends EbsVolumeTypesCalculation {
    instanceName?: string;
    isPrimary: boolean;
}

interface ManualModeEbsComparisonResponse {
    instanceEbs: InstanceEbsData[];
    fsx: StorageSummary;
    ebsTotal: StorageSummary;
    single: FsxCostCalculations;
    multi: FsxCostCalculations;
    fsx_optimized?: StorageSummary;
    fsx_optimized_single?: FsxCostCalculations;
}

interface MarketingRequestBody {
    useCase: string;
    volumeIds: string[];
    includeSnapshots: boolean;
    deploymentType: string;
    snapshots: {
        snapshotFreq: string;
        snapshotPercentageChange: number;
    };
    clones?: {
        monthlyCloneNumber: number;
        changeRate: number;
        numberOfCloneEnvs: number;
        ssdStorage: number;
        savings: number;
    };
    fileSystemsIds?: string[];
}

interface AutomaticModeMarketingRequestBodyFsxW {
    useCase: string;
    fileSystemsIds: string[];
    deduplicationSavings?: number;
    snapshotFreq?: string;
    cloneEnvs?: number;
    monthlyChangeRate?: number;
}

interface ManualModeMarketingRequestBodyEBS {
    useCase: string;
    region: string;
    deploymentType: string;
    snapshots: {
        snapshotFreq: string;
        snapshotPercentageChange: number;
    };
    clones?: {
        cloneEnvs: number;
        changeRate: number;
    };
    instances: [
        {
            instanceName?: string;
            isPrimary: boolean;
            volumes: [
                {
                    volumeType: string;
                    volumeNumber: number;
                    storageAmount: {
                        size: number;
                        unit: string;
                    };
                    volumeIops?: number;
                    throughput?: number;
                }
            ];
        }
    ];
}

interface StorageVolume {
    volumeId: string;
    volumeType: string;
    volumeSize: {
        size: number;
        unit: string;
    };
    status: string;
    tags?: {
        key: string;
        value: string;
    };
    iops: number;
    snapshotId: string;
}

interface StorageVolumesResponse {
    volumeInstances: StorageVolume[];
}

interface StorageInstance {
    instanceName: string;
    instanceId: string;
    instanceType: string;
    state: string;
    iops: number;
    numOfAttachedEBS: number;
}

interface StorageInstanceResponse {
    ec2Instances: StorageInstance[];
}

interface ManualModeMarketingRequestBodyFsxW {
    useCase: string;
    region: string;
    deploymentType: string;
    snapshots: {
        snapshotFreq: string;
        snapshotPercentageChange: number;
    };
    clones?: {
        cloneEnvs: number;
        changeRate: number;
    };
    instances: [
        {
            instanceName?: string;
            isPrimary: boolean;
            volumes: [
                {
                    volumeType: string;
                    volumeNumber: number;
                    storageAmount: {
                        size: number;
                        unit: string;
                    };
                    volumeIops?: number;
                    throughput?: number;
                }
            ];
        }
    ];
}

interface FsxwCostCalculation {
    deploymentType: string;
    desiredStorageCapacityGb: {
        size: number;
        unit: string;
    };
    desiredStorageCapacityTb: {
        size: number;
        unit: string;
    };
    deduplicationSavings: number;
    storageSavingCapacity: {
        size: number;
        unit: string;
    };
    effectiveProvisionedStorageCapacityForFsxw: {
        size: number;
        unit: string;
    };
    fsxwSsdPrice: {
        price: number;
        unit: string;
    };
    monthlyCostForFsxwStorageCapacity: number;
    totalMonthlyCostForFsxwStorageCapacity: number;
    iops: number;
    totalDefaultProvisionedIops: number;
    additionalUserProvisionedIops: number;
    billedIops: number;
    fsxwIopsPrice: number;
    totalMonthlyCostForFsxwProvisionedSsdIops: number;
    fsxwMaxCapacity: {
        size: number;
        unit: string;
    };
    numberOfFileSystemsRequiredForStorageCapacity: number;
    throughput: number;
    fsxwMaxThroughput: number;
    numberOfFileSystemsRequiredForThroughputCapacity: number;
    requiredNumberOfFsxwFileSystemsFractional: number;
    requiredNumberOfFsxwFileSystemsRoundUp: number;
    numberOfFsxwFileSystemsForMinimumThroughput: number;
    fsxwMinThroughput: number;
    minimumThroughputCapacityRequiredToProvisionFileSystems: number;
    provisionedThroughputCapacity: number;
    fsxwThroughputPrice: number;
    totalMonthlyCostForFsxwThroughputCapacity: number;
    totalStorageChargeMonthly: number;
    desiredSnapshotStorageCapacity: {
        size: number;
        unit: string;
    };
    storageSavingSnapshot: {
        size: number;
        unit: string;
    };
    effectiveProvisionedStorageCapacityForFsxwSnapshot: {
        size: number;
        unit: string;
    };
    monthlyCostForFsxwSnapshotStorageCapacity: number;
    totalMonthlyCostForFsxwSnapshotStorageCapacity: number;
    snapshotAmountChangeGib: number;
}

type ManualModeFsxwComparisonResponse = {
    fsxw: StorageSummary;
    fsxw_cost_calculation: FsxwCostCalculation;
    fsx: StorageSummary;
    fsx_calculation: FsxCalculation;
    fsx_cost_calculation_no_snapshot: FsxNoSnapshotCalculation;
    fsx_snapshot_cost_calculation: FsxSnapshotCalculation;
    fsx_clone_cost_calculation: FsxCloneCalculation;
};

type ManualModeComparisionResponse = ManualModeEbsComparisonResponse | ManualModeFsxwComparisonResponse;

type ManualModeMarketingRequestBody = ManualModeMarketingRequestBodyFsxW | ManualModeMarketingRequestBodyEBS;

type AutomaticModeMarketingRequestBody = AutomaticModeMarketingRequestBodyFsxW | MarketingRequestBody;

export {
    StorageSummary,
    EbsCostCalculation,
    FsxCalculation,
    FsxNoSnapshotCalculation,
    FsxSnapshotCalculation,
    FsxCloneCalculation,
    FsxCostCalculations,
    CalculateEbsComparisonResponse,
    InstanceEbsData,
    ManualModeEbsComparisonResponse,
    MarketingRequestBody,
    ManualModeMarketingRequestBody,
    StorageVolume,
    StorageVolumesResponse,
    StorageInstance,
    StorageInstanceResponse,
    ManualModeFsxwComparisonResponse,
    FsxwCostCalculation,
    ManualModeComparisionResponse,
    AutomaticModeMarketingRequestBody
};
