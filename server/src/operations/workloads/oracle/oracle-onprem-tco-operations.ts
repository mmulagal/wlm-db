import createError from 'http-errors';
import {
    DATABASE_DEPLOYMENT_TYPE,
    DATABASE_TYPE,
    JOBSTATUS,
    JOBTYPE,
    type onprem_tco_reports as OnPremTcoReport
} from '@prisma/client';
import { compact, isEmpty, sumBy } from 'lodash-es';
import { DEFAULT_AWS_REGION, HttpErrorCodes, ORACLE, OracleDeploymentModel } from '../../../utils/consts';
import { IS_DEMO_FLOW, convertGiBToBytes, sizeInGigaBytes } from '../../../utils/utils';
import getLogger from '../../../utils/logger';
import { registerJob } from '../../database/job-operations';
import { updateJob } from '../../../lib/database/job';
import { ONPREM_TCO_CREDENTIALS_ID, NETWORK_PERF } from '../../../utils/continous-optimization-consts';
import {
    OracleCollectionObject,
    OracleDatabaseEntry,
    OracleInstanceInfo,
    OraclePerformanceSummary,
    OracleStatsSummary,
    OracleResourceUtilization
} from '../../../utils/onprem-tco/onprem-tco-generic.types';
import {
    createOnPremTcoReportData,
    listOnPremDatabaseResources,
    updateOnPremTcoReportRecord
} from '../../../lib/database/onprem-tco';
import {
    validateEbsLimits,
    classifyEbsVolumeType,
    processEbsDisks,
    decompressCollectorPayload,
    executeWithJobTracking,
    fetchStorageSavingsFromMarketingApi,
    saveReportInReportingRegistry,
    fetchInstanceTypesByRetryWithPricing,
    validateAndGetRegion,
    deduplicateResourcesByLatestVersion,
    aggregateVolumesByType,
    buildInstanceRequirements,
    buildCombinedEc2Instances,
    fetchPricingForResourcesGeneric,
    buildMachineDetailsForNodes,
    buildComputeCalculationEntry,
    ComputeCalculationEntry,
    PricingDetails,
    EBSClassification,
    EbsVolumeType
} from '../../onprem-tco-operations';
import {
    OracleDatabaseDetailsRequestObjectType,
    OracleDatabaseResourceObjectType
} from '../../../routes/types/onprem-tco.types';
import {
    StorageSavingsRequestBodyType,
    ManualModeInstancesType,
    StorageSavingsResponseType
} from '../../../routes/types/storage-savings.types';
import {
    performManualModeStorageSavingsCalculations,
    getManualModeStorageSavingsCalculationMetrics
} from '../../storage-savings-operations';
import { generateUniqueId, getPowerOfTwoVcpuCount, convertToDate } from '../../../utils/onprem-tco/onprem-tco-utils';

const logger = getLogger();
const ORACLE_ALLOWED_INSTANCE_TYPES = ['r*', 'm*', 'x*'];

function validateOracleCollectionObject(data: OracleCollectionObject): boolean {
    if (!data) {
        return false;
    }
    const { scriptInfo, hostInfo, databases } = data;
    if (!scriptInfo || !hostInfo) {
        return false;
    }
    if (isEmpty(databases)) {
        return false;
    }
    // Validate each database entry
    for (const entry of databases) {
        if (!entry.instanceInfo || !entry.performanceSummary || !entry.storageInfo) {
            return false;
        }
        if (!Array.isArray(entry.performanceSnapshots) || isEmpty(entry.performanceSnapshots)) {
            return false;
        }
    }
    return true;
}

function validateOracleHostInfo(hostInfo: OracleCollectionObject['hostInfo']): boolean {
    if (!hostInfo) {
        return false;
    }
    const { hostname, cpuCount, totalRamBytes } = hostInfo;
    if (!hostname || !cpuCount || !totalRamBytes) {
        return false;
    }
    return true;
}

function getHostUniqueId(hostInfo: OracleCollectionObject['hostInfo']): string {
    const uid = hostInfo.uniqueHostId?.trim();
    if (uid && !uid.startsWith('N/A')) {
        return uid;
    }
    return hostInfo.hostname;
}

function determineOracleDeploymentType(instanceInfo: OracleInstanceInfo): DATABASE_DEPLOYMENT_TYPE {
    return instanceInfo.isDataGuardEnabled ? DATABASE_DEPLOYMENT_TYPE.DG : DATABASE_DEPLOYMENT_TYPE.Standalone;
}

interface OracleResourcePrepData {
    resourceId: string;
    resourceName: string;
    deploymentType: string;
    hostInfo: OracleCollectionObject['hostInfo'];
    entries: OracleDatabaseEntry[];
    aggregated: ReturnType<typeof aggregateDatabaseEntries>;
}

interface OracleResourceWithInstanceTypes extends OracleResourcePrepData {
    currentInstanceType?: string;
    recommendedInstanceType?: string;
}

interface OracleResourceWithPricing extends OracleResourceWithInstanceTypes {
    currentPricing?: PricingDetails;
    recommendedPricing?: PricingDetails;
}

type OracleResourceWithNodeCounts = OracleResourceWithPricing & {
    existingNodeCount: number;
    recommendedNodeCount: number;
};

interface ComputeSavingsEntry {
    resourceName: string;
    hostname: string;
    deploymentType: string;
    existing: ComputeCalculationEntry & { instanceMonthlyPrice: number };
    recommended: ComputeCalculationEntry & { instanceMonthlyPrice: number };
}

interface PerResourceAssessment {
    resourceId: string;
    existingComputeCalculation: ComputeCalculationEntry;
    recommendedComputeCalculation: ComputeCalculationEntry;
    computeSavings: ComputeSavingsEntry;
}

const MIN_ORACLE_VCPUS = 4;

function computeEffectiveVCpus(p95CpuPercent: number, physicalCpuCount: number): number {
    return Math.max(Math.ceil((p95CpuPercent / 100) * physicalCpuCount), MIN_ORACLE_VCPUS);
}

function deriveOracleEc2InstanceListForMarketing(
    instanceType: string,
    entries: OracleDatabaseEntry[],
    region: string,
    deploymentType: string
): ManualModeInstancesType {
    logger.info('Deriving Oracle EC2 Instance List for Marketing API', {
        instanceType,
        entryCount: entries.length,
        deploymentType
    });

    const ebsClassifications: EBSClassification[] = [];

    for (const entry of entries) {
        const { storageInfo, performanceSummary, instanceInfo } = entry;

        const totalDatabaseSizeGiB = storageInfo?.totalDatabaseSizeGB || 100;

        const { iops, throughputMBps } = deriveIopsAndThroughput(performanceSummary);

        validateEbsLimits(totalDatabaseSizeGiB, iops, throughputMBps);
        const ebsType = classifyEbsVolumeType(totalDatabaseSizeGiB, iops, throughputMBps, region);

        const sidLabel = instanceInfo?.instanceName || instanceInfo?.dbName || 'Oracle';
        ebsClassifications.push({
            instanceName: sidLabel,
            numDatabases: 1,
            requiredIops: iops,
            requiredThroughput: throughputMBps,
            ebsType,
            requiredVolumeSize: totalDatabaseSizeGiB,
            isPrimary: true
        });
    }

    const primaryVolumes: EbsVolumeType[] = processEbsDisks(ebsClassifications);

    const ec2Instances: ManualModeInstancesType = [
        {
            ec2InstanceDescription: 'Primary Oracle Database',
            ec2InstanceType: instanceType,
            isPrimary: true,
            volumes: primaryVolumes
        }
    ];

    if (deploymentType === DATABASE_DEPLOYMENT_TYPE.DG) {
        const secondaryClassifications = ebsClassifications.map(c => ({ ...c, isPrimary: false }));
        const secondaryVolumes: EbsVolumeType[] = processEbsDisks(secondaryClassifications);
        ec2Instances.push({
            ec2InstanceDescription: 'Secondary Oracle Database',
            ec2InstanceType: instanceType,
            isPrimary: false,
            volumes: secondaryVolumes
        });
    }

    return ec2Instances;
}

async function deriveOracleHostConfigBasedInstanceType(
    region: string,
    hostInfo: OracleCollectionObject['hostInfo']
): Promise<string | undefined> {
    logger.info('Deriving Oracle host-config-based instance type', { region, hostname: hostInfo.hostname });

    const requiredVCpus = getPowerOfTwoVcpuCount(Math.max(hostInfo.cpuCount, 4));
    const requiredMemoryMiB = Math.max(hostInfo.totalRamBytes / 1024 / 1024, 8192); // At least 8GB

    const instanceRequirements = buildInstanceRequirements({
        vCpuCount: { Min: requiredVCpus, Max: requiredVCpus * 2 },
        memoryMiB: { Min: Math.ceil(requiredMemoryMiB) },
        allowedInstanceTypes: ORACLE_ALLOWED_INSTANCE_TYPES
    });

    try {
        return await fetchInstanceTypesByRetryWithPricing(region, instanceRequirements, 'linux');
    } catch (error) {
        logger.error('Error deriving Oracle host-config-based instance type', { error });
        return undefined;
    }
}

async function deriveOracleInstanceType(
    region: string,
    instanceInfo: OracleInstanceInfo,
    hostInfo: OracleCollectionObject['hostInfo'],
    resourceUtilization?: OracleResourceUtilization,
    aggregatedValues?: {
        totalMemoryGB?: number;
        maxP95Cpu?: number;
    }
): Promise<string | undefined> {
    logger.info('Deriving Oracle instance type', { region, instanceInfo: instanceInfo.instanceName });

    const totalMemoryGB = aggregatedValues?.totalMemoryGB ?? instanceInfo.sgaTargetGB + instanceInfo.pgaTargetGB;
    const requiredMemoryMiB = Math.max(totalMemoryGB * 1024, 8192);

    let requiredVCpus = instanceInfo.vCPUs || hostInfo.cpuCount;

    if (aggregatedValues?.maxP95Cpu != null) {
        requiredVCpus = computeEffectiveVCpus(aggregatedValues.maxP95Cpu, hostInfo.cpuCount);

        logger.info('Using aggregated maxP95Cpu for CPU sizing', {
            maxP95Cpu: aggregatedValues.maxP95Cpu,
            requiredVCpus
        });
    } else if (resourceUtilization?.cpuUtilization && 'p95' in resourceUtilization.cpuUtilization) {
        const p95CpuPercent = (resourceUtilization.cpuUtilization as OracleStatsSummary).p95;
        requiredVCpus = computeEffectiveVCpus(p95CpuPercent, hostInfo.cpuCount);

        logger.info('Using resourceUtilization p95 CPU for sizing', {
            p95CpuPercent,
            requiredVCpus
        });
    }

    // Ensure vCPU count is a power of 2 (AWS instances typically use powers of 2)
    requiredVCpus = getPowerOfTwoVcpuCount(requiredVCpus);

    const instanceRequirements = buildInstanceRequirements({
        vCpuCount: { Min: requiredVCpus, Max: requiredVCpus * 2 },
        memoryMiB: { Min: Math.ceil(requiredMemoryMiB) },
        allowedInstanceTypes: ORACLE_ALLOWED_INSTANCE_TYPES
    });

    try {
        return await fetchInstanceTypesByRetryWithPricing(region, instanceRequirements, 'linux');
    } catch (error) {
        logger.error('Error deriving Oracle instance type', { error });
        return undefined;
    }
}

function groupDatabasesByDeployment(databases: OracleDatabaseEntry[]): Record<string, OracleDatabaseEntry[]> {
    const grouped: Record<string, OracleDatabaseEntry[]> = {};
    for (const entry of databases) {
        const deploymentType = determineOracleDeploymentType(entry.instanceInfo);
        if (!grouped[deploymentType]) {
            grouped[deploymentType] = [];
        }
        grouped[deploymentType].push(entry);
    }
    return grouped;
}

function deriveIopsAndThroughput(performanceSummary: OraclePerformanceSummary | undefined): {
    iops: number;
    throughputMBps: number;
} {
    const {
        sizingStats,
        readIOPS: { avg: readIOPSAvg = 0 } = {},
        writeIOPS: { avg: writeIOPSAvg = 0 } = {},
        readThroughputMBps: { avg: readThroughputAvg = 0 } = {},
        writeThroughputMBps: { avg: writeThroughputAvg = 0 } = {}
    } = performanceSummary || {};

    const iops = sizingStats?.totalIOPS?.recommendedValue || Math.round(readIOPSAvg + writeIOPSAvg);
    const throughputMBps =
        sizingStats?.totalThroughputMBps?.recommendedValue ||
        Math.round((readThroughputAvg + writeThroughputAvg) * 100) / 100;

    return { iops, throughputMBps };
}

function getOracleNodeCounts(
    deploymentType: string,
    entries: OracleDatabaseEntry[]
): { existingNodeCount: number; recommendedNodeCount: number } {
    if (deploymentType === DATABASE_DEPLOYMENT_TYPE.DG) {
        const standbyHostCount = new Set(
            entries.flatMap(e => (e.instanceInfo?.standbyDatabases || []).map(s => s.dbUniqueName))
        ).size;
        return {
            existingNodeCount: 1 + Math.max(standbyHostCount, 1),
            recommendedNodeCount: 2
        };
    }
    return { existingNodeCount: 1, recommendedNodeCount: 1 };
}

async function saveOracleReportInWlmdbDatabase(
    accountId: string,
    data: OracleCollectionObject
): Promise<{ resourceId: string; entries: OracleDatabaseEntry[] }[]> {
    logger.info('Saving Oracle Report in WLMDB Database', { accountId });

    const { hostInfo, databases, scriptInfo } = data;

    if (isEmpty(databases) || isEmpty(hostInfo)) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Error saving report in WLMDB database. No Oracle databases or host data found in the uploaded report.'
        );
    }

    const hostId = getHostUniqueId(hostInfo);
    const timestamp = data.timestamp || scriptInfo.collectionTimestamp;

    const groupedByDeployment = groupDatabasesByDeployment(databases);

    const reports = Object.entries(groupedByDeployment).map(([deploymentType, entries]) => {
        const sidNames = entries.map(e => e.instanceInfo.instanceName || e.instanceInfo.dbName);
        const resourceId = generateUniqueId(accountId, sidNames, [hostId]);
        return {
            account_id: accountId,
            resource_id: resourceId,
            database_type: ORACLE as DATABASE_TYPE,
            host_config: hostInfo,
            database_instances_data: entries,
            database_deployment_type: deploymentType as DATABASE_DEPLOYMENT_TYPE,
            creation_time: convertToDate(timestamp),
            version: scriptInfo.scriptVersion
        };
    });

    // Check for duplicates (same resource ID + timestamp)
    const validReports = await Promise.all(
        reports.map(async report => {
            const existingReport = await getOnPremisesOracleDatabaseResources(
                accountId,
                undefined,
                undefined,
                report.resource_id
            );
            if (existingReport.items.some(item => item.creationTime === report.creation_time.getTime())) {
                logger.error(
                    `Report already generated for Oracle data. Resource ID ${report.resource_id} and timestamp ${report.creation_time} already exists.`
                );
                return null;
            }
            return report;
        })
    );

    const filteredReports = compact(validReports);
    if (isEmpty(filteredReports)) {
        throw new Error('Report already generated for this Oracle collector data.');
    }

    await createOnPremTcoReportData(filteredReports);

    return filteredReports.map(r => ({
        resourceId: r.resource_id,
        entries: r.database_instances_data
    }));
}

async function uploadOracleTcoData(accountId: string, fileName: string, fileContent: string) {
    logger.info('Uploading Oracle collector data', { accountId, fileName });

    try {
        const originalJsonString = decompressCollectorPayload(fileContent);
        const data = JSON.parse(originalJsonString) as OracleCollectionObject;

        if (!validateOracleCollectionObject(data)) {
            const errorMessage = 'Invalid Oracle data format.';
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }

        if (!validateOracleHostInfo(data.hostInfo)) {
            const errorMessage = 'Invalid Oracle hostInfo format.';
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }

        // Register job for tracking
        const { id: jobId } = await registerJob(accountId, ONPREM_TCO_CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            name: 'Upload Oracle on-premises data collector results',
            description: 'Upload Oracle on-premises data collector results in Workload Factory',
            resourceName: data.hostInfo?.hostname,
            startTime: Date.now(),
            endTime: Date.now(),
            status: 'IN_PROGRESS',
            type: JOBTYPE.ASSESSMENT
        });

        // Process upload asynchronously
        handleOracleTcoDataUpload(accountId, fileName, jobId, data);

        return { jobId };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        logger.error('Error uploading Oracle collector data', { accountId, error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error uploading Oracle collector data');
    }
}

async function handleOracleTcoDataUpload(
    accountId: string,
    fileName: string,
    jobId: string,
    data: OracleCollectionObject
) {
    logger.info('Handling Oracle TCO Data Upload', { accountId, fileName, jobId });

    await executeWithJobTracking(accountId, jobId, 'Error uploading Oracle collector data:', async () => {
        await saveOracleReportInWlmdbDatabase(accountId, data);
        await saveReportInReportingRegistry(accountId, fileName, data, 'oracle');
    });
}

/**
 * Aggregate metrics across a group of OracleDatabaseEntry[].
 * - CPU: MAX of p95 across SIDs (host-level metric, all SIDs share CPUs)
 * - IOPS/Throughput: SUM across SIDs (concurrent IO)
 * - Memory (SGA+PGA): SUM across SIDs (each SID's pools coexist in RAM)
 * - Storage: SUM across SIDs
 */
function aggregateDatabaseEntries(entries: OracleDatabaseEntry[]) {
    let totalMemoryGB = 0;
    let totalIOPS = 0;
    let totalThroughputMBps = 0;
    let maxP95Cpu = 0;
    let totalStorageGB = 0;

    for (const entry of entries) {
        const { instanceInfo, performanceSummary, resourceUtilization, storageInfo } = entry;

        // Memory: SUM of SGA + PGA
        totalMemoryGB += (instanceInfo.sgaTargetGB || 0) + (instanceInfo.pgaTargetGB || 0);

        // IOPS/Throughput: SUM of recommendedValue (or avg fallback)
        const { iops: entryIOPS, throughputMBps: entryThroughput } = deriveIopsAndThroughput(performanceSummary);
        totalIOPS += entryIOPS;
        totalThroughputMBps += entryThroughput;

        // CPU: MAX of p95 across SIDs
        const cpuP95 = (resourceUtilization?.cpuUtilization as OracleStatsSummary)?.p95 || 0;
        if (cpuP95 > maxP95Cpu) {
            maxP95Cpu = cpuP95;
        }

        // Storage: SUM
        totalStorageGB += storageInfo?.totalDatabaseSizeGB || 0;
    }

    return { totalMemoryGB, totalIOPS, totalThroughputMBps, maxP95Cpu, totalStorageGB };
}

function applyOracleDatabaseOverrides(
    entries: OracleDatabaseEntry[],
    databaseData?: OracleDatabaseDetailsRequestObjectType[]
): OracleDatabaseEntry[] {
    if (!databaseData?.length) {
        return entries;
    }
    return entries.map(entry => {
        const override = databaseData.find(d => d.databaseId === String(entry.instanceInfo?.dbId));
        if (!override) {
            return entry;
        }
        return {
            ...entry,
            instanceInfo: {
                ...entry.instanceInfo,
                ...(override.noOfVcpusInUse != null && { vCPUs: override.noOfVcpusInUse }),
                ...(override.memory != null && {
                    sgaTargetGB: sizeInGigaBytes(override.memory, 'B'),
                    pgaTargetGB: 0
                })
            },
            storageInfo: {
                ...entry.storageInfo,
                ...(override.totalStorage != null && {
                    totalDatabaseSizeGB: sizeInGigaBytes(override.totalStorage, 'B')
                })
            },
            performanceSummary: {
                ...entry.performanceSummary,
                sizingStats: {
                    ...entry.performanceSummary?.sizingStats,
                    ...(override.totalIops != null && {
                        totalIOPS: {
                            ...entry.performanceSummary?.sizingStats?.totalIOPS,
                            recommendedValue: override.totalIops
                        }
                    }),
                    ...(override.totalThroughput != null && {
                        totalThroughputMBps: {
                            ...entry.performanceSummary?.sizingStats?.totalThroughputMBps,
                            recommendedValue: override.totalThroughput
                        }
                    })
                }
            }
        } as OracleDatabaseEntry;
    });
}

function assembleOracleStorageSavingsResponse(
    existingConfigData: StorageSavingsResponseType | undefined,
    existingConfigCalculations: Record<string, unknown> | undefined,
    recommendedConfigData: StorageSavingsResponseType | undefined,
    recommendedConfigCalculations: Record<string, unknown> | undefined
) {
    const {
        compute: { existing: existingCompute = undefined } = {},
        ebs,
        fsx,
        single,
        multi,
        totalSummary: { existing: existingTotalSummary = undefined } = {}
    } = (existingConfigData || {}) as Partial<StorageSavingsResponseType>;

    const {
        compute: { recommended: recommendedCompute = undefined } = {},
        totalSummary: { recommended: recommendedTotalSummary = undefined } = {}
    } = (recommendedConfigData || {}) as Partial<StorageSavingsResponseType>;

    const storageSavings = {
        compute: { existing: existingCompute, recommended: recommendedCompute },
        license: { existing: undefined, recommended: undefined },
        ebs,
        fsx,
        single,
        multi,
        totalSummary: {
            existing: Number(existingTotalSummary || 0),
            recommended: Number(recommendedTotalSummary || 0)
        }
    };

    const { recommendedComputeCalculation } = (recommendedConfigCalculations || {}) as {
        recommendedComputeCalculation?: unknown;
    };

    const calculations = {
        ...existingConfigCalculations,
        recommendedComputeCalculation,
        recommendedLicenseCalculation: undefined,
        existingLicenseCalculation: undefined,
        totalSummary: {
            existing: Number(existingTotalSummary || 0),
            recommended: Number(recommendedTotalSummary || 0)
        }
    };

    return { storageSavings, calculations };
}

async function computeOracleStorageSavings(
    accountId: string,
    regionCode: string,
    hostInfo: OracleCollectionObject['hostInfo'],
    entries: OracleDatabaseEntry[],
    snapshotInfo?: StorageSavingsRequestBodyType
) {
    const [firstEntry] = entries;
    const { instanceInfo } = firstEntry;
    const aggregated = aggregateDatabaseEntries(entries);
    const deploymentType = determineOracleDeploymentType(instanceInfo);

    const prepData: OracleResourcePrepData = {
        resourceId: '',
        resourceName: hostInfo?.hostname || '',
        deploymentType,
        hostInfo,
        entries,
        aggregated
    };

    const { currentInstanceType, recommendedInstanceType } = await deriveOracleInstanceTypesForResource(
        prepData,
        regionCode
    );

    if (!currentInstanceType || !recommendedInstanceType) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Error deriving Oracle instance requirements. Could not find instance type matching requirements.'
        );
    }

    const { clonedCopiesCount = 1, monthlyChangeRatePercentage = 8, snapshotFrequency = 'Daily' } = snapshotInfo || {};
    const marketingApiDeploymentType =
        deploymentType === DATABASE_DEPLOYMENT_TYPE.Standalone ? 'Standalone' : DATABASE_DEPLOYMENT_TYPE.DG;

    const { existingNodeCount, recommendedNodeCount } = getOracleNodeCounts(deploymentType, entries);
    const ec2Instances = deriveOracleEc2InstanceListForMarketing(
        currentInstanceType,
        entries,
        regionCode,
        deploymentType
    );
    const ec2InstancesRecommended = deriveOracleEc2InstanceListForMarketing(
        recommendedInstanceType,
        entries,
        regionCode,
        deploymentType
    );

    const { existingConfigData, existingConfigCalculations, recommendedConfigData, recommendedConfigCalculations } =
        await fetchStorageSavingsFromMarketingApi({
            accountId,
            regionCode,
            baseParams: {
                clonedCopiesCount,
                snapshotFrequency,
                monthlyChangeRatePercentage,
                sqlServerDeploymentType: marketingApiDeploymentType
            },
            existingEc2Instances: ec2Instances,
            recommendedEc2Instances: ec2InstancesRecommended,
            existingEdition: 'NA',
            recommendedEdition: 'NA',
            existingNodeCount,
            recommendedNodeCount
        });

    const { storageSavings, calculations } = assembleOracleStorageSavingsResponse(
        existingConfigData as StorageSavingsResponseType,
        existingConfigCalculations as Record<string, unknown>,
        recommendedConfigData as StorageSavingsResponseType,
        recommendedConfigCalculations as Record<string, unknown>
    );

    return { storageSavings, calculations };
}

async function analyzeOracleData(
    accountId: string,
    resourceId: string,
    hostInfo: OracleCollectionObject['hostInfo'],
    entries: OracleDatabaseEntry[],
    parentJobId?: string,
    region?: string
) {
    logger.info('Analyzing Oracle Data', { accountId, resourceId, region, entryCount: entries.length });

    let analyzeJobId = '';
    let analyzeJobStatus;
    let analyzeJobError;

    try {
        ({ id: analyzeJobId } = await registerJob(accountId, ONPREM_TCO_CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            name: 'Analyze on-premises Oracle configuration and performance data',
            description: 'Analyze on-premises Oracle configuration and performance data',
            resourceName: hostInfo.hostname,
            startTime: Date.now(),
            endTime: Date.now(),
            status: 'IN_PROGRESS',
            type: JOBTYPE.ASSESSMENT,
            ...(parentJobId && { parentJobId })
        }));

        if (!region || IS_DEMO_FLOW) {
            region = DEFAULT_AWS_REGION;
        }

        const result = await computeOracleStorageSavings(accountId, region, hostInfo, entries);

        await updateOnPremTcoReportRecord(accountId, resourceId, ORACLE, {
            assessment_data: result
        });

        return result;
    } catch (error) {
        logger.error('Error analyzing Oracle on-premises data', { accountId, analyzeJobId, error });
        analyzeJobError = 'Error analyzing Oracle on-premises data';
        analyzeJobStatus = JOBSTATUS.FAILED;
        throw error;
    } finally {
        if (analyzeJobId) {
            await updateJob(
                accountId,
                analyzeJobId,
                undefined,
                analyzeJobStatus || JOBSTATUS.COMPLETED,
                Date.now(),
                analyzeJobError
            );
        }
    }
}

async function getOnPremisesOracleDatabaseResources(
    accountId: string,
    apiPageSize?: number,
    nextToken?: string,
    resourceId?: string
): Promise<{ count: number; items: OracleDatabaseResourceObjectType[]; nextToken?: string }> {
    logger.info('Getting on-premises Oracle database resources', { accountId, apiPageSize, nextToken });

    const oracleDatabaseResourcesDetails = await listOnPremDatabaseResources(
        accountId,
        ORACLE,
        apiPageSize,
        nextToken,
        resourceId ? [resourceId] : undefined
    );

    if (isEmpty(oracleDatabaseResourcesDetails)) {
        logger.info(`No Oracle on-premises database resources found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    const oracleDatabaseResources: OracleDatabaseResourceObjectType[] = oracleDatabaseResourcesDetails.map(
        (resource: OnPremTcoReport) => {
            const {
                resource_id: onpremResourceId,
                host_config: hostConfig,
                database_instances_data: instancesData,
                database_deployment_type: deploymentType,
                creation_time: reportCreationTime
            } = resource;

            const hostInfo = hostConfig as unknown as OracleCollectionObject['hostInfo'];

            const entries = (Array.isArray(instancesData)
                ? instancesData
                : [instancesData]) as unknown as OracleDatabaseEntry[];

            // Build oracleDatabases[] from all entries in this group
            const oracleDatabases = entries.map((entry: OracleDatabaseEntry) => {
                const { instanceInfo, storageInfo: entryStorage, performanceSummary: entryPerf } = entry;
                const deploymentModel = instanceInfo ? determineOracleDeploymentType(instanceInfo) : deploymentType;
                const { iops: entryIops, throughputMBps: entryThroughput } = deriveIopsAndThroughput(entryPerf);

                return {
                    databaseId: String(instanceInfo?.dbId || onpremResourceId),
                    databaseName: instanceInfo?.dbName || 'Unknown',
                    sid: instanceInfo?.instanceName || 'Unknown',
                    oracleVersion: instanceInfo?.oracleVersion || 'Unknown',
                    oracleEdition: instanceInfo?.oracleEdition || 'Unknown',
                    deploymentModel:
                        deploymentModel === DATABASE_DEPLOYMENT_TYPE.DG
                            ? OracleDeploymentModel.DG
                            : OracleDeploymentModel.STANDALONE,
                    isRacEnabled: instanceInfo?.isRacEnabled || false,
                    isDataGuardEnabled: instanceInfo?.isDataGuardEnabled || false,
                    databaseRole: instanceInfo?.databaseRole || 'Unknown',
                    isCDB: instanceInfo?.isCDB || false,
                    vCPUs: instanceInfo?.vCPUs || 0,
                    pdbCount: instanceInfo?.pdbCount ?? (instanceInfo?.pdbList?.length || 0),
                    totalIops: entryIops || 0,
                    totalThroughput: entryThroughput || 0,
                    totalStorage: convertGiBToBytes(entryStorage?.totalDatabaseSizeGB || 0),
                    memory: convertGiBToBytes((instanceInfo?.sgaTargetGB || 0) + (instanceInfo?.pgaTargetGB || 0)),
                    networkPerformance: NETWORK_PERF.UP_TO_10
                };
            });

            // Aggregate totals across all entries
            const totalAllocatedCapacityGB = entries.reduce(
                (sum: number, e: OracleDatabaseEntry) => sum + (e.storageInfo?.totalDatabaseSizeGB || 0),
                0
            );

            const onPremisesNodes = [
                hostInfo?.hostname || 'Unknown',
                ...new Set(entries.flatMap(e => (e.instanceInfo?.standbyDatabases || []).map(s => s.dbUniqueName)))
            ];

            return {
                resourceId: onpremResourceId,
                resourceName: hostInfo?.hostname || 'Unknown',
                deploymentModel:
                    deploymentType === DATABASE_DEPLOYMENT_TYPE.DG
                        ? OracleDeploymentModel.DG
                        : OracleDeploymentModel.STANDALONE,
                creationTime: new Date(reportCreationTime).getTime(),
                oracleDatabases,
                hostInfo: {
                    hostname: hostInfo?.hostname || 'Unknown',
                    cpuCount: hostInfo?.cpuCount || 0,
                    totalRamGB: sizeInGigaBytes(hostInfo?.totalRamBytes || 0, 'B'),
                    storageProtocol: hostInfo?.storageProtocol || 'Unknown'
                },
                totalAllocatedCapacityGB,
                onPremisesNodes
            };
        }
    );

    return {
        count: oracleDatabaseResources.length,
        items: oracleDatabaseResources,
        nextToken:
            oracleDatabaseResourcesDetails?.length === apiPageSize
                ? oracleDatabaseResourcesDetails[oracleDatabaseResourcesDetails.length - 1].id
                : undefined
    };
}

async function getIndividualOracleDatabaseResource(accountId: string, resourceId: string) {
    const {
        items: [oracleDatabaseResource]
    } = await getOnPremisesOracleDatabaseResources(accountId, undefined, undefined, resourceId);

    if (!oracleDatabaseResource) {
        const errorMessage = `Oracle resource ${resourceId} not found for account ${accountId}`;
        logger.error(errorMessage, { accountId, resourceId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    return oracleDatabaseResource;
}

// ─── Bulk helper functions (MSSQL-aligned pattern) ───

function prepareOracleResourceData(
    dbResource: OnPremTcoReport,
    requestResources: Array<{
        resourceId: string;
        databaseData?: OracleDatabaseDetailsRequestObjectType[];
    }>
): OracleResourcePrepData {
    const {
        resource_id: resourceId,
        host_config: hostConfig,
        database_instances_data: instancesData,
        database_deployment_type: deploymentType
    } = dbResource;

    const hostInfo = hostConfig as unknown as OracleCollectionObject['hostInfo'];
    const rawEntries = (Array.isArray(instancesData)
        ? instancesData
        : [instancesData]) as unknown as OracleDatabaseEntry[];

    const requestResource = requestResources.find(r => r.resourceId === resourceId);
    const databaseData = requestResource?.databaseData;

    const entries = applyOracleDatabaseOverrides(rawEntries, databaseData);

    const aggregated = aggregateDatabaseEntries(entries);

    return {
        resourceId,
        resourceName: hostInfo?.hostname || resourceId,
        deploymentType: deploymentType || DATABASE_DEPLOYMENT_TYPE.Standalone,
        hostInfo,
        entries,
        aggregated
    };
}

async function deriveOracleInstanceTypesForResource(
    prepData: OracleResourcePrepData,
    regionCode: string
): Promise<OracleResourceWithInstanceTypes> {
    const { hostInfo, entries, aggregated } = prepData;
    const [firstEntry] = entries;
    const { instanceInfo, resourceUtilization } = firstEntry;

    const [currentInstanceType, recommendedInstanceType] = await Promise.all([
        deriveOracleHostConfigBasedInstanceType(regionCode, hostInfo),
        deriveOracleInstanceType(regionCode, instanceInfo, hostInfo, resourceUtilization, aggregated)
    ]);

    return {
        ...prepData,
        currentInstanceType,
        recommendedInstanceType
    };
}

function collectAndAggregateOracleEbsVolumes(
    validResourceDataList: OracleResourceWithInstanceTypes[],
    regionCode: string
): {
    combinedPrimaryEbsVolumes: EbsVolumeType[];
    combinedSecondaryEbsVolumes: EbsVolumeType[];
    totalNodeCount: number;
} {
    let combinedPrimaryEbsVolumes: EbsVolumeType[] = [];
    let combinedSecondaryEbsVolumes: EbsVolumeType[] = [];
    let totalNodeCount = 0;

    for (const resourceData of validResourceDataList) {
        const { entries, deploymentType } = resourceData;
        const { existingNodeCount } = getOracleNodeCounts(deploymentType, entries);
        totalNodeCount += existingNodeCount;

        const ebsClassifications: EBSClassification[] = [];
        for (const entry of entries) {
            const { storageInfo, performanceSummary, instanceInfo } = entry;
            const totalDatabaseSizeGiB = storageInfo?.totalDatabaseSizeGB || 100;
            const { iops, throughputMBps } = deriveIopsAndThroughput(performanceSummary);

            validateEbsLimits(totalDatabaseSizeGiB, iops, throughputMBps);
            const ebsType = classifyEbsVolumeType(totalDatabaseSizeGiB, iops, throughputMBps, regionCode);

            const sidLabel = instanceInfo?.instanceName || instanceInfo?.dbName || 'Oracle';
            ebsClassifications.push({
                instanceName: sidLabel,
                numDatabases: 1,
                requiredIops: iops,
                requiredThroughput: throughputMBps,
                ebsType,
                requiredVolumeSize: totalDatabaseSizeGiB,
                isPrimary: true
            });
        }

        const resourcePrimaryVolumes: EbsVolumeType[] = processEbsDisks(ebsClassifications);
        combinedPrimaryEbsVolumes = [...combinedPrimaryEbsVolumes, ...resourcePrimaryVolumes];

        if (deploymentType === DATABASE_DEPLOYMENT_TYPE.DG) {
            const secondaryClassifications = ebsClassifications.map(c => ({ ...c, isPrimary: false }));
            const resourceSecondaryVolumes: EbsVolumeType[] = processEbsDisks(secondaryClassifications);
            combinedSecondaryEbsVolumes = [...combinedSecondaryEbsVolumes, ...resourceSecondaryVolumes];
        }
    }

    return {
        combinedPrimaryEbsVolumes: aggregateVolumesByType(combinedPrimaryEbsVolumes),
        combinedSecondaryEbsVolumes: aggregateVolumesByType(combinedSecondaryEbsVolumes),
        totalNodeCount
    };
}

async function fetchOraclePricingForResources(
    resourceDataList: OracleResourceWithInstanceTypes[],
    regionCode: string
): Promise<OracleResourceWithPricing[]> {
    return fetchPricingForResourcesGeneric<OracleResourceWithInstanceTypes, OracleResourceWithPricing>(
        resourceDataList,
        regionCode,
        {
            osType: 'linux',
            getCacheKeys: r => ({
                current: r.currentInstanceType
                    ? { key: r.currentInstanceType, instanceType: r.currentInstanceType }
                    : undefined,
                recommended: r.recommendedInstanceType
                    ? { key: r.recommendedInstanceType, instanceType: r.recommendedInstanceType }
                    : undefined
            }),
            enrichResource: (r, currentPricing, recommendedPricing) => ({
                ...r,
                currentPricing,
                recommendedPricing
            })
        }
    );
}

function buildOraclePerResourceCalculations(resourcesWithPricing: OracleResourceWithNodeCounts[]) {
    const existingComputeCalculation: ComputeCalculationEntry[] = [];
    const recommendedComputeCalculation: ComputeCalculationEntry[] = [];
    const computeSavings: ComputeSavingsEntry[] = [];
    const perResourceAssessmentData: PerResourceAssessment[] = [];

    for (const resourceInfo of resourcesWithPricing) {
        const {
            resourceId,
            resourceName,
            deploymentType,
            existingNodeCount,
            recommendedNodeCount,
            currentInstanceType,
            recommendedInstanceType,
            currentPricing,
            recommendedPricing
        } = resourceInfo;

        const currentBasePrice = currentPricing?.[currentInstanceType!]?.NA?.pricePerUnit || 0;
        const recommendedBasePrice = recommendedPricing?.[recommendedInstanceType!]?.NA?.pricePerUnit || 0;

        const { machineDetails: currentMachineDetails, instanceTypeDisplay: existingInstanceTypeDisplay } =
            buildMachineDetailsForNodes({
                instanceType: currentInstanceType!,
                basePrice: currentBasePrice,
                fullPrice: currentBasePrice,
                licenseIncluded: false,
                nodeCount: existingNodeCount
            });
        const { machineDetails: recommendedMachineDetails, instanceTypeDisplay: recommendedInstanceTypeDisplay } =
            buildMachineDetailsForNodes({
                instanceType: recommendedInstanceType!,
                basePrice: recommendedBasePrice,
                fullPrice: recommendedBasePrice,
                licenseIncluded: false,
                nodeCount: recommendedNodeCount
            });

        const existingEntry = buildComputeCalculationEntry({
            resourceName,
            deploymentType,
            instanceType: existingInstanceTypeDisplay,
            basePrice: currentBasePrice,
            fullPrice: currentBasePrice,
            nodeCount: existingNodeCount,
            machineDetails: currentMachineDetails
        });
        existingComputeCalculation.push(existingEntry);

        const recommendedEntry = buildComputeCalculationEntry({
            resourceName,
            deploymentType,
            instanceType: recommendedInstanceTypeDisplay,
            basePrice: recommendedBasePrice,
            fullPrice: recommendedBasePrice,
            nodeCount: recommendedNodeCount,
            machineDetails: recommendedMachineDetails
        });
        recommendedComputeCalculation.push(recommendedEntry);

        computeSavings.push({
            resourceName,
            hostname: resourceName,
            deploymentType,
            existing: {
                ...existingEntry,
                instanceMonthlyPrice: existingEntry.instanceMonthlyPrice
            },
            recommended: {
                ...recommendedEntry,
                instanceMonthlyPrice: recommendedEntry.instanceMonthlyPrice
            }
        });

        perResourceAssessmentData.push({
            resourceId,
            existingComputeCalculation: existingComputeCalculation[existingComputeCalculation.length - 1],
            recommendedComputeCalculation: recommendedComputeCalculation[recommendedComputeCalculation.length - 1],
            computeSavings: computeSavings[computeSavings.length - 1]
        });
    }

    return {
        existingComputeCalculation,
        recommendedComputeCalculation,
        computeSavings,
        perResourceAssessmentData
    };
}

async function getOracleBulkResourceExploreSavings(
    accountId: string,
    regionCode: string,
    resources: Array<{
        resourceId: string;
        databaseData?: OracleDatabaseDetailsRequestObjectType[];
    }>,
    snapshotInfo?: StorageSavingsRequestBodyType
) {
    logger.info('Getting Oracle Bulk Resource Explore Savings', {
        accountId,
        resourcesCount: resources.length,
        regionCode,
        snapshotInfo
    });

    const region = validateAndGetRegion(regionCode);

    const resourceIds = compact(resources.map(r => r.resourceId));
    const onPremDatabaseResources = await listOnPremDatabaseResources(
        accountId,
        ORACLE,
        undefined,
        undefined,
        resourceIds
    );

    if (isEmpty(onPremDatabaseResources)) {
        const errorMessage = `No Oracle on-premises database resources found for account ${accountId}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const deduplicatedResources = deduplicateResourcesByLatestVersion(onPremDatabaseResources);

    try {
        // Step 1: Prepare all resource data (merge databaseData overrides)
        const resourcePrepDataList = compact(
            deduplicatedResources.map(resource => prepareOracleResourceData(resource, resources))
        );

        if (isEmpty(resourcePrepDataList)) {
            const errorMessage = 'No valid Oracle resources found for bulk analysis.';
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        // Step 2: Derive instance types for all resources in parallel
        const resourceDataWithInstanceTypes = await Promise.all(
            resourcePrepDataList.map(prepData => deriveOracleInstanceTypesForResource(prepData, regionCode))
        );

        const validResourceDataList = resourceDataWithInstanceTypes.filter(data => {
            if (!data.currentInstanceType || !data.recommendedInstanceType) {
                logger.warn(`Could not derive instance types for Oracle resource ${data.resourceId}, skipping`);
                return false;
            }
            return true;
        });

        if (isEmpty(validResourceDataList)) {
            const errorMessage = 'No valid Oracle resources with instance types found for bulk analysis.';
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        // Step 3: Collect and aggregate EBS volumes across all resources
        const { combinedPrimaryEbsVolumes, combinedSecondaryEbsVolumes, totalNodeCount } =
            collectAndAggregateOracleEbsVolumes(validResourceDataList, regionCode);

        // Step 4: Build combined EC2 instances for marketing API calls
        const { existingEc2Instances } = buildCombinedEc2Instances(
            combinedPrimaryEbsVolumes,
            combinedSecondaryEbsVolumes,
            validResourceDataList[0].currentInstanceType!,
            validResourceDataList[0].recommendedInstanceType!,
            'Combined Primary Oracle Database',
            'Combined Secondary Oracle Database'
        );

        // Step 4a: Build per-resource info with node counts
        const individualResourceInfo = validResourceDataList.map(data => {
            const { existingNodeCount, recommendedNodeCount } = getOracleNodeCounts(data.deploymentType, data.entries);
            return { ...data, existingNodeCount, recommendedNodeCount };
        });

        // Step 5: Prepare base params for marketing API calls
        const {
            clonedCopiesCount = 1,
            monthlyChangeRatePercentage = 8,
            snapshotFrequency = 'Daily'
        } = snapshotInfo || {};

        const hasMultiAzDeployment = validResourceDataList.some(
            data => data.deploymentType !== DATABASE_DEPLOYMENT_TYPE.Standalone
        );
        const marketingApiDeploymentType = hasMultiAzDeployment ? DATABASE_DEPLOYMENT_TYPE.DG : 'Standalone';

        const baseParams = {
            clonedCopiesCount,
            snapshotFrequency,
            monthlyChangeRatePercentage,
            sqlServerDeploymentType: marketingApiDeploymentType
        };

        // Step 7: Call marketing APIs AND fetch per-resource pricing in parallel
        // The recommended marketing API call is intentionally omitted: recommendedTotalSummary is
        // derived from per-resource pricing data (more accurate, avoids an extra API round-trip).
        const [existingConfigData, existingConfigCalculations, resourcesWithPricing] = await Promise.all([
            performManualModeStorageSavingsCalculations(
                accountId,
                regionCode,
                {
                    ...baseParams,
                    ec2Instances: existingEc2Instances,
                    sqlServerEdition: 'NA'
                },
                totalNodeCount,
                true
            ),
            getManualModeStorageSavingsCalculationMetrics(
                accountId,
                regionCode,
                {
                    ...baseParams,
                    ec2Instances: existingEc2Instances,
                    sqlServerEdition: 'NA'
                },
                totalNodeCount,
                true
            ),
            fetchOraclePricingForResources(validResourceDataList, regionCode)
        ]);

        // Step 8: Build per-resource compute calculations from pricing data
        const resourcesWithNodeCounts: OracleResourceWithNodeCounts[] = resourcesWithPricing.map((r, i) => ({
            ...r,
            existingNodeCount: individualResourceInfo[i].existingNodeCount,
            recommendedNodeCount: individualResourceInfo[i].recommendedNodeCount
        }));
        const { existingComputeCalculation, recommendedComputeCalculation, computeSavings } =
            buildOraclePerResourceCalculations(resourcesWithNodeCounts);

        // Step 9: Extract shared storage data from existing config API response
        const {
            ebs,
            fsx,
            single,
            multi,
            totalSummary: { existing: existingTotalSummary = 0 } = {}
        } = existingConfigData as StorageSavingsResponseType;

        const recommendedTotalSummary =
            Number(fsx?.total || 0) + sumBy(recommendedComputeCalculation, 'computeMonthlyPrice');

        // Step 10: Build aggregated response
        const aggregatedCalculations = {
            existingComputeCalculation,
            existingLicenseCalculation: [],
            recommendedComputeCalculation,
            recommendedLicenseCalculation: [],
            ebsCalculation: existingConfigCalculations?.ebsCalculation,
            ebsCloneCalculation: existingConfigCalculations?.ebsCloneCalculation,
            ebsSnapshotCalculation: existingConfigCalculations?.ebsSnapshotCalculation,
            single: existingConfigCalculations?.single,
            multi: existingConfigCalculations?.multi,
            totalSummary: {
                existing: existingTotalSummary,
                recommended: recommendedTotalSummary
            }
        };

        const aggregatedStorageSavings = {
            compute: computeSavings,
            license: [],
            ebs,
            fsx,
            single,
            multi,
            totalSummary: {
                existing: existingTotalSummary,
                recommended: recommendedTotalSummary
            }
        };

        return {
            region,
            regionCode,
            calculations: aggregatedCalculations,
            storageSavings: aggregatedStorageSavings,
            ...(snapshotInfo && { snapshotInfo })
        };
    } catch (error) {
        logger.error('Failed to fetch Oracle bulk assessment data', { accountId, error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch Oracle bulk assessment data');
    }
}

export {
    uploadOracleTcoData,
    getOnPremisesOracleDatabaseResources,
    getIndividualOracleDatabaseResource,
    getOracleBulkResourceExploreSavings,
    deriveOracleInstanceType,
    analyzeOracleData,
    validateOracleCollectionObject,
    validateOracleHostInfo,
    getHostUniqueId,
    saveOracleReportInWlmdbDatabase,
    aggregateDatabaseEntries
};
