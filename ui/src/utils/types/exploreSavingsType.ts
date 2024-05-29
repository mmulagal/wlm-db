import { OptionsWithData } from '../utilityFunctions';

export interface ExploreSavingsSliceEntities {
    selectedSnapshotFrequency: any;
    numberOfClonedCopies: number;
    selectedCloneRefresh: any;
    monthlyChangeRate: number;
    saveConfigName: string;
    loading: boolean;
    unmanagedExploreSavingsHost: Array<any>;
    selectedInstanceId: string;
    selectedServerName: string;
    selectedHostDetails: any;
    storageSavingsResponse: StorageSavingsInterface;
    storageSavingsLoading: boolean;
    savingsCalculatorRefresh: boolean;
    selectedDeploymentModel: string;
    viewCalculationsResponse: ViewCalculationsInterface | null;
    viewCalculationsLoading: boolean;
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
}

export interface RecommendedIntanceInterface {
    instanceType?: string;
    instanceHourlyPrice?: number | string;
    ec2MachineCost?: number | string;
    sqlEdition?: string;
    sqlLicense?: boolean | null;
}

export interface ViewCalculationsInterface {
    ebsInstanceCalculation?: Array<RecommendedIntanceInterface>;
    fsxInstanceCalculation?: Array<RecommendedIntanceInterface>;
    fsxOntapCalculation?: {
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
        maxSsdTierSize?: number | string;
        suggestedFsxnThroughputCapacity?: number | string;
        maxThroughput?: number | string;
        fsxnThroughputPrice?: number | string;
        provisionedSsdIops?: number | string;
        includedIops?: number | string;
        maxSsdIops?: number | string;
    };
    fsxOntapSnapshotCalculation?: {
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
    };
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
    fsxCloneCalculation?: {
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
    fsxTotalCost?: number | string;
    ebsTotalCost?: number | string;
    fsxSnapshotTotalCost?: number | string;
}
