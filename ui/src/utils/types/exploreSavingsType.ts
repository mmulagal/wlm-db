export interface InstanceType {
    instanceType?: string;
    vCpus?: number;
    ramInMib?: number;
    iopsInMbps?: number;
    architecture?: Array<string>;
}

export interface ManualTCOVolTypes {}

export interface ExploreSavingsSliceEntities {
    selectedTCOHostType: string;
    showOptimizeMode: {
        optimizeLoading: boolean;
        showCalcMode: boolean;
    };
    exploreSavingsRouteTab: string;
    serverDetails: {
        password: string;
        userName: string;
        ssmParameterArn: string;
    };
    selectedAuthenticationType: string;
    selectedCalculatorMode: string;
    hasFetched: boolean;
    showOptimizeLink: boolean;
    showOptimizedModal: boolean;
    regionChangeInstanceLoading: boolean;
    onPremiseData: any;
    onPremiseDataLoading: boolean;
    onPremiseOracleData: any;
    onPremiseOracleDataLoading: boolean;
    selectedOracleExploreSavingsTab: string;
    selectedExploreSavingsTab: string;
    selectedManualFSXThroughput: number;
    selectedManualFSXIOPS: number;
    selectedManualStorageCapacityUnit: any;
    manualStorageCapacity: number | string;
    selectedManualStorageType: any;
    selectedManualDeploymentType: any;
    disableState: boolean;
    requestedPayload: any;
    requestedRegion: any;
    selectedSnapshotFrequency: any;
    secondaryVolumeFilledStatus: boolean;
    numberOfClonedCopies: number | any;
    selectedCloneRefresh: any;
    monthlyChangeRate: number | any;
    saveConfigName: string;
    loading: boolean;
    unmanagedExploreSavingsHost: Array<any>;
    selectedInstanceId: string;
    selectedExCredId: string;
    selectedExRegionId: string;
    selectedOnPremHostId: string;
    selectedPartnerInstanceId: string;
    selectedServerName: string;
    selectedHostDetails: any;
    selectedOnPremHostDetails: any;
    selectedPartnerHostDetails: any;
    getPartnerHostDetailsLoading: boolean;
    storageSavingsResponse: StorageSavingsInterface;
    optimizedStorageSavingsResponse: StorageSavingsInterface;
    standardStorageSavingsResponse: StorageSavingsInterface;
    storageSavingsLoading: boolean;
    oracleLicenseCostUpdating: boolean;
    savingsCalculatorRefresh: boolean;
    selectedDeploymentModel: string;
    viewCalculationsResponse: ViewCalculationsInterface | null;
    optimizedViewCalculationsResponse: ViewCalculationsInterface | null;
    standardViewCalculationsResponse: ViewCalculationsInterface | null;
    viewCalculationsApiResponse: ViewCalculationsInterface | null;
    viewCalculationsLoading: boolean;
    savingsCalculatorFrom: string | null;
    selectedManualRegion: any;
    selectedOnPremRegion: any;
    selectedManualDeploymentModel: string | any;
    monthlyBYOLCost: string;
    manualMonthlyDescription: string;
    manualSecondaryMachineDescription: string;
    selectedManualServerEdition: any;
    selectedManualInstanceType: any;
    selectedSecondaryManualInstanceType: any;
    selectedVolumeTab: string;
    selectedVolumeTabForSecondary: string;
    manualTCOVolumeTypes2: any;
    getManualInstanceTypeList: {
        instanceTypeData: { instanceTypes?: InstanceType[] };
        instanceTypeLoading: false;
        instanceTypeError: null;
    };
    getManualRegionsList: {
        manualRegionsData: null;
        manualRegionsLoading: false;
        manualRegionsError: null;
    };
    getOnPremRegionList: {
        onPremRegionsData: null;
        onPremRegionsLoading: false;
        onPremRegionsError: null;
    };
    manualTCOVolumeTypes: any;
    volumeFilledStatus: boolean;
    recommendedTargetInstance: string;
    snapshotLoading: boolean;
    storageSavingsOnPremResponse: any;
    storageSavingsOnPremLoading: boolean;
    onPremNetworkPerformance: any;
    onPremStorageAndComputeInfo: any;
    instanceDataUpdatedTrigger: string | null;
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
        recommendedTotal?: number | string;
        optimized?: number | string;
    };
    compute?: {
        existing?: RecommendedCompute;
        recommended?: RecommendedCompute;
    };
    license?: {
        existing?: RecommendedLicense;
        recommended?: RecommendedLicense;
    };
    recommendedInstance?: any;
    fsxOptimized?: {
        capacity?: number | string;
        iops?: number | string;
        throughput?: number | string;
        snapshots?: number | string;
        clones?: number | string;
        compute?: number | string;
        license?: number | string;
        total?: number | string;
    };
    fsxOptimizedSingle?: StorageSavingsFsxnForAZ;
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
    machineDetails?: Array<any>;
    recommendationOptions?: Array<any>;
    finding?: string;
}

export interface RecommendedLicense {
    hoursInMonth: number;
    sqlServerEdition?: string;
    licenseHourlyPrice?: number;
    licenseIncluded?: boolean;
    licenseMonthlyPrice?: number;
}

export interface ViewCalculationsInterface {
    recommendedInstance?: Array<any>;
    recommendedComputeCalculation?: RecommendedCompute;
    recommendedLicenseCalculation?: RecommendedLicense;
    existingComputeCalculation?: RecommendedCompute;
    existingLicenseCalculation?: RecommendedLicense;
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
        [key: string]: EBSCalculation;
    };
    ebsCloneCalculation?: {
        clonedCopiesCount?: number | string;
        capacity?: number | string;
        iops?: number | string;
        throughput?: number | string;
        totalCloneMonthlyCost?: number | string;
        [key: string]: any;
    };
    ebsSnapshotCalculation?: {
        storageAmount?: number | string;
        monthlyCostOfSnapshots?: number | string;
        ebsInstanceMonth?: number | string;
        totalSnapshots?: number | string;
        initialSnapshotCost?: number | string;
        monthlyCostPerSnapshot?: number | string;
        discountForPartialStorageMonth?: number | string;
        incrementalSnapshotCost?: number | string;
        totalSnapshotCost?: number | string;
        totalEbsSnapshotCost?: number | string;
        ebsSnapshotCost?: number | string;
        [key: string]: any;
    };
    totalFsxEc2MachineCost?: number | string;
    totalEBSEc2MachineCost?: number | string;
    totalFsxwEc2MachineCost?: number | string;
    fsxTotalCost?: number | string;
    ebsTotalCost?: number | string;
    fsxwTotalCost?: number | string;
    ebsOnlyCost?: number | string;
    fsxSnapshotTotalCost?: number | string;
    totalAzCost?: number | string;
    azType?: string;
    fsxwCloneCalculation?: {
        clonedCopiesCount?: number | string;
        capacity?: number | string;
        iops?: number | string;
        throughput?: number | string;
        totalCloneMonthlyCost?: number | string;
    };
    fsxwSnapshotCalculation?: {
        desiredSnapshotStorageCapacity?: number | string;
        storageSavingSnapshot?: number | string;
        provisionedStorageCapacityForFsxwSnapshot?: number | string;
        totalMonthlyCostForFsxwSnapshotStorageCapacity?: number | string;
    };
    fsxwCalculation?: {
        deduplicationSavings?: number | string;
        fsxwSsdPrice?: { price: number | string };
        totalMonthlyCost?: number | string;
        desiredStorageCapacity?: number | string;
        storageSavings?: number | string;
        provisionedStorageCapacity?: number | string;
        monthlyCostForStorageCapacity?: number | string;
        totalDefaultProvisionedIops?: number | string;
        additionalUserProvisionedIops?: number | string;
        sumOfDefaultAndAdditionalProvisionedIops?: number | string;
        billedIops?: number | string;
        totalMonthlyCostForProvisionedSsdIops?: number | string;
        fsxwIopsPrice?: number | string;
        numberOfFileSystemsRequiredForStorageCapacity?: number | string;
        fsxwMaxCapacity?: number | string;
        numberOfFileSystemsRequiredForThroughputCapacity?: number | string;
        fsxwMaxThroughput?: number | string;
        throughput?: number | string;
        requiredFractionalFileSystems?: number | string;
        requiredFileSystems?: number | string;
        fsxwMinThroughput?: number | string;
        minThroughputCapacityRequired?: number | string;
        provisionedThroughputCapacity?: number | string;
        fsxwThroughputPrice?: number | string;
        totalMonthlyCostForThroughputCapacity?: number | string;
    };
    fsxOptimizedSingle?: {
        fsxOntapCalculation?: FsxOntapCalculation;
        fsxOntapSnapshotCalculation?: FsxOntapSnapshotCalculation;
        fsxCloneCalculation?: FsxCloneCalculation;
    };
}

export interface EBSSnapshotsCalculation {
    ebsInstanceMonth?: number | string;
    totalSnapshots?: number | string;
    initialSnapshotCost?: number | string;
    monthlyCostPerSnapshot?: number | string;
    discountForPartialStorageMonth?: number | string;
    incrementalSnapshotCost?: number | string;
    totalSnapshotCost?: number | string;
    totalEbsSnapshotCost?: number | string;
    ebsSnapshotCost?: number | string;
}

export interface EBSCalculation {
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
    ebsCapacityPrice?: { price?: number | string };
    hoursInAMonth?: number | string;
    ebsTotalCostMonthly?: number | string;
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
    fsxnStoragePrice?: { price: number | string };
    fsxnCapacityPrice?: { price: number | string };
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
    fsxnSsdPrice?: { price: number | string };
    fsxnCapacityPrice?: { price: number | string };
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
    totalMonthlyCostForFsxSsd?: number | string;
}

export interface FsxCloneCalculation {
    clonedCopiesCount?: number | string;
    numberOfClonesInAMonth?: number | string;
    changeRateBetweenClones?: number | string;
    totalFsxnCapacity?: number | string;
    fsxnSsdPrice?: { price: number | string };
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
