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
    HttpErrorCodes,
    MSSQL,
    SqlServerDeploymentModel,
    WLMDB
} from '../utils/consts';
import { convertGiBToBytes, getArtifactsRegionBucketName, isDemo } from '../utils/utils';
import getLogger from '../utils/logger';
import { registerJob } from './database/job-operations';
import { updateJob } from '../lib/database/job';
import {
    OP_TCO_COLLECTOR_SCRIPT_PATH,
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
    parseSqlVersion,
    parseIops,
    convertToDate,
    generateUniqueId,
    parseStorageDetailsByDb,
    parseAoagReadReplica
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

const { getPreSignedUrl } = preSignedUrl;

const logger = getLogger();

const isDemoFlow = isDemo();

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

async function generatePayload(accountId: string, fileName: string, fileContent: Buffer) {
    logger.info('Generate a payload', { accountId, fileName });

    const fileContentString = btoa(String.fromCharCode(...fileContent));
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
    logger.info('Delete a report', { accountId, resourceIds });

    const resourcesIdList = compact(resourceIds.split(','));

    return removeOnPremTcoReportData(undefined, accountId, resourcesIdList, databaseType);
}

function formatSqlInstanceDetails(sqlInstances: SqlInstanceDetails[]) {
    return compact(
        sqlInstances.map(instance => {
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
                totalStorage,
                ...(totalSecondaryStorage !== undefined && { totalSecondaryStorage })
            };
        })
    );
}

async function downloadOnpremTcoCollectorScript(accountId: string, databaseType: string = MSSQL) {
    logger.info('Downloading OnPrem TCO Collector Script', { accountId, databaseType });

    const bucketname = getArtifactsRegionBucketName(DEFAULT_AWS_REGION);
    const url = await getPreSignedUrl(DEFAULT_AWS_REGION, bucketname, OP_TCO_COLLECTOR_SCRIPT_PATH);
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
        return createOnPremTcoReportData(reports);
    }
    throw createError(
        HttpErrorCodes.INTERNAL_SERVER_ERROR,
        'Error saving report in WLMDB database. No SQL Server instances or database host data found in the uploaded report.'
    );
}

async function getStorageSavingsResponse(
    accountId: string,
    clonedCopiesCount: number = 1,
    sqlServerDeploymentType: string,
    monthlyChangeRatePercentage: number = 8,
    ec2Instances: ManualModeInstancesType,
    instanceType: string,
    sqlServerEdition: string = 'Standard Edition',
    snapshotFrequency: string = 'Daily'
) {
    logger.info('Getting Storage Savings Response', {
        accountId,
        clonedCopiesCount,
        sqlServerDeploymentType,
        monthlyChangeRatePercentage,
        ec2Instances,
        instanceType,
        sqlServerEdition,
        snapshotFrequency
    });

    const response = await performManualModeStorageSavingsCalculations(accountId, DEFAULT_AWS_REGION, {
        clonedCopiesCount,
        sqlServerDeploymentType,
        monthlyChangeRatePercentage,
        ec2Instances,
        sqlServerEdition,
        snapshotFrequency
    });

    logger.info('>>STORAGE SAVINGS RESPONSE', response);
    return response;
}

function groupSqlServerInstancesByDeploymentType(sqlServerInstances: SqlInstanceDetails[]) {
    logger.info('Grouping SQL Server Instances by Deployment Type', { sqlServerInstances: sqlServerInstances.length });

    return sqlServerInstances.reduce((acc: { [key: string]: SqlInstanceDetails[] }, instance) => {
        let { deploymentType } = instance;
        if (deploymentType.toLowerCase() === 'standalone') {
            deploymentType = DATABASE_DEPLOYMENT_TYPE.Standalone;
        } else if (deploymentType.toLowerCase() === 'aoag') {
            deploymentType = DATABASE_DEPLOYMENT_TYPE.AOAG;
        } else if (deploymentType.toLowerCase() === 'fci') {
            deploymentType = DATABASE_DEPLOYMENT_TYPE.FCI;
        } else {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Error grouping SQL Server instances by deployment type. Invalid deployment type: ${deploymentType}`
            );
        }
        if (!acc[deploymentType]) {
            acc[deploymentType] = [];
        }

        const { totalIops, totalThroughput, totalStorage, totalSecondaryStorage } = parseSqlUsageParams(instance);
        instance.totalIops = totalIops;

        instance.totalThroughput = totalThroughput;
        instance.totalStorage = totalStorage;
        instance.totalSecondaryStorage = totalSecondaryStorage;
        acc[deploymentType].push({ ...instance });
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

    disks.forEach((disk: EBSClassification) => {
        if (ebsTypeCountMap.has(disk.ebsType)) {
            const existing = ebsTypeCountMap.get(disk.ebsType)!;
            ebsTypeCountMap.set(disk.ebsType, {
                volumeType: disk.ebsType,
                volumeNumber: existing.volumeNumber + disk.numDatabases,
                storageAmount: existing.storageAmount + disk.avgVolumeSizePerDb,
                volumeIops: existing.volumeIops + disk.avgIopsPerDb,
                throughput: existing.throughput + disk.avgThroughputPerDb
            });
        } else {
            ebsTypeCountMap.set(disk.ebsType, {
                volumeType: disk.ebsType,
                volumeNumber: disk.numDatabases,
                storageAmount: disk.avgVolumeSizePerDb,
                volumeIops: disk.avgIopsPerDb,
                throughput: disk.avgThroughputPerDb
            });
        }
    });

    return Array.from(ebsTypeCountMap.values()).map(
        ({ volumeType, volumeNumber, storageAmount, volumeIops, throughput }) => ({
            volumeType,
            volumeNumber,
            storageAmount: Math.max(storageAmount, convertGiBToBytes(1)), // Minimum volume size is 1 GiB
            volumeIops: volumeType === 'gp3' ? Math.max(volumeIops, 3000) : volumeIops, // Minimum IOPS is 3000
            throughput: volumeType === 'gp3' ? Math.max(throughput, 125) : throughput // Minimum throughput is 125
        })
    );
}

function deriveEbsVolumesListForMarketing(sqlInstancesDetails: SqlInstanceDetails[]) {
    logger.info('Deriving EBS Volumes List', { sqlInstancesDetails: sqlInstancesDetails.length });
    try {
        const ebsDisks = classifyDisksToEBS(sqlInstancesDetails);

        const primaryEbsDisks = ebsDisks.filter(({ isPrimary }) => isPrimary);
        const secondaryEbsDisks = ebsDisks.filter(({ isPrimary }) => !isPrimary);

        const primaryEbsVolumes = processEbsDisks(primaryEbsDisks);
        const secondaryEbsVolumes = processEbsDisks(secondaryEbsDisks);

        logger.info('>>EBS VOLUMES', { primaryEbsVolumes, secondaryEbsVolumes });

        return { primaryEbsVolumes, secondaryEbsVolumes };
    } catch (error) {
        logger.error(`Error deriving EBS Volumes List for ${sqlInstancesDetails}`, error);
    }
}

function deriveEc2InstanceListForMarketing(
    sqlInstancesDetails: SqlInstanceDetails[],
    instanceType: string
): ManualModeInstancesType {
    logger.info('Deriving EC2 Instance List for Marketing', { sqlInstancesDetails: sqlInstancesDetails.length });

    const { primaryEbsVolumes, secondaryEbsVolumes } = deriveEbsVolumesListForMarketing(sqlInstancesDetails) || {};

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

async function deriveHostConfigBasedInstanceType(region: string, windowsConfig: WindowsConfig) {
    logger.info('Deriving Instance Type based on host config', { region, windowsConfig });

    const { nodeDetails } = windowsConfig;
    let maxVCpuCount = 4;
    let minMemoryMiB = 1024; // 1 GiB
    nodeDetails.forEach(node => {
        const { numberOfVcpus, ramSize: ramSizeGiB } = node;
        if (numberOfVcpus > maxVCpuCount) {
            maxVCpuCount = numberOfVcpus;
        }
        const ramSizeInMiB = ramSizeGiB * 1024;
        if (ramSizeInMiB > minMemoryMiB) {
            minMemoryMiB = ramSizeInMiB;
        }
    });

    const instanceRequirements = {
        ArchitectureTypes: [ArchitectureType.x86_64],
        VirtualizationTypes: [VirtualizationType.hvm],
        InstanceRequirements: {
            VCpuCount: { Min: 4, Max: maxVCpuCount },
            MemoryMiB: { Min: minMemoryMiB },
            CpuManufacturers: [CpuManufacturer.INTEL, CpuManufacturer.AMAZON_WEB_SERVICES],

            AllowedInstanceTypes: ['m*', 'c*', 'r*']
        },
        InstanceGenerations: [InstanceGeneration.CURRENT]
    };

    return fetchInstanceTypesByRetry(region, instanceRequirements);
}

async function deriveSqlUsageBasedInstanceType(region: string, sqlInstancesDetails: SqlInstanceDetails[]) {
    logger.info('Deriving SQL usage based Instance Type', { region, sqlInstancesDetails: sqlInstancesDetails?.length });

    const instanceRequirements = deriveInstanceRequirements(sqlInstancesDetails);

    return fetchInstanceTypesByRetry(region, instanceRequirements);
}

async function fetchInstanceTypesByRetry(
    region: string,
    instanceRequirements: GetInstanceTypesFromInstanceRequirementsCommandInput
) {
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
        ({ InstanceTypes: instanceTypes } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, instanceRequirements)) || {});
    }

    if (
        !instanceTypes &&
        instanceRequirements.InstanceRequirements?.MemoryMiB &&
        !isEmpty(instanceRequirements.InstanceRequirements.MemoryMiB.Min)
    ) {
        logger.info(
            'No instance types matching requirements after removing network bandwidth. Resetting minimum memory to minimum possible and trying again.'
        );
        instanceRequirements.InstanceRequirements.MemoryMiB.Min = 1024; // 1 GiB
        ({ InstanceTypes: instanceTypes } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, instanceRequirements)) || {});
    }

    if (
        !instanceTypes &&
        instanceRequirements.InstanceRequirements?.VCpuCount &&
        !isEmpty(instanceRequirements.InstanceRequirements.VCpuCount.Max)
    ) {
        logger.info(
            'No instance types matching requirements after resetting minimum memory. Removing maximum CPU criteria and trying again.'
        );
        delete instanceRequirements.InstanceRequirements.VCpuCount.Max;
        ({ InstanceTypes: instanceTypes } =
            (await getInstanceTypesFromInstanceRequirementsCommand(region, instanceRequirements)) || {});
    }

    return instanceTypes?.[0]?.InstanceType; // TODO: fetch cheapest instance type instead of first item in the list
}

async function analyzeOnpremData(
    accountId: string,
    data: OnPremCollectionObjectV1,
    snapShotInfo?: StorageSavingsRequestBodyType,
    region?: string,
    adHocRequest: boolean = false
) {
    logger.info('Analyzing OnPrem Data', { accountId, snapShotInfo, region, adHocRequest });

    let clonedCopiesCount;
    let monthlyChangeRatePercentage;
    let snapshotFrequency;
    if (snapShotInfo) {
        snapshotFrequency = snapShotInfo.snapshotFrequency;
        clonedCopiesCount = snapShotInfo.clonedCopiesCount;
        monthlyChangeRatePercentage = snapShotInfo.monthlyChangeRatePercentage;
    }

    // Analyze OnPrem data
    const { windowsConfig, sqlServerInfo } = data;

    const currentInstanceType = await deriveHostConfigBasedInstanceType(region || DEFAULT_AWS_REGION, windowsConfig); // Instance type here is based on the host config; considered as existing instance type

    const hostIds = windowsConfig.nodeDetails.map(({ hostId }) => hostId);
    const sqlInstancesPerDeploymentType = groupSqlServerInstancesByDeploymentType(sqlServerInfo);

    const response = [];
    for (const [deploymentType, instances] of Object.entries(sqlInstancesPerDeploymentType)) {
        const instanceIds = instances.map(instance => instance.instanceGuid);
        const resourceId = generateUniqueId(accountId, instanceIds, hostIds);

        const recommendedInstanceType = await deriveSqlUsageBasedInstanceType(region || DEFAULT_AWS_REGION, instances); // Instance type here is based on the current usage as per the report; considered as recommended instance type
        const { currentLicenseEdition, recommendedLicenseEdition } = getLicenseRecommendations(instances);

        if (!currentInstanceType || !recommendedInstanceType) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                'Error deriving instance requirements. Could not find instance type matching requirements.'
            );
        }

        const ec2Instances = deriveEc2InstanceListForMarketing(instances, currentInstanceType);
        const ec2InstancesRecommended = deriveEc2InstanceListForMarketing(instances, recommendedInstanceType);

        const [existingConfigData, recommendedConfigData, calculations] = await Promise.all([
            getStorageSavingsResponse(
                accountId,
                clonedCopiesCount,
                deploymentType,
                monthlyChangeRatePercentage,
                ec2Instances,
                currentInstanceType,
                currentLicenseEdition
            ),
            getStorageSavingsResponse(
                accountId,
                clonedCopiesCount,
                deploymentType,
                monthlyChangeRatePercentage,
                ec2InstancesRecommended,
                recommendedInstanceType,
                recommendedLicenseEdition
            ),
            getManualModeStorageSavingsCalculationMetrics(accountId, region || DEFAULT_AWS_REGION, {
                clonedCopiesCount: 1,
                sqlServerDeploymentType: deploymentType,
                monthlyChangeRatePercentage: 8,
                ec2Instances,
                sqlServerEdition: currentLicenseEdition,
                snapshotFrequency: snapshotFrequency || 'Daily'
            })
        ]);

        const {
            compute: { existing: existingCompute } = {},
            license: { existing: existingLicense } = {},
            ebs,
            fsx,
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
                recommended: recommendedLicense
            },
            ebs,
            fsx,
            multi,
            totalSummary: {
                existing: existingTotalSummary,
                recommended: recommendedTotalSummary
            }
        };
        response.push({ accountId, resourceId, storageSavings, calculations });
        if (!adHocRequest) {
            // Update the record in the database as part of the initial report analysis only
            await updateOnPremTcoReportRecord(accountId, resourceId, MSSQL, {
                assessment_data: { storageSavings, calculations }
            });
        }
    }
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
            name: 'Analyze OnPremises TCO data',
            description: 'Analyze OnPremises TCO data',
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
    logger.info('Handling OnPrem TCO Data Upload', { accountId, databaseType, fileName, jobId, data });

    let uploadJobStatus;
    let uploadJobError;
    try {
        await Promise.all([
            // saveReportInReportingRegistry(accountId, fileName, data),
            saveReportInWlmdbDatabase(accountId, databaseType as DATABASE_TYPE, data)
        ]);
        await handleOnpremTcoDataAnalysis(accountId, jobId, data);
    } catch (error) {
        const uploadErrorMessage = `Error handling OnPrem TCO data upload. ${error}`;
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
    logger.info('Uploading OnPrem TCO Data', { accountId, databaseType, fileName, fileContent });

    try {
        const compressedUint8Array = Uint8Array.from(
            atob(fileContent)
                .split('')
                .map(char => char.charCodeAt(0))
        );

        const decompressedData = decompressSync(compressedUint8Array);
        const decompressedBase64 = new TextDecoder().decode(decompressedData);
        const originalJsonString = atob(decompressedBase64);
        const data = JSON.parse(originalJsonString) as OnPremCollectionObjectV1;

        if (!validateOnPremCollectionObjectV1(data)) {
            const errorMessage = 'Error uploading OnPrem TCO data. Invalid data format.';
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }

        if (!validateWindowsConfig(data.windowsConfig)) {
            const errorMessage = 'Error uploading OnPrem TCO data. Invalid windowsConfig format.';
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }

        // in OnPremises analysis, credentials ID is irrelevant, so using a dummy UUID
        const { id: jobId } = await registerJob(accountId, ONPREM_TCO_CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            name: 'Upload OnPremises TCO data',
            description: 'OnPremises TCO data upload',
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
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error uploading OnPrem TCO data. ${error}`);
    }
}

interface EBSClassification {
    instanceName: string;
    numDatabases: number;
    avgIopsPerDb: number;
    avgThroughputPerDb: number;
    ebsType: string;
    avgVolumeSizePerDb: number;
    isPrimary: boolean;
}

function getEbsDisks(instance: SqlInstanceDetails, classification: string = 'primary') {
    logger.info('Getting EBS Disks', { instance, classification });
    // https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html#vol-type-ssd

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
        logger.warn(
            'Unsupported configuration; volume size is greater than 16 TiB or IOPS > 256,000 or Throughput > 4,000 MB/s'
        );
        return;
    }
    let ebsType = 'gp3';
    if (avgVolumeSizePerDb > 4 && avgIopsPerDb >= 64000 && avgThroughputPerDb <= 4000) {
        // 4000 MB/s
        ebsType = 'io2';
    } else if (avgVolumeSizePerDb > 4 && avgIopsPerDb >= 16000 && avgThroughputPerDb <= 1000) {
        // 1000 MB/s
        ebsType = 'io1';
    } else if (avgVolumeSizePerDb > 125 && avgIopsPerDb <= 500 && avgThroughputPerDb <= 500) {
        ebsType = 'st1';
    }

    return {
        instanceName: instance.sqlInstanceName,
        numDatabases,
        avgIopsPerDb,
        avgThroughputPerDb,
        ebsType,
        avgVolumeSizePerDb,
        isPrimary: classification !== 'secondary' // if it is not secondary, it is primary by default because marketing API expects atleast primary volumes
    };
}

function getDatabaseClassifications(sqlInstancesDetails: SqlInstanceDetails) {
    const { aoagReadReplica, storageDetailsByDb } = sqlInstancesDetails;
    const allDatabases = parseStorageDetailsByDb(storageDetailsByDb);
    let primaryDatabases: StorageDetailByDB[] = allDatabases || [];

    const aoagReadReplicaDbs = aoagReadReplica ? parseAoagReadReplica(aoagReadReplica) : undefined;
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

function classifyDisksToEBS(sqlInstancesDetails: SqlInstanceDetails[]): EBSClassification[] {
    logger.info('Classifying Disks to EBS', { sqlInstancesDetails });

    const ebsDisks: EBSClassification[] = [];
    sqlInstancesDetails.forEach((instance: SqlInstanceDetails) => {
        ebsDisks.push(getEbsDisks(instance, 'primary')!);
        ebsDisks.push(getEbsDisks(instance, 'secondary')!);
    });

    return compact(ebsDisks);
}

function parseSqlUsageParams(instance: SqlInstanceDetails) {
    logger.info('Parsing SQL Usage Parameters', { instance });

    const { primaryDatabases, secondaryDatabases } = getDatabaseClassifications(instance);

    let sqlVersion = parseSqlVersion(instance.sqlVersion) || '';
    sqlVersion = sqlVersion.substring(0, sqlVersion.indexOf('(')).trim();

    let totalIops = instance?.totalIops;
    let totalThroughput = instance?.totalThroughput;

    if (isEmpty(totalIops) || isEmpty(totalThroughput)) {
        const [iops] = parseIops(instance?.iops || '') || [];

        if (isEmpty(totalIops)) {
            const writeIops = parseFloat(iops?.writeIops?.trim());
            const readIops = parseFloat(iops?.readIops?.trim());
            totalIops = writeIops + readIops;
        }

        if (isEmpty(totalThroughput)) {
            const writeBytes = parseFloat(iops?.writeBytesPerSec?.trim());
            const readBytes = parseFloat(iops?.readBytesPerSec?.trim());
            totalThroughput = readBytes / writeBytes / 1024 / 1024; // Convert to MB/s
        }
    }

    let totalStorage;
    const totalSecondaryStorage = undefined;
    if (isEmpty(totalStorage)) {
        totalStorage =
            primaryDatabases.reduce((acc: number, db: StorageDetailByDB) => acc + db.allocatedSizeMb, 0) / 1024; // Convert to GiB
    }

    const [memoryDetails] = parseMemoryUtilization(instance?.memUtilization || '') || [];
    const primaryDatabasesCount = primaryDatabases.length;
    const secondaryDatabasesCount = secondaryDatabases.length;
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

    let requiredVcpuCount = 4;
    let requiredMemory = 8192; // 8 GiB as minimum memory requirement for database workloads

    let networkPerformance = NETWORK_PERF.UP_TO_10;

    let totalCpuCount = 0;
    let totalMemory = 0;
    sqlInstancesDetails.forEach(sqlInstance => {
        const { cpuUtilization, memUtilization, vcpusPerInstance } = sqlInstance;
        totalCpuCount += Math.ceil(((parseCpuUtilization(cpuUtilization) || 0) / 100) * Number(vcpusPerInstance!));
        // Assuming memUtilization is a JSO N string with memory details
        const [memoryDetails] = parseMemoryUtilization(memUtilization) || [];
        totalMemory += memoryDetails?.used ? Math.round(memoryDetails.used / (1024 * 1024)) : 0; // Convert bytes to MiB
        networkPerformance =
            sqlInstance.networkPerformance === NETWORK_PERF.ABOVE_10 ? NETWORK_PERF.ABOVE_10 : NETWORK_PERF.UP_TO_10;
    });

    requiredVcpuCount = Math.max(requiredVcpuCount, totalCpuCount / totalSqlInstances); // Taking average of the total CPU count of all instances as the required vCPU count
    requiredMemory = Math.max(requiredMemory, totalMemory / totalSqlInstances); // Taking average of the total memory of all instances as the required memory

    return {
        ArchitectureTypes: [ArchitectureType.x86_64],
        VirtualizationTypes: [VirtualizationType.hvm],
        InstanceRequirements: {
            VCpuCount: { Min: 4, Max: requiredVcpuCount },
            MemoryMiB: { Min: requiredMemory },
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
function getLicenseRecommendations(sqlInstancesDetails: SqlInstanceDetails[]) {
    logger.info('Getting license recommendations', { sqlInstancesDetails: sqlInstancesDetails.length });

    const enterpriseUsageResults = compact(
        sqlInstancesDetails.map((instance: SqlInstanceDetails) => {
            const { licenceUsageDetails, sqlVersion } = instance;
            const sqlVersionStr = parseSqlVersion(sqlVersion);
            if (sqlVersionStr && isNonFreeEnterpriseEdition(sqlVersionStr)) {
                const licenseFeatures = parseLicenceUsageDetails(licenceUsageDetails);
                if (
                    licenseFeatures &&
                    licenseFeatures.some(({ IsUsingFeature }: { IsUsingFeature: number }) => IsUsingFeature === 1)
                ) {
                    return { sqlVersionStr, isUsingAnyEnterpriseFeature: true };
                }
            }
            return { sqlVersionStr, isUsingAnyEnterpriseFeature: false };
        })
    );

    logger.info('>>ENTERPRISE USAGE RESULTS', enterpriseUsageResults);

    const currentLicenseEdition = enterpriseUsageResults.some(
        ({ sqlVersionStr }) => sqlVersionStr && isNonFreeEnterpriseEdition(sqlVersionStr)
    )
        ? 'Enterprise Edition'
        : 'Standard Edition';
    const isUsingEnterpriseFeature = enterpriseUsageResults.some(
        ({ isUsingAnyEnterpriseFeature }) => isUsingAnyEnterpriseFeature
    );
    const recommendedLicenseEdition = isUsingEnterpriseFeature ? 'Enterprise Edition' : 'Standard Edition';
    return { currentLicenseEdition, recommendedLicenseEdition };
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
    resourceId?: string
): Promise<{ count: number; items: OnPremDatabaseResourcesObjectType[]; nextToken?: string }> {
    logger.info('Getting OnPrem database resources', { accountId, databaseType, apiPageSize, nextToken });

    const onPremDatabaseResourcesDetails = await listOnPremDatabaseResources(
        accountId,
        databaseType,
        apiPageSize,
        nextToken,
        resourceId
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
                    database_deployment_type: deploymentType
                } = onPremDatabaseResource;
                const rawSqlInstanceDetails = persistedSqlInstancesDetails as unknown as SqlInstanceDetails[];

                const { clusterNodeNames: onPremisesNodes, windowsSystemName: resourceName } =
                    hostConfig as unknown as WindowsConfig;
                const sqlServerInstances = Array.isArray(rawSqlInstanceDetails)
                    ? formatSqlInstanceDetails(rawSqlInstanceDetails)
                    : [];
                const totalPrimaryHostStorage = rawSqlInstanceDetails.reduce(
                    (acc, instance) => acc + (instance?.totalStorage || 0),
                    0
                );
                const totalSecondaryHostStorage = rawSqlInstanceDetails.reduce(
                    (acc, instance) => acc + (instance?.totalSecondaryStorage || 0),
                    0
                );
                return {
                    resourceId: onpremResourceId,
                    resourceName,
                    deploymentModel: deploymentType,
                    sqlServerInstances,
                    onPremisesNodes,
                    totalPrimaryHostStorage,
                    ...(deploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT && { totalSecondaryHostStorage })
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
    snapShotInfo?: StorageSavingsRequestBodyType,
    totalPrimaryHostStorage?: number,
    totalSecondaryHostStorage?: number
) {
    logger.info('Getting OnPrem Resource Explore Savings', {
        accountId,
        onPrmResourceId,
        regionCode,
        sqlInstanceData,
        snapShotInfo,
        totalPrimaryHostStorage,
        totalSecondaryHostStorage
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

    if ((sqlInstanceData || snapShotInfo) && !isDemoFlow) {
        try {
            let avgSqlInstancePrimaryStorage: number;
            let avgSqlInstanceSecondaryStorage: number;
            if (totalPrimaryHostStorage) {
                avgSqlInstancePrimaryStorage = totalPrimaryHostStorage / rawSqlInstanceDetails.length;
            }
            if (totalSecondaryHostStorage) {
                avgSqlInstanceSecondaryStorage = totalSecondaryHostStorage / rawSqlInstanceDetails.length;
            }
            const updatedSqlDetailsBasedOnRequest = rawSqlInstanceDetails.map(detail => {
                const instanceData = sqlInstanceData?.find(
                    (data: { sqlInstanceId: string }) => data.sqlInstanceId === detail.instanceGuid
                );
                if (instanceData) {
                    const { noOfVcpusInUse, memory, networkPerformance, totalIops, totalThroughput } = instanceData;
                    return {
                        ...detail,
                        ...(noOfVcpusInUse && { noOfVcpusInUse: noOfVcpusInUse.toString() }),
                        ...(networkPerformance && { networkPerformance }),
                        ...(memory && { memory }),
                        ...(totalIops && { totalIops }),
                        ...(totalThroughput && { totalThroughput }),
                        ...(avgSqlInstancePrimaryStorage && { totalStorage: avgSqlInstancePrimaryStorage }),
                        ...(avgSqlInstanceSecondaryStorage && {
                            totalSecondaryStorage: avgSqlInstanceSecondaryStorage
                        }),
                        deploymentType
                    };
                }
                return {
                    ...detail,
                    ...(avgSqlInstancePrimaryStorage && { totalStorage: avgSqlInstancePrimaryStorage }),
                    ...(avgSqlInstanceSecondaryStorage && { totalSecondaryStorage: avgSqlInstanceSecondaryStorage }),
                    deploymentType
                };
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
    downloadOnpremTcoCollectorScript,
    uploadOnpremTcoData,
    getIndividualOnPremDatabaseResource,
    getOnPremDatabaseResources,
    saveReportInWlmdbDatabase,
    deriveHostConfigBasedInstanceType,
    groupSqlServerInstancesByDeploymentType,
    deriveEbsVolumesListForMarketing,
    deriveSqlUsageBasedInstanceType,
    getLicenseRecommendations,
    deriveInstanceRequirements,
    getOnPremResourceExploreSavings,
    saveReportInReportingRegistry
};
