import { JOBSTATUS, JOBTYPE, STORAGE_TYPE } from '@prisma/client';
import { DescribeInstancesCommandOutput, DescribeVpcsCommandInput } from '@aws-sdk/client-ec2';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
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
    DatabaseCreateResponseType,
    DriveInfoResponseBodyType,
    FileConfigType
} from '../routes/types/database-hosts.types';
import { describeInstance, describeSubnets, describeVpc, getAmis } from '../lib/aws/ec2';
import { describeFSxN, describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
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
    SqlServerDeploymentModel,
    DatabaseTypes,
    ACCOUNT_ID,
    FileSystemTypes,
    COMPLETE,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    SSM_COMMAND_CACHE_TYPE
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
    getActiveSqlNode,
    checkDatabaseExists
} from './workloads/mssql/mssql-operations';
import {
    getStorageDataUsingSSM,
    isAWSBackupEnabled,
    getOntapVolumesSnapshotCount,
    getCostAllocationTagFsxResource,
    getFsxStorageCapacity
} from './aws/fsx-operations';
import { Metadata, ResourceDetails } from '../utils/common-types';
import { calculateBilling, getCostAllocationTags } from './aws/cost-explorer-operations';
import { getSSMConnectionStatus } from './aws/ssm-operations';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { findResourceNameFromTags, getCostAllocationTagEC2Resource } from './aws/ec2-operations';
import { GET_CLUSTER_DRIVES, GET_DEFAULT_DRIVES, GET_DRIVE_INFO } from './workloads/mssql/ssm-script-utils';
import { getResources } from './database/database-operations';
import { convertGiBToBytes, sleep, sqlResponseParsing } from '../utils/utils';
import { CLEANUPSCRIPT, CONFIGURELUNSCRIPT, CREATEDBSCRIPT, INITIALIZEDBSCRIPT } from './workloads/mssql/const';
import { resetCache } from '../utils/cache';

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
    resourceData: ResourceDetails,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string
): Promise<TopologyResponseType> {
    logger.info('Fetching topology data', {
        accountId,
        region,
        resourceId,
        resourceData,
        activeNodeInstanceId,
        standbyNodeInstanceId
    });

    if (isEmpty(resourceData)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No data found for resource ${resourceId} in account ${accountId}.`
        );
    }

    const {
        resource_type: resourceType,
        co_relation_id: fileSystemId,
        credentials_id: credentialsId,
        cloud_provider_account_id: awsAccountId,
        storage_type: storageType,
        metadata
    } = resourceData;
    const { node1InstanceId, node2InstanceId, activeDirectoryName, activeDirectoryAddress, sqlDeploymentType } =
        metadata as unknown as Metadata;

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

    if (!isEmpty(node1InstanceId)) {
        let vpcId;
        let fileSystemStatus;
        let fileSystemName;
        let fileSystemDeploymentMode;
        let fileSystemStorageCapacity;
        let fileSystemThroughputCapacity;
        let subnetIds: Array<string> | undefined;
        let availabilityZones: Array<string> | undefined;
        let vpcCidr: string | undefined;

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
            const vpcParams: DescribeVpcsCommandInput = {
                VpcIds: [vpcId!]
            };
            const { Vpcs: vpcs = [] } = await describeVpc(credentialsId, region, vpcParams);
            vpcCidr = vpcs[0]?.CidrBlock;
            logger.info('availabilityZones', availabilityZones);
        } catch (error) {
            logger.error(`Error while fetching details for fsx. Error: ${error}`);
        }

        const instanceIds = node2InstanceId ? [node1InstanceId, node2InstanceId] : [node1InstanceId];

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
        let activeNodeInstanceName;
        let standbyNodeInstanceName;

        if (!isEmpty(activeNodeInstanceId)) {
            // fetch instance details only if there is atleast one active node
            try {
                ec2InstanceDetails = await describeInstance(credentialsId, region, { InstanceIds: instanceIds });
                const node1 = ec2InstanceDetails.Reservations?.[0].Instances?.[0];
                const node2 = ec2InstanceDetails.Reservations?.[1]?.Instances?.[0];
                const [activeNode, standbyNode] =
                    node1?.InstanceId === activeNodeInstanceId ? [node1, node2] : [node2, node1];
                if (!isEmpty(activeNode)) {
                    keyPairName = activeNode.KeyName;
                    activeInstanceType = activeNode.InstanceType;
                    activeAvailabilityZone = activeNode.Placement?.AvailabilityZone;
                    activeSubnetId = activeNode.SubnetId;
                    activeVolumeId = activeNode.BlockDeviceMappings?.[0].Ebs?.VolumeId;
                    activeNodeInstanceName = findResourceNameFromTags(activeNode.Tags);

                    if (!isEmpty(standbyNode)) {
                        standbyInstanceType = standbyNode.InstanceType;
                        standbyAvailabilityZone = standbyNode.Placement?.AvailabilityZone;
                        standbySubnetId = standbyNode.SubnetId;
                        standbyVolumeId = standbyNode.BlockDeviceMappings?.[0].Ebs?.VolumeId;
                        standbyNodeInstanceName = findResourceNameFromTags(standbyNode.Tags);
                    }
                }
            } catch (error) {
                logger.error(`Error while fetching details for ec2 instances. Error: ${error}`);
            }
        }
        const activeDirectoryDetails = {
            name: activeDirectoryName || '',
            address: activeDirectoryAddress || ''
        };
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
                storageType !== undefined
                    ? storageType === STORAGE_TYPE.FSXN
                        ? FileSystemTypes.FSXONTAP
                        : storageType
                    : '',
            fileSystemId: fileSystemId!,
            ...(fileSystemName && { fileSystemName }),
            ...(fileSystemDeploymentMode && { fileSystemDeploymentMode }),
            ...(fileSystemStatus && { fileSystemStatus }),
            ...(fileSystemStorageCapacity && { fileSystemStorageCapacity }),
            ...(fileSystemThroughputCapacity && { fileSystemThroughputCapacity }),
            ...(vpcId && { vpcId }),
            ...(vpcName && { vpcName }),
            ...(availabilityZones && { availabilityZones }),
            ...(vpcCidr && { vpcCidr }),
            ...(keyPairName && { keyPairName }),
            ...(activeNodeInstanceId && {
                ec2Details: [
                    {
                        id: activeNodeInstanceId!,
                        name: activeNodeInstanceName,
                        ebsVolumeId: activeVolumeId || '',
                        ...(activeInstanceType && { instanceType: activeInstanceType }),
                        ...(activeAvailabilityZone && { availabilityZone: activeAvailabilityZone }),
                        ...(activeSubnetId && { subnetId: activeSubnetId })
                    }
                ]
            }),
            ...(activeDirectoryDetails && { activeDirectoryDetails })
        };
        if (activeNodeInstanceId && standbyNodeInstanceId) {
            topologyData.ec2Details?.push({
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

async function getStorageData(
    resourceDetail: ResourceDetails,
    activeNodeInstanceId: string
): Promise<StorageResponseType | undefined> {
    logger.info('Getting storage data:', { resourceDetail, activeNodeInstanceId });

    try {
        const { region, co_relation_id: fileSystemId, credentials_id: credentialsId, metadata } = resourceDetail;

        const { stackname } = metadata as unknown as Metadata;

        const info = await getStorageDataUsingSSM(
            credentialsId,
            region!,
            fileSystemId!,
            'storage/volumes',
            `tiering.object_tags="wlmDeploymentId=${stackname?.replaceAll('-', '_')}"`,
            'fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used',
            activeNodeInstanceId
        );

        logger.info(`Storage data for volumes with deploymentId ${stackname}:`, info);

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

async function getProtectionStatus(
    resourceDetail: ResourceDetails,
    activeNodeInstanceId: string
): Promise<ProtectionResponseType | undefined> {
    logger.info('Get protection status', { resourceDetail });

    const {
        resource_id: resourceId,
        region,
        co_relation_id: fileSystemId,
        metadata,
        credentials_id: credentialsId
    } = resourceDetail;

    try {
        const [awsBackup, ontapProtection, nativeSqlProtection] = await Promise.all([
            isAWSBackupEnabled(credentialsId, region!, fileSystemId!, metadata as Metadata, activeNodeInstanceId),
            getOntapVolumesSnapshotCount(
                credentialsId,
                region!,
                fileSystemId!,
                metadata as Metadata,
                activeNodeInstanceId
            ),
            getNativeSQLProtection(resourceId, activeNodeInstanceId)
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

async function getBillingOrPriceEstimation(resourceDetail: ResourceDetails, activeNodeInstanceId?: string) {
    logger.info('Get AWS resources billing or cost data:', { resourceDetail, activeNodeInstanceId });
    const promises = [
        getBilling(resourceDetail).catch(error => {
            logger.error('Failed to get billing data for resource: :', JSON.stringify(error));
        })
    ];
    if (activeNodeInstanceId) {
        promises.push(
            getUsageEstimationData(resourceDetail, activeNodeInstanceId).catch(error => {
                logger.error('Failed to get pricing estimation data for resource:', JSON.stringify(error));
            })
        );
    } else {
        promises.push(Promise.resolve());
    }

    const [billingResponse, pricingResponse] = await Promise.all(promises);

    return billingResponse || pricingResponse;
}

async function getBilling(resourceDetail: ResourceDetails) {
    logger.info('Get AWS resources billing data:', resourceDetail);
    try {
        const { region, co_relation_id: fileSystemId, credentials_id: credentialsId, metadata } = resourceDetail;
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
        // Need to validate before proceeding for billing
        await validationForCostExplorer(resourceDetail);
        const billingResponse: UsageCostResponseType = await calculateBilling(
            credentialsId,
            region!,
            fileSystemId!,
            node1InstanceId,
            node2InstanceId
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

async function getUsageEstimationData(resourceDetail: ResourceDetails, activeNodeInstanceId: string) {
    logger.info('Get AWS resources estimation data:', { resourceDetail, activeNodeInstanceId });

    try {
        const { region, co_relation_id: fileSystemId, credentials_id: credentialsId, metadata } = resourceDetail;
        const { sqlDeploymentType } = metadata as unknown as Metadata;

        const [ec2ResourceInfo, fsxResourceInfo] = await Promise.all([
            getEc2ResourceInfo(credentialsId, region!, activeNodeInstanceId),
            getFsxResourceInfo(credentialsId, region!, fileSystemId!)
        ]);

        const pricingRequest: PricingServiceRequestType = {
            compute: {
                regionCode: region!,
                instanceType: ec2ResourceInfo.resourceType,
                sqlDeploymentMode: sqlDeploymentType?.toLowerCase() === FCI ? FCI : STANDALONE,
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
        customerCredentialsId,
        awsRegion,
        RESOURCESTYPE.MSSQL,
        API_PAGE_SIZE,
        nextToken
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

    const databaseHosts: DatabaseHostSummaryResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails.map(async resourceDetail => {
                const {
                    resource_id: resourceId,
                    resource_name: resourceName,
                    region,
                    credentials_id: credentialsId,
                    metadata
                } = resourceDetail;

                const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

                // Check SSM Connection status
                const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId } = await getActiveSqlNode(
                    credentialsId,
                    region!,
                    node1InstanceId,
                    node2InstanceId,
                    resourceId
                );
                const [dbCount, topologyData, performanceData, storageData, protectionData, usageEstimationData] =
                    await Promise.all(
                        [
                            ...(isSSMConnected && activeNodeInstanceId
                                ? [getDatabasesCount(credentialsId, region!, activeNodeInstanceId)]
                                : [Promise.resolve()]),
                            getTopology(
                                accountId,
                                region!,
                                resourceId,
                                resourceDetail,
                                activeNodeInstanceId!,
                                standbyNodeInstanceId
                            ),
                            ...(isSSMConnected && getPerformance && activeNodeInstanceId
                                ? [getServerIOLatency(resourceId, activeNodeInstanceId)]
                                : [Promise.resolve()]), // Fetch io latency data
                            ...(isSSMConnected && getStorageSavings && activeNodeInstanceId
                                ? [getStorageData(resourceDetail, activeNodeInstanceId)]
                                : [Promise.resolve()]), // Fetch storage savings data
                            ...(isSSMConnected && getProtection && activeNodeInstanceId
                                ? [getProtectionStatus(resourceDetail, activeNodeInstanceId)]
                                : [Promise.resolve()]), // Fetch protection status
                            ...(getUsageEstimation
                                ? [getBillingOrPriceEstimation(resourceDetail, activeNodeInstanceId)]
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
    fields?: string,
    resourceDetail?: ResourceDetails
): Promise<DatabaseHostSummaryResponseType> {
    logger.info('Fetching details about a database installtion ', accountId, databaseHostId, fields);

    if (isEmpty(resourceDetail)) {
        [resourceDetail] = await listResources(accountId, databaseHostId);
    }
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

    const {
        resource_id: resourceId,
        resource_name: resourceName,
        region,
        credentials_id: credentialsId,
        metadata
    } = resourceDetail;
    try {
        const { node1InstanceId, node2InstanceId, creationDate } = metadata as unknown as Metadata;

        // Check SSM Connection status
        const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId } = await getActiveSqlNode(
            credentialsId,
            region!,
            node1InstanceId,
            node2InstanceId,
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
                ...(isSSMConnected && activeNodeInstanceId
                    ? [getDatabasesCount(credentialsId, region!, activeNodeInstanceId)]
                    : [Promise.resolve()]),
                ...(isSSMConnected ? [getServerSummary(resourceId)] : [Promise.resolve()]), // Fetch server metadata
                getTopology(
                    accountId,
                    region!,
                    resourceId,
                    resourceDetail,
                    activeNodeInstanceId!,
                    standbyNodeInstanceId
                ),
                ...(isSSMConnected && getPerformance && activeNodeInstanceId
                    ? [getPerformanceMetrics(resourceId, activeNodeInstanceId)]
                    : [Promise.resolve()]), // Fetch io latency data
                ...(isSSMConnected && getStorageSavings && activeNodeInstanceId
                    ? [getStorageData(resourceDetail, activeNodeInstanceId)]
                    : [Promise.resolve()]), // Fetch storage savings data
                ...(getUsageEstimation
                    ? [getBillingOrPriceEstimation(resourceDetail, activeNodeInstanceId)]
                    : [Promise.resolve()]), // Fetch pricing estimate data
                ...(isSSMConnected && getResourceutilization && activeNodeInstanceId
                    ? [getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.MEMORY, activeNodeInstanceId)]
                    : [Promise.resolve()]),
                ...(isSSMConnected && getResourceutilization && activeNodeInstanceId
                    ? [getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.DISK, activeNodeInstanceId)]
                    : [Promise.resolve()]),
                ...(isSSMConnected && getResourceutilization && activeNodeInstanceId
                    ? [getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.CPU, activeNodeInstanceId)]
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

    const { region, co_relation_id: fileSystemId, credentials_id: credentialsId, metadata } = resourceDetail;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    // Check SSM Connection status
    const { isSSMConnected, activeNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region!,
        node1InstanceId,
        node2InstanceId
    );

    if (!isSSMConnected) {
        const errorMessage = `Error while fetching database details for ${accountId} ${databaseHostId} due to SSM connection issues.`;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }

    const [{ databases }, backedupDatabases, awsBackup, ontapBackup] = await Promise.all(
        [
            getDataBasesSummary(databaseHostId, activeNodeInstanceId),
            getNativeSQLBackedupDatabases(databaseHostId, activeNodeInstanceId),
            isAWSBackupEnabled(
                credentialsId,
                region!,
                fileSystemId!,
                metadata as unknown as Metadata,
                activeNodeInstanceId
            ),
            getOntapVolumesSnapshotCount(
                credentialsId,
                region!,
                fileSystemId!,
                metadata as unknown as Metadata,
                activeNodeInstanceId
            )
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

async function getDefaultDrives(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    executionTimeout?: string
) {
    logger.info('Getting MSSQL default data and log drives', { credentialsId, region, activeNodeInstanceId });
    const defaultDrivesCommand = [GET_DEFAULT_DRIVES];

    const defaultDriveResponse = await callSsmExecution(
        credentialsId,
        region,
        defaultDrivesCommand,
        activeNodeInstanceId,
        undefined,
        false,
        executionTimeout
    );

    const [parsedDefaultDataDrive, parsedDefaultLogDrive] = defaultDriveResponse
        ? sqlResponseParsing(defaultDriveResponse)
        : [];

    const currentDataDrive =
        parsedDefaultDataDrive && !parsedDefaultDataDrive.includes('error')
            ? sqlResponseParsing(parsedDefaultDataDrive)[0].CurrentDataDrive
            : '';

    const currentLogDrive =
        parsedDefaultLogDrive && !parsedDefaultLogDrive.includes('error')
            ? sqlResponseParsing(parsedDefaultLogDrive)[0].CurrentLogDrive
            : '';
    logger.debug('MSSQL default data and log drives response', { currentDataDrive, currentLogDrive });
    return { currentDataDrive, currentLogDrive };
}

async function getDriveInfoFromNodes(
    credentialsId: string,
    region: string,
    sqlDeploymentType: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId: string,
    executionTimeout?: string
) {
    logger.info('Getting existing drives info on node', {
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId
    });
    const driveInfoCommand = [GET_DRIVE_INFO];

    const existingDriveActiveNodePromise = callSsmExecution(
        credentialsId,
        region,
        driveInfoCommand,
        activeNodeInstanceId,
        undefined,
        false,
        executionTimeout
    );
    // Getting clustered drive letters for FCI deployments
    const clusterCommand = [GET_CLUSTER_DRIVES];

    let clusterCommandPromise;
    if (sqlDeploymentType === 'FCI') {
        clusterCommandPromise = callSsmExecution(
            credentialsId,
            region,
            clusterCommand,
            activeNodeInstanceId,
            undefined,
            false,
            executionTimeout
        );
    } else {
        clusterCommandPromise = Promise.resolve();
    }

    // Getting drive info of drives present on standby node to eliminate presenting existing drive letter as available drive letter
    let existingDriveStandbyNodePromise;
    if (sqlDeploymentType === 'FCI') {
        existingDriveStandbyNodePromise = callSsmExecution(
            credentialsId,
            region,
            driveInfoCommand,
            standbyNodeInstanceId!,
            undefined,
            false,
            executionTimeout
        );
    } else {
        existingDriveStandbyNodePromise = Promise.resolve();
    }

    const [clusterDrivesResponse, existingDriveActiveNodeResponse, existingDriveStandbyNodeResponse] =
        await Promise.all([clusterCommandPromise, existingDriveActiveNodePromise, existingDriveStandbyNodePromise]);

    const parsedActiveNodeResponse = sqlResponseParsing(existingDriveActiveNodeResponse!);
    const parsedstandbyNodeResponse = existingDriveStandbyNodeResponse!
        ? sqlResponseParsing(existingDriveStandbyNodeResponse!)
        : undefined;

    const activeNodeExistingDrives = Array.isArray(parsedActiveNodeResponse)
        ? parsedActiveNodeResponse
        : [parsedActiveNodeResponse];

    const standbyNodeExistingDrives = parsedstandbyNodeResponse
        ? Array.isArray(parsedstandbyNodeResponse)
            ? parsedstandbyNodeResponse
            : [parsedstandbyNodeResponse]
        : undefined;

    standbyNodeExistingDrives?.forEach(standbyNodeDrive => {
        const driveLetterExists = activeNodeExistingDrives.find(
            activeNodeDrive => activeNodeDrive.driveLetter === standbyNodeDrive.driveLetter
        );
        if (!driveLetterExists) {
            activeNodeExistingDrives.push(standbyNodeDrive);
        }
    });

    let updatedExitingDrives: any[] = activeNodeExistingDrives;

    if (sqlDeploymentType === 'FCI' && clusterDrivesResponse) {
        try {
            const parsedclusterDrivesResponse = sqlResponseParsing(clusterDrivesResponse);
            updatedExitingDrives = activeNodeExistingDrives.map(drive => {
                const matchingDrive = parsedclusterDrivesResponse.find(
                    (parsedDrive: { driveLetter: string }) =>
                        parsedDrive.driveLetter.replace(':', '') === drive.driveLetter
                );

                if (matchingDrive && matchingDrive.owner.includes('SQL Server')) {
                    return { ...drive, isDriveClustered: true };
                }
                return { ...drive, isDriveClustered: false };
            });
        } catch (error) {
            const errorMessage = `Unable to read cluster drive information ${activeNodeInstanceId} ${standbyNodeInstanceId}, ${error}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
    }

    // Constructing list of available drive letters
    const availableDriveLetters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).filter(
        letter => letter >= 'D' && !updatedExitingDrives.some(obj => obj.driveLetter === letter)
    );

    logger.debug('Existing drives info', { updatedExitingDrives, availableDriveLetters });
    return { updatedExitingDrives, availableDriveLetters };
}

async function getDriveInfoFromSSM(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    sqlDeploymentType: string,
    node1InstanceId: string,
    node2InstanceId?: string,
    executionTimeout?: string
) {
    logger.info('Getting drive information from SSM', {
        accountId,
        databaseHostId,
        credentialsId,
        sqlDeploymentType,
        node1InstanceId,
        node2InstanceId
    });
    // Check SSM Connection status
    const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region!,
        node1InstanceId,
        node2InstanceId
    );

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to access drive details for host ${databaseHostId} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    if (standbyNodeInstanceId) {
        const connectionStatus = await getSSMConnectionStatus(credentialsId, region!, node2InstanceId!);
        if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
            const errorMessage = `Unable to connect to node to access drive details for host ${databaseHostId} in account ${accountId}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
    }
    let getDriveInfoFromNodesResponse;
    let getDefaultDrivesResponse;
    try {
        // Not caching any ssm response as multiple creation will require real time data
        [getDriveInfoFromNodesResponse, getDefaultDrivesResponse] = await Promise.all([
            getDriveInfoFromNodes(
                credentialsId,
                region,
                sqlDeploymentType,
                activeNodeInstanceId as string,
                standbyNodeInstanceId!,
                executionTimeout
            ),
            getDefaultDrives(credentialsId, region, activeNodeInstanceId as string, executionTimeout)
        ]);
    } catch (error) {
        const errorMessage = `Unable to get drive information ${error}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    return { getDriveInfoFromNodesResponse, getDefaultDrivesResponse };
}

async function getDriveInfo(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    executionTimeout?: string
): Promise<DriveInfoResponseBodyType> {
    logger.info(
        'Fetching drive details and storage capacity of the database host',
        accountId,
        databaseHostId,
        credentialsId,
        region
    );

    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId, credentialsId, region, RESOURCESTYPE.MSSQL);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { co_relation_id: fileSystemId, metadata } = resourceDetail;
    const { node1InstanceId, node2InstanceId, sqlDeploymentType } = metadata as unknown as Metadata;

    let fsxStorageCapacity;
    let driveResponse;
    try {
        [fsxStorageCapacity, driveResponse] = await Promise.all([
            getFsxStorageCapacity(credentialsId, region!, fileSystemId!),
            getDriveInfoFromSSM(
                accountId,
                databaseHostId,
                credentialsId,
                region,
                sqlDeploymentType!,
                node1InstanceId,
                node2InstanceId,
                executionTimeout
            )
        ]);
    } catch (error) {
        const errorMessage = `Unable to get drive information and FSx storage capacity. ${error}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    const { getDriveInfoFromNodesResponse, getDefaultDrivesResponse } = driveResponse;
    const { storage } = fsxStorageCapacity ?? {};

    const response: DriveInfoResponseBodyType = {
        existingDriveInfo: getDriveInfoFromNodesResponse.updatedExitingDrives,
        availableDriveLetters: getDriveInfoFromNodesResponse.availableDriveLetters,
        ...(storage && { fsxStorageCapacity: storage * 1024 * 1024 * 1024 }),
        ...(getDefaultDrivesResponse.currentDataDrive && {
            defaultDataDrive: getDefaultDrivesResponse.currentDataDrive
        }),
        ...(getDefaultDrivesResponse.currentLogDrive && {
            defaultLogDrive: getDefaultDrivesResponse.currentLogDrive
        })
    };

    return response;
}

async function deployDatabase(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    databaseName: string,
    dataFileConfig: FileConfigType,
    logFileConfig: FileConfigType
): Promise<DatabaseCreateResponseType> {
    logger.info('Deploy new database', {
        accountId,
        databaseHostId,
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig
    });

    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId);

    const {
        resource_id: resourceId,
        co_relation_id: fileSystemId,
        metadata,
        resource_name: sqlServerName
    } = resourceDetail;
    const { node1InstanceId, node2InstanceId, fsxSvmId, sqlDeploymentType } = metadata as unknown as Metadata;
    const isClustered = sqlDeploymentType === 'FCI' ? 'true' : 'false';

    if (!credentialsId || !region || !node1InstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get resource  information');
    }

    // check whether any jobs on the same resource running
    const filterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        typeFilter: JOBTYPE.CREATE_RESOURCE
    };
    const {
        items: [job]
    } = await getJobs(accountId, credentialsId, region, filterParams);

    if (job) {
        throw createError(
            412,
            `A database creation operation for ${sqlServerName} is already in progress with job ID ${job.id}`
        );
    }

    // create the parent job for database deployment
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: `Creating user database ${databaseName} on the SQL Server host ${sqlServerName}`,
        startTime: Date.now(),
        description: `Creating user database ${databaseName} on the SQL Server host ${sqlServerName}`
    });

    invokeSSMForDatabaseDeployment(
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig,
        fileSystemId,
        isClustered,
        sqlServerName,
        node1InstanceId,
        fsxSvmId,
        jobId,
        resourceId,
        node2InstanceId
    );
    return { jobId };
}

async function invokeSSMForDatabaseDeployment(
    credentialsId: string,
    region: string,
    databaseName: string,
    dataFileConfig: FileConfigType,
    logFileConfig: FileConfigType,
    fileSystemId: string | null,
    isClustered: string,
    sqlServerName: string | null,
    node1InstanceId: string,
    fsxSvmId: string | undefined,
    parentJobId: string,
    resourceId: string,
    node2InstanceId?: string
) {
    logger.info(
        'invoke SSM for database deployment',
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig,
        node1InstanceId,
        node2InstanceId,
        fsxSvmId,
        fileSystemId,
        resourceId,
        isClustered,
        parentJobId
    );

    const accountId: string = getAsyncLocalStorageResource(ACCOUNT_ID);

    const { fileName: dataFileName, drive: dataDrive, isExisting: isDataDriveExists } = dataFileConfig;
    const { fileName: logFileName, drive: logDrive, isExisting: isLogDriveExists } = logFileConfig;

    const dataVolumeSize = dataFileConfig.volumeSize * 1074; // converting from GiB to MBs
    const logVolumeSize = logFileConfig.volumeSize * 1074; // converting from GiB to MBs

    const dataDrivePath = `${dataDrive}:\\${DatabaseTypes.MS_SQL_SERVER}\\data\\${dataFileName}`;
    const logDrivePath = `${logDrive}:\\${DatabaseTypes.MS_SQL_SERVER}\\log\\${logFileName}`;

    let sqlVirtualMachineName;
    let activeNodeId;

    try {
        const { isSSMConnected, activeNodeInstanceId } = await getActiveSqlNode(
            credentialsId,
            region!,
            node1InstanceId,
            node2InstanceId
        );
        if (!isSSMConnected && activeNodeInstanceId === undefined) {
            const errorMessage = `Error while creating database for ${accountId} ${resourceId} due to SSM connection issues.`;
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
        }

        await validateParams(
            accountId,
            resourceId,
            credentialsId,
            region,
            databaseName,
            dataFileConfig,
            logFileConfig,
            fileSystemId as string,
            isClustered,
            sqlServerName as string,
            parentJobId,
            activeNodeInstanceId as string
        );

        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            fileSystemId as string
        );

        const svmList = fsxSVMs?.filter(svm => svm.StorageVirtualMachineId === fsxSvmId) || [];
        const [{ Name: sqlVMName }] = svmList;

        sqlVirtualMachineName = sqlVMName;
        activeNodeId = activeNodeInstanceId;

        if (isDataDriveExists && isLogDriveExists) {
            // When the user selected drive as existing, we will only execute the create database script on the drive
            await createDatabase(
                accountId,
                credentialsId,
                resourceId,
                region,
                parentJobId,
                activeNodeInstanceId as string,
                sqlServerName,
                databaseName,
                dataDrivePath,
                logDrivePath
            );
            await updateJobDetails(accountId, credentialsId, region, parentJobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                error: undefined
            });
            // clearning all the ssm command cache so that we will get the fresh data once the database is created
            resetCache(SSM_COMMAND_CACHE_TYPE);
        } else {
            // New Drive selected, Will execute all the 3 scripts
            const {
                Resources: { Igroup: iGroup, FSxDataVolumeName: fsxDataVolumeName, FSxLogVolumeName: fsxLogVolumeName }
            } = await configureLuns(
                accountId,
                credentialsId,
                region,
                parentJobId,
                activeNodeInstanceId as string,
                sqlServerName,
                fileSystemId,
                sqlVMName,
                dataVolumeSize,
                logVolumeSize,
                (!isLogDriveExists).toString(),
                (!isDataDriveExists).toString()
            );
            // its required to sleep for 45 seconds so that initialization script will go through.. the ontap LUN configure can take time depending on busy system for the multiple API calls, and the disk initialize may take time to discover the created LUNs
            await sleep(45000);
            await newDBInitialization(
                accountId,
                credentialsId,
                region,
                parentJobId,
                activeNodeInstanceId as string,
                sqlServerName,
                databaseName,
                isClustered,
                dataDrive,
                logDrive,
                (!isLogDriveExists).toString(),
                (!isDataDriveExists).toString(),
                iGroup,
                fsxDataVolumeName,
                fsxLogVolumeName
            );

            await createDatabase(
                accountId,
                credentialsId,
                resourceId,
                region,
                parentJobId,
                activeNodeInstanceId as string,
                sqlServerName,
                databaseName,
                dataDrivePath,
                logDrivePath,
                iGroup,
                fsxDataVolumeName,
                fsxLogVolumeName
            );

            await updateJobDetails(accountId, credentialsId, region, parentJobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                error: undefined
            });
            // clearning all the ssm command cache so that we will get the fresh data once the database is created
            resetCache(SSM_COMMAND_CACHE_TYPE);
        }
    } catch (err: any) {
        logger.error(
            `Error while creating database ${databaseName} in host ${resourceId} in account ${accountId}`,
            err,
            err.data
        );
        // Clean up script will only be executed when the configure lun script is provisioned
        if (err.data && err.data?.iGroup) {
            const {
                data: { iGroup, fsxDataVolumeName, fsxLogVolumeName }
            } = err;
            await cleanUpDatabaseDeployment(
                accountId,
                credentialsId,
                resourceId,
                region,
                fileSystemId,
                sqlVirtualMachineName,
                fsxDataVolumeName,
                fsxLogVolumeName,
                iGroup,
                activeNodeId as string,
                sqlServerName,
                parentJobId,
                databaseName,
                isClustered
            );
        }

        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: err?.message
        });
    }
}

async function createDatabase(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    region: string,
    parentJobId: string,
    activeNodeInstanceId: string,
    sqlServerName: string | null,
    databaseName: string,
    dataDrivePath: string,
    logDrivePath: string,
    iGroup?: string,
    fsxDataVolumeName?: string,
    fsxLogVolumeName?: string
) {
    logger.info('Creating Database', {
        accountId,
        credentialsId,
        resourceId,
        region,
        parentJobId,
        activeNodeInstanceId,
        sqlServerName,
        databaseName,
        dataDrivePath,
        logDrivePath,
        iGroup,
        fsxDataVolumeName,
        fsxLogVolumeName
    });

    let createDatabaseCommand;
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        createDatabaseCommand = [
            `${CREATEDBSCRIPT} -SQLServer Draculla  -DBName tempdb9  -DataPath J:\\MSSQL\\data\\tempdb9_data.mdf  -LogPath K:\\MSSQL\\data\\tempdb9_log.ldf`
        ];
    } else {
        createDatabaseCommand = [
            `${CREATEDBSCRIPT} -SQLServer ${sqlServerName}  -DBName ${databaseName}  -DataPath ${dataDrivePath}  -LogPath ${logDrivePath}`
        ];
    }

    // child job creation
    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'Creating Database',
        parentJobId,
        description: `Creating database ${databaseName} with provided data and log file paths.`,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const createDatabaseResponse = await callSsmExecution(
            credentialsId,
            region,
            createDatabaseCommand,
            activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );
        logger.debug('Create database is done', createDatabaseResponse);
        const parsedDBResponse = createDatabaseResponse ? sqlResponseParsing(createDatabaseResponse) : {};

        if (parsedDBResponse?.Status === COMPLETE) {
            status = JOBSTATUS.COMPLETED;
        } else {
            status = JOBSTATUS.FAILED;
            errMsg = parsedDBResponse.Message;
            const exception = JSON.stringify(parsedDBResponse?.Exception);
            logger.error(`Exception for create db ${parsedDBResponse.Message} ${exception}`);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errMsg}.`, {
                data: { iGroup, fsxDataVolumeName, fsxLogVolumeName }
            });
        }
        return parsedDBResponse;
    } catch (err: any) {
        // child job failed
        const errorMsg = `Error while creating database ${databaseName} in host ${resourceId} in account ${accountId}.`;
        logger.error(errorMsg, err);
        errMsg = `${errorMsg}  ${err?.message}`;
        status = JOBSTATUS.FAILED;
        if (!err.data) {
            err.data = { iGroup, fsxLogVolumeName, fsxDataVolumeName };
        }
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg, { data: err.data });
    } finally {
        // child job update
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function configureLuns(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    activeNodeInstanceId: string,
    sqlServerName: string | null,
    fileSystemId: string | null,
    sqlVMName: string | undefined,
    dataVolumeSize: number,
    logVolumeSize: number,
    isLogDriveExists: string,
    isDataDriveExists: string
) {
    logger.info('Configure Luns', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        activeNodeInstanceId,
        sqlServerName,
        fileSystemId,
        sqlVMName,
        dataVolumeSize,
        logVolumeSize,
        isLogDriveExists,
        isDataDriveExists
    });

    let configureLuncommands;
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        configureLuncommands = [
            `${CONFIGURELUNSCRIPT} -FileSystemId fs-0d5efc3057c4f12cb -SQLVMName wlmdb_sqlsvm_1708791218786  -FSxDataLunSize 1074  -FSxLogLunSize 1074 -LogNew false -DataNew false`
        ];
    } else {
        configureLuncommands = [
            `${CONFIGURELUNSCRIPT} -FileSystemId ${fileSystemId} -SQLVMName ${sqlVMName}  -FSxDataLunSize ${dataVolumeSize}  -FSxLogLunSize ${logVolumeSize} -LogNew ${isLogDriveExists} -DataNew ${isDataDriveExists}`
        ];
    }

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'Configuring storage',
        parentJobId,
        description: 'Configuring storage on FSx for NetApp ONTAP with recommended best practices.',
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const configureLunresponse = await callSsmExecution(
            credentialsId,
            region,
            configureLuncommands,
            activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );
        logger.debug('Configure luns is done', configureLunresponse);
        const parsedLunsResponse = configureLunresponse ? sqlResponseParsing(configureLunresponse) : {};

        if (parsedLunsResponse?.Status === COMPLETE) {
            status = JOBSTATUS.COMPLETED;
        } else {
            status = JOBSTATUS.FAILED;
            errMsg = parsedLunsResponse.Message;
            const exception = JSON.stringify(parsedLunsResponse?.Exception);
            logger.error(`Exception for configure lun ${parsedLunsResponse.Message} ${exception}`);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errMsg}.`, {
                data: {
                    iGroup: parsedLunsResponse?.Resources?.Igroup,
                    fsxLogVolumeName: parsedLunsResponse?.Resources?.FSxLogVolumeName,
                    fsxDataVolumeName: parsedLunsResponse?.Resources?.FSxDataVolumeName
                }
            });
        }

        return parsedLunsResponse;
    } catch (err: any) {
        const errorMsg = `Error while configuring storage in account ${accountId}.`;
        logger.error(errorMsg, err);
        errMsg = `${errorMsg}  ${err?.message}`;
        status = JOBSTATUS.FAILED;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg, { data: err.data });
    } finally {
        // child job failed
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function newDBInitialization(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    activeNodeInstanceId: string,
    sqlServerName: string | null,
    databaseName: string,
    isClustered: string,
    dataDrive: string,
    logDrive: string,
    isLogDriveExists: string,
    isDataDriveExists: string,
    iGroup: string,
    fsxDataVolumeName: string,
    fsxLogVolumeName: string
) {
    logger.info('Initialising new database', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        activeNodeInstanceId,
        sqlServerName,
        databaseName,
        isClustered,
        dataDrive,
        logDrive,
        isLogDriveExists,
        isDataDriveExists,
        iGroup,
        fsxDataVolumeName,
        fsxLogVolumeName
    });

    let dbInitializecommands;
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        dbInitializecommands = [
            `${INITIALIZEDBSCRIPT} -DBName tempdb9  -IsClustered false  -DataDrive J  -LogDrive K -LogNew true -DataNew true`
        ];
    } else {
        dbInitializecommands = [
            `${INITIALIZEDBSCRIPT} -DBName ${databaseName}  -IsClustered ${isClustered}  -DataDrive ${dataDrive}  -LogDrive ${logDrive} -LogNew ${isLogDriveExists} -DataNew ${isDataDriveExists}`
        ];
    }

    const description =
        isClustered === 'true'
            ? 'Attaching iSCSI disks to Windows host, initializing drives, and assigning to SQL role in Windows cluster'
            : 'Attaching iSCSI disks to Windows host and initializing drives';

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'New iSCSI Disk Initialization',
        parentJobId,
        description,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const newDBInitializeresponse = await callSsmExecution(
            credentialsId,
            region,
            dbInitializecommands,
            activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );
        logger.debug('New DB initialize is successfully done', newDBInitializeresponse);

        const parsedDBInitializationResponse = newDBInitializeresponse
            ? sqlResponseParsing(newDBInitializeresponse)
            : {};

        if (parsedDBInitializationResponse?.Status === COMPLETE) {
            status = JOBSTATUS.COMPLETED;
        } else {
            status = JOBSTATUS.FAILED;
            errMsg = parsedDBInitializationResponse.Message;
            const exception = JSON.stringify(parsedDBInitializationResponse?.Exception);
            logger.error(`Exception for db initialize  ${parsedDBInitializationResponse.Message} ${exception}`);

            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errMsg}.`, {
                data: { iGroup, fsxLogVolumeName, fsxDataVolumeName }
            });
        }
        return parsedDBInitializationResponse;
    } catch (err: any) {
        const errorMsg = `Error while initializing new database ${databaseName} in account ${accountId}.`;
        logger.error(errorMsg, err);
        errMsg = `${errorMsg}  ${err?.message}`;
        status = JOBSTATUS.FAILED;
        if (!err.data) {
            err.data = { iGroup, fsxLogVolumeName, fsxDataVolumeName };
        }
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg, { data: err.data });
    } finally {
        // child job failed
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function cleanUpDatabaseDeployment(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    region: string,
    fileSystemId: string | null,
    sqlVMName: string | undefined,
    dataVolumeName: string,
    logVolumeName: string,
    iGroup: string,
    activeNodeInstanceId: string,
    sqlServerName: string | null,
    parentJobId: string,
    databaseName: string,
    isClustered: string
) {
    logger.info('Cleaning up the database deployment', {
        accountId,
        credentialsId,
        resourceId,
        region,
        fileSystemId,
        sqlVMName,
        dataVolumeName,
        logVolumeName,
        iGroup,
        activeNodeInstanceId,
        sqlServerName,
        parentJobId,
        databaseName,
        isClustered
    });

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'Cleaning up',
        parentJobId,
        description: `Database creation failed. Cleaning up resources in FSx for NetApp ONTAP and in host ${resourceId}`,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        let cleaupCommand;
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            cleaupCommand = [
                `${CLEANUPSCRIPT} -FileSystemId fs-0d5efc3057c4f12cb -SQLVMName wlmdb_sqlsvm_1708791218786  -FSxDataVolumeName wlmdb_sqldata_1708948249  -FSxLogVolumeName wlmdb_sqllog_1708948249 -IGROUP wlmdb_sqligroup_1708791218786`
            ];
        } else {
            cleaupCommand = [
                `${CLEANUPSCRIPT} -FileSystemId ${fileSystemId} -SQLVMName ${sqlVMName}  -FSxDataVolumeName ${dataVolumeName}  -FSxLogVolumeName ${logVolumeName} -IGROUP ${iGroup} -DBName ${databaseName} -IsClustered ${isClustered}`
            ];
        }

        const cleanUpResponse = await callSsmExecution(
            credentialsId,
            region,
            cleaupCommand,
            activeNodeInstanceId,
            accountId,
            false
        );

        const parsedCleanUpResponse = cleanUpResponse ? sqlResponseParsing(cleanUpResponse) : {};
        status = parsedCleanUpResponse?.Status === COMPLETE ? JOBSTATUS.COMPLETED : JOBSTATUS.FAILED;
        errMsg = parsedCleanUpResponse.Message;

        return parsedCleanUpResponse;
    } catch (err: any) {
        const errorMsg = `Error while cleaning up resources in FSx for NetApp ONTAP and in host ${resourceId} in account ${accountId}.`;
        logger.error(errorMsg, err);
        errMsg = `${errorMsg}  ${err?.message}`;
        status = JOBSTATUS.FAILED;
    } finally {
        // child job failed
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function validateParams(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    databaseName: string,
    dataFileConfig: FileConfigType,
    logFileConfig: FileConfigType,
    fileSystemId: string,
    isClustered: string,
    sqlServerName: string,
    parentJobId: string,
    activeNodeInstanceId: string
) {
    logger.info('validating parameters for database user creation', {
        accountId,
        databaseHostId,
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig,
        fileSystemId,
        sqlServerName,
        parentJobId
    });
    const { drive: dataDrive, isExisting: isDataDriveExists, volumeSize: dataVolumeSize } = dataFileConfig;
    const { drive: logDrive, isExisting: isLogDriveExists, volumeSize: logVolumeSize } = logFileConfig;

    const dataGibIntoBytes = convertGiBToBytes(dataVolumeSize);
    const logGibIntoBytes = convertGiBToBytes(logVolumeSize);

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'Database Validation',
        parentJobId,
        description: `Validating parameters for database ${databaseName}.`,
        startTime: Date.now()
    });

    let status;
    let errMsg;

    try {
        if (!isDataDriveExists && !isLogDriveExists) {
            if (dataDrive === logDrive) {
                throw createError(412, 'Data and log file drive letters should be different for new drives');
            }
        }

        await checkDatabaseExists(accountId, credentialsId, region, databaseHostId, databaseName, activeNodeInstanceId);

        const { existingDriveInfo, availableDriveLetters } = await getDriveInfo(
            accountId,
            databaseHostId,
            credentialsId,
            region,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );

        // check whether the drive selection detail is right
        await Promise.all([
            checkDriveExists(
                existingDriveInfo,
                availableDriveLetters,
                dataDrive,
                isDataDriveExists,
                dataGibIntoBytes,
                isClustered,
                'data'
            ),
            checkDriveExists(
                existingDriveInfo,
                availableDriveLetters,
                logDrive,
                isLogDriveExists,
                logGibIntoBytes,
                isClustered,
                'log'
            )
        ]);
        status = JOBSTATUS.COMPLETED;
    } catch (error: any) {
        const errorMsg = `Error while validating parameters in database ${databaseName} in host ${databaseHostId} in account ${accountId}.`;
        logger.error(errorMsg, error);
        errMsg = error?.message;
        status = JOBSTATUS.FAILED;
        throw createError(error.statusCode || 412, `${errorMsg} ${errMsg}`);
    } finally {
        // child job failed
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function checkDriveExists(
    existingDriveInfo: Array<{
        driveLetter: string;
        availableSize: number;
        isNetappDrive: boolean;
        isDriveClustered?: boolean;
    }>,
    availableDriveLetters: Array<string>,
    selectedDrive: string,
    isDriveExists: boolean,
    volumeSizeInBytes: number,
    isClustered: string,
    driveType: string
) {
    logger.info(
        'checking whether the drive exists',
        existingDriveInfo,
        availableDriveLetters,
        selectedDrive,
        isDriveExists,
        volumeSizeInBytes,
        isClustered,
        driveType
    );

    const restrictedDrives = ['A', 'B'];

    if (restrictedDrives.includes(selectedDrive)) {
        throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not a valid drive`);
    }

    const regex = /^[A-Z]{1}$/; // Allows only single Capital Alphabetical letter
    if (!regex.test(selectedDrive)) {
        throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not a valid drive`);
    }

    if (isDriveExists) {
        const matchedExistingDrive = existingDriveInfo?.find(drive => drive.driveLetter === selectedDrive);
        if (!matchedExistingDrive) {
            throw createError(412, `Selected ${driveType} drive letter ${selectedDrive} does not exist`);
        }
        if (!matchedExistingDrive.isNetappDrive) {
            throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not a NetApp drive`);
        }
        if (isClustered === 'true' && !matchedExistingDrive.isDriveClustered) {
            throw createError(
                412,
                `Selected ${driveType} drive ${selectedDrive} is non clustered drive or drive not part of SQL server`
            );
        }
        if (matchedExistingDrive.availableSize < volumeSizeInBytes) {
            throw createError(412, `Selected ${driveType} drive ${selectedDrive} does not have sufficient capacity`);
        }
    } else {
        const matchedAvailableDrive = availableDriveLetters?.includes(selectedDrive);
        if (!matchedAvailableDrive) {
            throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not available for creation`);
        }
    }
    return true;
}

export {
    getDatabaseHostsSummary,
    getDatabaseHostSummary,
    getDatabases,
    deployDatabase,
    getDriveInfo,
    createDatabase,
    newDBInitialization,
    configureLuns,
    cleanUpDatabaseDeployment
};
