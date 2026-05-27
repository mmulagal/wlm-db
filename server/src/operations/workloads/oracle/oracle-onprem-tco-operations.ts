import createError from 'http-errors';
import {
    DATABASE_DEPLOYMENT_TYPE,
    DATABASE_TYPE,
    JOBTYPE,
    type onprem_tco_reports as OnPremTcoReport
} from '@prisma/client';
import { compact, isEmpty, sumBy } from 'lodash-es';
import throat from 'throat';

import {
    DEFAULT_AWS_REGION,
    HttpErrorCodes,
    isGovCloudRegion,
    ORACLE,
    OracleDeploymentModel
} from '../../../utils/consts';
import { ONPREM_TCO_CREDENTIALS_ID, NETWORK_PERF } from '../../../utils/continous-optimization-consts';
import { convertGiBToBytes, sizeInGigaBytes } from '../../../utils/utils';
import getLogger from '../../../utils/logger';
import {
    OracleCollectionObject,
    OracleDatabaseEntry,
    OracleDatabaseInfo,
    OraclePerformanceSummary,
    OracleStatsSummary,
    OracleResourceUtilization
} from '../../../utils/onprem-tco/onprem-tco-generic.types';
import {
    generateUniqueId,
    getPowerOfTwoVcpuCount,
    convertToDate,
    hasComputeOverrides
} from '../../../utils/onprem-tco/onprem-tco-utils';
import { oracleCollectionObjectSchema, oracleHostInfoSchema } from '../../../utils/onprem-tco/onprem-tco-schemas';
import {
    OracleDatabaseDetailsRequestObjectType,
    OracleDatabaseResourceObjectType
} from '../../../routes/types/onprem-tco.types';
import { StorageSavingsRequestBodyType, StorageSavingsResponseType } from '../../../routes/types/storage-savings.types';

import {
    createOnPremTcoReportData,
    listOnPremDatabaseResources,
    updateOnPremTcoReportRecord
} from '../../../lib/database/onprem-tco';
import { registerJob } from '../../database/job-operations';
import {
    validateEbsLimits,
    classifyEbsVolumeType,
    processEbsDisks,
    decompressCollectorPayload,
    executeWithJobTracking,
    saveReportInReportingRegistry,
    fetchInstanceTypesByRetryWithPricing,
    deriveGovCloudInstanceTypeViaPricingApi,
    validateAndGetRegion,
    deduplicateResourcesByLatestVersion,
    aggregateVolumesByType,
    buildInstanceRequirements,
    buildCombinedEc2Instances,
    fetchPricingForResourcesGeneric,
    buildComputeCalculationsForResources,
    ComputeCalculation,
    ResourceComputeInput,
    PricingDetails,
    getPricePerUnit,
    validateOrThrow,
    rethrowIfClientError,
    resolveSnapshotDefaults,
    EBSClassification,
    EbsVolumeType,
    SavedAssessmentData,
    isSavedAssessmentData
} from '../../onprem-tco-operations';
import {
    getManualModeStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations
} from '../mssql/mssql-storage-savings-operations';

const logger = getLogger();
const ORACLE_ALLOWED_INSTANCE_TYPES = ['r*', 'm*', 'x*'];

function getHostUniqueId(hostInfo: OracleCollectionObject['hostInfo']): string {
    const uid = hostInfo.uniqueHostId?.trim();
    if (uid && !uid.startsWith('N/A')) {
        return uid;
    }
    return hostInfo.hostname;
}

function determineOracleDeploymentType(databaseInfo: OracleDatabaseInfo): DATABASE_DEPLOYMENT_TYPE {
    return databaseInfo.isDataGuardEnabled ? DATABASE_DEPLOYMENT_TYPE.DG : DATABASE_DEPLOYMENT_TYPE.Standalone;
}

interface OracleResourcePrepData {
    resourceId: string;
    resourceName: string;
    deploymentType: string;
    hostInfo: OracleCollectionObject['hostInfo'];
    entries: OracleDatabaseEntry[];
    aggregated: ReturnType<typeof aggregateDatabaseEntries>;
    networkPerformance?: string;
}

interface OracleResourceWithInstanceTypes extends OracleResourcePrepData {
    currentInstanceType?: string;
    recommendedInstanceType?: string;
    savedAssessmentData?: SavedAssessmentData;
}

interface OracleResourceWithPricing extends OracleResourceWithInstanceTypes {
    currentPricing?: PricingDetails;
    recommendedPricing?: PricingDetails;
}

type OracleResourceWithNodeCounts = OracleResourceWithPricing & {
    existingNodeCount: number;
    recommendedNodeCount: number;
};

interface OracleComputeSavingsEntry {
    resourceName: string;
    hostname: string;
    deploymentType: string;
    existing: ComputeCalculation;
    recommended: ComputeCalculation;
}

const MIN_ORACLE_VCPUS = 4;

/**
 * Converts the raw NIC speed (Mbps) collected from the Oracle host into the
 * NETWORK_PERF category used for EC2 instance filtering.
 * - nicSpeedMbps <= 0 or not present → default to UP_TO_10 (conservative)
 * - nicSpeedMbps <= 10 000 (10 Gbps) → UP_TO_10
 * - nicSpeedMbps > 10 000            → ABOVE_10
 */
function networkPerfFromNicSpeed(nicSpeedMbps: number | undefined): string {
    if (!nicSpeedMbps || nicSpeedMbps <= 0) {
        return NETWORK_PERF.UP_TO_10;
    }
    return nicSpeedMbps > 10_000 ? NETWORK_PERF.ABOVE_10 : NETWORK_PERF.UP_TO_10;
}

function computeEffectiveVCpus(p95CpuPercent: number, physicalCpuCount: number): number {
    return Math.max(Math.ceil((p95CpuPercent / 100) * physicalCpuCount), MIN_ORACLE_VCPUS);
}

async function deriveOracleHostConfigBasedInstanceType(
    region: string,
    hostInfo: OracleCollectionObject['hostInfo'],
    networkPerformance?: string
): Promise<string | undefined> {
    logger.info('Deriving Oracle host-config-based instance type', { region, hostname: hostInfo.hostname });

    const requiredVCpus = getPowerOfTwoVcpuCount(Math.max(hostInfo.cpuCount, 4));
    const requiredMemoryMiB = Math.max(hostInfo.totalRamBytes / 1024 / 1024, 8192); // At least 8GB

    const instanceRequirements = buildInstanceRequirements({
        vCpuCount: { Min: requiredVCpus, Max: requiredVCpus * 2 },
        memoryMiB: { Min: Math.ceil(requiredMemoryMiB) },
        allowedInstanceTypes: ORACLE_ALLOWED_INSTANCE_TYPES,
        networkBandwidthGbps:
            networkPerformance === NETWORK_PERF.ABOVE_10
                ? { Min: 10 }
                : networkPerformance === NETWORK_PERF.UP_TO_10
                ? { Max: 10 }
                : undefined
    });

    try {
        // GovCloud EC2 API is unreachable from the commercial server pod without partition credentials;
        // explore-savings is a credential-less flow, so derive from the commercial Pricing API instead.
        return isGovCloudRegion(region)
            ? await deriveGovCloudInstanceTypeViaPricingApi(region, instanceRequirements, 'linux')
            : await fetchInstanceTypesByRetryWithPricing(region, instanceRequirements, 'linux');
    } catch (error) {
        logger.error('Error deriving Oracle host-config-based instance type', { error });
        return undefined;
    }
}

async function deriveOracleInstanceType(
    region: string,
    databaseInfo: OracleDatabaseInfo,
    hostInfo: OracleCollectionObject['hostInfo'],
    resourceUtilization?: OracleResourceUtilization,
    aggregatedValues?: {
        totalMemoryGB?: number;
        maxP95Cpu?: number;
    },
    networkPerformance?: string
): Promise<string | undefined> {
    logger.info('Deriving Oracle instance type', { region, databaseInfo: databaseInfo.instanceName });

    const totalMemoryGB = aggregatedValues?.totalMemoryGB ?? databaseInfo.sgaTargetGB + databaseInfo.pgaTargetGB;
    const requiredMemoryMiB = Math.max(totalMemoryGB * 1024, 8192);

    let requiredVCpus = databaseInfo.vCPUs || hostInfo.cpuCount;

    if (!databaseInfo.vCPUs) {
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
    }

    // Ensure vCPU count is a power of 2 (AWS instances typically use powers of 2)
    requiredVCpus = getPowerOfTwoVcpuCount(requiredVCpus);

    const instanceRequirements = buildInstanceRequirements({
        vCpuCount: { Min: requiredVCpus, Max: requiredVCpus * 2 },
        memoryMiB: { Min: Math.ceil(requiredMemoryMiB) },
        allowedInstanceTypes: ORACLE_ALLOWED_INSTANCE_TYPES,
        networkBandwidthGbps:
            networkPerformance === NETWORK_PERF.ABOVE_10
                ? { Min: 10 }
                : networkPerformance === NETWORK_PERF.UP_TO_10
                ? { Max: 10 }
                : undefined
    });

    try {
        // GovCloud EC2 API is unreachable from the commercial server pod without partition credentials;
        // explore-savings is a credential-less flow, so derive from the commercial Pricing API instead.
        return isGovCloudRegion(region)
            ? await deriveGovCloudInstanceTypeViaPricingApi(region, instanceRequirements, 'linux')
            : await fetchInstanceTypesByRetryWithPricing(region, instanceRequirements, 'linux');
    } catch (error) {
        logger.error('Error deriving Oracle instance type', { error });
        return undefined;
    }
}

function groupDatabasesByDeployment(databases: OracleDatabaseEntry[]): Record<string, OracleDatabaseEntry[]> {
    const grouped: Record<string, OracleDatabaseEntry[]> = {};
    for (const entry of databases) {
        const deploymentType = determineOracleDeploymentType(entry.databaseInfo);
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

// All entries in a DG resource share the same physical host, so partnerNodes
// (which lists primary + standby hostnames) is identical across SIDs — reading
// from entries[0] is sufficient.
function getOracleNodeCounts(
    deploymentType: string,
    entries: OracleDatabaseEntry[]
): { existingNodeCount: number; recommendedNodeCount: number } {
    if (deploymentType === DATABASE_DEPLOYMENT_TYPE.DG) {
        const partnerNodes = entries[0]?.databaseInfo?.partnerNodes;
        let nodeCount: number;
        if (partnerNodes?.length) {
            nodeCount = partnerNodes.length;
        } else {
            const maxStandbyPerSid = Math.max(...entries.map(e => (e.databaseInfo?.standbyDatabases || []).length), 0);
            nodeCount = 1 + Math.max(maxStandbyPerSid, 1);
        }
        return { existingNodeCount: nodeCount, recommendedNodeCount: nodeCount };
    }
    return { existingNodeCount: 1, recommendedNodeCount: 1 };
}

function getStandbyNodesFromBestSid(entries: OracleDatabaseEntry[]): string[] {
    const bestEntry = entries.reduce(
        (best, e) =>
            (e.databaseInfo?.standbyDatabases || []).length > (best.databaseInfo?.standbyDatabases || []).length
                ? e
                : best,
        entries[0]
    );
    return (bestEntry?.databaseInfo?.standbyDatabases || []).map(s => s.dbUniqueName);
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
        const sidNames = entries.map(e => e.databaseInfo.instanceName || e.databaseInfo.dbName);
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
        throw new Error('Report already generated for the collected Oracle Database data.');
    }

    await createOnPremTcoReportData(filteredReports);

    const savedResources = filteredReports.map(r => ({
        resourceId: r.resource_id,
        entries: r.database_instances_data
    }));

    computeAndSaveComputeLicenseData(accountId, hostInfo, savedResources).catch(error =>
        logger.error('Failed to compute and save compute/license data for Oracle', { accountId, error })
    );

    return savedResources;
}

async function uploadOracleTcoData(accountId: string, fileName: string, fileContent: string) {
    logger.info('Uploading Oracle collector data', { accountId, fileName });

    try {
        const originalJsonString = decompressCollectorPayload(fileContent);
        const data = JSON.parse(originalJsonString) as OracleCollectionObject;

        validateOrThrow(oracleCollectionObjectSchema, data, 'Invalid Oracle data format');
        validateOrThrow(oracleHostInfoSchema, data.hostInfo, 'Invalid Oracle hostInfo format');

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

async function computeAndSaveComputeLicenseData(
    accountId: string,
    hostInfo: OracleCollectionObject['hostInfo'],
    savedResources: { resourceId: string; entries: OracleDatabaseEntry[] }[]
) {
    logger.info('Computing and saving compute/license data for Oracle', {
        accountId,
        resourceCount: savedResources.length
    });

    const regionCode = DEFAULT_AWS_REGION;

    await Promise.all(
        savedResources.map(
            throat(5, async ({ resourceId, entries }) => {
                try {
                    const aggregated = aggregateDatabaseEntries(entries);
                    const { databaseInfo, resourceUtilization } = entries[0];
                    const deploymentType = determineOracleDeploymentType(databaseInfo);

                    const networkPerformance = networkPerfFromNicSpeed(hostInfo.nicSpeedMbps);
                    const [existingInstanceType, recommendedInstanceType] = await Promise.all([
                        deriveOracleHostConfigBasedInstanceType(regionCode, hostInfo, networkPerformance),
                        deriveOracleInstanceType(
                            regionCode,
                            databaseInfo,
                            hostInfo,
                            resourceUtilization,
                            aggregated,
                            networkPerformance
                        )
                    ]);

                    if (!existingInstanceType || !recommendedInstanceType) {
                        logger.warn('Could not derive instance types, skipping compute/license caching', {
                            accountId,
                            resourceId
                        });
                        return;
                    }

                    const { existingNodeCount, recommendedNodeCount } = getOracleNodeCounts(deploymentType, entries);

                    const resourcePrepData: OracleResourcePrepData = {
                        resourceId,
                        resourceName: hostInfo?.hostname || resourceId,
                        deploymentType,
                        hostInfo,
                        entries,
                        aggregated
                    };

                    const resourceWithInstanceTypes: OracleResourceWithInstanceTypes = {
                        ...resourcePrepData,
                        currentInstanceType: existingInstanceType,
                        recommendedInstanceType
                    };

                    const [resourceWithPricing] = await fetchOraclePricingForResources(
                        [resourceWithInstanceTypes],
                        regionCode
                    );

                    const resourceWithNodeCounts: OracleResourceWithNodeCounts = {
                        ...resourceWithPricing,
                        existingNodeCount,
                        recommendedNodeCount
                    };

                    const { existingComputeCalculation, recommendedComputeCalculation } =
                        buildOraclePerResourceCalculations([resourceWithNodeCounts]);

                    const cachedData: SavedAssessmentData = {
                        regionCode,
                        existingInstanceType,
                        recommendedInstanceType,
                        existingComputeCalculation: existingComputeCalculation[0],
                        recommendedComputeCalculation: recommendedComputeCalculation[0]
                    };

                    await updateOnPremTcoReportRecord(accountId, resourceId, ORACLE, {
                        assessment_data: cachedData
                    });

                    logger.info('Saved compute/license data for Oracle resource', { accountId, resourceId });
                } catch (error) {
                    logger.error('Failed to compute compute/license data for Oracle resource', {
                        accountId,
                        resourceId,
                        error
                    });
                }
            })
        )
    );
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
        const { databaseInfo, performanceSummary, resourceUtilization, storageInfo } = entry;

        // Memory: SUM of SGA + PGA
        totalMemoryGB += (databaseInfo.sgaTargetGB || 0) + (databaseInfo.pgaTargetGB || 0);

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
        const override = databaseData.find(d => d.databaseId === String(entry.databaseInfo?.dbId));
        if (!override) {
            return entry;
        }
        return {
            ...entry,
            databaseInfo: {
                ...entry.databaseInfo,
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
                const { databaseInfo, storageInfo: entryStorage, performanceSummary: entryPerf } = entry;
                const {
                    dbId,
                    dbName,
                    instanceName,
                    oracleVersion,
                    oracleEdition,
                    isRacEnabled,
                    isDataGuardEnabled,
                    databaseRole,
                    isCDB,
                    vCPUs,
                    pdbCount,
                    pdbList,
                    sgaTargetGB,
                    pgaTargetGB
                } = databaseInfo || ({} as Partial<OracleDatabaseInfo>);
                const deploymentModel = databaseInfo ? determineOracleDeploymentType(databaseInfo) : deploymentType;
                const { iops: entryIops, throughputMBps: entryThroughput } = deriveIopsAndThroughput(entryPerf);

                return {
                    databaseId: String(dbId || onpremResourceId),
                    databaseName: dbName || 'Unknown',
                    sid: instanceName || 'Unknown',
                    oracleVersion: oracleVersion || 'Unknown',
                    oracleEdition: oracleEdition || 'Unknown',
                    deploymentModel:
                        deploymentModel === DATABASE_DEPLOYMENT_TYPE.DG
                            ? OracleDeploymentModel.DG
                            : OracleDeploymentModel.STANDALONE,
                    isRacEnabled: isRacEnabled || false,
                    isDataGuardEnabled: isDataGuardEnabled || false,
                    databaseRole: databaseRole || 'Unknown',
                    isCDB: isCDB || false,
                    vCPUs: vCPUs || 0,
                    pdbCount: pdbCount ?? (pdbList?.length || 0),
                    totalIops: entryIops || 0,
                    totalThroughput: entryThroughput || 0,
                    totalStorage: convertGiBToBytes(entryStorage?.totalDatabaseSizeGB || 0),
                    memory: convertGiBToBytes((sgaTargetGB || 0) + (pgaTargetGB || 0)),
                    networkPerformance: networkPerfFromNicSpeed(hostInfo?.nicSpeedMbps)
                };
            });

            // Aggregate totals across all entries
            const totalAllocatedCapacityGB = entries.reduce(
                (sum: number, e: OracleDatabaseEntry) => sum + (e.storageInfo?.totalDatabaseSizeGB || 0),
                0
            );

            const partnerNodes = entries[0]?.databaseInfo?.partnerNodes;
            const onPremisesNodes = partnerNodes?.length
                ? partnerNodes
                : [hostInfo?.hostname || 'Unknown', ...getStandbyNodesFromBestSid(entries)];

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

    const networkPerformance = databaseData?.find(d => d.networkPerformance)?.networkPerformance;

    return {
        resourceId,
        resourceName: hostInfo?.hostname || resourceId,
        deploymentType: deploymentType || DATABASE_DEPLOYMENT_TYPE.Standalone,
        hostInfo,
        entries,
        aggregated,
        networkPerformance
    };
}

async function deriveOracleInstanceTypesForResource(
    prepData: OracleResourcePrepData,
    regionCode: string,
    hasUserOverrides: boolean
): Promise<OracleResourceWithInstanceTypes> {
    const { hostInfo, entries, aggregated, networkPerformance } = prepData;
    const [firstEntry] = entries;
    const { databaseInfo, resourceUtilization } = firstEntry;

    const [currentInstanceType, recommendedInstanceType] = await Promise.all([
        hasUserOverrides
            ? deriveOracleInstanceType(
                  regionCode,
                  databaseInfo,
                  hostInfo,
                  resourceUtilization,
                  aggregated,
                  networkPerformance
              )
            : deriveOracleHostConfigBasedInstanceType(regionCode, hostInfo, networkPerformance),
        deriveOracleInstanceType(
            regionCode,
            databaseInfo,
            hostInfo,
            resourceUtilization,
            aggregated,
            networkPerformance
        )
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
            const { storageInfo, performanceSummary, databaseInfo } = entry;
            const totalDatabaseSizeGiB = storageInfo?.totalDatabaseSizeGB || 100;
            const { iops, throughputMBps } = deriveIopsAndThroughput(performanceSummary);

            validateEbsLimits(totalDatabaseSizeGiB, iops, throughputMBps);
            const ebsType = classifyEbsVolumeType(totalDatabaseSizeGiB, iops, throughputMBps, regionCode);

            const sidLabel = databaseInfo?.instanceName || databaseInfo?.dbName || 'Oracle';
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

async function fetchOraclePricingForResources<TResource extends OracleResourceWithInstanceTypes>(
    resourceDataList: TResource[],
    regionCode: string
): Promise<(TResource & OracleResourceWithPricing)[]> {
    return fetchPricingForResourcesGeneric<TResource, TResource & OracleResourceWithPricing>(
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
    const inputs: ResourceComputeInput[] = resourcesWithPricing.map(
        ({
            currentPricing,
            currentInstanceType,
            recommendedPricing,
            recommendedInstanceType,
            resourceId,
            resourceName,
            deploymentType,
            existingNodeCount,
            recommendedNodeCount
        }) => {
            const currentBasePrice = getPricePerUnit(currentPricing, currentInstanceType, 'NA');
            const recommendedBasePrice = getPricePerUnit(recommendedPricing, recommendedInstanceType, 'NA');
            return {
                resourceId,
                resourceName,
                deploymentType,
                existingNodeCount,
                recommendedNodeCount,
                currentInstanceType,
                recommendedInstanceType,
                existing: { basePrice: currentBasePrice, fullPrice: currentBasePrice, licenseIncluded: false },
                recommended: {
                    basePrice: recommendedBasePrice,
                    fullPrice: recommendedBasePrice,
                    licenseIncluded: false
                }
            };
        }
    );

    const result = buildComputeCalculationsForResources(inputs);

    const oracleComputeSavings: OracleComputeSavingsEntry[] = result.computeSavings.map(s => ({
        ...s,
        hostname: s.resourceName
    }));

    return {
        existingComputeCalculation: result.existingComputeCalculation,
        recommendedComputeCalculation: result.recommendedComputeCalculation,
        computeSavings: oracleComputeSavings,
        perResourceAssessmentData: result.perResourceAssessmentData
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

    validateAndGetRegion(regionCode);

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

        // Step 2: Derive instance types — skip for resources with valid cached assessment data
        // (same region, no user overrides). Those resources reuse cached compute calculations directly
        // instead of re-deriving instance types and re-fetching pricing.
        //
        // Iterate over resourcePrepDataList (post-compact) rather than deduplicatedResources so that
        // index i always corresponds to the correct prepData. compact() removes null entries and shifts
        // indices, so indexing into resourcePrepDataList[i] via deduplicatedResources[i] would silently
        // pair the wrong rawRecord with a prepData after any null is removed.
        const resourceDataWithInstanceTypes = await Promise.all(
            resourcePrepDataList.map(async prepData => {
                const rawRecord = deduplicatedResources.find(r => r.resource_id === prepData.resourceId);
                if (!rawRecord) {
                    return Promise.resolve(null);
                }

                const requestResource = resources.find(r => r.resourceId === prepData.resourceId);
                const cachedData = rawRecord.assessment_data;

                // Only bypass the cache if compute-affecting fields (vCPUs, memory, network) differ
                // from what was used to generate the saved assessment. Storage/IOPS/throughput overrides
                // only affect EBS sizing and do not require re-deriving instance types.
                const persistedEntries = (Array.isArray(rawRecord.database_instances_data)
                    ? rawRecord.database_instances_data
                    : [rawRecord.database_instances_data]) as unknown as OracleDatabaseEntry[];
                const persistedHostInfo = rawRecord.host_config as unknown as OracleCollectionObject['hostInfo'];
                const persistedNetworkPerformance = networkPerfFromNicSpeed(persistedHostInfo?.nicSpeedMbps);
                const hasOverrides = hasComputeOverrides(
                    requestResource?.databaseData?.map(db => ({
                        id: db.databaseId,
                        vcpus: db.noOfVcpusInUse,
                        memoryBytes: db.memory,
                        networkPerformance: db.networkPerformance
                    })),
                    (persistedEntries ?? []).map(entry => ({
                        id: String(entry.databaseInfo?.dbId),
                        vcpus: entry.databaseInfo?.vCPUs ?? 0,
                        memoryBytes: convertGiBToBytes(
                            (entry.databaseInfo?.sgaTargetGB ?? 0) + (entry.databaseInfo?.pgaTargetGB ?? 0)
                        ),
                        networkPerformance: persistedNetworkPerformance
                    }))
                );

                if (!hasOverrides && isSavedAssessmentData(cachedData) && cachedData.regionCode === regionCode) {
                    logger.info('Using cached assessment data for Oracle bulk resource (no compute overrides)', {
                        accountId,
                        resourceId: prepData.resourceId
                    });
                    return {
                        ...prepData,
                        currentInstanceType: cachedData.existingInstanceType,
                        recommendedInstanceType: cachedData.recommendedInstanceType,
                        savedAssessmentData: cachedData
                    };
                }

                const result = await deriveOracleInstanceTypesForResource(prepData, regionCode, hasOverrides);
                return {
                    ...result,
                    savedAssessmentData: undefined as SavedAssessmentData | undefined
                };
            })
        );

        const validResourceDataList = compact(resourceDataWithInstanceTypes).filter(data => {
            if (!data.currentInstanceType || !data.recommendedInstanceType) {
                logger.warn(`Could not derive instance types for Oracle resource ${data.resourceId}, skipping`);
                return false;
            }
            return true;
        });

        if (isEmpty(validResourceDataList)) {
            const errorMessage = 'No valid Oracle resources with instance types found for bulk analysis.';
            throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
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
        const { clonedCopiesCount, monthlyChangeRatePercentage, snapshotFrequency } =
            resolveSnapshotDefaults(snapshotInfo);

        const hasMultiAzDeployment = validResourceDataList.some(
            data => data.deploymentType !== DATABASE_DEPLOYMENT_TYPE.Standalone
        );
        const marketingApiDeploymentType = hasMultiAzDeployment
            ? DATABASE_DEPLOYMENT_TYPE.DG
            : DATABASE_DEPLOYMENT_TYPE.Standalone;

        const baseParams = {
            clonedCopiesCount,
            snapshotFrequency,
            monthlyChangeRatePercentage,
            sqlServerDeploymentType: marketingApiDeploymentType
        };

        // Step 7: Call marketing APIs AND fetch per-resource pricing in parallel.
        // For resources with cached assessment data, pricing is not re-fetched — cached
        // compute calculations are used directly instead.
        // The recommended marketing API call is intentionally omitted: recommendedTotalSummary is
        // derived from per-resource pricing data (more accurate, avoids an extra API round-trip).
        const resourcesNeedingPricing = individualResourceInfo.filter(info => !info.savedAssessmentData);

        const [existingConfigData, existingConfigCalculations, pricedResources] = await Promise.all([
            performManualModeStorageSavingsCalculations(
                accountId,
                regionCode,
                {
                    ...baseParams,
                    ec2Instances: existingEc2Instances,
                    sqlServerEdition: 'NA'
                },
                totalNodeCount,
                true,
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
                true,
                true
            ),
            fetchOraclePricingForResources(resourcesNeedingPricing, regionCode)
        ]);

        // Step 8: Build per-resource compute calculations in original order.
        // Resources with saved assessment data use their stored calculations directly;
        // the rest already carry node counts and go through buildOraclePerResourceCalculations
        // with fresh pricing.
        const {
            existingComputeCalculation: pricedExisting,
            recommendedComputeCalculation: pricedRecommended,
            computeSavings: pricedComputeSavings,
            perResourceAssessmentData: pricedPerResourceAssessment
        } = buildOraclePerResourceCalculations(pricedResources);

        const pricedByResourceId = new Map(
            pricedPerResourceAssessment.map((entry, idx) => [
                entry.resourceId,
                {
                    existingCompute: pricedExisting[idx],
                    recommendedCompute: pricedRecommended[idx],
                    computeSaving: pricedComputeSavings[idx]
                }
            ])
        );

        const existingComputeCalculation: ComputeCalculation[] = [];
        const recommendedComputeCalculation: ComputeCalculation[] = [];
        const computeSavings: OracleComputeSavingsEntry[] = [];

        for (const { resourceId, resourceName, deploymentType, savedAssessmentData: saved } of individualResourceInfo) {
            if (saved) {
                existingComputeCalculation.push(saved.existingComputeCalculation);
                recommendedComputeCalculation.push(saved.recommendedComputeCalculation);
                computeSavings.push({
                    resourceName,
                    hostname: resourceName,
                    deploymentType,
                    existing: saved.existingComputeCalculation,
                    recommended: saved.recommendedComputeCalculation
                });
            } else {
                const priced = pricedByResourceId.get(resourceId)!;
                existingComputeCalculation.push(priced.existingCompute);
                recommendedComputeCalculation.push(priced.recommendedCompute);
                computeSavings.push(priced.computeSaving);
            }
        }

        // Step 9: Extract shared storage data from existing config API response
        const { ebs, fsx, single, multi } = existingConfigData as StorageSavingsResponseType;

        // Compute both totals consistently using per-resource compute calculations
        const existingTotalSummary = Number(ebs?.total || 0) + sumBy(existingComputeCalculation, 'computeMonthlyPrice');
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
            regionCode,
            calculations: aggregatedCalculations,
            storageSavings: aggregatedStorageSavings,
            ...(snapshotInfo && { snapshotInfo })
        };
    } catch (error) {
        logger.error('Failed to fetch Oracle bulk assessment data', { accountId, error });
        rethrowIfClientError(error);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to fetch Oracle bulk assessment data: ${(error as Error).message}`
        );
    }
}

export {
    uploadOracleTcoData,
    getOnPremisesOracleDatabaseResources,
    getIndividualOracleDatabaseResource,
    getOracleBulkResourceExploreSavings,
    deriveOracleInstanceType,
    getHostUniqueId,
    saveOracleReportInWlmdbDatabase,
    aggregateDatabaseEntries
};
