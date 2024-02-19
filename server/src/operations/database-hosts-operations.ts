import { resource } from '@prisma/client';
import { DescribeInstancesCommandOutput } from '@aws-sdk/client-ec2';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { listResources } from '../lib/database/db';
import {
    DatabaseHostSummaryResponseType,
    DatabaseHostSummaryListResponseType,
    TopologyResponseType,
    ProtectionResponseType,
    StorageResponseType,
    UsageCostResponseType,
    DatabasesListResponseType,
    DriveInfoResponseBodyType
} from '../routes/types/database-hosts.types';
import { describeInstance, describeSubnets, describeVpc, getAmis } from '../lib/aws/ec2';
import { describeFSxN } from '../lib/aws/fsx';
import { PricingServiceRequestType, PricingServiceResponseType } from '../routes/types/pricing.types';

import calculatePrice from './aws/pricing-operations';
import {
    DatabaseHostsQueryFields,
    HttpErrorCodes,
    RESOURCESTYPE,
    ServerState,
    SERVER_TYPE_MAPPING,
    STANDALONE,
    FCI,
    AWS_REGIONS,
    SQL_STD,
    SQL_ENT,
    DATABASE_METRIC_TYPE,
    MSSQL_DATABASE_TYPES,
    MSSQL_SYSTEM_DATABASES,
    PRICING,
    WLMDB_COST_ALLOCATION_TAG,
    API_PAGE_SIZE,
    SqlServerDeploymentModel
} from '../utils/consts';
import getLogger from '../utils/logger';
import {
    getServerIOLatency,
    getNativeSQLProtection,
    getDatabasesCount,
    getServerSummary,
    getResourceUtilisation,
    getPerformanceMetrics,
    getDataBasesSummary,
    getNativeSQLBackedupDatabases,
    callSsmExecution,
    sqlResponseParsing
} from './workloads/mssql/mssql-operations';
import {
    getStorageDataUsingSSM,
    isAWSBackupEnabled,
    getOntapVolumesSnapshotCount,
    getCostAllocationTagFsxResource,
    getFsxStorageCapacity
    // getFsxStorageCapacity
} from './aws/fsx-operations';
import { Metadata, ResourceDetails } from '../utils/common-types';
import { calculateBilling, getCostAllocationTags } from './aws/cost-explorer-operations';
import { isSSMConnectionSuccessful } from './aws/ssm-operations';
import { findResourceNameFromTags, getCostAllocationTagEC2Resource } from './aws/ec2-operations';
import { GET_DIVE_INFO, EXECUTE_QUERY } from './workloads/mssql/utils';
import { DEFAULT_SQL_DATA_DRIVE, DEFAULT_SQL_LOG_DRIVE } from './workloads/mssql/queries';
import { getResources } from './database/database-operations';

const logger = getLogger();

const DATABASE_HOSTS_INDEX_MAPPING: { [index: number]: string } = {
    0: 'serverState',
    1: 'databasesCount',
    2: 'serverSummary',
    3: 'topology',
    4: 'performance',
    5: 'storage',
    6: 'billing',
    7: 'memUtilization',
    8: 'diskUtilization',
    9: 'cpuUtilization'
};

interface Topology {
    activeNodeInstanceId: string;
    activeNodeInstanceName: string;
    standbyNodeInstanceId?: string;
    standbyNodeInstanceName?: string;
    sqlDeploymentType?: string;
    fileSystemType?: string;
}

interface DriveInfo {
    driveLetter: string;
    availableSize: number;
    defaultDataDrive: boolean;
    defaultLogDrive: boolean;
    isNetappDrive: boolean;
}
type VolumeSpaceRecord = {
    uuid: string;
    name: string;
    efficiency: {
        space_savings: {
            total: number;
            total_percent: number;
        };
    };
    space: {
        size: number;
        used: number;
    };
};

type EstimationEc2Type = {
    resourceType: string;
    sqlSoftwareType: string;
};

type EstimationFSxType = {
    storageCapacity: number;
    throughput: number;
    iops: number;
    deploymentOption: string;
};

async function getTopology(
    accountId: string,
    region: string,
    resourceId: string,
    resourceData: resource,
    additionalFields?: { [key: string]: boolean }
): Promise<TopologyResponseType> {
    logger.info('Fetching topology data', accountId, region, resourceId, resourceData);

    if (isEmpty(resourceData)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No data found for resource ${resourceId} in account ${accountId}.`
        );
    }

    const {
        resource_type: resourceType,
        co_relation_id: fileSystemId,
        cloud_provider_account_id: awsAccountId,
        metadata
    } = resourceData;
    const { credentialsId, activeDirectoryName, activeDirectoryAddress } = metadata as {
        credentialsId: string;
        activeDirectoryName: string;
        activeDirectoryAddress: string;
    };

    let topologyData: TopologyResponseType = {
        awsAccount: '',
        region,
        serverType: resourceType,
        serverInstallationMode: '',
        fileSystemId: fileSystemId!,
        fileSystemType: '',
        vpcId: undefined,
        ec2Details: []
    };

    let activeNodeInstanceId: string;
    let standbyNodeInstanceId;
    let activeNodeInstanceName: string | undefined;
    let standbyNodeInstanceName: string | undefined;
    let sqlDeploymentType;
    let fileSystemType;
    if (!isEmpty(metadata)) {
        ({ activeNodeInstanceId, standbyNodeInstanceId, sqlDeploymentType, fileSystemType } =
            metadata as unknown as Topology);

        let vpcId: string | undefined;
        let fileSystemStatus;
        let fileSystemName;
        let fileSystemDeploymentMode;
        let fileSystemStorageCapacity;
        let fileSystemThroughputCapacity;
        let subnetIds: Array<string> | undefined;
        let availabilityZones: Array<string> | undefined;

        if (additionalFields?.allTopology || additionalFields?.vpc) {
            try {
                const fsxInfo = await describeFSxN(credentialsId, region, { FileSystemIds: [fileSystemId!] });
                vpcId = fsxInfo?.FileSystems?.[0].VpcId;
                fileSystemName = fsxInfo?.FileSystems?.[0].Tags?.reduce(
                    (a = '', tag) => (tag.Key === 'Name' ? tag.Value : a),
                    ''
                );

                fileSystemDeploymentMode = fsxInfo?.FileSystems?.[0].OntapConfiguration?.DeploymentType;
                fileSystemStatus = fsxInfo?.FileSystems?.[0].Lifecycle;
                fileSystemStorageCapacity = fsxInfo?.FileSystems?.[0].StorageCapacity;
                fileSystemThroughputCapacity = fsxInfo?.FileSystems?.[0].OntapConfiguration?.ThroughputCapacity;
                subnetIds = fsxInfo?.FileSystems?.[0].SubnetIds;

                const { Subnets: subnets } = await describeSubnets(credentialsId, region, {
                    SubnetIds: subnetIds
                });
                availabilityZones = subnets?.map(subnetId => subnetId?.AvailabilityZone as string);
                logger.info('availabilityZones', availabilityZones);
            } catch (error) {
                logger.error(`Error while fetching details for fsx. Error: ${error}`);
            }
        }

        const instanceIds = standbyNodeInstanceId
            ? [activeNodeInstanceId, standbyNodeInstanceId]
            : [activeNodeInstanceId];

        // Todo: These details can be saved in database as part of metadata and AWS calls can be made incase of not found
        let ec2InstanceDetails;
        let keyPairName;
        let activeInstanceType;
        let activeAvailabilityZone;
        let activeSubnetId;
        let activeVolumeId;
        let standbyInstanceType;
        let standbyAvailabilityZone;
        let standbySubnetId;
        let standbyVolumeId;
        let activeDirectoryDetails;
        if (additionalFields?.allTopology) {
            try {
                ec2InstanceDetails = await describeInstance(credentialsId, region, { InstanceIds: instanceIds });
                keyPairName = ec2InstanceDetails.Reservations?.[0].Instances?.[0].KeyName;
                activeInstanceType = ec2InstanceDetails.Reservations?.[0].Instances?.[0].InstanceType;
                activeNodeInstanceName = findResourceNameFromTags(
                    ec2InstanceDetails.Reservations?.[0].Instances?.[0].Tags
                );
                activeAvailabilityZone =
                    ec2InstanceDetails.Reservations?.[0].Instances?.[0].Placement?.AvailabilityZone;
                activeSubnetId = ec2InstanceDetails.Reservations?.[0].Instances?.[0].SubnetId;
                activeVolumeId =
                    ec2InstanceDetails.Reservations?.[0].Instances?.[0].BlockDeviceMappings?.[0].Ebs?.VolumeId;
                if (standbyNodeInstanceId) {
                    standbyInstanceType = ec2InstanceDetails.Reservations?.[1].Instances?.[0].InstanceType;
                    standbyNodeInstanceName = findResourceNameFromTags(
                        ec2InstanceDetails.Reservations?.[1].Instances?.[0].Tags
                    );
                    standbyAvailabilityZone =
                        ec2InstanceDetails.Reservations?.[1].Instances?.[0].Placement?.AvailabilityZone;
                    standbySubnetId = ec2InstanceDetails.Reservations?.[1].Instances?.[0].SubnetId;
                    standbyVolumeId =
                        ec2InstanceDetails.Reservations?.[1].Instances?.[0].BlockDeviceMappings?.[0].Ebs?.VolumeId;
                }
            } catch (error) {
                logger.error(`Error while fetching details for ec2 instances. Error: ${error}`);
            }
            activeDirectoryDetails = {
                name: activeDirectoryName || '',
                address: activeDirectoryAddress || ''
            };
        }
        let vpcName;
        if (vpcId) {
            const { Vpcs } = await describeVpc(credentialsId, region, {
                VpcIds: [vpcId!]
            });
            vpcName = findResourceNameFromTags(Vpcs![0]?.Tags);
        }
        // Fetch topology data
        topologyData = {
            awsAccount: awsAccountId || '',
            region: AWS_REGIONS.has(region) ? AWS_REGIONS.get(region)! : region,
            serverType: SERVER_TYPE_MAPPING.get(resourceType)!,
            serverInstallationMode: sqlDeploymentType !== undefined ? sqlDeploymentType : '',
            fileSystemType:
                fileSystemType !== undefined ? (fileSystemType === 'FSx ONTAP' ? 'FSx for ONTAP' : fileSystemType) : '',
            fileSystemId: fileSystemId!,
            ...(fileSystemName && { fileSystemName }),
            ...(fileSystemDeploymentMode && { fileSystemDeploymentMode }),
            ...(fileSystemStatus && { fileSystemStatus }),
            ...(fileSystemStorageCapacity && { fileSystemStorageCapacity }),
            ...(fileSystemThroughputCapacity && { fileSystemThroughputCapacity }),
            ...(vpcId && { vpcId }),
            ...(vpcName && { vpcName }),
            ...(availabilityZones && { availabilityZones }),
            ...(keyPairName && { keyPairName }),
            ec2Details: [
                {
                    id: activeNodeInstanceId!,
                    name: activeNodeInstanceName,
                    ebsVolumeId: activeVolumeId || '',
                    ...(activeInstanceType && { instanceType: activeInstanceType }),
                    ...(activeAvailabilityZone && { availabilityZone: activeAvailabilityZone }),
                    ...(activeSubnetId && { subnetId: activeSubnetId })
                }
            ],
            ...(activeDirectoryDetails && { activeDirectoryDetails })
        };
        if (standbyNodeInstanceId) {
            topologyData.ec2Details.push({
                id: standbyNodeInstanceId!,
                name: standbyNodeInstanceName,
                ebsVolumeId: standbyVolumeId || '',
                ...(standbyInstanceType && { instanceType: standbyInstanceType }),
                ...(standbyAvailabilityZone && { availabilityZone: standbyAvailabilityZone }),
                ...(standbySubnetId && { subnetId: standbySubnetId })
            });
        }
    }
    return topologyData;
}

async function getStorageData(resourceDetail: ResourceDetails): Promise<StorageResponseType | undefined> {
    logger.info('Getting storage data:', { resourceDetail });

    try {
        const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;

        const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId, fsxSecret } = metadata as {
            credentialsId: string;
            activeNodeInstanceId: string;
            standbyNodeInstanceId: string;
            fsxSecret: string;
        };

        // DeploymentID is same as AWS CloudFormation stack name.  We retrieve
        // deploymentID from the fsxSecret, which has an additional '-fsx'
        // suffix to stack name (e.g., WLMDB-SqlFciStack-1698992271319-fsx).
        //     ONTAP tags have '_' instead of '-' in the stack name.  So we
        // tune tag accordingly with replaceAll.
        const deploymentId = fsxSecret?.replace('-fsx', '')?.replaceAll('-', '_');

        const info = await getStorageDataUsingSSM(
            credentialsId,
            region!,
            fileSystemId!,
            fsxSecret,
            'storage/volumes',
            `tiering.object_tags="wlmDeploymentId=${deploymentId}"`,
            'fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used',
            activeNodeInstanceId,
            standbyNodeInstanceId
        );

        logger.info(`Storage data for volumes with deploymentId ${deploymentId}:`, info);

        let totalSize = 0;
        let totalUsed = 0;
        let totalSpaceSavings = 0;
        info?.records?.forEach(({ efficiency, space }: VolumeSpaceRecord) => {
            const { size, used } = space;
            const { total } = efficiency.space_savings;

            totalSize += size;
            totalUsed += used;
            totalSpaceSavings += total;
        });

        return {
            size: totalSize,
            used: totalUsed,
            spaceSavings: totalSpaceSavings
        };
    } catch (error) {
        const errorMessage = `Error while getting storage savings for resource ${resourceDetail} ${JSON.stringify(
            error
        )}`;
        let { message } = error as { message: string };
        if (message?.toLocaleLowerCase().includes('ThrottlingException: Rate exceeded'.toLowerCase())) {
            message += '. Retry the operation.';
            throw createError(HttpErrorCodes.SERVICE_UNAVAILABLE, message);
        }
        throw createError(HttpErrorCodes.SERVICE_UNAVAILABLE, errorMessage);
    }
}

async function getProtectionStatus(resourceDetail: ResourceDetails): Promise<ProtectionResponseType | undefined> {
    logger.info('Get protection status', { resourceDetail });

    const { resource_id: resourceId, region, co_relation_id: fileSystemId, metadata } = resourceDetail;

    const { credentialsId } = metadata as Metadata;

    try {
        const [awsBackup, ontapProtection, nativeSqlProtection] = await Promise.all([
            isAWSBackupEnabled(credentialsId, region!, fileSystemId!, metadata as Metadata),
            getOntapVolumesSnapshotCount(credentialsId, region!, fileSystemId!, metadata as Metadata),
            getNativeSQLProtection(resourceId)
        ]);

        return {
            isAwsBackUpEnabled: Boolean(awsBackup),
            isFsxOntapSnapshotsEnabled: Boolean(ontapProtection),
            isSqlNativeEnabled: Boolean(nativeSqlProtection),
            protectedDatabases: Number.isNaN(Number(nativeSqlProtection)) ? 0 : Number(nativeSqlProtection)
        };
    } catch (error) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while getting protection status: ${resourceDetail} ${error}`
        );
    }
}

async function getBillingOrPriceEstimation(resourceDetail: ResourceDetails) {
    logger.info('Get AWS resources billing or cost data:', resourceDetail);

    const [billingResponse, pricingResponse] = await Promise.all([
        getBilling(resourceDetail).catch(error => {
            logger.error('Failed to get billing data for resource: :', JSON.stringify(error));
        }),
        getUsageEstimationData(resourceDetail).catch(error => {
            logger.error('Failed to get pricing estimation data for resource:', JSON.stringify(error));
        })
    ]);

    return billingResponse || pricingResponse;
}

async function getBilling(resourceDetail: ResourceDetails) {
    logger.info('Get AWS resources billing data:', resourceDetail);
    try {
        const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;
        const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as {
            credentialsId: string;
            activeNodeInstanceId: string;
            standbyNodeInstanceId: string;
        };
        // Need to validate before proceeding for billing
        await validationForCostExplorer(resourceDetail);
        const billingResponse: UsageCostResponseType = await calculateBilling(
            credentialsId,
            region!,
            fileSystemId!,
            activeNodeInstanceId,
            standbyNodeInstanceId
        );

        return {
            compute: billingResponse?.compute,
            storage: billingResponse?.storage,
            connectivity: billingResponse?.connectivity || 0,
            others: 0, // TODO: to be calculated for other resources such as ActiveDiretory, Secrets etc.
            estimationType: billingResponse?.estimationType
        };
    } catch (error) {
        logger.error('Failed to get billing data for resource:', resourceDetail.resource_id, error);
        throw error;
    }
}

async function validationForCostExplorer(resourceDetail: ResourceDetails) {
    logger.info('Validating prerequiste for Cost explorer for billing of resources');

    // 1.  We need to check if wlmdb-cost-resource cost allocation tag is activated at account level or not
    const tagsResponse = await getCostAllocationTags(resourceDetail);
    if (!tagsResponse?.Tags?.includes(WLMDB_COST_ALLOCATION_TAG)) {
        throw new Error(
            `Calcaulation of  Billing data has failed as cost allocation tag ${WLMDB_COST_ALLOCATION_TAG} is not activated at account level`
        );
    }

    // 2. Validate cost allocation tag is at resource level or not
    const [ec2Resources, fsxResources] = await Promise.all([
        getCostAllocationTagEC2Resource(resourceDetail),
        getCostAllocationTagFsxResource(resourceDetail)
    ]);
    // fsxResources has all tag attached to the that filesystem, so we need to find if cost allocation tag is attached or not
    if (!ec2Resources?.Tags?.length && !fsxResources?.Tags?.find(tag => tag?.Key === WLMDB_COST_ALLOCATION_TAG)) {
        throw new Error(
            `Calcaulation of Billing data has failed as cost allocation tag ${WLMDB_COST_ALLOCATION_TAG} is not attached to resource ${resourceDetail.resource_id}`
        );
    }
}

async function getUsageEstimationData(resourceDetail: ResourceDetails) {
    logger.info('Get AWS resources estimation data:', resourceDetail);

    try {
        const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;
        const { credentialsId, sqlDeploymentType, activeNodeInstanceId } = metadata as {
            credentialsId: string;
            sqlDeploymentType: string;
            activeNodeInstanceId: string;
        };

        const [ec2ResourceInfo, fsxResourceInfo] = await Promise.all([
            getEc2ResourceInfo(credentialsId, region!, activeNodeInstanceId),
            getFsxResourceInfo(credentialsId, region!, fileSystemId!)
        ]);

        const pricingRequest: PricingServiceRequestType = {
            compute: {
                regionCode: region!,
                instanceType: ec2ResourceInfo.resourceType,
                sqlDeploymentMode: sqlDeploymentType.toLowerCase() === FCI ? FCI : STANDALONE,
                sqlSoftwareType: ec2ResourceInfo.sqlSoftwareType
            },
            storage: {
                regionCode: region!,
                storageCapacity: fsxResourceInfo.storageCapacity,
                throughput: fsxResourceInfo.throughput,
                iops: fsxResourceInfo.iops,
                deploymentOption: fsxResourceInfo.deploymentOption,
                diskSize: 0 // As we are calculating post deployment cost usage, we don't need disk size, we can use storageCapacity instead.
            },
            vpc: {
                regionCode: region!
            }
        };

        const pricingResponse: PricingServiceResponseType = await calculatePrice(
            pricingRequest.compute,
            pricingRequest.storage,
            pricingRequest.vpc
        );
        return {
            compute: pricingResponse?.compute || 0,
            storage: (pricingResponse?.storage?.capacity || 0) + (pricingResponse?.storage?.throughput || 0),
            connectivity: pricingResponse?.vpc || 0,
            others: 0, // TODO: to be calculated for other resources such as ActiveDiretory, Secrets etc.
            estimationType: PRICING
        };
    } catch (error) {
        logger.error('Failed to get resources estimation data for resource:', resourceDetail, JSON.stringify(error));
        throw error;
    }
}

async function getEc2ResourceInfo(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
): Promise<EstimationEc2Type> {
    logger.info('Getting EC2 resource info:', { credentialsId, region, activeNodeInstanceId });

    const ec2Info: DescribeInstancesCommandOutput = await describeInstance(credentialsId, region!, {
        InstanceIds: [activeNodeInstanceId]
    });
    logger.info('Estimation info for EC2:', ec2Info);
    const resourceType = ec2Info?.Reservations?.[0].Instances?.[0].InstanceType;
    const imageId = ec2Info?.Reservations?.[0].Instances?.[0].ImageId;

    const amiInfo = await getAmis(credentialsId, region, { ImageIds: [imageId!] });
    logger.info('Estimation info for AMI:', amiInfo);
    const sqlPlatform = amiInfo?.Images?.[0].PlatformDetails;

    let sqlSoftwareType: string = SQL_STD; // Let's 'Windows with SQL Server Standard' be default
    if (sqlPlatform === 'Windows with SQL Server Enterprise') {
        sqlSoftwareType = SQL_ENT;
    }

    return {
        resourceType: resourceType!,
        sqlSoftwareType
    };
}

async function getFsxResourceInfo(
    credentialsId: string,
    region: string,
    filesystemId: string
): Promise<EstimationFSxType> {
    logger.info('Getting FSxN resource info:', { credentialsId, region, filesystemId });

    const fsxInfo = await describeFSxN(credentialsId, region, { FileSystemIds: [filesystemId] });
    logger.info('Estimation info for FSxN:', fsxInfo);

    const storageCapacity = fsxInfo?.FileSystems?.[0].StorageCapacity || 0;
    const throughput = fsxInfo?.FileSystems?.[0].OntapConfiguration?.ThroughputCapacity;
    const iops = fsxInfo?.FileSystems?.[0].OntapConfiguration?.DiskIopsConfiguration?.Iops;
    const deploymentOption = fsxInfo?.FileSystems?.[0].OntapConfiguration?.DeploymentType;

    return { storageCapacity, throughput: throughput!, iops: iops!, deploymentOption: deploymentOption! };
}

async function getDatabaseHostsSummary(
    accountId: string,
    fields?: string,
    nextToken?: string,
    awsRegion?: string,
    customerCredentialsId?: string
): Promise<DatabaseHostSummaryListResponseType> {
    logger.info(
        'Fetching all database hosts deployed in account ',
        accountId,
        fields,
        nextToken,
        awsRegion,
        customerCredentialsId
    );

    const resourceDetails = await listResources(
        accountId,
        undefined,
        RESOURCESTYPE.MSSQL,
        API_PAGE_SIZE,
        nextToken,
        awsRegion,
        customerCredentialsId
    );

    if (isEmpty(resourceDetails)) {
        logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getPerformance = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE);
    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE);
    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);
    const getUsageEstimation = fieldsValues?.includes(DatabaseHostsQueryFields.USAGE_ESTIMATION.toLocaleLowerCase());
    const additionalFields = {
        vpc: Boolean(getUsageEstimation)
    };

    const databaseHosts: DatabaseHostSummaryResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails.map(async resourceDetail => {
                const { resource_id: resourceId, resource_name: resourceName, region, metadata } = resourceDetail;
                logger.info(' resourceName', resourceName);

                const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as unknown as Metadata;

                // Check SSM Connection status
                const isSSMConnected = await isSSMConnectionSuccessful(
                    credentialsId,
                    region!,
                    activeNodeInstanceId,
                    standbyNodeInstanceId,
                    resourceId
                );

                const activeNodeId = activeNodeInstanceId;
                const standbyNodeId = standbyNodeInstanceId;

                const [dbCount, topologyData, performanceData, storageData, protectionData, usageEstimationData] =
                    await Promise.all(
                        [
                            ...(isSSMConnected
                                ? [getDatabasesCount(credentialsId, region!, activeNodeId, standbyNodeId)]
                                : [Promise.resolve()]),
                            getTopology(accountId, region!, resourceId, resourceDetail, additionalFields), // Fetch topology data
                            ...(isSSMConnected && getPerformance
                                ? [getServerIOLatency(resourceId)]
                                : [Promise.resolve()]), // Fetch io latency data
                            ...(isSSMConnected && getStorageSavings
                                ? [getStorageData(resourceDetail)]
                                : [Promise.resolve()]), // Fetch storage savings data
                            ...(isSSMConnected && getProtection
                                ? [getProtectionStatus(resourceDetail)]
                                : [Promise.resolve()]), // Fetch protection status
                            ...(getUsageEstimation
                                ? [getBillingOrPriceEstimation(resourceDetail)]
                                : [Promise.resolve()]) // Fetch billing or pricing estimate data
                        ].map(p => p.catch(error => logger.error(`Error while fetching data: ${error}.`)))
                    );

                databaseHosts.push({
                    id: resourceId,
                    name: resourceName || '',
                    status: dbCount ? ServerState.UP : ServerState.DOWN,
                    databaseCount: dbCount?.totalCount || 0,
                    topology: topologyData!,
                    ...(performanceData && { performance: performanceData }),
                    ...(storageData && { storage: storageData }),
                    ...(protectionData && { protection: protectionData }),
                    ...(usageEstimationData && { estimatedUsageCost: usageEstimationData })
                });
            })
        );
    } catch (error) {
        logger.error(`Error while fetching database hosts details ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database hosts details ${accountId}, ${error}`
        );
    }

    logger.debug('Database hosts details', databaseHosts);

    return {
        count: databaseHosts.length,
        items: databaseHosts,
        nextToken:
            resourceDetails?.length === API_PAGE_SIZE ? resourceDetails[resourceDetails.length - 1].id : undefined
    };
}

async function getDatabaseHostSummary(
    accountId: string,
    databaseHostId: string,
    fields?: string
): Promise<DatabaseHostSummaryResponseType> {
    logger.info('Fetching details about a database installtion ', accountId, databaseHostId, fields);

    const [resourceDetail] = await listResources(accountId, databaseHostId);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }

    const databaseHostDetails: DatabaseHostSummaryResponseType = {
        id: '',
        name: '',
        status: '',
        databaseCount: 0
    };

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getPerformance = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE);
    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE);
    const getUsageEstimation = fieldsValues?.includes(DatabaseHostsQueryFields.USAGE_ESTIMATION.toLocaleLowerCase());
    const getResourceutilization = fieldsValues?.includes(
        DatabaseHostsQueryFields.RESOURCE_UTILIZATION.toLocaleLowerCase()
    );
    const additionalFields = {
        allTopology: true
    };

    const { resource_id: resourceId, resource_name: resourceName, region, metadata } = resourceDetail;
    try {
        const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId, creationDate } =
            metadata as unknown as Metadata;

        // Check SSM Connection status
        const isSSMConnected = await isSSMConnectionSuccessful(
            credentialsId,
            region!,
            activeNodeInstanceId,
            standbyNodeInstanceId,
            resourceId
        );

        const errormessages: { [index: string]: string } = {};

        const [
            dbCount,
            serverMetadata,
            topologyData,
            performanceData,
            storageData,
            usageEstimationData,
            memoryUtilizationData,
            diskUtilizationData,
            cpuUtilizationData
        ] = await Promise.all(
            [
                ...(isSSMConnected
                    ? [getDatabasesCount(credentialsId, region!, activeNodeInstanceId, standbyNodeInstanceId)]
                    : [Promise.resolve()]),
                ...(isSSMConnected ? [getServerSummary(resourceId)] : [Promise.resolve()]), // Fetch server metadata
                getTopology(accountId, region!, resourceId, resourceDetail, additionalFields), // Fetch topology data
                ...(isSSMConnected && getPerformance ? [getPerformanceMetrics(resourceId)] : [Promise.resolve()]), // Fetch io latency data
                ...(isSSMConnected && getStorageSavings ? [getStorageData(resourceDetail)] : [Promise.resolve()]), // Fetch storage savings data
                ...(getUsageEstimation ? [getBillingOrPriceEstimation(resourceDetail)] : [Promise.resolve()]), // Fetch pricing estimate data
                ...(isSSMConnected && getResourceutilization
                    ? [getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.MEMORY)]
                    : [Promise.resolve()]),
                ...(isSSMConnected && getResourceutilization
                    ? [getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.DISK)]
                    : [Promise.resolve()]),
                ...(isSSMConnected && getResourceutilization
                    ? [getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.CPU)]
                    : [Promise.resolve()])
            ].map((p, index) =>
                p.catch(error => {
                    if (DATABASE_HOSTS_INDEX_MAPPING[index]) {
                        errormessages[DATABASE_HOSTS_INDEX_MAPPING[index]] = JSON.stringify(error);
                    }
                    logger.error(`Error while fetching data: ${error}.`);
                })
            )
        );

        // CreationDate needs to be picked up from resource table: https://jira.ngage.netapp.com/browse/DBS-1586
        if (serverMetadata) {
            serverMetadata.creationDate = creationDate || '';
        }
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            if (topologyData.serverInstallationMode === SqlServerDeploymentModel.SQL_STANDALONE_SHORT) {
                delete serverMetadata.clusterName;
                serverMetadata.activeNode = resourceName || '';
                serverMetadata.nodeNames = [resourceName || ''];
            } else {
                serverMetadata.clusterName = resourceName || '';
            }
        }
        databaseHostDetails.id = resourceId;
        databaseHostDetails.name = resourceName || '';
        databaseHostDetails.status = serverMetadata ? ServerState.UP : ServerState.DOWN;
        databaseHostDetails.databaseCount = dbCount?.totalCount || 0;
        databaseHostDetails.databaseServer = serverMetadata;
        databaseHostDetails.topology = topologyData!;
        databaseHostDetails.performance = getPerformance ? { rwMetrics: performanceData! } : {};
        databaseHostDetails.storage = storageData!;
        databaseHostDetails.estimatedUsageCost = usageEstimationData!;
        if (getResourceutilization && cpuUtilizationData && memoryUtilizationData && diskUtilizationData) {
            databaseHostDetails.resourceUtilization = {
                cpu: cpuUtilizationData! || {},
                memory: memoryUtilizationData! || {},
                disk: diskUtilizationData! || {}
            };
        }
        if (!isEmpty(errormessages)) {
            databaseHostDetails.errors = errormessages;
        }
    } catch (error) {
        logger.error(`Error while fetching database hosts details ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database hosts details ${accountId}, ${error}`
        );
    }

    logger.debug('Database host details', databaseHostDetails);

    return databaseHostDetails;
}

async function getDatabases(accountId: string, databaseHostId: string): Promise<DatabasesListResponseType> {
    logger.info('Fetching details about a database installtion ', accountId, databaseHostId);

    const [resourceDetail] = await listResources(accountId, databaseHostId);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }

    const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;
    const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as unknown as Metadata;

    // Check SSM Connection status
    const isSSMConnected = await isSSMConnectionSuccessful(
        credentialsId,
        region!,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );

    if (!isSSMConnected) {
        const errorMessage = `Error while fetching database details for ${accountId} ${databaseHostId} due to SSM connection issues.`;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }

    const [{ databases }, backedupDatabases, awsBackup, ontapBackup] = await Promise.all(
        [
            getDataBasesSummary(databaseHostId),
            getNativeSQLBackedupDatabases(databaseHostId),
            isAWSBackupEnabled(credentialsId, region!, fileSystemId!, metadata as unknown as Metadata),
            getOntapVolumesSnapshotCount(credentialsId, region!, fileSystemId!, metadata as unknown as Metadata)
        ].map(p => p.catch(error => logger.error(`Error while fetching data: ${error}.`)))
    );
    try {
        const response = databases.map(
            (database: { databaseName: string; databaseSize: number; databaseStatus: string }) => ({
                name: database.databaseName,
                size: database.databaseSize,
                status: database.databaseStatus,
                type: MSSQL_SYSTEM_DATABASES.includes(database.databaseName.toLowerCase())
                    ? MSSQL_DATABASE_TYPES.SYSTEM
                    : MSSQL_DATABASE_TYPES.USER,
                protection: {
                    isAWSBackupEnabled: Boolean(awsBackup),
                    isFsxOntapSnapshotsEnabled: Boolean(ontapBackup),
                    isSqlNativeEnabled: Boolean(
                        backedupDatabases &&
                            backedupDatabases.find(
                                (e: { backedupDatabases: string }) => e.backedupDatabases === database.databaseName
                            )
                    )
                }
            })
        );
        return {
            count: response.length,
            nextToken: '',
            items: response
        };
    } catch (error) {
        const errorMessage = `Error while fetching database details for ${accountId} ${databaseHostId}, ${error}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }
}

async function getDriveInfoFromSSM(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string
) {
    logger.info('Getting drive information from SSM');
    // Check SSM Connection status
    const isSSMConnected = await isSSMConnectionSuccessful(
        credentialsId,
        region!,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );

    if (!isSSMConnected) {
        const errorMessage = `Error while fetching drive details for ${accountId} ${databaseHostId} due to SSM connection issues.`;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }
    const driveCommand = [GET_DIVE_INFO];
    const defaultDataDriveCommand = [EXECUTE_QUERY(DEFAULT_SQL_DATA_DRIVE, 0)];
    const defaultLogDriveCommand = [EXECUTE_QUERY(DEFAULT_SQL_LOG_DRIVE, 0)];

    const [driveResponse, defaultDataDriveResponse, defaultLogDriveResponse] = await Promise.all([
        callSsmExecution(credentialsId, region!, driveCommand, activeNodeInstanceId, standbyNodeInstanceId),
        callSsmExecution(credentialsId, region!, defaultDataDriveCommand, activeNodeInstanceId, standbyNodeInstanceId),
        callSsmExecution(credentialsId, region!, defaultLogDriveCommand, activeNodeInstanceId, standbyNodeInstanceId)
    ]);

    const finalDriveResponse = driveResponse ? sqlResponseParsing(driveResponse) : {};
    const finalDefaultDataDriveResponse =
        defaultDataDriveResponse && !defaultDataDriveResponse?.includes('error')
            ? sqlResponseParsing(defaultDataDriveResponse)[0]
            : {};
    const finalDefaultLogDriveResponse =
        defaultLogDriveResponse && !defaultLogDriveResponse?.includes('error')
            ? sqlResponseParsing(defaultLogDriveResponse)[0]
            : {};

    const currentDataDrive: string =
        Object.keys(finalDefaultDataDriveResponse).length !== 0 ? finalDefaultDataDriveResponse?.CurrentDataDrive : '';

    const currentLogDrive: string =
        Object.keys(finalDefaultLogDriveResponse).length !== 0 ? finalDefaultLogDriveResponse?.CurrentLogDrive : '';

    const { ExistingDriveInfo: existingDriveInfo, AvailableDriveLetters: availableDriveLetters } = finalDriveResponse;
    const UpdatedExistingDriveInfo: DriveInfo[] = [];

    existingDriveInfo.forEach((element: { DriveLetter: any; FreeSpace: any; manufacturer: string }) => {
        const updatedDriveInfo: DriveInfo = {
            driveLetter: element.DriveLetter,
            availableSize: element.FreeSpace,
            defaultDataDrive: element.DriveLetter === currentDataDrive,
            defaultLogDrive: element.DriveLetter === currentLogDrive,
            isNetappDrive: element.manufacturer === 'NETAPP'
        };

        UpdatedExistingDriveInfo.push(updatedDriveInfo);
    });
    return { UpdatedExistingDriveInfo, availableDriveLetters };
}

async function getDriveInfo(accountId: string, databaseHostId: string): Promise<DriveInfoResponseBodyType> {
    logger.info('Fetching drive details and storage capacity of the database host  ', accountId, databaseHostId);

    const [resourceDetail] = await getResources(accountId, databaseHostId);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }

    const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;
    const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as unknown as Metadata;

    const [fsxStorageCapacity, driveResponse] = await Promise.all([
        getFsxStorageCapacity(credentialsId, region!, fileSystemId!),
        getDriveInfoFromSSM(
            accountId,
            databaseHostId,
            credentialsId,
            region!,
            activeNodeInstanceId,
            standbyNodeInstanceId
        )
    ]);

    return {
        existingDriveInfo: driveResponse.UpdatedExistingDriveInfo,
        availableDriveLetters: driveResponse.availableDriveLetters,
        fsxStorageCapacity
    };
}

export { getDatabaseHostsSummary, getDatabaseHostSummary, getDatabases, getDriveInfo };
