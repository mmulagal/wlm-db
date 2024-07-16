export interface InstanceType {
    instanceType?: string;
    vCpus?: number;
    ramInMib?: number;
    iopsInMbps?: number;
    architecture?: Array<string>;
}

export interface ManualTCOVolTypes {}

export interface ExploreSavingsSliceEntities {
    selectedSnapshotFrequency: any;
    numberOfClonedCopies: number | any;
    selectedCloneRefresh: any;
    monthlyChangeRate: number | any;
    saveConfigName: string;
    loading: boolean;
    unmanagedExploreSavingsHost: Array<any>;
    selectedInstanceId: string;
    selectedPartnerInstanceId: string;
    selectedServerName: string;
    selectedHostDetails: any;
    selectedPartnerHostDetails: any;
    getPartnerHostDetailsLoading: boolean;
    storageSavingsResponse: StorageSavingsInterface;
    storageSavingsLoading: boolean;
    savingsCalculatorRefresh: boolean;
    selectedDeploymentModel: string;
    viewCalculationsResponse: ViewCalculationsInterface | null;
    viewCalculationsLoading: boolean;
    savingsCalculatorFrom: string | null;
    selectedManualRegion: any;
    selectedManualDeploymentModel: string | any;
    monthlyBYOLCost: string;
    manualMonthlyDescription: string;
    manualSecondaryMachineDescription: string;
    selectedManualServerEdition: any;
    selectedManualInstanceType: any;
    selectedSecondaryManualInstanceType: any;
    selectedVolumeTab: string;
    manualTCOVolumeTypes2: any;
    getManualInstanceTypeList: {
        instanceTypeData: { instanceTypes?: InstanceType[] };
        instanceTypeLoading: false;
        instanceTypeError: null;
    };
    manualTCOVolumeTypes: any;
}

export interface StorageSavingsInterface {
    fsx?: {
        capacity?: number | string;
        iops?: number | string;
        throughput?: number | string;
        snapshots?: number | string;
        clones?: number | string;
        compute?: number | string;
        license?: number | string;
        total?: number | string;
    };
    ebs?: {
        capacity?: number | string;
        iops?: number | string;
        throughput?: number | string;
        snapshots?: number | string;
        clones?: number | string;
        compute?: number | string;
        license?: number | string;
        total?: number | string;
    };
    single?: StorageSavingsFsxnForAZ;
    multi?: StorageSavingsFsxnForAZ;
    totalSummary?: {
        existing?: number | string;
        recommended?: number | string;
    };
    compute?: {
        existing?: RecommendedCompute;
        recommended?: RecommendedCompute;
    };
    license?: {
        existing?: RecommendedLicense;
        recommended?: RecommendedLicense;
    };
}

export interface StorageSavingsFsxnForAZ {
    fsxCalculation?: {
        deploymentType?: string;
        numberOfVolumes?: number;
        throughput?: number | string;
        totalStorageCapacity?: number | string;
        percentageSsd?: number | string;
        savings?: number | string;
        effectiveCapacity?: number | string;
        ssdTierReqCapacity?: number | string;
        capacityPoolTier?: number | string;
        ssdIop?: number | string;
        throughputCapacity?: number | string;
        useCase?: string;
        regionName?: string;
        monthlySnapshotCapacity?: number | string;
    };
    fsxBreakdown?: {
        fsxDataLunSize?: number | string;
        fsxDataVolumeSize?: number | string;
        fsxLogVolumeSize?: number | string;
        fsxTempDbVolumeSize?: number | string;
        fsxQuorumVolumeSize?: number | string;
        fsxBufferVolumeSize?: number | string;
        fsxStorageCapacity?: number | string;
    };
}

export interface RecommendedIntanceInterface {
    instanceType?: string;
    computeHourlyPrice?: number | string;
    computeMonthlyPrice?: number | string;
    sqlEdition?: string;
    sqlLicense?: boolean | null;
}

export interface RecommendedCompute {
    instanceType?: string;
    computeHourlyPrice?: number | string;
    computeMonthlyPrice?: number | string;
    instanceMonthlyPrice?: number | string;
    hoursInMonth?: number | string;
    windowsOsVersion?: string;
}

export interface RecommendedLicense {
    hoursInMonth: number;
    sqlServerEdition?: string;
    licenseHourlyPrice?: number;
    licenseIncluded?: boolean;
}

export interface ViewCalculationsInterface {
    recommendedComputeCalculation?: Array<RecommendedCompute>;
    recommendedLicenseCalculation?: Array<RecommendedLicense>;
    existingComputeCalculation: Array<RecommendedCompute>;
    existingLicenseCalculation?: Array<RecommendedLicense>;
    ebsInstanceCalculation?: Array<RecommendedIntanceInterface>;
    fsxInstanceCalculation?: Array<RecommendedIntanceInterface>;
    single?: {
        fsxOntapCalculation?: FsxOntapCalculation;
        fsxOntapSnapshotCalculation?: FsxOntapSnapshotCalculation;
        fsxCloneCalculation?: FsxCloneCalculation;
    };
    multi?: {
        fsxOntapCalculation?: FsxOntapCalculation;
        fsxOntapSnapshotCalculation?: FsxOntapSnapshotCalculation;
        fsxCloneCalculation?: FsxCloneCalculation;
    };
    fsxOntapCalculation?: FsxOntapCalculation;
    fsxOntapSnapshotCalculation?: FsxOntapSnapshotCalculation;
    fsxCloneCalculation?: FsxCloneCalculation;
    ebsCalculation?: {
        storageAmountPerVol?: number | string;
        totalInstanceHours?: number | string;
        ebsInstanceMonth?: number | string;
        ebsStorageCost?: number | string;
        billableIops?: number | string;
        totalBillableIops?: number | string;
        ebsIopsCost?: number | string;
        billableMbps?: number | string;
        billableThroughputMbps?: number | string;
        billableThroughputGbps?: number | string;
        ebsThroughputCost?: number | string;
        numberOfVolumes?: number;
        instanceAvgDuration?: number | string;
        ebsCapacityPrice?: number | string;
        hoursInAMonth?: number | string;
        ebsTotalCostMonthly?: number | string;
    };
    ebsCloneCalculation?: {
        clonedCopiesCount?: number | string;
        capacity?: number | string;
        iops?: number | string;
        throughput?: number | string;
        totalCloneMonthlyCost?: number | string;
    };
    ebsSnapshotCalculation?: {
        ebsInstanceMonth?: number | string;
        totalSnapshots?: number | string;
        initialSnapshotCost?: number | string;
        monthlyCostPerSnapshot?: number | string;
        discountForPartialStorageMonth?: number | string;
        incrementalSnapshotCost?: number | string;
        totalSnapshotCost?: number | string;
        totalEbsSnapshotCost?: number | string;
        ebsSnapshotCost?: number | string;
    };
    totalFsxEc2MachineCost?: number | string;
    totalEBSEc2MachineCost?: number | string;
    fsxTotalCost?: number | string;
    ebsTotalCost?: number | string;
    fsxSnapshotTotalCost?: number | string;
    totalAzCost?: number | string;
    azType?: string;
}

export interface FsxOntapCalculation {
    desiredStorageCapacity?: number | string;
    percentageOfDataOnSsdStorage?: number | string;
    savingsFromCompressionAndDeduplication?: number | string;
    storageSavingsFromCompressionAndDeduplication?: number | string;
    effectiveFsxnStorageCapacity?: number | string;
    ssdStoragePerMonth?: number | string;
    greaterOfSsdAndMinAllowedSsd?: number | string;
    ssdMonthlyCost?: number | string;
    totalMonthlyCostForFSxSsd?: number | string;
    ratioAfterSavings?: number | string;
    dataOnCapacityPoolStorageFactor?: number | string;
    capacityPoolStorage?: number | string;
    capacityMonthlyCost?: number | string;
    totalMonthlyCostForCapacity?: number | string;
    totalMonthlyStorageCharge?: number | string;
    minFileSystemsNumForStorage?: number | string;
    minFileSystemsNumForThroughputCapacity?: number | string;
    minFileSystemsNumForSsdIops?: number | string;
    requiredNumOfFsxFractional?: number | string;
    requiredNumOfFsx?: number | string;
    minThroughputCapacityRequired?: number | string;
    provisionedThroughputCapacity?: number | string;
    totalMonthlyFsxnThroughputCapacityCost?: number | string;
    includedSsdIops?: number | string;
    additionalSsdIops?: number | string;
    billedAdditionalSsdIops?: number | string;
    additionalBilledCostForSsdIops?: number | string;
    totalThroughputAndIopsMonthly?: number | string;
    ebsCapacity?: number | string;
    numberOfVolumes?: number;
    fsxnStoragePrice?: number | string;
    fsxnCapacityPrice?: number | string;
    fsxnIopsPrice?: number | string;
    maxSsdTierSize?: number | string;
    suggestedFsxnThroughputCapacity?: number | string;
    maxThroughput?: number | string;
    fsxnThroughputPrice?: number | string;
    provisionedSsdIops?: number | string;
    includedIops?: number | string;
    maxSsdIops?: number | string;
}

export interface FsxOntapSnapshotCalculation {
    fsxnSsdPrice?: number | string;
    fsxnCapacityPrice?: number | string;
    desiredStorageCapacity?: number | string;
    percentageOfDataOnSsdStorage?: number | string;
    savingsFromCompressionAndDeduplication?: number | string;
    storageSavingsFromCompressionAndDeduplication?: number | string;
    effectiveFsxnStorageCapacity?: number | string;
    ssdStoragePerMonth?: number | string;
    ssdMonthlyCost?: number | string;
    totalSnapshotMonthlyCostForFsxSsd?: number | string;
    ratioAfterSavings?: number | string;
    dataOnCapacityPoolStorageFactor?: number | string;
    capacityPoolStorage?: number | string;
    capacityMonthlyCost?: number | string;
    totalMonthlyCostForCapacity?: number | string;
    totalSnapshotMonthlyCost?: number | string;
}

export interface FsxCloneCalculation {
    clonedCopiesCount?: number | string;
    numberOfClonesInAMonth?: number | string;
    changeRateBetweenClones?: number | string;
    totalFsxnCapacity?: number | string;
    fsxnSsdPrice?: number | string;
    cloneRefreshFrequency?: string;
    monthlyChangeRatePercentage?: number | string;
    desiredStorageCapacity?: number | string;
    percentageOfDataOnSsdStorage?: number | string;
    savingsFromCompressionAndDeduplication?: number | string;
    storageSavingsFromCompressionAndDeduplication?: number | string;
    effectiveFsxnStorageCapacity?: number | string;
    ssdStoragePerMonth?: number | string;
    ssdMonthlyCost?: number | string;
    totalCloneMonthlyCost?: number | string;
}
