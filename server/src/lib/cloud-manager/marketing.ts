import { HEADERS, USER_TOKEN, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';

const logger = getLogger();

interface CalculateEbsComparisonResponse {
    ebs: {
        capacity: number;
        iops: number;
        throughput: number;
        snapshots: number;
        total: number;
    };
    fsx: {
        capacity: number;
        iops: number;
        throughput: number;
        snapshots: number;
        total: number;
    };
    fsx_calculation: {
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
    };
    fsx_cost_calculation_no_snapshot: {
        desiredSnapshotStorageCapacityGB: {
            size: number;
            unit: string;
        };
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
    };
    fsx_snapshot_cost_calculation: {
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
    };
    ebs_cost_calculation: {
        storageVolumeType: string;
        storageAmountPerVol: {
            size: number;
            unit: string;
        };
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
    };
    fsx_clone_cost_calculation: {
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
    };
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
    clones: {
        monthlyCloneNumber: number;
        changeRate: number;
        numberOfCloneEnvs: number;
        ssdStorage: number;
        savings: number;
    };
}

export default async function getStorageSavings(
    accountId: string,
    credentialsId: string,
    region: string,
    params: MarketingRequestBody
) {
    logger.info('Get storage savings from marketing APIs:', { accountId, credentialsId, region });

    const response = await gotInstanceForInternalRequest
        .post(`accounts/${accountId}/marketing/v1/credentials/${credentialsId}/regions/${region}/ebs/auto/calculate`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN)
            },
            json: params
        })
        .json<CalculateEbsComparisonResponse>();
    return response;
}
