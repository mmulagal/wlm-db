import createError from 'http-errors';
import {
    DATABASE_DEPLOYMENT_TYPE,
    DATABASE_TYPE,
    JOBTYPE,
    type onprem_tco_reports as OnPremTcoReport
} from '@prisma/client';
import { compact, isEmpty, sumBy } from 'lodash-es';
import { GetInstanceTypesFromInstanceRequirementsCommandInput } from '@aws-sdk/client-ec2';
import {
    DEFAULT_AWS_REGION,
    FINDING,
    HttpErrorCodes,
    MSSQL,
    PRICING_LICENSE_KEYS,
    HOURS_IN_MONTH
} from '../../../utils/consts';
import { convertGiBToBytes, convertToBytes, sizeInGigaBytes, IS_DEMO_FLOW } from '../../../utils/utils';
import getLogger from '../../../utils/logger';
import { registerJob } from '../../database/job-operations';
import { NETWORK_PERF, ONPREM_TCO_CREDENTIALS_ID } from '../../../utils/continous-optimization-consts';
import {
    OnPremCollectionObject,
    SqlInstanceDetails,
    StorageDetailByDB,
    WindowsConfig
} from '../../../utils/onprem-tco/onprem-tco-generic.types';
import {
    createOnPremTcoReportData,
    listOnPremDatabaseResources,
    updateOnPremTcoReportRecord
} from '../../../lib/database/onprem-tco';
import {
    processEbsDisks,
    aggregateVolumesByType,
    validateEbsLimits,
    classifyEbsVolumeType,
    decompressCollectorPayload,
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
    buildMachineDetailsForNodes,
    buildComputeCalculationEntry,
    ComputeCalculationEntry,
    PricingDetails,
    EBSClassification,
    EbsVolumeType
} from '../../onprem-tco-operations';
import {
    getManualModeStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations
} from '../../storage-savings-operations';
import {
    parseCpuUtilization,
    parseMemoryUtilization,
    parseLicenceUsageDetails,
    parseIops,
    convertToDate,
    generateUniqueId,
    parseStorageDetailsByDb,
    parseAoagReadReplica,
    parseSqlVersion,
    getPowerOfTwoVcpuCount
} from '../../../utils/onprem-tco/onprem-tco-utils';
import { isNonFreeEnterpriseEdition } from '../../recommendation-operations';
import {
    ManualModeInstancesType,
    StorageSavingsMetricsCalculationsResponseType,
    StorageSavingsRequestBodyType,
    StorageSavingsResponseType
} from '../../../routes/types/storage-savings.types';
import {
    OnPremDatabaseResourcesObjectType,
    SqlInstanceDetailsRequestObjectType
} from '../../../routes/types/onprem-tco.types';

const logger = getLogger();

const ENTERPRISE_EDITION = 'Enterprise Edition';
const STANDARD_EDITION = 'Standard Edition';
const MSSQL_ALLOWED_INSTANCE_TYPES = ['m*', 'c*', 'r*'];

interface LicenseCalculationEntry {
    resourceName: string;
    deploymentType: string;
    sqlServerEdition: string;
    licenseHourlyPrice: number;
    licenseIncluded: boolean;
    licenseMonthlyPrice: number;
    hoursInMonth: number;
}

interface MssqlComputeSavingsEntry {
    resourceName: string;
    deploymentType: string;
    existing: ComputeCalculationEntry;
    recommended: ComputeCalculationEntry;
}

interface MssqlLicenseSavingsEntry {
    resourceName: string;
    deploymentType: string;
    existing: Omit<LicenseCalculationEntry, 'resourceName' | 'deploymentType'>;
    recommended: Omit<LicenseCalculationEntry, 'resourceName' | 'deploymentType'>;
    finding: string;
}

interface MssqlPerResourceAssessment {
    resourceId: string;
    existingComputeCalculation: ComputeCalculationEntry;
    existingLicenseCalculation: LicenseCalculationEntry;
    recommendedComputeCalculation: ComputeCalculationEntry;
    recommendedLicenseCalculation: LicenseCalculationEntry;
    computeSavings: MssqlComputeSavingsEntry;
    licenseSavings: MssqlLicenseSavingsEntry;
}

function validateOnPremCollectionObject(data: OnPremCollectionObject): boolean {
    if (!data) {
        return false;
    }
    const { windowsConfig, sqlServerInfo, scriptVersion, timestamp } = data;
    if (!windowsConfig || !sqlServerInfo || !scriptVersion || !timestamp) {
        return false;
    }
    if (!Array.isArray(sqlServerInfo) || sqlServerInfo.length === 0) {
        return false;
    }
    return true;
}

function validateWindowsConfig(windowsConfig: WindowsConfig): boolean {
    if (!windowsConfig) {
        return false;
    }
    const { windowsSystemName, nodeDetails } = windowsConfig;
    if (!windowsSystemName || !Array.isArray(nodeDetails) || nodeDetails.length === 0) {
        return false;
    }
    return nodeDetails.every(node => node.hostId && node.numberOfVcpus && node.ramSize);
}

function formatSqlInstanceDetails(sqlInstances: SqlInstanceDetails[]) {
    return compact(
        sqlInstances.map(instance => {
            try {
                const { isReadReplica, instanceGuid, sqlInstanceName, sqlEdition, vcpusPerInstance } = instance;
                const {
                    numDatabases: { primary: numDatabases, secondary: numDatabasesSecondary },
                    totalIops,
                    totalThroughput,
                    totalStorage,
                    sqlVersion,
                    memoryDetails,
                    totalSecondaryStorage
                } = parseSqlUsageParams(instance);

                return {
                    sqlInstanceId: instanceGuid,
                    sqlInstanceName,
                    noOfDatabases: numDatabases + (numDatabasesSecondary || 0),
                    sqlEdition,
                    sqlVersion,
                    noOfVcpusInUse: parseInt(vcpusPerInstance, 10),
                    memory: memoryDetails?.used || 0,
                    networkPerformance: NETWORK_PERF.UP_TO_10,
                    totalIops,
                    totalThroughput,
                    isReadReplica: !!(isReadReplica && isReadReplica?.toLowerCase() === 'true'),
                    totalStorage: convertGiBToBytes(totalStorage || 0) + convertGiBToBytes(totalSecondaryStorage || 0)
                };
            } catch (error) {
                logger.error('Failed to format SQL instance details', { instance, error });
                return null;
            }
        })
    );
}

function calculateTotalAllocatedCapacity(sqlServerInfo: SqlInstanceDetails[]): string {
    let totalAllocatedMb = 0;

    for (const instance of sqlServerInfo) {
        let storageDetails: StorageDetailByDB[] = [];

        // Parse storage details
        if (typeof instance.storageDetailsByDb === 'string') {
            try {
                storageDetails = JSON.parse(instance.storageDetailsByDb);
            } catch (error) {
                logger.error('Failed to parse storageDetailsByDb JSON in calculateTotalAllocatedCapacity', {
                    rawStorageDetails: instance.storageDetailsByDb,
                    error
                });
            }
        } else if (Array.isArray(instance.storageDetailsByDb)) {
            storageDetails = instance.storageDetailsByDb;
        }

        // Sum up allocated sizes only if we have valid storage details
        if (storageDetails.length > 0) {
            totalAllocatedMb += sumBy(storageDetails, db => db?.allocatedSizeMb ?? 0);
        }
    }

    return String(convertToBytes(totalAllocatedMb, 'MiB')); // MiB to bytes as string
}

async function saveReportInWlmdbDatabase(
    accountId: string,
    databaseType: DATABASE_TYPE,
    data: OnPremCollectionObject
): Promise<{ resourceId: string; deploymentType: string; instances: SqlInstanceDetails[] }[]> {
    logger.info('Saving Report in WLMDB Database', { accountId, databaseType });
    const { windowsConfig, sqlServerInfo, scriptVersion, timestamp } = data;
    windowsConfig.totalAllocatedCapacity = calculateTotalAllocatedCapacity(sqlServerInfo);

    if (!isEmpty(sqlServerInfo) && !isEmpty(windowsConfig)) {
        const hostIds = windowsConfig.nodeDetails?.map(({ hostId }) => hostId);
        const sqlServerInstancesByDeploymentType = groupSqlServerInstancesByDeploymentType(sqlServerInfo);
        const reports = Object.entries(sqlServerInstancesByDeploymentType).map(([deploymentType, instances]) => {
            const instanceIds = instances.map(instance => instance.instanceGuid);
            const resourceId = generateUniqueId(accountId, instanceIds, hostIds);
            return {
                account_id: accountId,
                resource_id: resourceId,
                database_type: databaseType,
                host_config: windowsConfig,
                database_instances_data: instances,
                database_deployment_type: deploymentType as DATABASE_DEPLOYMENT_TYPE,
                creation_time: convertToDate(timestamp),
                version: scriptVersion
            };
        });

        const validReports = await Promise.all(
            reports.map(async report => {
                const existingReport = await getOnPremDatabaseResources(
                    accountId,
                    databaseType,
                    undefined,
                    undefined,
                    report.resource_id
                );
                if (existingReport.items.some(item => item.creationTime === report.creation_time.getTime())) {
                    logger.error(
                        `Report already generated for the collected SQL Server data. Report with the same resource ID ${
                            report.resource_id
                        } and timestamp ${convertToDate(timestamp)} already exists.`
                    );
                    return null;
                }
                return report;
            })
        );
        const filteredReports = compact(validReports);
        if (isEmpty(filteredReports)) {
            throw new Error('Report already generated for the collected SQL Server data.');
        }

        await createOnPremTcoReportData(filteredReports);

        return filteredReports.map(r => ({
            resourceId: r.resource_id,
            deploymentType: r.database_deployment_type,
            instances: r.database_instances_data
        }));
    }
    throw createError(
        HttpErrorCodes.INTERNAL_SERVER_ERROR,
        'Error saving report in WLMDB database. No SQL Server instances or database host data found in the uploaded report.'
    );
}

async function getStorageSavingsResponse(
    accountId: string,
    region: string,
    sqlServerDeploymentType: string,
    windowsConfig: WindowsConfig,
    instances: SqlInstanceDetails[],
    snapshotInfo?: StorageSavingsRequestBodyType
) {
    logger.info('Getting Storage Savings Response', {
        accountId,
        region,
        sqlServerDeploymentType,
        windowsConfig,
        instances,
        snapshotInfo
    });
    const { currentLicenseEdition, recommendedLicenseEdition, finding } = getOnpremLicenseRecommendations(instances);

    const currentInstanceType = await deriveHostConfigBasedInstanceType(
        region,
        windowsConfig,
        isNonFreeEnterpriseEdition(currentLicenseEdition) ? ENTERPRISE_EDITION : STANDARD_EDITION
    ); // Instance type here is based on the host config; considered as existing instance type
    const recommendedInstanceType = await deriveSqlUsageBasedInstanceType(region, instances, recommendedLicenseEdition); // Instance type here is based on the current usage as per the report; considered as recommended instance type

    if (!currentInstanceType || !recommendedInstanceType) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Error deriving instance requirements. Could not find instance type matching requirements.'
        );
    }

    const ec2Instances = deriveEc2InstanceListForMarketing(region, instances, currentInstanceType);
    const ec2InstancesRecommended = deriveEc2InstanceListForMarketing(region, instances, recommendedInstanceType);

    const { clonedCopiesCount = 1, monthlyChangeRatePercentage = 8, snapshotFrequency = 'Daily' } = snapshotInfo || {};

    const params = {
        clonedCopiesCount,
        snapshotFrequency,
        monthlyChangeRatePercentage,
        sqlServerDeploymentType
    };

    const nodeCount = windowsConfig.nodeDetails.length;

    const { existingConfigData, existingConfigCalculations, recommendedConfigData, recommendedConfigCalculations } =
        await fetchStorageSavingsFromMarketingApi({
            accountId,
            regionCode: region,
            baseParams: params,
            existingEc2Instances: ec2Instances,
            recommendedEc2Instances: ec2InstancesRecommended,
            existingEdition: currentLicenseEdition,
            recommendedEdition: recommendedLicenseEdition,
            existingNodeCount: nodeCount,
            recommendedNodeCount: sqlServerDeploymentType === DATABASE_DEPLOYMENT_TYPE.Standalone ? 1 : 2
        });

    return assembleStorageSavingsResponse(
        existingConfigData,
        existingConfigCalculations,
        recommendedConfigData,
        recommendedConfigCalculations,
        finding
    );
}

function groupSqlServerInstancesByDeploymentType(sqlServerInstances: SqlInstanceDetails[]) {
    logger.info('Grouping SQL Server Instances by Deployment Type', { sqlServerInstances: sqlServerInstances.length });

    return compact(sqlServerInstances).reduce((acc: { [key: string]: SqlInstanceDetails[] }, instance) => {
        let { deploymentType } = instance || {};

        if (!isEmpty(deploymentType)) {
            if (deploymentType.toLowerCase() === 'standalone') {
                deploymentType = DATABASE_DEPLOYMENT_TYPE.Standalone;
            } else if (deploymentType.toLowerCase() === 'aoag') {
                deploymentType = DATABASE_DEPLOYMENT_TYPE.AOAG;
            } else if (deploymentType.toLowerCase() === 'fci') {
                deploymentType = DATABASE_DEPLOYMENT_TYPE.FCI;
            }
            if (!acc[deploymentType]) {
                acc[deploymentType] = [];
            }

            try {
                const { totalIops, totalThroughput, totalStorage, totalSecondaryStorage } =
                    parseSqlUsageParams(instance);
                instance.totalIops = totalIops;
                instance.totalThroughput = totalThroughput;
                instance.totalStorage = totalStorage;
                instance.totalSecondaryStorage = totalSecondaryStorage;
                acc[deploymentType].push({ ...instance });
                // TODO: For handling errors any instance with error will be not added in the DB oand not considered for assessment revisit this
            } catch (error) {
                logger.error('Error parsing SQL instance details', { instance: instance?.sqlInstanceName, error });
            }
        }
        return acc;
    }, {});
}

function deriveEbsVolumesListForMarketing(region: string, sqlInstancesDetails: SqlInstanceDetails[]) {
    logger.info('Deriving EBS Volumes List', { region, sqlInstancesDetails: sqlInstancesDetails.length });
    try {
        const ebsDisks: (EBSClassification | undefined)[] = [];
        sqlInstancesDetails.forEach((instance: SqlInstanceDetails) => {
            ebsDisks.push(getEbsDisks(region, instance, 'primary'));
            ebsDisks.push(getEbsDisks(region, instance, 'secondary'));
        });

        const filteredEbsDisks = compact(ebsDisks);

        const primaryEbsDisks = filteredEbsDisks.filter(({ isPrimary }) => isPrimary);
        const secondaryEbsDisks = filteredEbsDisks.filter(({ isPrimary }) => !isPrimary);

        const primaryEbsVolumes = processEbsDisks(primaryEbsDisks);

        const secondaryEbsVolumes = secondaryEbsDisks.length > 0 ? processEbsDisks(secondaryEbsDisks) : [];

        logger.debug('EBS Volumes derivation', { primaryEbsVolumes, secondaryEbsVolumes });

        return { primaryEbsVolumes, secondaryEbsVolumes };
    } catch (error) {
        logger.error('Error deriving EBS Volumes List', { region, error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error deriving EBS Volumes List');
    }
}

function deriveEc2InstanceListForMarketing(
    region: string,
    sqlInstancesDetails: SqlInstanceDetails[],
    instanceType: string
): ManualModeInstancesType {
    logger.info('Deriving EC2 Instance List for Marketing', { sqlInstancesDetails: sqlInstancesDetails.length });

    const { primaryEbsVolumes, secondaryEbsVolumes } =
        deriveEbsVolumesListForMarketing(region, sqlInstancesDetails) || {};
    if (isEmpty(primaryEbsVolumes)) {
        throw createError('Unable to fetch primary database volumes');
    }
    const ec2Instances = [
        {
            ec2InstanceDescription: 'Primary',
            ec2InstanceType: instanceType,
            isPrimary: true,
            volumes: primaryEbsVolumes
        }
    ];
    if (!isEmpty(secondaryEbsVolumes)) {
        ec2Instances.push({
            ec2InstanceDescription: 'Secondary',
            ec2InstanceType: instanceType,
            isPrimary: false,
            volumes: secondaryEbsVolumes
        });
    }
    return ec2Instances;
}

async function deriveHostConfigBasedInstanceType(region: string, windowsConfig: WindowsConfig, licenseEdition: string) {
    logger.info('Deriving Instance Type based on host config', { region, windowsConfig, licenseEdition });

    const { nodeDetails } = windowsConfig;
    let maxVCpuCount = 4;
    let minMemoryMiB = 1024; // 1 GiB

    let networkBandwidthGbps = 0;
    nodeDetails.forEach(node => {
        const { numberOfVcpus, ramSize: ramSizeGiB, networkConfiguration } = node;
        if (numberOfVcpus > maxVCpuCount) {
            maxVCpuCount = numberOfVcpus;
        }
        const ramSizeInMiB = ramSizeGiB * 1024;
        if (ramSizeInMiB > minMemoryMiB) {
            minMemoryMiB = ramSizeInMiB;
        }
        const networkConfig = Array.isArray(networkConfiguration) ? networkConfiguration : [networkConfiguration];

        // Loop through the network configurations to find the maximum speed
        networkConfig.forEach(({ speedMbps }) => {
            if (speedMbps > 0) {
                networkBandwidthGbps = Math.max(networkBandwidthGbps, speedMbps / 1000); // Convert to Gbps
            }
        });
    });

    maxVCpuCount = getPowerOfTwoVcpuCount(maxVCpuCount);

    const vCpuCeil = Math.ceil(maxVCpuCount);
    const instanceRequirements = buildInstanceRequirements({
        vCpuCount: { Min: vCpuCeil, Max: vCpuCeil }, // both min and max are same to ensure we get the same instance type matching the vcpu count of the on-prem server
        memoryMiB: { Min: Math.ceil(minMemoryMiB) },
        allowedInstanceTypes: MSSQL_ALLOWED_INSTANCE_TYPES,
        networkBandwidthGbps: networkBandwidthGbps
            ? {
                  Min: Math.ceil(networkBandwidthGbps),
                  Max: Math.ceil(networkBandwidthGbps) + 1 // Adding 1 Gbps to the max to allow for some flexibility
              }
            : undefined
    });

    const licenseType =
        licenseEdition === ENTERPRISE_EDITION ? PRICING_LICENSE_KEYS.SQL_ENT : PRICING_LICENSE_KEYS.SQL_STD;
    return fetchInstanceTypesByRetryWithPricing(region, instanceRequirements, 'windows', licenseType);
}

async function deriveSqlUsageBasedInstanceType(
    region: string,
    sqlInstancesDetails: SqlInstanceDetails[],
    licenseEdition: string
) {
    logger.info('Deriving SQL usage based Instance Type', {
        region,
        sqlInstancesDetails: sqlInstancesDetails?.length,
        licenseEdition
    });

    const instanceRequirements = deriveInstanceRequirements(sqlInstancesDetails);
    const licenseType =
        licenseEdition === ENTERPRISE_EDITION ? PRICING_LICENSE_KEYS.SQL_ENT : PRICING_LICENSE_KEYS.SQL_STD;
    return fetchInstanceTypesByRetryWithPricing(region, instanceRequirements, 'windows', licenseType);
}

async function analyzeOnpremData(
    accountId: string,
    data: OnPremCollectionObject,
    snapshotInfo?: StorageSavingsRequestBodyType,
    region?: string,
    adHocRequest: boolean = false,
    savedResources?: { resourceId: string; deploymentType: string; instances: SqlInstanceDetails[] }[]
) {
    logger.info('Analyzing OnPrem Data', { accountId, snapshotInfo, region, adHocRequest });

    const { windowsConfig, sqlServerInfo } = data;
    if (!region || IS_DEMO_FLOW) {
        region = DEFAULT_AWS_REGION;
    }

    const resourceGroups =
        savedResources ??
        (() => {
            const hostIds = windowsConfig.nodeDetails.map(({ hostId }) => hostId);
            const grouped = groupSqlServerInstancesByDeploymentType(sqlServerInfo);
            return Object.entries(grouped).map(([deploymentType, instances]) => ({
                resourceId: generateUniqueId(
                    accountId,
                    instances.map(i => i.instanceGuid),
                    hostIds
                ),
                deploymentType,
                instances
            }));
        })();

    const response: Array<{
        accountId: string;
        resourceId: string;
        storageSavings: Record<string, unknown>;
        calculations: Record<string, unknown>;
    }> = [];
    await Promise.all(
        resourceGroups.map(async ({ resourceId, deploymentType, instances }) => {
            const { storageSavings, calculations } = await getStorageSavingsResponse(
                accountId,
                region || DEFAULT_AWS_REGION,
                deploymentType,
                windowsConfig,
                instances,
                snapshotInfo
            );
            response.push({ accountId, resourceId, storageSavings, calculations });
            if (!adHocRequest) {
                await updateOnPremTcoReportRecord(accountId, resourceId, MSSQL, {
                    assessment_data: { storageSavings, calculations }
                });
            }
        })
    );
    return response;
}

async function handleOnpremTcoDataUpload(
    accountId: string,
    databaseType: string,
    fileName: string,
    jobId: string,
    data: OnPremCollectionObject
) {
    logger.info('Handling OnPrem TCO Data Upload', { accountId, databaseType, fileName, jobId });

    await executeWithJobTracking(accountId, jobId, 'Error uploading SQL Server collector data.', async () => {
        await saveReportInWlmdbDatabase(accountId, databaseType as DATABASE_TYPE, data);
        await saveReportInReportingRegistry(accountId, fileName, data, 'mssql');
    });
}

async function uploadOnpremTcoData(accountId: string, databaseType: string, fileName: string, fileContent: string) {
    logger.debug('Uploading SQL Server collector data', { accountId, databaseType, fileName, fileContent });

    try {
        const originalJsonString = decompressCollectorPayload(fileContent);
        const data = JSON.parse(originalJsonString) as OnPremCollectionObject;

        if (!validateOnPremCollectionObject(data)) {
            const errorMessage = 'Invalid data format.';
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }

        if (!validateWindowsConfig(data.windowsConfig)) {
            const errorMessage = 'Invalid windowsConfig format.';
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }

        // in OnPremises analysis, credentials ID is irrelevant, so using a dummy UUID
        const { id: jobId } = await registerJob(accountId, ONPREM_TCO_CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            name: 'Upload on-premises data collector results in Workload Factory',
            description: 'Upload on-premises data collector results in Workload Factory',
            resourceName: data?.windowsConfig?.windowsSystemName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: 'IN_PROGRESS',
            type: JOBTYPE.ASSESSMENT
        });

        handleOnpremTcoDataUpload(accountId, databaseType, fileName, jobId, data);

        return {
            jobId
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        logger.error('Error uploading SQL Server collector data', { accountId, error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error uploading SQL Server collector data');
    }
}

function getEbsDisks(region: string, instance: SqlInstanceDetails, classification: string = 'primary') {
    logger.info('Getting EBS Disks', { region, instance: instance?.sqlInstanceName, classification });
    // https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html#vol-type-ssd
    try {
        let {
            avgVolumeSizePerDb: { primary: avgVolumeSizePerDb, secondary: avgVolumeSizePerDbSecondary },
            avgIopsPerDb: { primary: avgIopsPerDb, secondary: avgIopsPerDbSecondary },
            avgThroughputPerDb: { primary: avgThroughputPerDb, secondary: avgThroughputPerDbSecondary },
            numDatabases: { primary: numDatabases, secondary: numDatabasesSecondary }
        } = parseSqlUsageParams(instance);

        if (classification === 'secondary') {
            if (
                numDatabasesSecondary > 0 &&
                avgVolumeSizePerDbSecondary &&
                avgIopsPerDbSecondary &&
                avgThroughputPerDbSecondary
            ) {
                avgVolumeSizePerDb = avgVolumeSizePerDbSecondary;
                avgIopsPerDb = avgIopsPerDbSecondary;
                avgThroughputPerDb = avgThroughputPerDbSecondary;
                numDatabases = numDatabasesSecondary;
            } else {
                return;
            }
        }
        validateEbsLimits(avgVolumeSizePerDb, avgIopsPerDb, avgThroughputPerDb);
        const ebsType = classifyEbsVolumeType(avgVolumeSizePerDb, avgIopsPerDb, avgThroughputPerDb, region);

        return {
            instanceName: instance.sqlInstanceName,
            numDatabases,
            requiredIops: avgIopsPerDb,
            requiredThroughput: avgThroughputPerDb,
            ebsType,
            requiredVolumeSize: avgVolumeSizePerDb,
            isPrimary: classification !== 'secondary' // if it is not secondary, it is primary by default because marketing API expects atleast primary volumes
        };
    } catch (error) {
        logger.error('Error getting EBS Disks', { instance: instance?.sqlInstanceName, region, error });
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error getting EBS Disks for ${instance?.sqlInstanceName}`
        );
    }
}

function getDatabaseClassifications(sqlInstancesDetails: SqlInstanceDetails) {
    const { aoagReadReplica, storageDetailsByDb } = sqlInstancesDetails;
    const allDatabases = parseStorageDetailsByDb(storageDetailsByDb);
    let primaryDatabases: StorageDetailByDB[] = allDatabases || [];

    const aoagReadReplicaDbs =
        aoagReadReplica && !isEmpty(aoagReadReplica) ? parseAoagReadReplica(aoagReadReplica) : undefined;
    const aoagReadReplicaDbNames = aoagReadReplicaDbs?.map(({ databaseName }) => databaseName);

    let secondaryDatabases: StorageDetailByDB[] = [];
    if (aoagReadReplicaDbs && !isEmpty(aoagReadReplicaDbs) && allDatabases && !isEmpty(allDatabases)) {
        primaryDatabases = allDatabases.filter(({ databaseName }) => !aoagReadReplicaDbNames?.includes(databaseName));
        secondaryDatabases = allDatabases.filter(({ databaseName }) => aoagReadReplicaDbNames?.includes(databaseName));
    }
    return {
        ...sqlInstancesDetails,
        primaryDatabases,
        secondaryDatabases
    };
}

function parseSqlUsageParams(instance: SqlInstanceDetails) {
    logger.debug('Parsing SQL Usage Parameters', { instance });

    const { primaryDatabases, secondaryDatabases } = getDatabaseClassifications(instance);

    let sqlVersion = parseSqlVersion(instance?.sqlVersion || '') || '';
    sqlVersion = sqlVersion.substring(0, sqlVersion.indexOf('(')).trim();

    let totalIops = instance?.totalIops;
    let totalThroughput = instance?.totalThroughput;

    if (Number.isNaN(Number(totalIops)) || Number.isNaN(Number(totalThroughput))) {
        const [iops] = parseIops(instance?.iops || '') || [];

        if (Number.isNaN(Number(totalIops))) {
            const writeIops = parseFloat(iops?.writeIops?.trim());
            const readIops = parseFloat(iops?.readIops?.trim());
            totalIops = writeIops + readIops;
        }

        if (Number.isNaN(Number(totalThroughput))) {
            const writeBytes = parseFloat(iops?.writeBytesPerSec?.trim());
            const readBytes = parseFloat(iops?.readBytesPerSec?.trim());
            totalThroughput = (readBytes + writeBytes) / 1024 / 1024; // Convert to MB/s
        }
    }

    let totalStorage = instance?.totalStorage;
    let totalSecondaryStorage = !isEmpty(secondaryDatabases) ? instance?.totalSecondaryStorage : undefined;
    if (Number.isNaN(Number(totalStorage))) {
        totalStorage = primaryDatabases.reduce((acc, db) => acc + db.allocatedSizeMb, 0) / 1024; // Convert to GiB
    }

    if (Number.isNaN(Number(totalSecondaryStorage)) && !isEmpty(secondaryDatabases)) {
        totalSecondaryStorage = secondaryDatabases.reduce((acc, db) => acc + db.allocatedSizeMb, 0) / 1024; // Convert to GiB
    }

    const [memoryDetails] = parseMemoryUtilization(instance?.memUtilization || '') || [];
    // The StorageDetailByDB response will have duplicate entry for datbases whose storage is spread across differnt drives so using below logic
    const secondaryDatabasesCount = secondaryDatabases?.length || 0;
    const primaryDatabasesCount = parseInt(instance.noOfDatabases, 10) - secondaryDatabasesCount;
    const numDatabases = {
        primary: primaryDatabasesCount,
        secondary: secondaryDatabasesCount
    };

    const avgIopsPerDb = {
        primary: primaryDatabasesCount ? (totalIops || 0) / primaryDatabasesCount : 0,
        ...(secondaryDatabasesCount && { secondary: (totalIops || 0) / secondaryDatabasesCount })
    };
    const avgThroughputPerDb = {
        primary: primaryDatabasesCount ? (totalThroughput || 0) / primaryDatabasesCount : 0,
        ...(secondaryDatabasesCount && { secondary: (totalThroughput || 0) / secondaryDatabasesCount })
    };

    const avgVolumeSizePerDb = {
        primary: primaryDatabasesCount ? (totalStorage || 0) / primaryDatabasesCount : 0,
        ...(secondaryDatabasesCount && { secondary: (totalSecondaryStorage || 0) / secondaryDatabasesCount })
    };

    return {
        avgVolumeSizePerDb,
        avgIopsPerDb,
        avgThroughputPerDb,
        numDatabases,
        totalIops,
        totalThroughput,
        totalStorage,
        sqlVersion,
        memoryDetails,
        totalSecondaryStorage
    };
}

function deriveInstanceRequirements(
    sqlInstancesDetails: SqlInstanceDetails[]
): GetInstanceTypesFromInstanceRequirementsCommandInput {
    if (sqlInstancesDetails.length === 0) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'No SQL instances provided for instance requirements derivation'
        );
    }

    const totalSqlInstances = sqlInstancesDetails.length;
    logger.info('Deriving Instance Requirements', { sqlInstancesDetails: totalSqlInstances });

    let requiredMemory = 8192; // 8 GiB as minimum memory requirement for database workloads

    let networkPerformance = NETWORK_PERF.UP_TO_10;

    let totalMemory = 0;
    let totalCpuCount = 0;
    let maxVcpuCount = 4;
    let minVcpuCount: number = -1;
    sqlInstancesDetails.forEach(sqlInstance => {
        try {
            const { noOfVcpusInUse, cpuUtilization, memUtilization, vcpusPerInstance } = sqlInstance;
            const instanceCpuUsage =
                noOfVcpusInUse ||
                Math.ceil(((parseCpuUtilization(cpuUtilization) || 0) / 100) * Number(vcpusPerInstance!));
            totalCpuCount += instanceCpuUsage;
            minVcpuCount = minVcpuCount !== -1 ? Math.min(minVcpuCount, instanceCpuUsage) : instanceCpuUsage;
            // Assuming memUtilization is a JSO N string with memory details
            const [memoryDetails] = parseMemoryUtilization(memUtilization) || [];
            totalMemory += memoryDetails?.used ? Math.round(memoryDetails.used / (1024 * 1024)) : 0; // Convert bytes to MiB
            if (sqlInstance.networkPerformance === NETWORK_PERF.ABOVE_10) {
                networkPerformance = NETWORK_PERF.ABOVE_10;
            }
        } catch (error) {
            logger.error(`Error accounting SQL instance ${sqlInstance.sqlInstanceName} for instance requirements`, {
                error
            });
        }
    });

    const avgVcpuCount = totalCpuCount / totalSqlInstances;
    maxVcpuCount = Math.max(maxVcpuCount, avgVcpuCount);
    minVcpuCount = Math.max(minVcpuCount, 4);

    // Need to have a number between min and max which is a power of 2 or recommendation will fail as all EC2 instances have vCPUs in powers of 2
    maxVcpuCount = getPowerOfTwoVcpuCount(maxVcpuCount);

    requiredMemory = Math.max(requiredMemory, totalMemory / totalSqlInstances); // Taking average of the total memory of all instances as the required memory

    return buildInstanceRequirements({
        vCpuCount: { Min: Math.ceil(minVcpuCount), Max: Math.ceil(maxVcpuCount) },
        memoryMiB: { Min: Math.ceil(requiredMemory) },
        allowedInstanceTypes: MSSQL_ALLOWED_INSTANCE_TYPES,
        networkBandwidthGbps: networkPerformance === NETWORK_PERF.UP_TO_10 ? { Max: 10 } : { Min: 10 }
    });
}

// This approach assumes that if any of the features are being used in any one of the SQL server instance, it is considered as using an enterprise feature.
function getOnpremLicenseRecommendations(sqlInstancesDetails: SqlInstanceDetails[]) {
    logger.info('Getting onprem license recommendations', { sqlInstancesDetails: sqlInstancesDetails.length });

    const enterpriseUsageResults = compact(
        sqlInstancesDetails.map((instance: SqlInstanceDetails) => {
            try {
                const { licenceUsageDetails, sqlEdition } = instance;
                if (sqlEdition && isNonFreeEnterpriseEdition(sqlEdition)) {
                    const licenseFeatures = parseLicenceUsageDetails(licenceUsageDetails);
                    if (
                        licenseFeatures &&
                        licenseFeatures.some(({ IsUsingFeature }: { IsUsingFeature: number }) => IsUsingFeature === 1)
                    ) {
                        return { sqlEdition, isUsingAnyEnterpriseFeature: true };
                    }
                }
                return { sqlEdition, isUsingAnyEnterpriseFeature: false };
            } catch (error) {
                logger.error(
                    `Error getting license recommendations for SQL instance ${instance.sqlInstanceName}`,
                    error
                );
                return {};
            }
        })
    );

    const [{ sqlEdition: currentLicenseEdition = STANDARD_EDITION }] = sqlInstancesDetails || {};
    const isUsingEnterpriseFeature = enterpriseUsageResults.some(
        ({ isUsingAnyEnterpriseFeature }) => isUsingAnyEnterpriseFeature
    );
    const recommendedLicenseEdition = isUsingEnterpriseFeature ? ENTERPRISE_EDITION : STANDARD_EDITION;
    const finding =
        isNonFreeEnterpriseEdition(currentLicenseEdition) && !isUsingEnterpriseFeature
            ? FINDING.NOT_OPTIMIZED
            : FINDING.OPTIMIZED;
    return { currentLicenseEdition, recommendedLicenseEdition, finding };
}

async function getIndividualOnPremDatabaseResource(
    accountId: string,
    resourceId: string,
    databaseType: DATABASE_TYPE = MSSQL
) {
    const {
        items: [onPremDatabaseResource]
    } = await getOnPremDatabaseResources(accountId, databaseType, undefined, undefined, resourceId);

    if (!onPremDatabaseResource) {
        const errorMessage = `MSSQL resource ${resourceId} not found for account ${accountId}`;
        logger.error(errorMessage, { accountId, resourceId, databaseType });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    return onPremDatabaseResource;
}
async function getOnPremDatabaseResources(
    accountId: string,
    databaseType: DATABASE_TYPE = MSSQL,
    apiPageSize?: number,
    nextToken?: string,
    resourceId?: string,
    timestamp?: Date
): Promise<{ count: number; items: OnPremDatabaseResourcesObjectType[]; nextToken?: string }> {
    logger.info('Getting OnPrem database resources', { accountId, databaseType, apiPageSize, nextToken });

    const onPremDatabaseResourcesDetails = await listOnPremDatabaseResources(
        accountId,
        databaseType,
        apiPageSize,
        nextToken,
        resourceId ? [resourceId] : undefined,
        timestamp
    );

    if (isEmpty(onPremDatabaseResourcesDetails)) {
        logger.info(`No On-premises  database resources found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    let onPremDatabaseResources: OnPremDatabaseResourcesObjectType[] = [];
    try {
        onPremDatabaseResources = await Promise.all(
            onPremDatabaseResourcesDetails.map(async onPremDatabaseResource => {
                const {
                    resource_id: onpremResourceId,
                    host_config: hostConfig,
                    database_instances_data: persistedSqlInstancesDetails,
                    database_deployment_type: deploymentType,
                    creation_time: reportCreationTime
                } = onPremDatabaseResource;
                const rawSqlInstanceDetails = persistedSqlInstancesDetails as unknown as SqlInstanceDetails[];

                let {
                    clusterNodeNames: onPremisesNodes,
                    windowsSystemName: resourceName,
                    totalAllocatedCapacity
                } = hostConfig as unknown as WindowsConfig;
                const sqlServerInstances = Array.isArray(rawSqlInstanceDetails)
                    ? formatSqlInstanceDetails(rawSqlInstanceDetails)
                    : [];

                // Ensure totalAllocatedCapacity is always set by recalculating for older reports
                if (totalAllocatedCapacity === undefined && Array.isArray(rawSqlInstanceDetails)) {
                    totalAllocatedCapacity = calculateTotalAllocatedCapacity(rawSqlInstanceDetails);
                }

                return {
                    resourceId: onpremResourceId,
                    resourceName,
                    deploymentModel: deploymentType,
                    creationTime: new Date(reportCreationTime).getTime(),
                    sqlServerInstances,
                    onPremisesNodes,
                    totalAllocatedCapacity
                };
            })
        );
    } catch (error) {
        logger.error('Failed to fetch On-premises resources', { accountId, error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch On-premises resources');
    }

    return {
        count: onPremDatabaseResources.length,
        items: onPremDatabaseResources,
        nextToken:
            onPremDatabaseResourcesDetails?.length === apiPageSize
                ? onPremDatabaseResourcesDetails[onPremDatabaseResourcesDetails.length - 1].id
                : undefined
    };
}

async function getOnPremResourceExploreSavings(
    accountId: string,
    onPrmResourceId: string,
    regionCode: string,
    sqlInstanceData?: SqlInstanceDetailsRequestObjectType[],
    snapshotInfo?: StorageSavingsRequestBodyType
) {
    logger.info('Getting OnPrem Resource Explore Savings', {
        accountId,
        onPrmResourceId,
        regionCode,
        sqlInstanceCount: sqlInstanceData?.length,
        snapshotInfo
    });

    const [onPremDatabaseResource] = await listOnPremDatabaseResources(accountId, MSSQL, undefined, undefined, [
        onPrmResourceId
    ]);

    if (isEmpty(onPremDatabaseResource)) {
        const errorMessage = `No On-premises  database resources found for account ${accountId}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }
    const region = validateAndGetRegion(regionCode);

    const {
        resource_id: resourceId,
        host_config: hostConfig,
        database_instances_data: persistedSqlInstancesDetails,
        database_deployment_type: deploymentType,
        assessment_data: assessmentData,
        version: scriptVersion,
        creation_time: reportCreationTime
    } = onPremDatabaseResource;

    const rawSqlInstanceDetails = persistedSqlInstancesDetails as unknown as SqlInstanceDetails[];

    const { windowsSystemName: resourceName } = hostConfig as unknown as WindowsConfig;

    if (sqlInstanceData || snapshotInfo) {
        try {
            const updatedSqlDetailsBasedOnRequest = rawSqlInstanceDetails.map(detail => {
                try {
                    const {
                        numDatabases: { primary: numDatabases, secondary: numDatabasesSecondary }
                    } = parseSqlUsageParams(detail);
                    const instanceData = sqlInstanceData?.find(
                        (data: { sqlInstanceId: string }) => data.sqlInstanceId === detail.instanceGuid
                    );
                    if (instanceData) {
                        const {
                            noOfVcpusInUse,
                            memory,
                            networkPerformance,
                            totalIops,
                            totalThroughput,
                            totalStorage: incomingTotalStorage
                        } = instanceData;

                        const totalDbCount = numDatabases + numDatabasesSecondary;
                        const primaryDbRatio = totalDbCount > 0 ? numDatabases / totalDbCount : 0;
                        const secondaryDbRatio = totalDbCount > 0 ? numDatabasesSecondary / totalDbCount : 0;
                        return {
                            ...detail,
                            ...(noOfVcpusInUse && { noOfVcpusInUse }),
                            ...(networkPerformance && { networkPerformance }),
                            ...(memory && { memory }),
                            ...(totalIops && { totalIops }),
                            ...(totalThroughput && { totalThroughput }),
                            ...(numDatabases &&
                                incomingTotalStorage && {
                                    totalStorage: sizeInGigaBytes(incomingTotalStorage, 'B') * primaryDbRatio
                                }),
                            ...(numDatabasesSecondary &&
                                incomingTotalStorage && {
                                    totalSecondaryStorage: sizeInGigaBytes(incomingTotalStorage, 'B') * secondaryDbRatio
                                }),
                            deploymentType
                        };
                    }
                    return {
                        ...detail,
                        deploymentType
                    };
                } catch (error) {
                    logger.warn('Error updating SQL instance details based on request', { detail, error });
                    return undefined;
                }
            });

            const data: OnPremCollectionObject = {
                windowsConfig: hostConfig as unknown as WindowsConfig,
                sqlServerInfo: updatedSqlDetailsBasedOnRequest as unknown as SqlInstanceDetails[],
                scriptVersion,
                timestamp: new Date(reportCreationTime).toISOString()
            };
            const analysisResult = await analyzeOnpremData(accountId, data, snapshotInfo, regionCode, true);

            if (isEmpty(analysisResult)) {
                const errorMessage = 'No analysis result found for the input provided.';
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
            const [{ storageSavings, calculations }] = analysisResult;
            return {
                resourceId,
                resourceName,
                deploymentModel: deploymentType,
                creationTime: new Date(reportCreationTime).getTime(),
                region,
                regionCode,
                calculations: calculations as StorageSavingsMetricsCalculationsResponseType,
                storageSavings: storageSavings as StorageSavingsResponseType,
                snapShotInfo: snapshotInfo
            };
        } catch (error) {
            logger.error('Failed to fetch assessment data for the input provided', { accountId, resourceId, error });
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to fetch assessment data for the input provided'
            );
        }
    }

    // If no user input is provided, return the persisted report data
    try {
        const { calculations, storageSavings } = assessmentData as {
            calculations: StorageSavingsMetricsCalculationsResponseType;
            storageSavings: StorageSavingsResponseType;
        };
        return {
            resourceId,
            resourceName,
            deploymentModel: deploymentType,
            creationTime: new Date(reportCreationTime).getTime(),
            region,
            regionCode,
            calculations,
            storageSavings
        };
    } catch (error) {
        logger.error('Failed to fetch assessment data for the selected resource', { accountId, resourceId, error });
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Failed to fetch assessment data for the selected resource'
        );
    }
}

type ResourcePrepData = {
    resourceId: string;
    resourceName: string;
    deploymentType: string;
    windowsConfig: WindowsConfig;
    sqlInstanceDetails: SqlInstanceDetails[];
    currentLicenseEdition: string;
    recommendedLicenseEdition: string;
    finding: string;
};

type ResourceDataWithInstanceTypes = ResourcePrepData & {
    currentInstanceType?: string;
    recommendedInstanceType?: string;
};

type IndividualResourceInfo = {
    resourceId: string;
    resourceName: string;
    deploymentType: string;
    existingNodeCount: number;
    recommendedNodeCount: number;
    currentLicenseEdition: string;
    recommendedLicenseEdition: string;
    finding: string;
    currentInstanceType?: string;
    recommendedInstanceType?: string;
};

type ResourceWithPricing = IndividualResourceInfo & {
    currentLicenseType: string;
    recommendedLicenseType: string;
    currentPricing: PricingDetails;
    recommendedPricing: PricingDetails;
};

function prepareResourceData(
    onPremDatabaseResource: OnPremTcoReport,
    resources: Array<{ resourceId: string; sqlInstanceData?: SqlInstanceDetailsRequestObjectType[] }>
): ResourcePrepData | null {
    const {
        resource_id: resourceId,
        host_config: hostConfig,
        database_instances_data: persistedSqlInstancesDetails,
        database_deployment_type: deploymentType
    } = onPremDatabaseResource;

    const rawSqlInstanceDetails = persistedSqlInstancesDetails as unknown as SqlInstanceDetails[];
    const windowsConfig = hostConfig as unknown as WindowsConfig;
    const { windowsSystemName: resourceName } = windowsConfig;

    const resourceRequest = resources.find(r => r.resourceId === resourceId);
    const sqlInstanceData = resourceRequest?.sqlInstanceData;

    let sqlInstanceDetailsToUse: SqlInstanceDetails[];
    if (sqlInstanceData) {
        const updatedSqlDetailsBasedOnRequest = rawSqlInstanceDetails.map(detail => {
            try {
                const {
                    numDatabases: { primary: numDatabases, secondary: numDatabasesSecondary }
                } = parseSqlUsageParams(detail);
                const instanceData = sqlInstanceData.find(
                    (data: { sqlInstanceId: string }) => data.sqlInstanceId === detail.instanceGuid
                );
                if (instanceData) {
                    const {
                        noOfVcpusInUse,
                        memory,
                        networkPerformance,
                        totalIops,
                        totalThroughput,
                        totalStorage: incomingTotalStorage
                    } = instanceData;

                    const totalDbCount = numDatabases + numDatabasesSecondary;
                    const primaryDbRatio = totalDbCount > 0 ? numDatabases / totalDbCount : 0;
                    const secondaryDbRatio = totalDbCount > 0 ? numDatabasesSecondary / totalDbCount : 0;
                    return {
                        ...detail,
                        ...(noOfVcpusInUse && { noOfVcpusInUse }),
                        ...(networkPerformance && { networkPerformance }),
                        ...(memory && { memory }),
                        ...(totalIops && { totalIops }),
                        ...(totalThroughput && { totalThroughput }),
                        ...(numDatabases &&
                            incomingTotalStorage && {
                                totalStorage: sizeInGigaBytes(incomingTotalStorage, 'B') * primaryDbRatio
                            }),
                        ...(numDatabasesSecondary &&
                            incomingTotalStorage && {
                                totalSecondaryStorage: sizeInGigaBytes(incomingTotalStorage, 'B') * secondaryDbRatio
                            }),
                        deploymentType
                    };
                }
                return { ...detail, deploymentType };
            } catch (error) {
                logger.warn('Error updating SQL instance details', { detail, error });
                return undefined;
            }
        });
        sqlInstanceDetailsToUse = compact(updatedSqlDetailsBasedOnRequest) as SqlInstanceDetails[];
    } else {
        sqlInstanceDetailsToUse = compact(rawSqlInstanceDetails) as SqlInstanceDetails[];
    }

    const { currentLicenseEdition, recommendedLicenseEdition, finding } =
        getOnpremLicenseRecommendations(sqlInstanceDetailsToUse);

    return {
        resourceId,
        resourceName,
        deploymentType,
        windowsConfig,
        sqlInstanceDetails: sqlInstanceDetailsToUse,
        currentLicenseEdition,
        recommendedLicenseEdition,
        finding
    };
}

async function deriveInstanceTypesForResource(
    prepData: ResourcePrepData,
    regionCode: string
): Promise<ResourceDataWithInstanceTypes> {
    const { windowsConfig, sqlInstanceDetails, currentLicenseEdition, recommendedLicenseEdition } = prepData;

    const [currentInstanceType, recommendedInstanceType] = await Promise.all([
        deriveHostConfigBasedInstanceType(
            regionCode,
            windowsConfig,
            isNonFreeEnterpriseEdition(currentLicenseEdition) ? ENTERPRISE_EDITION : STANDARD_EDITION
        ),
        deriveSqlUsageBasedInstanceType(regionCode, sqlInstanceDetails, recommendedLicenseEdition)
    ]);

    return { ...prepData, currentInstanceType, recommendedInstanceType };
}

function collectAndAggregateEbsVolumes(
    validResourceDataList: ResourceDataWithInstanceTypes[],
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
        const { windowsConfig, sqlInstanceDetails } = resourceData;

        const ebsVolumes = deriveEbsVolumesListForMarketing(regionCode, sqlInstanceDetails);
        if (ebsVolumes) {
            const { primaryEbsVolumes, secondaryEbsVolumes } = ebsVolumes;
            if (primaryEbsVolumes) {
                combinedPrimaryEbsVolumes = [...combinedPrimaryEbsVolumes, ...primaryEbsVolumes];
            }
            if (secondaryEbsVolumes) {
                combinedSecondaryEbsVolumes = [...combinedSecondaryEbsVolumes, ...secondaryEbsVolumes];
            }
        }
        totalNodeCount += windowsConfig.nodeDetails.length;
    }

    return {
        combinedPrimaryEbsVolumes: aggregateVolumesByType(combinedPrimaryEbsVolumes),
        combinedSecondaryEbsVolumes: aggregateVolumesByType(combinedSecondaryEbsVolumes),
        totalNodeCount
    };
}

function isEnterpriseEditionForPricing(licenseEdition: string): boolean {
    return licenseEdition.toLowerCase().includes('enterprise');
}

function resolveLicenseType(licenseEdition: string): string {
    return isEnterpriseEditionForPricing(licenseEdition) ? PRICING_LICENSE_KEYS.SQL_ENT : PRICING_LICENSE_KEYS.SQL_STD;
}

async function fetchPricingForResources(
    individualResourceInfo: IndividualResourceInfo[],
    regionCode: string
): Promise<ResourceWithPricing[]> {
    return fetchPricingForResourcesGeneric<IndividualResourceInfo, ResourceWithPricing>(
        individualResourceInfo,
        regionCode,
        {
            osType: 'windows',
            getCacheKeys: r => {
                const currentLicenseType = resolveLicenseType(r.currentLicenseEdition);
                const recommendedLicenseType = resolveLicenseType(r.recommendedLicenseEdition);
                return {
                    current: r.currentInstanceType
                        ? {
                              key: `${r.currentInstanceType}|${currentLicenseType}`,
                              instanceType: r.currentInstanceType,
                              licenseType: currentLicenseType
                          }
                        : undefined,
                    recommended: r.recommendedInstanceType
                        ? {
                              key: `${r.recommendedInstanceType}|${recommendedLicenseType}`,
                              instanceType: r.recommendedInstanceType,
                              licenseType: recommendedLicenseType
                          }
                        : undefined
                };
            },
            enrichResource: (r, currentPricing, recommendedPricing) => ({
                ...r,
                currentLicenseType: resolveLicenseType(r.currentLicenseEdition),
                recommendedLicenseType: resolveLicenseType(r.recommendedLicenseEdition),
                currentPricing: currentPricing as PricingDetails,
                recommendedPricing: recommendedPricing as PricingDetails
            })
        }
    );
}

function buildPerResourceCalculations(resourcesWithPricing: ResourceWithPricing[], monthlySqlByolCost?: number) {
    const existingComputeCalculation: ComputeCalculationEntry[] = [];
    const existingLicenseCalculation: LicenseCalculationEntry[] = [];
    const recommendedComputeCalculation: ComputeCalculationEntry[] = [];
    const recommendedLicenseCalculation: LicenseCalculationEntry[] = [];
    const computeSavings: MssqlComputeSavingsEntry[] = [];
    const licenseSavings: MssqlLicenseSavingsEntry[] = [];
    const perResourceAssessmentData: MssqlPerResourceAssessment[] = [];

    for (const resourceInfo of resourcesWithPricing) {
        const {
            resourceId,
            resourceName,
            deploymentType,
            existingNodeCount,
            recommendedNodeCount,
            currentLicenseEdition,
            recommendedLicenseEdition,
            finding,
            currentInstanceType,
            recommendedInstanceType,
            currentLicenseType,
            recommendedLicenseType,
            currentPricing,
            recommendedPricing
        } = resourceInfo;

        const currentPrice = currentPricing?.[currentInstanceType!]?.[currentLicenseType]?.pricePerUnit || 0;
        const currentBasePrice = currentPricing?.[currentInstanceType!]?.NA?.pricePerUnit || 0;
        const currentLicensePrice = currentPrice - currentBasePrice;

        const recommendedPrice =
            recommendedPricing?.[recommendedInstanceType!]?.[recommendedLicenseType]?.pricePerUnit || 0;
        const recommendedBasePrice = recommendedPricing?.[recommendedInstanceType!]?.NA?.pricePerUnit || 0;
        const recommendedLicensePrice = recommendedPrice - recommendedBasePrice;

        const isUsingByol = monthlySqlByolCost && monthlySqlByolCost > 0;
        const existingLicenseIncluded = isUsingByol ? false : currentLicensePrice > 0;

        const { machineDetails: currentMachineDetails, instanceTypeDisplay: existingInstanceTypeDisplay } =
            buildMachineDetailsForNodes({
                instanceType: currentInstanceType!,
                basePrice: currentBasePrice,
                fullPrice: currentPrice,
                licenseIncluded: existingLicenseIncluded,
                nodeCount: existingNodeCount
            });
        const { machineDetails: recommendedMachineDetails, instanceTypeDisplay: recommendedInstanceTypeDisplay } =
            buildMachineDetailsForNodes({
                instanceType: recommendedInstanceType!,
                basePrice: recommendedBasePrice,
                fullPrice: recommendedPrice,
                licenseIncluded: true,
                nodeCount: recommendedNodeCount
            });

        const existingEntry = buildComputeCalculationEntry({
            resourceName,
            deploymentType,
            instanceType: existingInstanceTypeDisplay,
            basePrice: currentBasePrice,
            fullPrice: currentPrice,
            nodeCount: existingNodeCount,
            machineDetails: currentMachineDetails
        });
        existingComputeCalculation.push(existingEntry);

        const recommendedEntry = buildComputeCalculationEntry({
            resourceName,
            deploymentType,
            instanceType: recommendedInstanceTypeDisplay,
            basePrice: recommendedBasePrice,
            fullPrice: recommendedPrice,
            nodeCount: recommendedNodeCount,
            machineDetails: recommendedMachineDetails
        });
        recommendedComputeCalculation.push(recommendedEntry);

        const existingLicenseMonthlyPrice = currentLicensePrice * HOURS_IN_MONTH * existingNodeCount;
        const recommendedLicenseMonthlyPrice = recommendedLicensePrice * HOURS_IN_MONTH * recommendedNodeCount;
        const existingLicenseHourlyPrice = currentLicensePrice * existingNodeCount;
        const recommendedLicenseHourlyPrice = recommendedLicensePrice * recommendedNodeCount;

        existingLicenseCalculation.push({
            resourceName,
            deploymentType,
            sqlServerEdition: currentLicenseEdition,
            licenseHourlyPrice: existingLicenseHourlyPrice,
            licenseIncluded: existingLicenseIncluded,
            licenseMonthlyPrice: existingLicenseMonthlyPrice,
            hoursInMonth: HOURS_IN_MONTH
        });

        recommendedLicenseCalculation.push({
            resourceName,
            deploymentType,
            sqlServerEdition: recommendedLicenseEdition,
            licenseHourlyPrice: recommendedLicenseHourlyPrice,
            licenseIncluded: true,
            licenseMonthlyPrice: recommendedLicenseMonthlyPrice,
            hoursInMonth: HOURS_IN_MONTH
        });

        computeSavings.push({
            resourceName,
            deploymentType,
            existing: existingEntry,
            recommended: recommendedEntry
        });

        licenseSavings.push({
            resourceName,
            deploymentType,
            existing: {
                sqlServerEdition: currentLicenseEdition,
                licenseHourlyPrice: existingLicenseHourlyPrice,
                licenseIncluded: existingLicenseIncluded,
                licenseMonthlyPrice: existingLicenseMonthlyPrice,
                hoursInMonth: HOURS_IN_MONTH
            },
            recommended: {
                sqlServerEdition: recommendedLicenseEdition,
                licenseHourlyPrice: recommendedLicenseHourlyPrice,
                licenseIncluded: true,
                licenseMonthlyPrice: recommendedLicenseMonthlyPrice,
                hoursInMonth: HOURS_IN_MONTH
            },
            finding
        });

        // Build per-resource assessment data for DB storage
        perResourceAssessmentData.push({
            resourceId,
            existingComputeCalculation: existingComputeCalculation[existingComputeCalculation.length - 1],
            existingLicenseCalculation: existingLicenseCalculation[existingLicenseCalculation.length - 1],
            recommendedComputeCalculation: recommendedComputeCalculation[recommendedComputeCalculation.length - 1],
            recommendedLicenseCalculation: recommendedLicenseCalculation[recommendedLicenseCalculation.length - 1],
            computeSavings: computeSavings[computeSavings.length - 1],
            licenseSavings: licenseSavings[licenseSavings.length - 1]
        });
    }

    return {
        existingComputeCalculation,
        existingLicenseCalculation,
        recommendedComputeCalculation,
        recommendedLicenseCalculation,
        computeSavings,
        licenseSavings,
        perResourceAssessmentData
    };
}

async function getOnPremBulkResourceExploreSavings(
    accountId: string,
    regionCode: string,
    resources: Array<{ resourceId: string; sqlInstanceData?: SqlInstanceDetailsRequestObjectType[] }>,
    snapshotInfo?: StorageSavingsRequestBodyType
) {
    logger.info('Getting OnPrem Bulk Resource Explore Savings', {
        accountId,
        resourcesCount: resources.length,
        regionCode,
        snapshotInfo
    });

    const region = validateAndGetRegion(regionCode);

    const resourceIds = compact(resources.map(r => r.resourceId));
    const onPremDatabaseResources = await listOnPremDatabaseResources(
        accountId,
        MSSQL,
        undefined,
        undefined,
        resourceIds
    );

    if (isEmpty(onPremDatabaseResources)) {
        const errorMessage = `No On-premises database resources found for account ${accountId}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    // Deduplicate by resource_id, keeping only the latest record
    const deduplicatedResources = deduplicateResourcesByLatestVersion(onPremDatabaseResources);

    try {
        // Step 1: Prepare all resource data
        const resourcePrepDataList = compact(
            deduplicatedResources.map(resource => prepareResourceData(resource, resources))
        );

        if (isEmpty(resourcePrepDataList)) {
            const errorMessage = 'No valid resources found for bulk analysis.';
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        // Step 2: Derive instance types for all resources in parallel
        const resourceDataWithInstanceTypes = await Promise.all(
            resourcePrepDataList.map(prepData => deriveInstanceTypesForResource(prepData, regionCode))
        );

        // Filter out resources where instance types could not be derived
        const validResourceDataList = resourceDataWithInstanceTypes.filter(data => {
            if (!data.currentInstanceType || !data.recommendedInstanceType) {
                logger.warn(`Could not derive instance types for resource ${data.resourceId}, skipping`);
                return false;
            }
            return true;
        });

        if (isEmpty(validResourceDataList)) {
            const errorMessage = 'No valid resources with instance types found for bulk analysis.';
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        // Step 3: Collect and aggregate EBS volumes
        const { combinedPrimaryEbsVolumes, combinedSecondaryEbsVolumes, totalNodeCount } =
            collectAndAggregateEbsVolumes(validResourceDataList, regionCode);

        // Step 4: Build individual resource info for compute/license breakdown
        const individualResourceInfo: IndividualResourceInfo[] = validResourceDataList.map(
            ({
                resourceId,
                resourceName,
                deploymentType,
                windowsConfig,
                currentLicenseEdition,
                recommendedLicenseEdition,
                finding,
                currentInstanceType,
                recommendedInstanceType
            }) => ({
                resourceId,
                resourceName,
                deploymentType,
                existingNodeCount: windowsConfig.nodeDetails.length,
                // For recommended, use 2 nodes for FCI/AOAG (same logic as single-resource flow)
                recommendedNodeCount: deploymentType === DATABASE_DEPLOYMENT_TYPE.Standalone ? 1 : 2,
                currentLicenseEdition,
                recommendedLicenseEdition,
                finding,
                currentInstanceType,
                recommendedInstanceType
            })
        );

        // Step 5: Build combined EC2 instances for marketing API calls
        const { existingEc2Instances } = buildCombinedEc2Instances(
            combinedPrimaryEbsVolumes,
            combinedSecondaryEbsVolumes,
            validResourceDataList[0].currentInstanceType!,
            validResourceDataList[0].recommendedInstanceType!
        );

        // Step 6: Determine combined existing license edition for marketing API
        const hasEnterpriseEdition = individualResourceInfo.some(info =>
            isNonFreeEnterpriseEdition(info.currentLicenseEdition)
        );
        const combinedExistingLicenseEdition = hasEnterpriseEdition ? ENTERPRISE_EDITION : STANDARD_EDITION;

        // Step 7: Prepare base params for marketing API calls
        const {
            clonedCopiesCount = 1,
            monthlyChangeRatePercentage = 8,
            snapshotFrequency = 'Daily',
            monthlySqlByolCost
        } = snapshotInfo || {};

        // Determine combined deployment type: if any resource is FCI or AOAG, use that for Multi-AZ FSx pricing
        const hasMultiAzDeployment = individualResourceInfo.some(
            info =>
                info.deploymentType === DATABASE_DEPLOYMENT_TYPE.FCI ||
                info.deploymentType === DATABASE_DEPLOYMENT_TYPE.AOAG
        );
        const combinedDeploymentType = hasMultiAzDeployment
            ? DATABASE_DEPLOYMENT_TYPE.FCI // Use FCI to trigger Multi-AZ pricing
            : DATABASE_DEPLOYMENT_TYPE.Standalone;

        const baseParams = {
            clonedCopiesCount,
            snapshotFrequency,
            monthlyChangeRatePercentage,
            sqlServerDeploymentType: combinedDeploymentType
        };

        // Step 8: Call marketing APIs AND fetch pricing in parallel (independent operations)
        // The recommended marketing API call is intentionally omitted: recommendedTotalSummary is
        // derived from per-resource pricing data (more accurate, avoids an extra API round-trip).
        const [existingConfigData, existingConfigCalculations, resourcesWithPricing] = await Promise.all([
            performManualModeStorageSavingsCalculations(
                accountId,
                regionCode,
                {
                    ...baseParams,
                    ec2Instances: existingEc2Instances,
                    sqlServerEdition: combinedExistingLicenseEdition
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
                    sqlServerEdition: combinedExistingLicenseEdition
                },
                totalNodeCount,
                true
            ),
            fetchPricingForResources(individualResourceInfo, regionCode)
        ]);

        // Step 9: Build per-resource calculations
        const {
            existingComputeCalculation,
            existingLicenseCalculation,
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
            computeSavings,
            licenseSavings
        } = buildPerResourceCalculations(resourcesWithPricing, monthlySqlByolCost);

        // Step 10: Extract shared storage data from existing config API response
        const {
            ebs,
            fsx,
            single,
            multi,
            totalSummary: { existing: existingTotalSummary = undefined } = {}
        } = existingConfigData || {};

        // Derive recommended total from per-resource pricing: FSx storage + compute + license
        const recommendedTotalSummary =
            Number(fsx?.total || 0) +
            sumBy(recommendedComputeCalculation, 'computeMonthlyPrice') +
            sumBy(recommendedLicenseCalculation, 'licenseMonthlyPrice');

        // Step 11: Build aggregated response
        const aggregatedCalculations = {
            existingComputeCalculation,
            existingLicenseCalculation,
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
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
            license: licenseSavings,
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
            ...(snapshotInfo && { snapShotInfo: snapshotInfo })
        };
    } catch (error) {
        logger.error('Failed to fetch bulk assessment data', { accountId, error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch bulk assessment data');
    }
}

export {
    uploadOnpremTcoData,
    getIndividualOnPremDatabaseResource,
    getOnPremDatabaseResources,
    saveReportInWlmdbDatabase,
    deriveHostConfigBasedInstanceType,
    groupSqlServerInstancesByDeploymentType,
    deriveEbsVolumesListForMarketing,
    deriveSqlUsageBasedInstanceType,
    getOnpremLicenseRecommendations,
    deriveInstanceRequirements,
    getOnPremResourceExploreSavings,
    getOnPremBulkResourceExploreSavings,
    calculateTotalAllocatedCapacity
};
