import { compressSync, decompressSync } from 'fflate';
import createError from 'http-errors';
import { DATABASE_DEPLOYMENT_TYPE, DATABASE_TYPE, JOBSTATUS, JOBTYPE } from '@prisma/client';
import { compact, isEmpty } from 'lodash-es';
import {
    ArchitectureType,
    CpuManufacturer,
    GetInstanceTypesFromInstanceRequirementsCommandInput,
    InstanceGeneration,
    VirtualizationType
} from '@aws-sdk/client-ec2';
import { preSignedUrl, putObjectBucket } from '../lib/aws/s3';
import {
    AWS_REGIONS,
    DEFAULT_AWS_REGION,
    FINDING,
    HttpErrorCodes,
    IO2_AVAILABLE_REGIONS,
    MSSQL,
    PRICING_LICENSE_KEYS,
    WLMDB
} from '../utils/consts';
import { convertGiBToBytes, getArtifactsRegionBucketName, sizeInGigaBytes, IS_DEMO_FLOW } from '../utils/utils';
import getLogger from '../utils/logger';
import { registerJob } from './database/job-operations';
import { updateJob } from '../lib/database/job';
import {
    SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH,
    REPORTING_BUCKET,
    NETWORK_PERF,
    ONPREM_TCO_CREDENTIALS_ID
} from '../utils/continous-optimization-consts';
import {
    OnPremCollectionObjectV1,
    SqlInstanceDetails,
    StorageDetailByDB,
    WindowsConfig
} from '../utils/onprem-tco/onprem-tco-generic.types';
import {
    createOnPremTcoReportData,
    listOnPremDatabaseResources,
    removeOnPremTcoReportData,
    updateOnPremTcoReportRecord
} from '../lib/database/onprem-tco';
import { getInstanceTypesFromInstanceRequirementsCommand } from '../lib/aws/ec2';
import {
    getManualModeStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations
} from './storage-savings-operations';
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
} from '../utils/onprem-tco/onprem-tco-utils';
import { isNonFreeEnterpriseEdition } from './recommendation-operations';
import {
    ManualModeInstancesType,
    StorageSavingsMetricsCalculationsResponseType,
    StorageSavingsRequestBodyType,
    StorageSavingsResponseType
} from '../routes/types/storage-savings.types';
import {
    OnPremDatabaseResourcesObjectType,
    SqlInstanceDetailsRequestObjectType
} from '../routes/types/onprem-tco.types';
import { getSqlInstancePricingDetails } from './aws/pricing-operations';

const { getPreSignedUrl } = preSignedUrl;

const logger = getLogger();

const ENTERPRISE_EDITION = 'Enterprise Edition';
const STANDARD_EDITION = 'Standard Edition';
function validateOnPremCollectionObjectV1(data: OnPremCollectionObjectV1): boolean {
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
    const compressedBase64 = btoa(String.fromCharCode(...compressedData));

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
    logger.info('Delete sql data collector report', { accountId, resourceIds });

    const resourcesIdList = compact(resourceIds.split(','));
    try {
        const response = await removeOnPremTcoReportData(undefined, accountId, resourcesIdList, databaseType);
        if (response.count === 0) {
            logger.error('No report found to delete', { accountId, resourceIds });
            throw createError(HttpErrorCodes.NOT_FOUND, `Report id ${resourceIds} not found for account ${accountId}`);
        }
        return response;
    } catch (error: any) {
        if (error.status === HttpErrorCodes.NOT_FOUND) {
            throw createError(error);
        }
        logger.error('Error deleting report', { error });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error deleting report ${error}`);
    }
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
                const errorMessage = `Failed to format SQL instance details ${error}`;
                logger.error('Failed to format SQL instance details', { instance, errorMessage });
                return {
                    ...(instance.instanceGuid ? { sqlInstanceId: instance.instanceGuid } : {}),
                    ...(instance.sqlInstanceName ? { sqlInstanceName: instance.sqlInstanceName } : {}),
                    errorMessage
                };
            }
        })
    );
}

async function downloadSqlServerDataCollectorScript(accountId: string, databaseType: string = MSSQL) {
    logger.info('Downloading SQL Server data collector Script', { accountId, databaseType });

    const bucketname = getArtifactsRegionBucketName(DEFAULT_AWS_REGION);
    const url = await getPreSignedUrl(DEFAULT_AWS_REGION, bucketname, SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH);
    return {
        url
    };
}

async function saveReportInReportingRegistry(accountId: string, fileName: string, data: OnPremCollectionObjectV1) {
    logger.info('Saving Report in Reporting Registry', { accountId, fileName });

    await putObjectBucket(
        DEFAULT_AWS_REGION,
        REPORTING_BUCKET,
        `${WLMDB}/${accountId}-${fileName}`,
        JSON.stringify(data),
        undefined,
        false
    );
}

async function saveReportInWlmdbDatabase(
    accountId: string,
    databaseType: DATABASE_TYPE,
    data: OnPremCollectionObjectV1
) {
    logger.info('Saving Report in WLMDB Database', { accountId, databaseType });
    const { windowsConfig, sqlServerInfo, scriptVersion, timestamp } = data;

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
                    return null; // Skip this report if it already exists
                }
                return report;
            })
        );
        if (isEmpty(compact(validReports))) {
            throw new Error('Report already generated for the collected SQL Server data.');
        }

        return createOnPremTcoReportData(reports);
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

    const [existingConfigData, existingConfigCalculations, recommendedConfigData, recommendedConfigCalculations] =
        await Promise.all([
            performManualModeStorageSavingsCalculations(
                accountId,
                region,
                {
                    ...params,
                    ec2Instances,
                    sqlServerEdition: currentLicenseEdition
                },
                nodeCount,
                true
            ),
            getManualModeStorageSavingsCalculationMetrics(
                accountId,
                region,
                {
                    ...params,
                    ec2Instances,
                    sqlServerEdition: currentLicenseEdition
                },
                nodeCount,
                true
            ),
            performManualModeStorageSavingsCalculations(
                accountId,
                region,
                {
                    ...params,
                    ec2Instances: ec2InstancesRecommended,
                    sqlServerEdition: recommendedLicenseEdition
                },
                sqlServerDeploymentType === DATABASE_DEPLOYMENT_TYPE.Standalone ? 1 : 2, // We recommend 2 node FCI for SQL Server
                true
            ),
            getManualModeStorageSavingsCalculationMetrics(
                accountId,
                region,
                {
                    ...params,
                    ec2Instances: ec2InstancesRecommended,
                    sqlServerEdition: recommendedLicenseEdition
                },
                sqlServerDeploymentType === DATABASE_DEPLOYMENT_TYPE.Standalone ? 1 : 2, // We recommend 2 node FCI for SQL Server
                true
            )
        ]);

    const {
        compute: { existing: existingCompute } = {},
        license: { existing: existingLicense } = {},
        ebs,
        fsx,
        single,
        multi,
        totalSummary: { existing: existingTotalSummary } = {}
    } = existingConfigData;

    const {
        compute: { recommended: recommendedCompute } = {},
        license: { recommended: recommendedLicense } = {},
        totalSummary: { recommended: recommendedTotalSummary } = {}
    } = recommendedConfigData;

    const storageSavings = {
        compute: {
            existing: existingCompute,
            recommended: recommendedCompute
        },
        license: {
            existing: existingLicense,
            recommended: recommendedLicense,
            finding
        },
        ebs,
        fsx,
        single,
        multi,
        totalSummary: {
            existing: existingTotalSummary,
            recommended: recommendedTotalSummary
        }
    };

    const { recommendedComputeCalculation, recommendedLicenseCalculation } = recommendedConfigCalculations;

    const calculations = {
        ...existingConfigCalculations,
        recommendedComputeCalculation,
        recommendedLicenseCalculation
    };

    return { storageSavings, calculations };
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
                logger.error(`Error parsing SQL instance details: ${error}`);
            }
        }
        return acc;
    }, {});
}

function processEbsDisks(disks: EBSClassification[]) {
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
                    volumeIops: Math.max(volumeIops, requiredIops), // IOPS and throughput would be in a similar range for the same ebs disk type, considering the max value among all primary or secondary instances which uses the same ebs disk type
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
            let storageAmount = Math.max(storageAmountPerDiskType, 1); // Minimum volume size is 1 GiB
            switch (volumeType) {
                case 'io2': {
                    storageAmount = Math.min(Math.max(storageAmountPerDiskType, 4), sizeInGigaBytes(64, 'TiB')); // Minimum volume size is 4 GiB for io1
                    volumeIops = Math.min(Math.max(volumeIops, 100), 256000); // Minimum IOPS is 100, max 256,000
                    throughput = 0; // Throughput is not applicable for io1
                    break;
                }
                case 'io1': {
                    storageAmount = Math.min(Math.max(storageAmountPerDiskType, 4), sizeInGigaBytes(16, 'TiB')); // Minimum volume size is 4 GiB for io1
                    volumeIops = Math.min(Math.max(volumeIops, 100), 64000); // Minimum IOPS is 100 , max 64,000
                    throughput = 0; // Throughput is not applicable for io1
                    break;
                }
                case 'gp3':
                default: {
                    volumeIops = Math.min(Math.max(volumeIops, 3000), 16000); // Minimum IOPS is 3000
                    throughput = Math.min(Math.max(throughput, 125), 1000); // Minimum throughput is 125 , max is 1000
                    storageAmount = Math.min(Math.max(storageAmountPerDiskType, 1), sizeInGigaBytes(16, 'TiB')); // Minimum volume size is 1 GiB
                    break;
                }
            }

            return {
                volumeType,
                volumeNumber,
                storageAmount: convertGiBToBytes(storageAmount),
                volumeIops,
                throughput
            };
        }
    );
}

function deriveEbsVolumesListForMarketing(region: string, sqlInstancesDetails: SqlInstanceDetails[]) {
    logger.info('Deriving EBS Volumes List', { region, sqlInstancesDetails: sqlInstancesDetails.length });
    try {
        let ebsDisks: EBSClassification[] = [];
        sqlInstancesDetails.forEach((instance: SqlInstanceDetails) => {
            ebsDisks.push(getEbsDisks(region, instance, 'primary')!);
            ebsDisks.push(getEbsDisks(region, instance, 'secondary')!);
        });

        ebsDisks = compact(ebsDisks);

        const primaryEbsDisks = ebsDisks.filter(({ isPrimary }) => isPrimary);
        const secondaryEbsDisks = ebsDisks.filter(({ isPrimary }) => !isPrimary);

        const primaryEbsVolumes = processEbsDisks(primaryEbsDisks);

        const secondaryEbsVolumes = secondaryEbsDisks.length > 0 ? processEbsDisks(secondaryEbsDisks) : [];

        logger.info('>>EBS VOLUMES', { primaryEbsVolumes, secondaryEbsVolumes });

        return { primaryEbsVolumes, secondaryEbsVolumes };
    } catch (error) {
        const errorMessage = `Error deriving EBS Volumes List ${error}`;
        throw errorMessage;
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

    const instanceRequirements = {
        ArchitectureTypes: [ArchitectureType.x86_64],
        VirtualizationTypes: [VirtualizationType.hvm],
        InstanceRequirements: {
            VCpuCount: { Min: Math.ceil(maxVCpuCount), Max: Math.ceil(maxVCpuCount) }, // both min and max are same to ensure we get the same instance type matching the vcpu count of the on-prem server
            MemoryMiB: { Min: Math.ceil(minMemoryMiB) },
            CpuManufacturers: [CpuManufacturer.INTEL, CpuManufacturer.AMAZON_WEB_SERVICES],
            AllowedInstanceTypes: ['m*', 'c*', 'r*'],
            InstanceGenerations: [InstanceGeneration.CURRENT],
            NetworkBandwidthGbps: networkBandwidthGbps
                ? {
                      Min: Math.ceil(networkBandwidthGbps),
                      Max: Math.ceil(networkBandwidthGbps) + 1 // Adding 1 Gbps to the max value to allow for some flexibility
                  }
                : undefined
        }
    };

    return fetchInstanceTypesByRetry(region, instanceRequirements, licenseEdition);
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

    return fetchInstanceTypesByRetry(region, instanceRequirements, licenseEdition);
}

async function fetchInstanceTypesByRetry(
    region: string,
    instanceRequirements: GetInstanceTypesFromInstanceRequirementsCommandInput,
    licenseEdition: string
) {
    logger.info('Fetching Instance Types by Retry', { region, instanceRequirements, licenseEdition });

    let { InstanceTypes: instanceTypes } =
        (await getInstanceTypesFromInstanceRequirementsCommand(region, instanceRequirements)) || {};
    if (
        isEmpty(instanceTypes) &&
        instanceRequirements.InstanceRequirements &&
        !isEmpty(instanceRequirements.InstanceRequirements?.NetworkBandwidthGbps)
    ) {
        logger.info(
            'No instance types matching initial requirements. Removing network bandwidth requirement and trying again.'
        );
        delete instanceRequirements.InstanceRequirements.NetworkBandwidthGbps;
        ({ InstanceTypes: instanceTypes = [] } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, instanceRequirements)) || {});
    }

    if (
        isEmpty(instanceTypes) &&
        instanceRequirements.InstanceRequirements?.MemoryMiB &&
        Number.isInteger(instanceRequirements.InstanceRequirements.MemoryMiB.Min)
    ) {
        logger.info(
            'No instance types matching requirements after removing network bandwidth. Resetting minimum memory to minimum possible and trying again.'
        );
        instanceRequirements.InstanceRequirements.MemoryMiB.Min = 1024; // 1 GiB
        ({ InstanceTypes: instanceTypes = [] } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, instanceRequirements)) || {});
    }

    if (
        isEmpty(instanceTypes) &&
        instanceRequirements.InstanceRequirements?.VCpuCount &&
        Number.isInteger(instanceRequirements.InstanceRequirements.VCpuCount.Max)
    ) {
        logger.info(
            'No instance types matching requirements after resetting minimum memory. Removing maximum CPU criteria and trying again.'
        );
        delete instanceRequirements.InstanceRequirements.VCpuCount.Max;
        ({ InstanceTypes: instanceTypes = [] } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, instanceRequirements)) || {});
    }

    let instanceType = instanceTypes?.[0]?.InstanceType; // Fall back to the first instance type if no cheaper instance types are found
    try {
        const licenseType =
            licenseEdition === ENTERPRISE_EDITION ? PRICING_LICENSE_KEYS.SQL_ENT : PRICING_LICENSE_KEYS.SQL_STD;
        const allInstanceTypePricingDetails = await getSqlInstancePricingDetails(
            region,
            undefined,
            'windows',
            undefined,
            licenseType
        );
        const recommendedInstanceTypePricingDetails = compact(
            Object.keys(allInstanceTypePricingDetails).filter(allInstType =>
                instanceTypes?.some(({ InstanceType: type }) => type === allInstType)
            )
        ); // Filter the instance types that are present in the instanceTypes array ; allInstanceTypePricingDetails is already sorted by price, so the first one in recommendedInstanceTypePricingDetails is the cheapest

        const [cheaperInstanceType] = recommendedInstanceTypePricingDetails;
        instanceType = cheaperInstanceType || instanceType;
    } catch (error) {
        logger.warn('Error fetching cheaper instance type', { error });
    }
    return instanceType;
}

async function analyzeOnpremData(
    accountId: string,
    data: OnPremCollectionObjectV1,
    snapshotInfo?: StorageSavingsRequestBodyType,
    region?: string,
    adHocRequest: boolean = false
) {
    logger.info('Analyzing OnPrem Data', { accountId, snapshotInfo, region, adHocRequest });

    // Analyze OnPrem data
    const { windowsConfig, sqlServerInfo } = data;
    if (!region || IS_DEMO_FLOW) {
        region = DEFAULT_AWS_REGION; // For demo flow or missing region, set to default region
    }

    const hostIds = windowsConfig.nodeDetails.map(({ hostId }) => hostId);
    const sqlInstancesPerDeploymentType = groupSqlServerInstancesByDeploymentType(sqlServerInfo);

    const response: any[] = [];
    await Promise.all(
        Object.entries(sqlInstancesPerDeploymentType).map(async ([deploymentType, instances]) => {
            const instanceIds = instances.map(instance => instance.instanceGuid);
            const resourceId = generateUniqueId(accountId, instanceIds, hostIds);

            const { storageSavings, calculations } = await getStorageSavingsResponse(
                accountId,
                region,
                deploymentType,
                windowsConfig,
                instances,
                snapshotInfo
            );
            response.push({ accountId, resourceId, storageSavings, calculations });
            if (!adHocRequest) {
                // Update the record in the database as part of the initial report analysis only
                await updateOnPremTcoReportRecord(accountId, resourceId, MSSQL, {
                    assessment_data: { storageSavings, calculations }
                });
            }
        })
    );
    return response;
}

async function handleOnpremTcoDataAnalysis(accountId: string, jobId: string, data: OnPremCollectionObjectV1) {
    logger.info('Handling OnPrem TCO Data Analysis', { accountId, jobId });

    let analyzeJobId = '';
    let analyzeJobStatus;
    let analyzeJobError;
    try {
        const {
            windowsConfig: { windowsSystemName }
        } = data;
        ({ id: analyzeJobId } = await registerJob(accountId, 'ON_PREM', DEFAULT_AWS_REGION, {
            name: 'Analyze on-premises SQL Server configuration and performance data',
            description: 'Analyze on-premises SQL Server configuration and performance data',
            resourceName: windowsSystemName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: 'IN_PROGRESS',
            type: JOBTYPE.ASSESSMENT,
            parentJobId: jobId
        }));

        await analyzeOnpremData(accountId, data);
    } catch (error) {
        const errorMessage = `Error analyzing onpremises TCO data. ${error}`;
        logger.error({ accountId, jobId, errorMessage });
        analyzeJobError = errorMessage;
        analyzeJobStatus = JOBSTATUS.FAILED;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    } finally {
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

async function handleOnpremTcoDataUpload(
    accountId: string,
    databaseType: string,
    fileName: string,
    jobId: string,
    data: OnPremCollectionObjectV1
) {
    logger.info('Handling OnPrem TCO Data Upload', { accountId, databaseType, fileName, jobId });

    let uploadJobStatus;
    let uploadJobError;
    try {
        await saveReportInWlmdbDatabase(accountId, databaseType as DATABASE_TYPE, data);
        await saveReportInReportingRegistry(accountId, fileName, data);
        await handleOnpremTcoDataAnalysis(accountId, jobId, data);
    } catch (error) {
        const uploadErrorMessage = `Error uploading  SQL Server collector data. ${error}`;
        logger.error({ accountId, jobId, uploadErrorMessage });
        uploadJobError = uploadErrorMessage;
        uploadJobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJob(
            accountId,
            jobId,
            undefined,
            uploadJobStatus || JOBSTATUS.COMPLETED,
            Date.now(),
            uploadJobError
        );
    }
}

async function uploadOnpremTcoData(accountId: string, databaseType: string, fileName: string, fileContent: string) {
    logger.info('Uploading SQL Server collector data', { accountId, databaseType, fileName, fileContent });

    try {
        const compressedUint8Array = Uint8Array.from(
            atob(fileContent)
                .split('')
                .map(char => char.charCodeAt(0))
        );

        // Handle potential BOM characters in the decompressed data
        const decompressedData = decompressSync(compressedUint8Array);
        const decompressedBase64 = new TextDecoder().decode(decompressedData);
        const cleanedBase64 = decompressedBase64.replace(/^ÿþ/, ''); // Remove BOM characters if present
        const originalJsonString = atob(cleanedBase64);
        const data = JSON.parse(originalJsonString) as OnPremCollectionObjectV1;

        if (!validateOnPremCollectionObjectV1(data)) {
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
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error uploading SQL Server collector data. ${error}`);
    }
}

interface EBSClassification {
    instanceName: string;
    numDatabases: number;
    requiredIops: number;
    requiredThroughput: number;
    ebsType: string;
    requiredVolumeSize: number;
    isPrimary: boolean;
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
        if (avgVolumeSizePerDb > 16 * 1024 || avgIopsPerDb > 256000 || avgThroughputPerDb > 4000) {
            const errorMessage =
                'Unsupported configuration; volume size is greater than 16 TiB or IOPS > 256,000 or Throughput > 4,000 MB/s';
            throw errorMessage;
        }
        let ebsType = 'gp3';
        if (avgVolumeSizePerDb > 4 && avgIopsPerDb >= 64000 && avgThroughputPerDb <= 4000) {
            // 4000 MB/s
            if (IO2_AVAILABLE_REGIONS.includes(region)) {
                ebsType = 'io2';
            } else {
                ebsType = 'io1';
            }
        } else if (avgVolumeSizePerDb > 4 && avgIopsPerDb >= 16000 && avgThroughputPerDb <= 1000) {
            // 1000 MB/s
            ebsType = 'io1';
        }

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
        const errorMessage = `Error getting EBS Disks for ${instance?.sqlInstanceName} ${error}`;
        throw errorMessage;
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
            networkPerformance =
                sqlInstance.networkPerformance === NETWORK_PERF.ABOVE_10
                    ? NETWORK_PERF.ABOVE_10
                    : NETWORK_PERF.UP_TO_10;
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

    return {
        ArchitectureTypes: [ArchitectureType.x86_64],
        VirtualizationTypes: [VirtualizationType.hvm],
        InstanceRequirements: {
            VCpuCount: { Min: Math.ceil(minVcpuCount), Max: Math.ceil(maxVcpuCount) },
            MemoryMiB: { Min: Math.ceil(requiredMemory) },
            CpuManufacturers: [CpuManufacturer.INTEL, CpuManufacturer.AMAZON_WEB_SERVICES],
            AllowedInstanceTypes: ['m*', 'c*', 'r*'],
            InstanceGenerations: [InstanceGeneration.CURRENT],
            NetworkBandwidthGbps:
                networkPerformance === NETWORK_PERF.UP_TO_10
                    ? {
                          Max: 10
                      }
                    : {
                          Min: 10
                      }
        }
    };
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
        resourceId,
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

                const { clusterNodeNames: onPremisesNodes, windowsSystemName: resourceName } =
                    hostConfig as unknown as WindowsConfig;
                const sqlServerInstances = Array.isArray(rawSqlInstanceDetails)
                    ? formatSqlInstanceDetails(rawSqlInstanceDetails)
                    : [];
                return {
                    resourceId: onpremResourceId,
                    resourceName,
                    deploymentModel: deploymentType,
                    creationTime: new Date(reportCreationTime).getTime(),
                    sqlServerInstances,
                    onPremisesNodes
                };
            })
        );
    } catch (error) {
        const errorMessage = `Failed to fetch On-premises resources . ${error}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
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
    snapShotInfo?: StorageSavingsRequestBodyType
) {
    logger.info('Getting OnPrem Resource Explore Savings', {
        accountId,
        onPrmResourceId,
        regionCode,
        sqlInstanceCount: sqlInstanceData?.length,
        snapShotInfo
    });

    const [onPremDatabaseResource] = await listOnPremDatabaseResources(
        accountId,
        MSSQL,
        undefined,
        undefined,
        onPrmResourceId
    );

    if (isEmpty(onPremDatabaseResource)) {
        const errorMessage = `No On-premises  database resources found for account ${accountId}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }
    const region = AWS_REGIONS.get(regionCode);
    if (!region) {
        const errorMessage = `Invalid region code provided ${accountId}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

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

    if (sqlInstanceData || snapShotInfo) {
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

                        const primaryDbRatio = numDatabases / (numDatabases + numDatabasesSecondary);
                        const secondaryDbRatio = numDatabasesSecondary / (numDatabases + numDatabasesSecondary);
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
                    const errorMessage = `Error updating SQL instance details based on request. ${error}`;
                    logger.warn({ errorMessage, detail });
                    return undefined; // Storage savings will not be calculated for this instance as it has an error
                }
            });

            const data: OnPremCollectionObjectV1 = {
                windowsConfig: hostConfig as unknown as WindowsConfig,
                sqlServerInfo: updatedSqlDetailsBasedOnRequest as unknown as SqlInstanceDetails[],
                scriptVersion,
                timestamp: new Date(reportCreationTime).toISOString()
            };
            const analysisResult = await analyzeOnpremData(accountId, data, snapShotInfo, regionCode, true);

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
                calculations,
                storageSavings,
                snapShotInfo
            };
        } catch (error) {
            const errorMessage = `Failed to fetch assessment data for the input provided. ${error}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
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
        const errorMessage = `Failed to fetch assessment data for the selected resource. ${error}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

export {
    generatePayload,
    deleteOnPremTcoReportResourceRecord,
    downloadSqlServerDataCollectorScript,
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
    saveReportInReportingRegistry,
    processEbsDisks
};
