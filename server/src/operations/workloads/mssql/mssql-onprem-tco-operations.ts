import createError from 'http-errors';
import {
    DATABASE_DEPLOYMENT_TYPE,
    DATABASE_TYPE,
    JOBTYPE,
    type onprem_tco_reports as OnPremTcoReport
} from '@prisma/client';
import { compact, isEmpty, sumBy } from 'lodash-es';
import throat from 'throat';
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
    buildComputeCalculationsForResources,
    ComputeCalculation,
    LicenseCalculation,
    ResourceComputeInput,
    PricingDetails,
    getPricePerUnit,
    validateOrThrow,
    resolveSnapshotDefaults,
    EBSClassification,
    EbsVolumeType,
    SavedAssessmentData,
    isSavedAssessmentData
} from '../../onprem-tco-operations';
import {
    getManualModeStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations
} from './mssql-storage-savings-operations';
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
    getPowerOfTwoVcpuCount,
    hasComputeOverrides
} from '../../../utils/onprem-tco/onprem-tco-utils';
import { mssqlCollectionObjectSchema, windowsConfigSchema } from '../../../utils/onprem-tco/onprem-tco-schemas';
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

interface MssqlComputeSavingsEntry {
    resourceName: string;
    deploymentType: string;
    existing: ComputeCalculation;
    recommended: ComputeCalculation;
}

interface MssqlLicenseSavingsEntry {
    resourceName: string;
    deploymentType: string;
    existing: Omit<LicenseCalculation, 'resourceName' | 'deploymentType'>;
    recommended: Omit<LicenseCalculation, 'resourceName' | 'deploymentType'>;
    finding: string;
}

interface MssqlPerResourceAssessment {
    resourceId: string;
    existingComputeCalculation: ComputeCalculation;
    existingLicenseCalculation: LicenseCalculation;
    recommendedComputeCalculation: ComputeCalculation;
    recommendedLicenseCalculation: LicenseCalculation;
    computeSavings: MssqlComputeSavingsEntry;
    licenseSavings: MssqlLicenseSavingsEntry;
}

interface HybridExploreSavingsParams {
    accountId: string;
    resourceId: string;
    resourceName: string;
    deploymentType: string;
    reportCreationTime: Date;
    regionCode: string;
    savedAssessmentData: SavedAssessmentData;
    rawSqlInstanceDetails: SqlInstanceDetails[];
    windowsConfig: WindowsConfig;
    snapshotInfo?: StorageSavingsRequestBodyType;
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

        const savedResources = filteredReports.map(r => ({
            resourceId: r.resource_id,
            deploymentType: r.database_deployment_type,
            instances: r.database_instances_data
        }));

        computeAndSaveComputeLicenseData(accountId, data, savedResources).catch(error =>
            logger.error('Failed to compute and save compute/license data', { accountId, error })
        );

        return savedResources;
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
    snapshotInfo?: StorageSavingsRequestBodyType,
    hasUserOverrides: boolean = false
) {
    logger.info('Getting Storage Savings Response', {
        accountId,
        region,
        sqlServerDeploymentType,
        windowsConfig,
        instances,
        snapshotInfo,
        hasUserOverrides
    });
    const { currentLicenseEdition, recommendedLicenseEdition, finding } = getOnpremLicenseRecommendations(instances);

    const currentInstanceType = hasUserOverrides
        ? await deriveSqlUsageBasedInstanceType(region, instances, currentLicenseEdition)
        : await deriveHostConfigBasedInstanceType(
              region,
              windowsConfig,
              isNonFreeEnterpriseEdition(currentLicenseEdition) ? ENTERPRISE_EDITION : STANDARD_EDITION
          );
    const recommendedInstanceType = await deriveSqlUsageBasedInstanceType(region, instances, recommendedLicenseEdition);

    if (!currentInstanceType || !recommendedInstanceType) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Error deriving instance requirements. Could not find instance type matching requirements.'
        );
    }

    const ec2Instances = deriveEc2InstanceListForMarketing(region, instances, currentInstanceType);
    const ec2InstancesRecommended = deriveEc2InstanceListForMarketing(region, instances, recommendedInstanceType);

    const { clonedCopiesCount, monthlyChangeRatePercentage, snapshotFrequency } = resolveSnapshotDefaults(snapshotInfo);

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
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error deriving EBS Volumes List: ${(error as Error).message}`
        );
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

    const licenseType = resolveLicenseType(licenseEdition);
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
    const licenseType = resolveLicenseType(licenseEdition);
    return fetchInstanceTypesByRetryWithPricing(region, instanceRequirements, 'windows', licenseType);
}

async function analyzeOnpremData(
    accountId: string,
    data: OnPremCollectionObject,
    snapshotInfo?: StorageSavingsRequestBodyType,
    region?: string,
    hasUserOverrides: boolean = false
) {
    logger.info('Analyzing OnPrem Data', { accountId, snapshotInfo, region, hasUserOverrides });

    const { windowsConfig, sqlServerInfo } = data;
    if (!region || IS_DEMO_FLOW) {
        region = DEFAULT_AWS_REGION;
    }

    const hostIds = windowsConfig.nodeDetails.map(({ hostId }) => hostId);
    const grouped = groupSqlServerInstancesByDeploymentType(sqlServerInfo);
    const resourceGroups = Object.entries(grouped).map(([deploymentType, instances]) => ({
        resourceId: generateUniqueId(
            accountId,
            instances.map(i => i.instanceGuid),
            hostIds
        ),
        deploymentType,
        instances
    }));

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
                snapshotInfo,
                hasUserOverrides
            );
            response.push({ accountId, resourceId, storageSavings, calculations });
        })
    );
    return response;
}

async function computeAndSaveComputeLicenseData(
    accountId: string,
    data: OnPremCollectionObject,
    savedResources: { resourceId: string; deploymentType: string; instances: SqlInstanceDetails[] }[]
) {
    logger.info('Computing and saving compute/license data', { accountId, resourceCount: savedResources.length });

    const { windowsConfig } = data;
    const regionCode = DEFAULT_AWS_REGION;

    await Promise.all(
        savedResources.map(
            throat(5, async ({ resourceId, deploymentType, instances }) => {
                try {
                    const { currentLicenseEdition, recommendedLicenseEdition, finding } =
                        getOnpremLicenseRecommendations(instances);

                    const [existingInstanceType, recommendedInstanceType] = await Promise.all([
                        deriveHostConfigBasedInstanceType(
                            regionCode,
                            windowsConfig,
                            isNonFreeEnterpriseEdition(currentLicenseEdition) ? ENTERPRISE_EDITION : STANDARD_EDITION
                        ),
                        deriveSqlUsageBasedInstanceType(regionCode, instances, recommendedLicenseEdition)
                    ]);

                    if (!existingInstanceType || !recommendedInstanceType) {
                        logger.warn('Could not derive instance types, skipping compute/license caching', {
                            accountId,
                            resourceId
                        });
                        return;
                    }

                    const existingNodeCount = windowsConfig.nodeDetails.length;
                    const recommendedNodeCount = deploymentType === DATABASE_DEPLOYMENT_TYPE.Standalone ? 1 : 2;
                    const resourceName = windowsConfig.windowsSystemName;

                    const individualResourceInfo: IndividualResourceInfo[] = [
                        {
                            resourceId,
                            resourceName,
                            deploymentType,
                            existingNodeCount,
                            recommendedNodeCount,
                            currentLicenseEdition,
                            recommendedLicenseEdition,
                            finding,
                            currentInstanceType: existingInstanceType,
                            recommendedInstanceType
                        }
                    ];

                    const [resourceWithPricing] = await fetchPricingForResources(individualResourceInfo, regionCode);

                    const {
                        existingComputeCalculation: [existingComputeCalc],
                        existingLicenseCalculation: [existingLicenseCalc],
                        recommendedComputeCalculation: [recommendedComputeCalc],
                        recommendedLicenseCalculation: [recommendedLicenseCalc]
                    } = buildPerResourceCalculations([resourceWithPricing]);

                    const cachedData: SavedAssessmentData = {
                        regionCode,
                        existingInstanceType,
                        recommendedInstanceType,
                        existingComputeCalculation: existingComputeCalc,
                        recommendedComputeCalculation: recommendedComputeCalc,
                        existingLicenseCalculation: existingLicenseCalc,
                        recommendedLicenseCalculation: recommendedLicenseCalc,
                        licenseFinding: finding
                    };

                    await updateOnPremTcoReportRecord(accountId, resourceId, MSSQL, {
                        assessment_data: cachedData
                    });

                    logger.info('Saved compute/license data for resource', { accountId, resourceId });
                } catch (error) {
                    logger.error('Failed to compute compute/license data for resource', {
                        accountId,
                        resourceId,
                        error
                    });
                }
            })
        )
    );
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

        validateOrThrow(mssqlCollectionObjectSchema, data, 'Invalid data format');
        validateOrThrow(windowsConfigSchema, data.windowsConfig, 'Invalid windowsConfig format');

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
            `Error getting EBS Disks for ${instance?.sqlInstanceName}: ${(error as Error).message}`
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

async function buildHybridExploreSavingsResponse(params: HybridExploreSavingsParams) {
    const {
        accountId,
        resourceId,
        resourceName,
        deploymentType,
        reportCreationTime,
        regionCode,
        savedAssessmentData,
        rawSqlInstanceDetails,
        windowsConfig,
        snapshotInfo
    } = params;

    logger.info('Building hybrid explore savings from saved compute/license data', { accountId, resourceId });

    try {
        const {
            existingInstanceType,
            recommendedInstanceType,
            existingComputeCalculation,
            recommendedComputeCalculation,
            existingLicenseCalculation,
            recommendedLicenseCalculation,
            licenseFinding
        } = savedAssessmentData;

        const ec2Instances = deriveEc2InstanceListForMarketing(regionCode, rawSqlInstanceDetails, existingInstanceType);
        const ec2InstancesRecommended = deriveEc2InstanceListForMarketing(
            regionCode,
            rawSqlInstanceDetails,
            recommendedInstanceType
        );

        const { clonedCopiesCount, monthlyChangeRatePercentage, snapshotFrequency } =
            resolveSnapshotDefaults(snapshotInfo);
        const existingNodeCount = windowsConfig.nodeDetails.length;
        const recommendedNodeCount = deploymentType === DATABASE_DEPLOYMENT_TYPE.Standalone ? 1 : 2;

        const existingLicenseEdition = existingLicenseCalculation?.sqlServerEdition || STANDARD_EDITION;
        const recommendedLicenseEdition = recommendedLicenseCalculation?.sqlServerEdition || STANDARD_EDITION;

        const { existingConfigData, existingConfigCalculations, recommendedConfigData, recommendedConfigCalculations } =
            await fetchStorageSavingsFromMarketingApi({
                accountId,
                regionCode,
                baseParams: {
                    clonedCopiesCount,
                    snapshotFrequency,
                    monthlyChangeRatePercentage,
                    sqlServerDeploymentType: deploymentType
                },
                existingEc2Instances: ec2Instances,
                recommendedEc2Instances: ec2InstancesRecommended,
                existingEdition: existingLicenseEdition,
                recommendedEdition: recommendedLicenseEdition,
                existingNodeCount,
                recommendedNodeCount
            });

        const { ebs, fsx, single, multi } = (existingConfigData || {}) as Partial<StorageSavingsResponseType>;
        const { fsx: recommendedFsx } = (recommendedConfigData || {}) as Partial<StorageSavingsResponseType>;

        const storageSavingsCompute = {
            existing: {
                instanceType: existingComputeCalculation.instanceType,
                computeMonthlyPrice: existingComputeCalculation.computeMonthlyPrice,
                machineDetails: existingComputeCalculation.machineDetails
            },
            recommended: {
                instanceType: recommendedComputeCalculation.instanceType,
                computeMonthlyPrice: recommendedComputeCalculation.computeMonthlyPrice,
                machineDetails: recommendedComputeCalculation.machineDetails
            }
        };

        const existingLicenseMonthlyPrice = existingLicenseCalculation?.licenseMonthlyPrice || 0;
        const recommendedLicenseMonthlyPrice = recommendedLicenseCalculation?.licenseMonthlyPrice || 0;

        const storageSavingsLicense = {
            existing: existingLicenseCalculation
                ? {
                      sqlServerEdition: existingLicenseEdition,
                      licenseMonthlyPrice: existingLicenseMonthlyPrice
                  }
                : undefined,
            recommended: recommendedLicenseCalculation
                ? {
                      sqlServerEdition: recommendedLicenseEdition,
                      licenseMonthlyPrice: recommendedLicenseMonthlyPrice
                  }
                : undefined,
            ...(licenseFinding !== undefined && { finding: licenseFinding })
        };

        const ebsTotal = Number((ebs as { total?: number })?.total || 0);
        const fsxTotal = Number(((recommendedFsx || fsx) as { total?: number })?.total || 0);

        const existingTotalSummary =
            ebsTotal + existingComputeCalculation.computeMonthlyPrice + existingLicenseMonthlyPrice;
        const recommendedTotalSummary =
            fsxTotal + recommendedComputeCalculation.computeMonthlyPrice + recommendedLicenseMonthlyPrice;

        const storageSavings = {
            compute: storageSavingsCompute,
            license: storageSavingsLicense,
            ebs,
            fsx: recommendedFsx || fsx,
            single,
            multi,
            totalSummary: { existing: existingTotalSummary, recommended: recommendedTotalSummary }
        } as StorageSavingsResponseType;

        const calculations = {
            ...existingConfigCalculations,
            existingComputeCalculation,
            existingLicenseCalculation,
            recommendedComputeCalculation,
            recommendedLicenseCalculation,
            ...(recommendedConfigCalculations && {
                single: (recommendedConfigCalculations as Record<string, unknown>).single,
                multi: (recommendedConfigCalculations as Record<string, unknown>).multi
            }),
            totalSummary: { existing: existingTotalSummary, recommended: recommendedTotalSummary }
        } as StorageSavingsMetricsCalculationsResponseType;

        return {
            resourceId,
            resourceName,
            deploymentModel: deploymentType,
            creationTime: new Date(reportCreationTime).getTime(),
            regionCode,
            calculations,
            storageSavings,
            ...(snapshotInfo && { snapShotInfo: snapshotInfo })
        };
    } catch (error) {
        logger.error('Failed to build hybrid assessment from cached data', { accountId, resourceId, error });
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Failed to fetch assessment data for the selected resource'
        );
    }
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
    validateAndGetRegion(regionCode);

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

    if (sqlInstanceData) {
        try {
            const hasUserOverrides = hasComputeOverrides(
                sqlInstanceData.map(inst => ({
                    id: inst.sqlInstanceId,
                    vcpus: inst.noOfVcpusInUse,
                    memoryBytes: inst.memory,
                    networkPerformance: inst.networkPerformance
                })),
                (rawSqlInstanceDetails ?? []).map(stored => {
                    const [memDetails] = parseMemoryUtilization(stored.memUtilization || '') || [];
                    return {
                        id: stored.instanceGuid,
                        vcpus: stored.noOfVcpusInUse ?? parseInt(stored.vcpusPerInstance, 10),
                        memoryBytes: memDetails?.used ?? stored.memory ?? 0,
                        networkPerformance: stored.networkPerformance ?? NETWORK_PERF.UP_TO_10
                    };
                })
            );

            const updatedSqlDetailsBasedOnRequest = applySqlInstanceOverrides(
                rawSqlInstanceDetails,
                sqlInstanceData,
                deploymentType
            );

            const data: OnPremCollectionObject = {
                windowsConfig: hostConfig as unknown as WindowsConfig,
                sqlServerInfo: updatedSqlDetailsBasedOnRequest as unknown as SqlInstanceDetails[],
                scriptVersion,
                timestamp: new Date(reportCreationTime).toISOString()
            };
            const analysisResult = await analyzeOnpremData(accountId, data, snapshotInfo, regionCode, hasUserOverrides);

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

    if (isSavedAssessmentData(assessmentData) && assessmentData.regionCode === regionCode) {
        return buildHybridExploreSavingsResponse({
            accountId,
            resourceId,
            resourceName,
            deploymentType,
            reportCreationTime,
            regionCode,
            savedAssessmentData: assessmentData,
            rawSqlInstanceDetails,
            windowsConfig: hostConfig as unknown as WindowsConfig,
            snapshotInfo
        });
    }

    // Fallback: no cached data available, recompute everything
    try {
        const data: OnPremCollectionObject = {
            windowsConfig: hostConfig as unknown as WindowsConfig,
            sqlServerInfo: rawSqlInstanceDetails,
            scriptVersion,
            timestamp: new Date(reportCreationTime).toISOString()
        };
        const analysisResult = await analyzeOnpremData(accountId, data, snapshotInfo, regionCode);

        if (isEmpty(analysisResult)) {
            const errorMessage = 'No analysis result found for the selected resource.';
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        const [{ storageSavings, calculations }] = analysisResult;
        return {
            resourceId,
            resourceName,
            deploymentModel: deploymentType,
            creationTime: new Date(reportCreationTime).getTime(),
            regionCode,
            calculations: calculations as StorageSavingsMetricsCalculationsResponseType,
            storageSavings: storageSavings as StorageSavingsResponseType,
            ...(snapshotInfo && { snapShotInfo: snapshotInfo })
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
    savedAssessmentData?: SavedAssessmentData;
};

type ResourceWithPricing = IndividualResourceInfo & {
    currentLicenseType: string;
    recommendedLicenseType: string;
    currentPricing: PricingDetails;
    recommendedPricing: PricingDetails;
};

function applySqlInstanceOverrides(
    rawSqlInstanceDetails: SqlInstanceDetails[],
    sqlInstanceData: SqlInstanceDetailsRequestObjectType[],
    deploymentType: DATABASE_DEPLOYMENT_TYPE | null
) {
    return rawSqlInstanceDetails.map(detail => {
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
            logger.warn('Error applying SQL instance overrides', { instanceGuid: detail.instanceGuid, error });
            return undefined;
        }
    });
}

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
        const updatedSqlDetailsBasedOnRequest = applySqlInstanceOverrides(
            rawSqlInstanceDetails,
            sqlInstanceData,
            deploymentType
        );
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
    regionCode: string,
    hasUserOverrides: boolean
): Promise<ResourceDataWithInstanceTypes> {
    const { windowsConfig, sqlInstanceDetails, currentLicenseEdition, recommendedLicenseEdition } = prepData;

    const [currentInstanceType, recommendedInstanceType] = await Promise.all([
        hasUserOverrides
            ? deriveSqlUsageBasedInstanceType(regionCode, sqlInstanceDetails, currentLicenseEdition)
            : deriveHostConfigBasedInstanceType(
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
    const isUsingByol = monthlySqlByolCost && monthlySqlByolCost > 0;

    const inputs: ResourceComputeInput[] = resourcesWithPricing.map(
        ({
            currentPricing,
            currentInstanceType,
            currentLicenseType,
            recommendedPricing,
            recommendedInstanceType,
            recommendedLicenseType,
            resourceId,
            resourceName,
            deploymentType,
            existingNodeCount,
            recommendedNodeCount
        }) => {
            const currentPrice = getPricePerUnit(currentPricing, currentInstanceType, currentLicenseType);
            const currentBasePrice = getPricePerUnit(currentPricing, currentInstanceType, 'NA');
            const currentLicensePrice = currentPrice - currentBasePrice;

            const recommendedPrice = getPricePerUnit(
                recommendedPricing,
                recommendedInstanceType,
                recommendedLicenseType
            );
            const recommendedBasePrice = getPricePerUnit(recommendedPricing, recommendedInstanceType, 'NA');

            const existingLicenseIncluded = isUsingByol ? false : currentLicensePrice > 0;

            return {
                resourceId,
                resourceName,
                deploymentType,
                existingNodeCount,
                recommendedNodeCount,
                currentInstanceType,
                recommendedInstanceType,
                existing: {
                    basePrice: currentBasePrice,
                    fullPrice: currentPrice,
                    licenseIncluded: existingLicenseIncluded
                },
                recommended: { basePrice: recommendedBasePrice, fullPrice: recommendedPrice, licenseIncluded: true }
            };
        }
    );

    const computeResult = buildComputeCalculationsForResources(inputs);

    const existingLicenseCalculation: LicenseCalculation[] = [];
    const recommendedLicenseCalculation: LicenseCalculation[] = [];
    const licenseSavings: MssqlLicenseSavingsEntry[] = [];
    const perResourceAssessmentData: MssqlPerResourceAssessment[] = [];

    for (let i = 0; i < resourcesWithPricing.length; i += 1) {
        const r = resourcesWithPricing[i];
        const input = inputs[i];

        const currentLicensePrice = input.existing.fullPrice - input.existing.basePrice;
        const recommendedLicensePrice = input.recommended.fullPrice - input.recommended.basePrice;

        const existingLicenseMonthlyPrice = currentLicensePrice * HOURS_IN_MONTH * r.existingNodeCount;
        const recommendedLicenseMonthlyPrice = recommendedLicensePrice * HOURS_IN_MONTH * r.recommendedNodeCount;
        const existingLicenseHourlyPrice = currentLicensePrice * r.existingNodeCount;
        const recommendedLicenseHourlyPrice = recommendedLicensePrice * r.recommendedNodeCount;

        existingLicenseCalculation.push({
            resourceName: r.resourceName,
            deploymentType: r.deploymentType,
            sqlServerEdition: r.currentLicenseEdition,
            licenseHourlyPrice: existingLicenseHourlyPrice,
            licenseIncluded: input.existing.licenseIncluded,
            licenseMonthlyPrice: existingLicenseMonthlyPrice,
            hoursInMonth: HOURS_IN_MONTH
        });

        recommendedLicenseCalculation.push({
            resourceName: r.resourceName,
            deploymentType: r.deploymentType,
            sqlServerEdition: r.recommendedLicenseEdition,
            licenseHourlyPrice: recommendedLicenseHourlyPrice,
            licenseIncluded: true,
            licenseMonthlyPrice: recommendedLicenseMonthlyPrice,
            hoursInMonth: HOURS_IN_MONTH
        });

        licenseSavings.push({
            resourceName: r.resourceName,
            deploymentType: r.deploymentType,
            existing: {
                sqlServerEdition: r.currentLicenseEdition,
                licenseHourlyPrice: existingLicenseHourlyPrice,
                licenseIncluded: input.existing.licenseIncluded,
                licenseMonthlyPrice: existingLicenseMonthlyPrice,
                hoursInMonth: HOURS_IN_MONTH
            },
            recommended: {
                sqlServerEdition: r.recommendedLicenseEdition,
                licenseHourlyPrice: recommendedLicenseHourlyPrice,
                licenseIncluded: true,
                licenseMonthlyPrice: recommendedLicenseMonthlyPrice,
                hoursInMonth: HOURS_IN_MONTH
            },
            finding: r.finding
        });

        perResourceAssessmentData.push({
            resourceId: r.resourceId,
            existingComputeCalculation: computeResult.existingComputeCalculation[i],
            existingLicenseCalculation: existingLicenseCalculation[i],
            recommendedComputeCalculation: computeResult.recommendedComputeCalculation[i],
            recommendedLicenseCalculation: recommendedLicenseCalculation[i],
            computeSavings: computeResult.computeSavings[i],
            licenseSavings: licenseSavings[i]
        });
    }

    return {
        existingComputeCalculation: computeResult.existingComputeCalculation,
        existingLicenseCalculation,
        recommendedComputeCalculation: computeResult.recommendedComputeCalculation,
        recommendedLicenseCalculation,
        computeSavings: computeResult.computeSavings,
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

    validateAndGetRegion(regionCode);

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

        // Step 2: Derive instance types — skip for resources with valid saved assessment data
        // (same region, no user overrides). Those resources reuse saved compute/license calculations
        // directly instead of re-deriving instance types and re-fetching pricing.
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
                const savedData = rawRecord.assessment_data;

                // Only bypass the cache if compute-affecting fields (vCPUs, memory, network) differ
                // from what was used to generate the saved assessment. Storage/IOPS/throughput overrides
                // only affect EBS sizing and do not require re-deriving instance types.
                const persistedInstances = rawRecord.database_instances_data as unknown as SqlInstanceDetails[];
                const hasOverrides = hasComputeOverrides(
                    requestResource?.sqlInstanceData?.map(inst => ({
                        id: inst.sqlInstanceId,
                        vcpus: inst.noOfVcpusInUse,
                        memoryBytes: inst.memory,
                        networkPerformance: inst.networkPerformance
                    })),
                    (persistedInstances ?? []).map(stored => {
                        const [memDetails] = parseMemoryUtilization(stored.memUtilization || '') || [];
                        return {
                            id: stored.instanceGuid,
                            vcpus: stored.noOfVcpusInUse ?? parseInt(stored.vcpusPerInstance, 10),
                            memoryBytes: memDetails?.used ?? stored.memory ?? 0,
                            networkPerformance: stored.networkPerformance ?? NETWORK_PERF.UP_TO_10
                        };
                    })
                );

                if (!hasOverrides && isSavedAssessmentData(savedData) && savedData.regionCode === regionCode) {
                    logger.info('Using saved assessment data for bulk resource (no compute overrides)', {
                        accountId,
                        resourceId: prepData.resourceId
                    });
                    return {
                        ...prepData,
                        currentInstanceType: savedData.existingInstanceType,
                        recommendedInstanceType: savedData.recommendedInstanceType,
                        savedAssessmentData: savedData
                    };
                }

                const result = await deriveInstanceTypesForResource(prepData, regionCode, hasOverrides);
                return {
                    ...result,
                    savedAssessmentData: undefined as SavedAssessmentData | undefined
                };
            })
        );

        // Filter out resources where instance types could not be derived
        const validResourceDataList = compact(resourceDataWithInstanceTypes).filter(data => {
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
                recommendedInstanceType,
                savedAssessmentData
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
                recommendedInstanceType,
                savedAssessmentData
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
        const { clonedCopiesCount, monthlyChangeRatePercentage, snapshotFrequency, monthlySqlByolCost } =
            resolveSnapshotDefaults(snapshotInfo);

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

        // Step 8: Call marketing APIs AND fetch pricing in parallel (independent operations).
        // For resources with saved assessment data, pricing is not re-fetched — saved
        // compute/license calculations are used directly instead.
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
                    sqlServerEdition: combinedExistingLicenseEdition
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
                    sqlServerEdition: combinedExistingLicenseEdition
                },
                totalNodeCount,
                true,
                true
            ),
            fetchPricingForResources(resourcesNeedingPricing, regionCode)
        ]);

        // Step 9: Build per-resource calculations in original order.
        // Resources with saved assessment data use their stored calculations directly;
        // the rest go through buildPerResourceCalculations with fresh pricing.
        const {
            existingComputeCalculation: pricedExisting,
            existingLicenseCalculation: pricedExistingLicense,
            recommendedComputeCalculation: pricedRecommended,
            recommendedLicenseCalculation: pricedRecommendedLicense,
            computeSavings: pricedComputeSavings,
            licenseSavings: pricedLicenseSavings,
            perResourceAssessmentData: pricedPerResourceAssessment
        } = buildPerResourceCalculations(pricedResources, monthlySqlByolCost);

        const pricedByResourceId = new Map(
            pricedPerResourceAssessment.map((entry, idx) => [
                entry.resourceId,
                {
                    existingCompute: pricedExisting[idx],
                    existingLicense: pricedExistingLicense[idx],
                    recommendedCompute: pricedRecommended[idx],
                    recommendedLicense: pricedRecommendedLicense[idx],
                    computeSaving: pricedComputeSavings[idx],
                    licenseSaving: pricedLicenseSavings[idx]
                }
            ])
        );

        const existingComputeCalculation: ComputeCalculation[] = [];
        const existingLicenseCalculation: LicenseCalculation[] = [];
        const recommendedComputeCalculation: ComputeCalculation[] = [];
        const recommendedLicenseCalculation: LicenseCalculation[] = [];
        const computeSavings: MssqlComputeSavingsEntry[] = [];
        const licenseSavings: MssqlLicenseSavingsEntry[] = [];

        for (const {
            resourceId,
            resourceName,
            deploymentType,
            currentLicenseEdition,
            recommendedLicenseEdition,
            finding,
            savedAssessmentData: saved
        } of individualResourceInfo) {
            if (saved) {
                const existingLic = saved.existingLicenseCalculation ?? ({} as LicenseCalculation);
                const recommendedLic = saved.recommendedLicenseCalculation ?? ({} as LicenseCalculation);

                existingComputeCalculation.push(saved.existingComputeCalculation);
                recommendedComputeCalculation.push(saved.recommendedComputeCalculation);
                existingLicenseCalculation.push({
                    resourceName,
                    deploymentType,
                    sqlServerEdition: existingLic.sqlServerEdition || currentLicenseEdition,
                    licenseHourlyPrice: existingLic.licenseHourlyPrice || 0,
                    licenseIncluded: existingLic.licenseIncluded ?? false,
                    licenseMonthlyPrice: existingLic.licenseMonthlyPrice || 0,
                    hoursInMonth: existingLic.hoursInMonth || HOURS_IN_MONTH
                });
                recommendedLicenseCalculation.push({
                    resourceName,
                    deploymentType,
                    sqlServerEdition: recommendedLic.sqlServerEdition || recommendedLicenseEdition,
                    licenseHourlyPrice: recommendedLic.licenseHourlyPrice || 0,
                    licenseIncluded: recommendedLic.licenseIncluded ?? true,
                    licenseMonthlyPrice: recommendedLic.licenseMonthlyPrice || 0,
                    hoursInMonth: recommendedLic.hoursInMonth || HOURS_IN_MONTH
                });
                computeSavings.push({
                    resourceName,
                    deploymentType,
                    existing: saved.existingComputeCalculation,
                    recommended: saved.recommendedComputeCalculation
                });
                licenseSavings.push({
                    resourceName,
                    deploymentType,
                    existing: {
                        sqlServerEdition: existingLic.sqlServerEdition || currentLicenseEdition,
                        licenseHourlyPrice: existingLic.licenseHourlyPrice || 0,
                        licenseIncluded: existingLic.licenseIncluded ?? false,
                        licenseMonthlyPrice: existingLic.licenseMonthlyPrice || 0,
                        hoursInMonth: existingLic.hoursInMonth || HOURS_IN_MONTH
                    },
                    recommended: {
                        sqlServerEdition: recommendedLic.sqlServerEdition || recommendedLicenseEdition,
                        licenseHourlyPrice: recommendedLic.licenseHourlyPrice || 0,
                        licenseIncluded: recommendedLic.licenseIncluded ?? true,
                        licenseMonthlyPrice: recommendedLic.licenseMonthlyPrice || 0,
                        hoursInMonth: recommendedLic.hoursInMonth || HOURS_IN_MONTH
                    },
                    finding: saved.licenseFinding || finding
                });
            } else {
                const priced = pricedByResourceId.get(resourceId)!;
                existingComputeCalculation.push(priced.existingCompute);
                existingLicenseCalculation.push(priced.existingLicense);
                recommendedComputeCalculation.push(priced.recommendedCompute);
                recommendedLicenseCalculation.push(priced.recommendedLicense);
                computeSavings.push(priced.computeSaving);
                licenseSavings.push(priced.licenseSaving);
            }
        }

        // Step 10: Extract shared storage data from existing config API response
        const { ebs, fsx, single, multi } = existingConfigData || {};

        // Derive totals from per-resource pricing (consistent with how Oracle bulk flow computes them)
        const existingTotalSummary =
            Number(ebs?.total || 0) +
            sumBy(existingComputeCalculation, 'computeMonthlyPrice') +
            sumBy(existingLicenseCalculation, 'licenseMonthlyPrice');
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
            regionCode,
            calculations: aggregatedCalculations,
            storageSavings: aggregatedStorageSavings,
            ...(snapshotInfo && { snapShotInfo: snapshotInfo })
        };
    } catch (error) {
        logger.error('Failed to fetch bulk assessment data', { accountId, error });
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Failed to fetch bulk assessment data: ${(error as Error).message}`
        );
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
