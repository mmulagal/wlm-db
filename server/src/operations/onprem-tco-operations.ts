import { compressSync, decompressSync } from 'fflate';
import createError from 'http-errors';
import { DATABASE_TYPE, JOBSTATUS, type onprem_tco_reports as OnPremTcoReport } from '@prisma/client';
import { cloneDeep, compact, isEmpty } from 'lodash-es';
import {
    ArchitectureType,
    CpuManufacturer,
    GetInstanceTypesFromInstanceRequirementsCommandInput,
    InstanceGeneration,
    VirtualizationType
} from '@aws-sdk/client-ec2';
import {
    AWS_REGIONS,
    DEFAULT_AWS_REGION,
    HttpErrorCodes,
    HOURS_IN_MONTH,
    IO2_AVAILABLE_REGIONS,
    WLMDB
} from '../utils/consts';
import { convertGiBToBytes, getArtifactsRegionBucketName, sizeInGigaBytes, validateWithSchema } from '../utils/utils';
import getLogger from '../utils/logger';
import { removeOnPremTcoReportData } from '../lib/database/onprem-tco';
import { updateJob } from '../lib/database/job';
import { getInstanceTypesFromInstanceRequirementsCommand } from '../lib/aws/ec2';
import { preSignedUrl, putObjectBucket } from '../lib/aws/s3';
import {
    REPORTING_BUCKET,
    SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH,
    ORACLE_DATA_COLLECTOR_SCRIPT_PATH
} from '../utils/continous-optimization-consts';
import { getSqlInstancePricingDetails } from './aws/pricing-operations';
import {
    getManualModeStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations
} from './workloads/mssql/mssql-storage-savings-operations';
import { ManualModeInstancesType, StorageSavingsRequestBodyType } from '../routes/types/storage-savings.types';

const { getPreSignedUrl } = preSignedUrl;

const logger = getLogger();

interface EBSClassification {
    instanceName: string;
    numDatabases: number;
    requiredIops: number;
    requiredThroughput: number;
    ebsType: string;
    requiredVolumeSize: number;
    isPrimary: boolean;
}

type EbsVolumeType = {
    volumeType: string;
    volumeNumber: number;
    storageAmount: number;
    volumeIops?: number;
    throughput?: number;
};

interface ExistingRecommendedPair<T = unknown> {
    existing?: T;
    recommended?: T;
}

interface StorageSavingsConfigData {
    compute?: ExistingRecommendedPair;
    license?: ExistingRecommendedPair;
    ebs?: unknown;
    fsx?: unknown;
    single?: unknown;
    multi?: unknown;
    totalSummary?: ExistingRecommendedPair<number>;
}

interface StorageSavingsConfigCalculations {
    existingComputeCalculation?: unknown;
    existingLicenseCalculation?: unknown;
    recommendedComputeCalculation?: unknown;
    recommendedLicenseCalculation?: unknown;
    [key: string]: unknown;
}

interface StorageSavingsMarketingApiParams {
    accountId: string;
    regionCode: string;
    baseParams: {
        clonedCopiesCount: number;
        snapshotFrequency: string;
        monthlyChangeRatePercentage: number;
        sqlServerDeploymentType: string;
        monthlySqlByolCost?: number;
    };
    existingEc2Instances: ManualModeInstancesType;
    recommendedEc2Instances: ManualModeInstancesType;
    existingEdition: string;
    recommendedEdition: string;
    existingNodeCount: number;
    recommendedNodeCount: number;
}

interface MachineDetail {
    instanceType: string;
    price: number;
    basePrice: number;
    computeMonthlyPrice: number;
    instanceMonthlyPrice: number;
    licenseMonthlyPrice: number;
    hoursInMonth: number;
    licenseIncluded: boolean;
}

interface ComputeCalculation {
    resourceName: string;
    deploymentType: string;
    instanceType: string;
    computeHourlyPrice: number;
    computeMonthlyPrice: number;
    instanceMonthlyPrice: number;
    hoursInMonth: number;
    machineDetails: MachineDetail[];
}

interface LicenseCalculation {
    resourceName: string;
    deploymentType: string;
    sqlServerEdition: string;
    licenseHourlyPrice: number;
    licenseIncluded: boolean;
    licenseMonthlyPrice: number;
    hoursInMonth: number;
}

interface SavedAssessmentData {
    regionCode: string;
    existingInstanceType: string;
    recommendedInstanceType: string;
    existingComputeCalculation: ComputeCalculation;
    recommendedComputeCalculation: ComputeCalculation;
    existingLicenseCalculation?: LicenseCalculation;
    recommendedLicenseCalculation?: LicenseCalculation;
    licenseFinding?: string;
}

function uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

async function generatePayload(accountId: string, fileName: string, fileContent: Buffer) {
    logger.info('Generate a payload', { accountId, fileName });

    const fileContentString = uint8ArrayToBase64(fileContent);
    const base64Bytes = new TextEncoder().encode(fileContentString);
    const compressedData = compressSync(base64Bytes);
    const compressedBase64 = Buffer.from(compressedData).toString('base64');

    return {
        fileName,
        fileContent: compressedBase64
    };
}

async function deleteOnPremTcoReportResourceRecord(
    accountId: string,
    resourceIds: string,
    databaseType: DATABASE_TYPE = DATABASE_TYPE.mssql
) {
    logger.info(`Deleting on-prem TCO report for database type: ${databaseType}`, {
        accountId,
        resourceIds,
        databaseType
    });

    const resourcesIdList = compact(resourceIds.split(','));
    try {
        const response = await removeOnPremTcoReportData(undefined, accountId, resourcesIdList, databaseType);
        if (response.count === 0) {
            logger.error(`No on-prem TCO report found to delete for database type: ${databaseType}`, {
                accountId,
                resourceIds,
                databaseType
            });
            throw createError(HttpErrorCodes.NOT_FOUND, `Report id ${resourceIds} not found for account ${accountId}`);
        }
        return response;
    } catch (error: unknown) {
        const err = error as { status?: number };
        if (err.status === HttpErrorCodes.NOT_FOUND) {
            throw createError(error as Error);
        }
        logger.error('Error deleting report', { accountId, resourceIds, error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error deleting report');
    }
}

async function fetchInstanceTypesByRetry(
    region: string,
    instanceRequirements: GetInstanceTypesFromInstanceRequirementsCommandInput
): Promise<{ InstanceType: string }[] | undefined> {
    logger.info('Fetching Instance Types by Retry', { region, instanceRequirements });

    let req = cloneDeep(instanceRequirements);
    let { InstanceTypes: instanceTypes } = (await getInstanceTypesFromInstanceRequirementsCommand(region, req)) || {};

    if (
        isEmpty(instanceTypes) &&
        req.InstanceRequirements &&
        !isEmpty(req.InstanceRequirements?.NetworkBandwidthGbps)
    ) {
        logger.info(
            'No instance types matching initial requirements. Removing network bandwidth requirement and trying again.'
        );
        req = cloneDeep(instanceRequirements);
        if (req.InstanceRequirements) {
            delete req.InstanceRequirements.NetworkBandwidthGbps;
        }
        ({ InstanceTypes: instanceTypes = [] } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, req)) || {});
    }

    if (
        isEmpty(instanceTypes) &&
        req.InstanceRequirements?.MemoryMiB &&
        typeof req.InstanceRequirements.MemoryMiB === 'object' &&
        Number.isInteger(req.InstanceRequirements.MemoryMiB.Min)
    ) {
        logger.info(
            'No instance types matching requirements after removing network bandwidth. Resetting minimum memory to minimum possible and trying again.'
        );
        req = cloneDeep(instanceRequirements);
        if (req.InstanceRequirements?.MemoryMiB && typeof req.InstanceRequirements.MemoryMiB === 'object') {
            req.InstanceRequirements = {
                ...req.InstanceRequirements,
                MemoryMiB: { ...req.InstanceRequirements.MemoryMiB, Min: 1024 }
            };
        }
        ({ InstanceTypes: instanceTypes = [] } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, req)) || {});
    }

    if (
        isEmpty(instanceTypes) &&
        req.InstanceRequirements?.VCpuCount &&
        typeof req.InstanceRequirements.VCpuCount === 'object' &&
        Number.isInteger(req.InstanceRequirements.VCpuCount.Max)
    ) {
        logger.info(
            'No instance types matching requirements after resetting minimum memory. Removing maximum CPU criteria and trying again.'
        );
        req = cloneDeep(instanceRequirements);
        if (req.InstanceRequirements?.VCpuCount && typeof req.InstanceRequirements.VCpuCount === 'object') {
            delete req.InstanceRequirements.VCpuCount.Max;
        }
        ({ InstanceTypes: instanceTypes = [] } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, req)) || {});
    }

    const filtered = instanceTypes?.filter((t): t is { InstanceType: string } => typeof t?.InstanceType === 'string');
    return filtered;
}

function validateEbsLimits(volumeSizeGiB: number, iops: number, throughputMBps: number): void {
    if (volumeSizeGiB > 16 * 1024 || iops > 256000 || throughputMBps > 4000) {
        throw new Error('Unsupported configuration; volume size > 16 TiB or IOPS > 256,000 or Throughput > 4,000 MB/s');
    }
}

function classifyEbsVolumeType(
    volumeSizeGiB: number,
    iops: number,
    throughputMBps: number,
    region: string
): 'gp3' | 'io1' | 'io2' {
    if (volumeSizeGiB > 4 && iops >= 64000 && throughputMBps <= 4000) {
        return IO2_AVAILABLE_REGIONS.includes(region) ? 'io2' : 'io1';
    }
    if (volumeSizeGiB > 4 && iops >= 16000 && throughputMBps <= 1000) {
        return 'io1';
    }
    return 'gp3';
}

function processEbsDisks(disks: EBSClassification[]): EbsVolumeType[] {
    logger.info('Processing EBS Disks', { disks: disks.length });

    const ebsTypeCountMap = new Map<
        string,
        {
            volumeType: string;
            volumeNumber: number;
            storageAmount: number;
            volumeIops: number;
            throughput: number;
        }
    >();

    disks
        .filter(disk => disk.numDatabases > 0)
        .forEach((disk: EBSClassification) => {
            if (ebsTypeCountMap.has(disk.ebsType)) {
                const existing = ebsTypeCountMap.get(disk.ebsType)!;

                const { ebsType, numDatabases, requiredVolumeSize, requiredIops, requiredThroughput } = disk;
                const { volumeNumber, storageAmount, volumeIops, throughput } = existing;
                ebsTypeCountMap.set(ebsType, {
                    volumeType: ebsType,
                    volumeNumber: volumeNumber + numDatabases,
                    storageAmount: storageAmount + requiredVolumeSize * numDatabases,
                    // IOPS and throughput would be in a similar range for the same EBS disk type,
                    // considering the max value among all primary or secondary instances which use the same EBS disk type
                    volumeIops: Math.max(volumeIops, requiredIops),
                    throughput: Math.max(throughput, requiredThroughput)
                });
            } else {
                const { ebsType, numDatabases, requiredVolumeSize, requiredIops, requiredThroughput } = disk;
                ebsTypeCountMap.set(ebsType, {
                    volumeType: ebsType,
                    volumeNumber: numDatabases,
                    storageAmount: requiredVolumeSize * numDatabases,
                    volumeIops: requiredIops,
                    throughput: requiredThroughput
                });
            }
        });

    return Array.from(ebsTypeCountMap.values()).map(
        ({ volumeType, volumeNumber, storageAmount: totalStorageAmountPerDiskType, volumeIops, throughput }) => {
            const storageAmountPerDiskType = totalStorageAmountPerDiskType / volumeNumber;
            let adjustedStorage: number;
            let adjustedIops: number;
            let adjustedThroughput: number;

            // https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html#vol-type-ssd
            switch (volumeType) {
                case 'io2':
                    adjustedStorage = Math.min(Math.max(storageAmountPerDiskType, 4), sizeInGigaBytes(64, 'TiB')); // Min 4 GiB, max 64 TiB
                    adjustedIops = Math.min(Math.max(volumeIops, 100), 256000); // Min 100, max 256,000
                    adjustedThroughput = 0; // Throughput is not applicable for io2
                    break;
                case 'io1':
                    adjustedStorage = Math.min(Math.max(storageAmountPerDiskType, 4), sizeInGigaBytes(16, 'TiB')); // Min 4 GiB, max 16 TiB
                    adjustedIops = Math.min(Math.max(volumeIops, 100), 64000); // Min 100, max 64,000
                    adjustedThroughput = 0; // Throughput is not applicable for io1
                    break;
                case 'gp3':
                default:
                    adjustedStorage = Math.min(Math.max(storageAmountPerDiskType, 1), sizeInGigaBytes(16, 'TiB')); // Min 1 GiB, max 16 TiB
                    adjustedIops = Math.min(Math.max(volumeIops, 3000), 16000); // Min 3,000, max 16,000
                    adjustedThroughput = Math.min(Math.max(throughput, 125), 1000); // Min 125 MiB/s, max 1,000 MiB/s
                    break;
            }

            return {
                volumeType,
                volumeNumber,
                storageAmount: convertGiBToBytes(adjustedStorage),
                volumeIops: adjustedIops,
                throughput: adjustedThroughput
            };
        }
    );
}

function aggregateVolumesByType(volumes: EbsVolumeType[]): EbsVolumeType[] {
    const volumeMap = new Map<string, EbsVolumeType>();
    for (const volume of volumes) {
        const existing = volumeMap.get(volume.volumeType);
        if (existing) {
            const hasIops = existing.volumeIops !== undefined || volume.volumeIops !== undefined;
            const hasThroughput = existing.throughput !== undefined || volume.throughput !== undefined;
            const newVolumeNumber = existing.volumeNumber + volume.volumeNumber;
            volumeMap.set(volume.volumeType, {
                volumeType: volume.volumeType,
                volumeNumber: newVolumeNumber,
                storageAmount:
                    (existing.storageAmount * existing.volumeNumber + volume.storageAmount * volume.volumeNumber) /
                    newVolumeNumber,
                volumeIops: hasIops ? Math.max(existing.volumeIops || 0, volume.volumeIops || 0) : undefined,
                throughput: hasThroughput ? Math.max(existing.throughput || 0, volume.throughput || 0) : undefined
            });
        } else {
            volumeMap.set(volume.volumeType, { ...volume });
        }
    }
    return Array.from(volumeMap.values());
}

function decompressCollectorPayload(fileContent: string): string {
    const compressedUint8Array = Uint8Array.from(
        atob(fileContent)
            .split('')
            .map(char => char.charCodeAt(0))
    );
    const decompressedData = decompressSync(compressedUint8Array);
    const decompressedBase64 = new TextDecoder().decode(decompressedData);
    const cleanedBase64 = decompressedBase64.replace(/^ÿþ/, '');
    return atob(cleanedBase64);
}

const COLLECTOR_SCRIPT_PATHS: Record<string, string> = {
    [DATABASE_TYPE.mssql]: SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH,
    [DATABASE_TYPE.oracle]: ORACLE_DATA_COLLECTOR_SCRIPT_PATH
};

async function downloadDataCollectorScript(accountId: string, databaseType: string = DATABASE_TYPE.mssql) {
    const scriptPath = COLLECTOR_SCRIPT_PATHS[databaseType] || SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH;
    logger.info('Downloading data collector script', { accountId, databaseType, scriptPath });
    const bucketname = getArtifactsRegionBucketName(DEFAULT_AWS_REGION);
    const url = await getPreSignedUrl(DEFAULT_AWS_REGION, bucketname, scriptPath);
    return { url };
}

async function saveReportInReportingRegistry(accountId: string, fileName: string, data: unknown, subPath: string = '') {
    logger.info('Saving Report in Reporting Registry', { accountId, fileName });
    const prefix = subPath ? `${WLMDB}/${subPath}` : WLMDB;
    await putObjectBucket(
        DEFAULT_AWS_REGION,
        REPORTING_BUCKET,
        `${prefix}/${accountId}-${fileName}`,
        JSON.stringify(data)
    );
}

async function fetchInstanceTypesByRetryWithPricing(
    region: string,
    instanceRequirements: GetInstanceTypesFromInstanceRequirementsCommandInput,
    osType: string = 'linux',
    licenseType?: string
): Promise<string | undefined> {
    const instanceTypes = await fetchInstanceTypesByRetry(region, instanceRequirements);
    let instanceType = instanceTypes?.[0]?.InstanceType;
    try {
        const allPricing = await getSqlInstancePricingDetails(region, undefined, osType, undefined, licenseType);
        const withPricing = compact(
            Object.keys(allPricing).filter(t => instanceTypes?.some(({ InstanceType: type }) => type === t))
        );
        instanceType = withPricing[0] || instanceType;
    } catch (error) {
        logger.warn('Error fetching instance pricing', { error });
    }
    return instanceType;
}

async function executeWithJobTracking(
    accountId: string,
    jobId: string,
    errorMessagePrefix: string,
    work: () => Promise<void>
): Promise<void> {
    let jobStatus;
    let jobError;
    try {
        await work();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(errorMessagePrefix, { accountId, jobId, error });
        jobError = `${errorMessagePrefix} ${errorMessage}`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJob(accountId, jobId, undefined, jobStatus || JOBSTATUS.COMPLETED, Date.now(), jobError);
    }
}

function validateAndGetRegion(regionCode: string): string {
    const region = AWS_REGIONS.get(regionCode);
    if (!region) {
        const errorMessage = `Invalid region code provided: ${regionCode}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }
    return region;
}

async function fetchStorageSavingsFromMarketingApi(params: StorageSavingsMarketingApiParams) {
    const {
        accountId,
        regionCode,
        baseParams,
        existingEc2Instances,
        recommendedEc2Instances,
        existingEdition,
        recommendedEdition,
        existingNodeCount,
        recommendedNodeCount
    } = params;

    const [existingConfigData, existingConfigCalculations, recommendedConfigData, recommendedConfigCalculations] =
        await Promise.all([
            performManualModeStorageSavingsCalculations(
                accountId,
                regionCode,
                { ...baseParams, ec2Instances: existingEc2Instances, sqlServerEdition: existingEdition },
                existingNodeCount,
                true
            ),
            getManualModeStorageSavingsCalculationMetrics(
                accountId,
                regionCode,
                { ...baseParams, ec2Instances: existingEc2Instances, sqlServerEdition: existingEdition },
                existingNodeCount,
                true
            ),
            performManualModeStorageSavingsCalculations(
                accountId,
                regionCode,
                { ...baseParams, ec2Instances: recommendedEc2Instances, sqlServerEdition: recommendedEdition },
                recommendedNodeCount,
                true
            ),
            getManualModeStorageSavingsCalculationMetrics(
                accountId,
                regionCode,
                { ...baseParams, ec2Instances: recommendedEc2Instances, sqlServerEdition: recommendedEdition },
                recommendedNodeCount,
                true
            )
        ]);

    return { existingConfigData, existingConfigCalculations, recommendedConfigData, recommendedConfigCalculations };
}

function assembleStorageSavingsResponse(
    existingConfigData: StorageSavingsConfigData | undefined,
    existingConfigCalculations: StorageSavingsConfigCalculations | undefined,
    recommendedConfigData: StorageSavingsConfigData | undefined,
    recommendedConfigCalculations: StorageSavingsConfigCalculations | undefined,
    licenseFinding?: string
) {
    const {
        compute: { existing: existingCompute = undefined } = {},
        license: { existing: existingLicense = undefined } = {},
        ebs,
        fsx,
        single,
        multi,
        totalSummary: { existing: existingTotalSummary = undefined } = {}
    } = existingConfigData || {};

    const {
        compute: { recommended: recommendedCompute = undefined } = {},
        license: { recommended: recommendedLicense = undefined } = {},
        totalSummary: { recommended: recommendedTotalSummary = undefined } = {}
    } = recommendedConfigData || {};

    const storageSavings = {
        compute: { existing: existingCompute, recommended: recommendedCompute },
        license: {
            existing: existingLicense,
            recommended: recommendedLicense,
            ...(licenseFinding !== undefined && { finding: licenseFinding })
        },
        ebs,
        fsx,
        single,
        multi,
        totalSummary: { existing: existingTotalSummary, recommended: recommendedTotalSummary }
    };

    const { recommendedComputeCalculation, recommendedLicenseCalculation } = recommendedConfigCalculations || {};

    const calculations = {
        ...existingConfigCalculations,
        recommendedComputeCalculation,
        recommendedLicenseCalculation
    };

    return { storageSavings, calculations };
}

function deduplicateResourcesByLatestVersion(resources: OnPremTcoReport[]): OnPremTcoReport[] {
    logger.info('Deduplicating resources by latest version', { resourceCount: resources.length });
    const sortedResources = [...resources].sort(
        (a, b) => new Date(b.creation_time).getTime() - new Date(a.creation_time).getTime()
    );
    const latestResourcesByResourceId = new Map<string, OnPremTcoReport>();

    for (const resource of sortedResources) {
        if (!latestResourcesByResourceId.has(resource.resource_id)) {
            latestResourcesByResourceId.set(resource.resource_id, resource);
        }
    }
    return Array.from(latestResourcesByResourceId.values());
}

type PricingCacheKeyInfo = {
    key: string;
    instanceType: string;
    licenseType?: string;
};

type PricingDetails = Record<string, Record<string, { pricePerUnit: number }>>;

function getPricePerUnit(
    pricing: PricingDetails | undefined,
    instanceType: string | undefined,
    licenseType: string
): number {
    return pricing?.[instanceType!]?.[licenseType]?.pricePerUnit || 0;
}

function validateOrThrow(schema: object, data: unknown, label: string): void {
    const { isValid, errors } = validateWithSchema(schema, data);
    if (!isValid) {
        const errorMessage = `${label}: ${JSON.stringify(errors)}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
}

function resolveSnapshotDefaults(snapshotInfo?: StorageSavingsRequestBodyType) {
    return {
        clonedCopiesCount: snapshotInfo?.clonedCopiesCount ?? 1,
        monthlyChangeRatePercentage: snapshotInfo?.monthlyChangeRatePercentage ?? 8,
        snapshotFrequency: snapshotInfo?.snapshotFrequency ?? 'Daily',
        monthlySqlByolCost: snapshotInfo?.monthlySqlByolCost
    };
}

async function fetchPricingForResourcesGeneric<TResource, TEnriched>(
    resources: TResource[],
    regionCode: string,
    config: {
        osType: string;
        getCacheKeys: (r: TResource) => {
            current?: PricingCacheKeyInfo;
            recommended?: PricingCacheKeyInfo;
        };
        enrichResource: (
            r: TResource,
            currentPricing: PricingDetails | undefined,
            recommendedPricing: PricingDetails | undefined
        ) => TEnriched;
    }
): Promise<TEnriched[]> {
    const { osType, getCacheKeys, enrichResource } = config;

    const uniquePricingRequests = new Map<string, { instanceType: string; licenseType?: string }>();
    const resourceKeyPairs = resources.map(resource => {
        const keys = getCacheKeys(resource);
        if (keys.current && !uniquePricingRequests.has(keys.current.key)) {
            uniquePricingRequests.set(keys.current.key, {
                instanceType: keys.current.instanceType,
                licenseType: keys.current.licenseType
            });
        }
        if (keys.recommended && !uniquePricingRequests.has(keys.recommended.key)) {
            uniquePricingRequests.set(keys.recommended.key, {
                instanceType: keys.recommended.instanceType,
                licenseType: keys.recommended.licenseType
            });
        }
        return keys;
    });

    const uniqueRequests = Array.from(uniquePricingRequests.entries());
    const pricingResults = await Promise.all(
        uniqueRequests.map(async ([key, { instanceType, licenseType }]) => {
            const pricing = await getSqlInstancePricingDetails(
                regionCode,
                instanceType,
                osType,
                undefined,
                licenseType
            );
            return { key, pricing };
        })
    );

    const pricingCache = new Map<string, PricingDetails>();
    for (const { key, pricing } of pricingResults) {
        pricingCache.set(key, pricing as PricingDetails);
    }

    return resources.map((resource, index) => {
        const keys = resourceKeyPairs[index];
        const currentPricing = keys.current ? pricingCache.get(keys.current.key) : undefined;
        const recommendedPricing = keys.recommended ? pricingCache.get(keys.recommended.key) : undefined;
        return enrichResource(resource, currentPricing, recommendedPricing);
    });
}

function buildMachineDetailsForNodes(params: {
    instanceType: string;
    basePrice: number;
    fullPrice: number;
    licenseIncluded: boolean;
    nodeCount: number;
}): { machineDetails: MachineDetail[]; instanceTypeDisplay: string } {
    const { instanceType, basePrice, fullPrice, licenseIncluded, nodeCount } = params;
    const licensePrice = fullPrice - basePrice;
    const machineDetail: MachineDetail = {
        instanceType,
        price: fullPrice,
        basePrice,
        computeMonthlyPrice: basePrice * HOURS_IN_MONTH,
        instanceMonthlyPrice: fullPrice * HOURS_IN_MONTH,
        licenseMonthlyPrice: licensePrice * HOURS_IN_MONTH,
        hoursInMonth: HOURS_IN_MONTH,
        licenseIncluded
    };
    return {
        machineDetails: Array.from({ length: nodeCount }, () => ({ ...machineDetail })),
        instanceTypeDisplay: Array(nodeCount).fill(instanceType).join(', ')
    };
}

function buildComputeCalculation(params: {
    resourceName: string;
    deploymentType: string;
    instanceType: string;
    basePrice: number;
    fullPrice: number;
    nodeCount: number;
    machineDetails: MachineDetail[];
}): ComputeCalculation {
    const { resourceName, deploymentType, instanceType, basePrice, fullPrice, nodeCount, machineDetails } = params;
    return {
        resourceName,
        deploymentType,
        instanceType,
        computeHourlyPrice: basePrice * nodeCount,
        computeMonthlyPrice: basePrice * HOURS_IN_MONTH * nodeCount,
        instanceMonthlyPrice: fullPrice * HOURS_IN_MONTH * nodeCount,
        hoursInMonth: HOURS_IN_MONTH,
        machineDetails
    };
}

function buildInstanceRequirements(params: {
    vCpuCount: { Min: number; Max: number };
    memoryMiB: { Min: number };
    allowedInstanceTypes: string[];
    networkBandwidthGbps?: { Min?: number; Max?: number };
}): GetInstanceTypesFromInstanceRequirementsCommandInput {
    const { vCpuCount, memoryMiB, allowedInstanceTypes, networkBandwidthGbps } = params;
    return {
        ArchitectureTypes: [ArchitectureType.x86_64],
        VirtualizationTypes: [VirtualizationType.hvm],
        InstanceRequirements: {
            VCpuCount: vCpuCount,
            MemoryMiB: memoryMiB,
            CpuManufacturers: [CpuManufacturer.INTEL, CpuManufacturer.AMAZON_WEB_SERVICES],
            AllowedInstanceTypes: allowedInstanceTypes,
            InstanceGenerations: [InstanceGeneration.CURRENT],
            ...(networkBandwidthGbps && { NetworkBandwidthGbps: networkBandwidthGbps })
        }
    };
}

interface ResourceComputeInput {
    resourceId: string;
    resourceName: string;
    deploymentType: string;
    existingNodeCount: number;
    recommendedNodeCount: number;
    currentInstanceType?: string;
    recommendedInstanceType?: string;
    existing: { basePrice: number; fullPrice: number; licenseIncluded: boolean };
    recommended: { basePrice: number; fullPrice: number; licenseIncluded: boolean };
}

interface ComputeSavings {
    resourceName: string;
    deploymentType: string;
    existing: ComputeCalculation;
    recommended: ComputeCalculation;
}

interface ComputeCalculationsResult {
    existingComputeCalculation: ComputeCalculation[];
    recommendedComputeCalculation: ComputeCalculation[];
    computeSavings: ComputeSavings[];
    perResourceAssessmentData: Array<{
        resourceId: string;
        existingComputeCalculation: ComputeCalculation;
        recommendedComputeCalculation: ComputeCalculation;
        computeSavings: ComputeSavings;
    }>;
}

function buildComputeCalculationsForResources(resources: ResourceComputeInput[]): ComputeCalculationsResult {
    const existingComputeCalculation: ComputeCalculation[] = [];
    const recommendedComputeCalculation: ComputeCalculation[] = [];
    const computeSavings: ComputeSavings[] = [];
    const perResourceAssessmentData: ComputeCalculationsResult['perResourceAssessmentData'] = [];

    for (const resource of resources) {
        const {
            resourceId,
            resourceName,
            deploymentType,
            existingNodeCount,
            recommendedNodeCount,
            currentInstanceType,
            recommendedInstanceType,
            existing,
            recommended
        } = resource;

        const { machineDetails: currentMachineDetails, instanceTypeDisplay: existingInstanceTypeDisplay } =
            buildMachineDetailsForNodes({
                instanceType: currentInstanceType!,
                basePrice: existing.basePrice,
                fullPrice: existing.fullPrice,
                licenseIncluded: existing.licenseIncluded,
                nodeCount: existingNodeCount
            });
        const { machineDetails: recommendedMachineDetails, instanceTypeDisplay: recommendedInstanceTypeDisplay } =
            buildMachineDetailsForNodes({
                instanceType: recommendedInstanceType!,
                basePrice: recommended.basePrice,
                fullPrice: recommended.fullPrice,
                licenseIncluded: recommended.licenseIncluded,
                nodeCount: recommendedNodeCount
            });

        const existingEntry = buildComputeCalculation({
            resourceName,
            deploymentType,
            instanceType: existingInstanceTypeDisplay,
            basePrice: existing.basePrice,
            fullPrice: existing.fullPrice,
            nodeCount: existingNodeCount,
            machineDetails: currentMachineDetails
        });
        existingComputeCalculation.push(existingEntry);

        const recommendedEntry = buildComputeCalculation({
            resourceName,
            deploymentType,
            instanceType: recommendedInstanceTypeDisplay,
            basePrice: recommended.basePrice,
            fullPrice: recommended.fullPrice,
            nodeCount: recommendedNodeCount,
            machineDetails: recommendedMachineDetails
        });
        recommendedComputeCalculation.push(recommendedEntry);

        const savings: ComputeSavings = {
            resourceName,
            deploymentType,
            existing: existingEntry,
            recommended: recommendedEntry
        };
        computeSavings.push(savings);

        perResourceAssessmentData.push({
            resourceId,
            existingComputeCalculation: existingEntry,
            recommendedComputeCalculation: recommendedEntry,
            computeSavings: savings
        });
    }

    return {
        existingComputeCalculation,
        recommendedComputeCalculation,
        computeSavings,
        perResourceAssessmentData
    };
}

function isSavedAssessmentData(data: unknown): data is SavedAssessmentData {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const record = data as Record<string, unknown>;
    return (
        typeof record.regionCode === 'string' &&
        typeof record.existingInstanceType === 'string' &&
        typeof record.recommendedInstanceType === 'string' &&
        !!record.existingComputeCalculation &&
        !!record.recommendedComputeCalculation
    );
}

function buildCombinedEc2Instances(
    combinedPrimaryEbsVolumes: EbsVolumeType[],
    combinedSecondaryEbsVolumes: EbsVolumeType[],
    currentInstanceType: string,
    recommendedInstanceType: string,
    primaryDescription: string = 'Combined Primary',
    secondaryDescription: string = 'Combined Secondary'
): { existingEc2Instances: ManualModeInstancesType; recommendedEc2Instances: ManualModeInstancesType } {
    const existingEc2Instances: ManualModeInstancesType = [];
    const recommendedEc2Instances: ManualModeInstancesType = [];

    if (!isEmpty(combinedPrimaryEbsVolumes)) {
        existingEc2Instances.push({
            ec2InstanceDescription: primaryDescription,
            ec2InstanceType: currentInstanceType,
            isPrimary: true,
            volumes: combinedPrimaryEbsVolumes
        });
        recommendedEc2Instances.push({
            ec2InstanceDescription: primaryDescription,
            ec2InstanceType: recommendedInstanceType,
            isPrimary: true,
            volumes: combinedPrimaryEbsVolumes
        });
    }
    if (!isEmpty(combinedSecondaryEbsVolumes)) {
        existingEc2Instances.push({
            ec2InstanceDescription: secondaryDescription,
            ec2InstanceType: currentInstanceType,
            isPrimary: false,
            volumes: combinedSecondaryEbsVolumes
        });
        recommendedEc2Instances.push({
            ec2InstanceDescription: secondaryDescription,
            ec2InstanceType: recommendedInstanceType,
            isPrimary: false,
            volumes: combinedSecondaryEbsVolumes
        });
    }

    return { existingEc2Instances, recommendedEc2Instances };
}

export {
    generatePayload,
    deleteOnPremTcoReportResourceRecord,
    validateEbsLimits,
    classifyEbsVolumeType,
    processEbsDisks,
    aggregateVolumesByType,
    decompressCollectorPayload,
    downloadDataCollectorScript,
    executeWithJobTracking,
    fetchStorageSavingsFromMarketingApi,
    assembleStorageSavingsResponse,
    saveReportInReportingRegistry,
    fetchInstanceTypesByRetryWithPricing,
    validateAndGetRegion,
    deduplicateResourcesByLatestVersion,
    buildInstanceRequirements,
    buildCombinedEc2Instances,
    fetchPricingForResourcesGeneric,
    buildComputeCalculation,
    MachineDetail,
    ComputeCalculation,
    LicenseCalculation,
    PricingDetails,
    getPricePerUnit,
    validateOrThrow,
    resolveSnapshotDefaults,
    EBSClassification,
    EbsVolumeType,
    SavedAssessmentData,
    isSavedAssessmentData,
    StorageSavingsConfigData,
    StorageSavingsConfigCalculations,
    buildComputeCalculationsForResources,
    ResourceComputeInput
};
