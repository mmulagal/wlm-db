import { HEADERS, USER_TOKEN, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';

const logger = getLogger();

interface StorageSummary {
    capacity: number;
    iops: number;
    throughput: number;
    snapshots: number;
    total: number;
    clones: number;
}
interface EbsCostCalculation {
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
}
interface CalculateEbsComparisonResponse {
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
    ebs: {
        capacity: number;
        iops: number;
        throughput: number;
        snapshots: number;
        total: number;
        clones: number;
    };
    fsx: {
        capacity: number;
        iops: number;
        throughput: number;
        snapshots: number;
        clones: number;
        total: number;
    };
    single?: FsxCostCalculations;
    multi?: FsxCostCalculations;
}

interface ManualModeEbsComparisonResponse {
    instanceEbs: [
        {
            instanceName?: string;
            isPrimary: boolean;
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
    ];
    fsx: StorageSummary;
    ebsTotal: StorageSummary;
    single: FsxCostCalculations;
    multi: FsxCostCalculations;
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
}

interface ManualModeMarketingRequestBody {
    useCase: string;
    region: string;
    deploymentType: string;
    snapshots: {
        snapshotFreq: string;
        snapshotMonthlyChangeRatePcg: number;
    };
    clones?: {
        cloneFreq: string;
        cloneEnvs: number;
        cloneMonthlyChangeRatePcg: number;
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

async function getStorageSavings(
    accountId: string,
    credentialsId: string,
    region: string,
    params: MarketingRequestBody
) {
    logger.info('Get storage savings from marketing APIs:', { accountId, credentialsId, region, params });

    const response = await gotInstanceForInternalRequest
        .post(`accounts/${accountId}/marketing/v2/credentials/${credentialsId}/regions/${region}/ebs/auto/calculate`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN),
                ...((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && {
                    [HEADERS.SIMULATOR]: 'true'
                })
            },
            json: params
        })
        .json<CalculateEbsComparisonResponse>();
    return response;
}

async function getManualModeStorageSavings(accountId: string, params: ManualModeMarketingRequestBody) {
    logger.info('Get manual mode storage savings from marketing APIs:', { accountId, params });

    const response = await gotInstanceForInternalRequest
        .post(`accounts/${accountId}/marketing/v1/ebs/db/calculate`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN),
                ...((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && {
                    [HEADERS.SIMULATOR]: 'true'
                })
            },
            json: params
        })
        .json<ManualModeEbsComparisonResponse>();

    return response;
}

async function getInstanceListFromStorage(accountId: string, credentialsId: string, region: string) {
    logger.info('Get storage instance list from marketing APIs:', { accountId, credentialsId, region });

    const response = await gotInstanceForInternalRequest
        .get(
            `accounts/${accountId}/marketing/v1/credentials/${credentialsId}/regions/${region}/instances?limit=50&offset=0&force=false`,
            {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN),
                    ...((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && {
                        [HEADERS.SIMULATOR]: 'true'
                    })
                }
            }
        )
        .json<StorageInstanceResponse>();
    return response;
}

async function getVolumesListFromStorage(accountId: string, credentialsId: string, region: string, instanceId: string) {
    logger.info('Get storage volumes list from marketing APIs:', { accountId, credentialsId, region, instanceId });

    const response = await gotInstanceForInternalRequest
        .get(
            `accounts/${accountId}/marketing/v1/credentials/${credentialsId}/regions/${region}/instances/${instanceId}/ebs-volumes`,
            {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN),
                    ...((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && {
                        [HEADERS.SIMULATOR]: 'true'
                    })
                }
            }
        )
        .json<StorageVolumesResponse>();
    return response;
}

export {
    StorageSummary,
    FsxCalculation,
    FsxCostCalculations,
    EbsCostCalculation,
    ManualModeMarketingRequestBody,
    getStorageSavings,
    getManualModeStorageSavings,
    getVolumesListFromStorage,
    getInstanceListFromStorage,
    CalculateEbsComparisonResponse
};
