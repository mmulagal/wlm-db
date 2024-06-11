import { STORAGE_TYPE } from '@prisma/client';
import numeral from 'numeral';
import { DescribeInstancesCommandOutput, DescribeVpcsCommandInput } from '@aws-sdk/client-ec2';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { listDatabaseInstances, listResources } from '../lib/database/db';
import {
    TopologyResponseType,
    ProtectionPerStorageTypeResponseType,
    UsageCostResponseType,
    DatabasesListResponseType,
    StoragePerStorageTypeResponseType,
    DatabaseHostSummaryPerStorageTypeResponseType,
    DatabaseHostSummaryPerStorageTypeListResponseType,
    DatabaseHostSummaryForMultiInstanceResponseType,
    DatabaseHostInstanceSummaryResponseType
} from '../routes/types/database-hosts.types';
import { describeInstance, describeSubnets, describeVolumes, describeVpc, getAmis } from '../lib/aws/ec2';
import { describeFSx } from '../lib/aws/fsx';
import { PricingServiceRequestType, PricingServiceResponseType } from '../routes/types/pricing.types';

import { calculatePrice } from './aws/pricing-operations';
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
    MSSQL_DATABASE_TYPES,
    MSSQL_SYSTEM_DATABASES,
    PRICING,
    WLMDB_COST_ALLOCATION_TAG,
    API_PAGE_SIZE,
    SqlServerDeploymentModel,
    FileSystemTypes,
    CUSTOM,
    SQL_WEB,
    VERSION_2_0
} from '../utils/consts';
import getLogger from '../utils/logger';
import {
    getNativeSQLProtection,
    getPerformanceMetrics,
    getDataBasesSummary,
    getNativeSQLBackedupDatabases,
    getActiveSqlNode,
    getServerDetails,
    getAllResourceUtilisationDetails,
    getAllInstanceDetails
} from './workloads/mssql/mssql-operations';
import {
    isFsxnAwsBackupEnabled,
    getOntapVolumesSnapshotCount,
    getCostAllocationTagFsxResource,
    isFsxwAwsBackupEnabled
} from './aws/fsx-operations';
import { DatabaseInstance, Metadata, ResourceDetails } from '../utils/common-types';
import { calculateBilling, getCostAllocationTags } from './aws/cost-explorer-operations';
import { findResourceNameFromTags, getCostAllocationTagEC2Resource, isEbsAwsBackupEnabled } from './aws/ec2-operations';
import {
    calculateFsxnStorageEfficiencyUsingCloudwatch,
    calculateFsxwStorageEfficiencyUsingCloudwatch
} from './aws/cloud-watch-operations';
import { getDatabsaeInstanceName } from '../utils/utils';

const logger = getLogger();

const DATABASE_HOSTS_INDEX_MAPPING: { [index: number]: string } = {
    0: 'serverDetails',
    1: 'topology',
    2: 'performance',
    3: 'storage',
    4: 'protection',
    5: 'billing/pricing',
    6: 'resourceUtilization'
};

const DATABASE_HOSTS_INDEX_MAPPING_V2: { [index: number]: string } = {
    0: 'instanceDetails',
    1: 'nodeTopology',
    2: 'billing/pricing'
};
const DATABASE_INSTANCE_INDEX_MAPPING: { [index: number]: string } = {
    0: 'serverDetails',
    1: 'databaseInstancetopologyData',
    2: 'performance',
    3: 'storage',
    4: 'protection',
    5: 'resourceUtilization'
};

// type VolumeSpaceRecord = {
//     uuid: string;
//     name: string;
//     efficiency: {
//         space_savings: {
//             total: number;
//             total_percent: number;
//         };
//     };
//     space: {
//         size: number;
//         used: number;
//     };
// };

type EstimationEc2Type = {
    resourceType: string;
    sqlSoftwareType: string;
};

type EstimationFSxType = {
    storageCapacity: number;
    throughput: number;
    iops: number;
    deploymentOption: string;
    storageType: string;
};

type EstimationEbsType = {
    id: string;
    size: number;
    throughput: number;
    iops: number;
    volumeType: string;
}[];

async function getTopology(
    accountId: string,
    region: string,
    resourceId: string,
    resourceData: ResourceDetails,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string,
    shouldQueryFullTopology: boolean = false
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
        awsAccount: awsAccountId || '',
        region: AWS_REGIONS.has(region) ? AWS_REGIONS.get(region)! : region,
        serverType: SERVER_TYPE_MAPPING.get(resourceType)!,
        serverInstallationMode: sqlDeploymentType !== undefined ? sqlDeploymentType : '',
        fileSystemId: fileSystemId!,
        fileSystemType:
            storageType !== undefined
                ? storageType === STORAGE_TYPE.FSXN
                    ? FileSystemTypes.FSXONTAP
                    : storageType
                : '',
        vpcId: undefined,
        ec2Details: []
    };

    if (node1InstanceId && shouldQueryFullTopology) {
        let vpcId;
        let fileSystemStatus;
        let fileSystemName;
        let fileSystemDeploymentMode;
        let fileSystemStorageCapacity;
        let fileSystemThroughputCapacity;
        let subnetIds: Array<string> | undefined;
        let availabilityZones: Array<string> | undefined;
        let vpcCidr: string | undefined;
        let fileSystemTags;
        try {
            if (fileSystemId) {
                const fsxInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] });
                const [fileSystem = {}] = fsxInfo?.FileSystems || []; // first item in the list
                ({
                    VpcId: vpcId,
                    Tags: fileSystemTags,
                    OntapConfiguration: {
                        DeploymentType: fileSystemDeploymentMode = undefined,
                        ThroughputCapacity: fileSystemThroughputCapacity = undefined
                    } = {},
                    Lifecycle: fileSystemStatus,
                    StorageCapacity: fileSystemStorageCapacity,
                    SubnetIds: subnetIds
                } = fileSystem);

                fileSystemName = fileSystemTags?.reduce((a = '', tag) => (tag.Key === 'Name' ? tag.Value : a), '');

                const { Subnets: subnets } = await describeSubnets(credentialsId, region, {
                    SubnetIds: subnetIds
                });
                availabilityZones = subnets?.map(subnetId => subnetId?.AvailabilityZone as string);
                const vpcParams: DescribeVpcsCommandInput = {
                    VpcIds: [vpcId!]
                };

                const { Vpcs: [vpc = {}] = [] } = await describeVpc(credentialsId, region, vpcParams);
                vpcCidr = vpc?.CidrBlock;
                logger.info('availabilityZones', availabilityZones);
            } else {
                logger.error(`FSX ID not found for resource ${resourceId}`);
            }
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
                        const [firstBlockDeviceMapping = {}] = standbyNode.BlockDeviceMappings || [];
                        ({ Ebs: { VolumeId: standbyVolumeId = undefined } = {} } = firstBlockDeviceMapping);
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
            const { Vpcs: [firstVpc = {}] = [] } = await describeVpc(credentialsId, region, {
                VpcIds: [vpcId]
            });
            vpcName = findResourceNameFromTags(firstVpc?.Tags);
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
    resourceDetail?: ResourceDetails,
    databaseInstanceDetails?: DatabaseInstance,
    version?: string
): Promise<StoragePerStorageTypeResponseType | undefined> {
    logger.info('Getting storage data:', { resourceDetail, databaseInstanceDetails, version });

    try {
        let region;
        let fsxnId;
        let credentialsId;
        let fsxwId;
        let ebsVolumeIds;
        let metadata;
        let totalSize = 0;
        let totalUsed;
        let totalSpaceSavings;
        let totalSpaceSavingsPercentage;
        let storageProtocol;

        if (version === VERSION_2_0 && databaseInstanceDetails) {
            ({
                region,
                fsxn_ids: fsxnId,
                credentials_id: credentialsId,
                fsxwId,
                ebsVolumeIds,
                storage_protocol: storageProtocol
            } = databaseInstanceDetails);
        } else if (resourceDetail) {
            ({
                region,
                co_relation_id: fsxnId,
                credentials_id: credentialsId,
                fsxwId,
                ebsVolumeIds,
                metadata
            } = resourceDetail);
            ({ storageProtocol } = metadata as unknown as Metadata);
        }
        ebsVolumeIds = ebsVolumeIds || [];

        const response = {} as StoragePerStorageTypeResponseType;
        if (fsxnId && region && credentialsId) {
            ({ totalSize, totalUsed, totalSpaceSavings, totalSpaceSavingsPercentage } =
                await calculateFsxnStorageEfficiencyUsingCloudwatch(region, credentialsId, fsxnId));
            response.fsxn = {
                size: numeral(`${totalSize}GiB`).value() || 0,
                used: totalUsed,
                spaceSavings: totalSpaceSavings,
                spaceSavingsPercentage: totalSpaceSavingsPercentage,
                protocol: storageProtocol ? storageProtocol.split(',') : []
            };
        }
        if (fsxwId && region && credentialsId) {
            ({ totalSize, totalUsed, totalSpaceSavings, totalSpaceSavingsPercentage } =
                await calculateFsxwStorageEfficiencyUsingCloudwatch(region, credentialsId, fsxwId));
            response.fsxw = {
                size: numeral(`${totalSize}GiB`).value() || 0,
                used: totalUsed,
                spaceSavings: totalSpaceSavings,
                spaceSavingsPercentage: totalSpaceSavingsPercentage
            };
        }
        if (ebsVolumeIds?.length && region && credentialsId) {
            const storageData = await getEbsResourceInfo(credentialsId, region, ebsVolumeIds);
            totalSize = storageData.reduce((acc, { size }) => acc + size, 0);
            response.ebs = { size: numeral(`${totalSize}GiB`).value() || 0 };
        }

        return response;
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

// async function getStorageData(
//     resourceDetail: ResourceDetails,
//     activeNodeInstanceId: string
// ): Promise<StorageResponseType | undefined> {
//     logger.info('Getting storage data:', { resourceDetail, activeNodeInstanceId });

//     try {
//         const { region, co_relation_id: fileSystemId, credentials_id: credentialsId, metadata } = resourceDetail;

//         const { stackname } = metadata as unknown as Metadata;

//         const info = await getStorageDataUsingSSM(
//             credentialsId,
//             region!,
//             fileSystemId!,
//             'storage/volumes',
//             `tiering.object_tags="wlmDeploymentId=${stackname?.replaceAll('-', '_')}"`,
//             'fields=efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used',
//             activeNodeInstanceId
//         );

//         logger.info(`Storage data for volumes with deploymentId ${stackname}:`, info);

//         let totalSize = 0;
//         let totalUsed = 0;
//         let totalSpaceSavings = 0;
//         info?.records?.forEach(({ efficiency, space }: VolumeSpaceRecord) => {
//             const { size, used } = space;
//             const { total } = efficiency.space_savings;

//             totalSize += size;
//             totalUsed += used;
//             totalSpaceSavings += total;
//         });

//         return {
//             size: totalSize,
//             used: totalUsed,
//             spaceSavings: totalSpaceSavings
//         };
//     } catch (error) {
//         const errorMessage = `Error while getting storage savings for resource ${resourceDetail} ${JSON.stringify(
//             error
//         )}`;
//         let { message } = error as { message: string };
//         if (message?.toLocaleLowerCase().includes('ThrottlingException: Rate exceeded'.toLowerCase())) {
//             message += '. Retry the operation.';
//             throw createError(HttpErrorCodes.SERVICE_UNAVAILABLE, message);
//         }
//         throw createError(HttpErrorCodes.SERVICE_UNAVAILABLE, errorMessage);
//     }
// }

async function getProtectionStatus(
    activeNodeInstanceId: string,
    instanceName: string,
    resourceDetail?: ResourceDetails,
    databaseInstanceDetails?: DatabaseInstance,
    version?: string,
    isInstanceRunning: boolean = true
): Promise<ProtectionPerStorageTypeResponseType | undefined> {
    logger.info('Get protection status', { resourceDetail });

    let region;
    let fsxnId;
    let credentialsId;
    let fsxwId;
    let ebsVolumeIds;
    let id;

    if (version === VERSION_2_0 && databaseInstanceDetails) {
        ({
            database_instance_id: id,
            fsxn_ids: fsxnId,
            region,
            credentials_id: credentialsId,
            fsxwId,
            ebsVolumeIds
        } = databaseInstanceDetails);
    } else if (resourceDetail) {
        ({ id, region, co_relation_id: fsxnId, credentials_id: credentialsId, fsxwId, ebsVolumeIds } = resourceDetail);
    }

    if (!region || !credentialsId) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Region or credentials id is not found for resource ${id}. region: ${region}, credentils Id:  ${credentialsId}`
        );
    }

    try {
        const [nativeSqlProtection, fsxnBackup, ontapProtection, fsxwBackup, ebsBackup] = await Promise.all([
            ...(isInstanceRunning
                ? [getNativeSQLProtection(credentialsId, region, activeNodeInstanceId, instanceName)]
                : [Promise.resolve()]), // Fetch server metadata

            fsxnId ? isFsxnAwsBackupEnabled(credentialsId, region, fsxnId, activeNodeInstanceId) : Promise.resolve(),
            fsxnId
                ? getOntapVolumesSnapshotCount(credentialsId, region, fsxnId, activeNodeInstanceId)
                : Promise.resolve(),
            fsxwId ? isFsxwAwsBackupEnabled(credentialsId, region, fsxwId) : Promise.resolve(),
            ebsVolumeIds ? isEbsAwsBackupEnabled(credentialsId, region, ebsVolumeIds) : Promise.resolve() // returns true if backup is enabled on any of the ebs ID associated with the resource; revisit this to return information for each ebs
        ]);

        return {
            isSqlNativeEnabled: Boolean(nativeSqlProtection),
            isAwsBackupEnabled: {
                fsxn: Boolean(fsxnBackup),
                fsxw: Boolean(fsxwBackup),
                ebs: Boolean(ebsBackup)
            },
            isFsxOntapSnapshotsEnabled: Boolean(ontapProtection),
            protectedDatabases: Number.isNaN(Number(nativeSqlProtection)) ? 0 : Number(nativeSqlProtection)
        };
    } catch (error) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while getting protection status: ${resourceDetail} ${error}`
        );
    }
}

async function getBillingOrPriceEstimation(
    resourceDetail: ResourceDetails,
    activeNodeInstanceId?: string,
    isManagedResource?: boolean
) {
    logger.info('Get AWS resources billing or cost data:', {
        resourceDetail,
        activeNodeInstanceId,
        isManagedResource
    });
    const promises = [];
    if (isManagedResource) {
        promises.push(
            getBilling(resourceDetail).catch(error => {
                logger.error('Failed to get billing data for resource: :', JSON.stringify(error));
            })
        );
    }
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
        const {
            region,
            co_relation_id: fsxnId,
            credentials_id: credentialsId,
            metadata,
            ebsVolumeIds,
            fsxwId
        } = resourceDetail;
        const { sqlDeploymentType } = metadata as unknown as Metadata;

        if (!region) {
            throw new Error('Unable to fetch usage estimation data as region is not available');
        }

        const [ec2Info, fsxnInfo, ebsInfo, fsxwInfo] = await Promise.all([
            getEc2ResourceInfo(credentialsId, region, activeNodeInstanceId),
            ...(fsxnId ? [getFsxResourceInfo(credentialsId, region, fsxnId!)] : [Promise.resolve()]),
            ...(ebsVolumeIds && !isEmpty(ebsVolumeIds)
                ? [getEbsResourceInfo(credentialsId, region, ebsVolumeIds)]
                : [Promise.resolve()]),
            ...(fsxwId ? [getFsxResourceInfo(credentialsId, region, fsxwId!)] : [Promise.resolve()])
        ]);

        const ec2ResourceInfo = ec2Info as EstimationEc2Type;
        const fsxnResourceInfo = fsxnInfo as EstimationFSxType;
        const ebsResourceInfo = ebsInfo as EstimationEbsType;
        const fsxwResourceInfo = fsxwInfo as EstimationFSxType;

        const pricingRequest: PricingServiceRequestType = {
            compute: {
                regionCode: region!,
                instanceType: ec2ResourceInfo.resourceType,
                sqlDeploymentMode: sqlDeploymentType?.toLowerCase() === FCI ? FCI : STANDALONE,
                sqlSoftwareType: ec2ResourceInfo.sqlSoftwareType
            },
            ...(fsxnResourceInfo && {
                fsxnStorage: {
                    regionCode: region!,
                    storageCapacity: fsxnResourceInfo.storageCapacity,
                    throughput: fsxnResourceInfo.throughput,
                    iops: fsxnResourceInfo.iops,
                    deploymentOption: fsxnResourceInfo.deploymentOption,
                    diskSize: 0 // As we are calculating post deployment cost usage, we don't need disk size, we can use storageCapacity instead.
                }
            }),
            ...(ebsResourceInfo && {
                ebsStorage: {
                    regionCode: region!,
                    ebsResourceInfo: ebsResourceInfo || []
                }
            }),
            vpc: {
                regionCode: region!
            },
            ...(fsxwResourceInfo && {
                fsxwStorage: {
                    regionCode: region!,
                    storageCapacity: fsxwResourceInfo.storageCapacity,
                    throughput: fsxwResourceInfo.throughput,
                    iops: fsxwResourceInfo.iops,
                    deploymentOption: fsxwResourceInfo.deploymentOption,
                    storageType: fsxwResourceInfo.storageType,
                    diskSize: 0 // As we are calculating post deployment cost usage, we don't need disk size, we can use storageCapacity instead.
                }
            })
        };

        const pricingResponse: PricingServiceResponseType = await calculatePrice(
            pricingRequest.compute,
            pricingRequest.fsxnStorage,
            pricingRequest.vpc,
            pricingRequest.ebsStorage,
            pricingRequest.fsxwStorage
        );
        return {
            compute: pricingResponse?.compute || 0,
            storage: {
                fsxn:
                    (pricingResponse?.fsxnStorage?.capacityCost || 0) +
                    (pricingResponse?.fsxnStorage?.operationalCost || 0),
                fsxw:
                    (pricingResponse?.fsxwStorage?.capacityCost || 0) +
                    (pricingResponse?.fsxwStorage?.operationalCost || 0),
                ebs: pricingResponse.ebsStorage?.ebsStorageCost,
                ebsBreakdownByVolumeType: pricingResponse.ebsStorage?.ebsBreakdownByVolumeType
            },
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
    const {
        Reservations: [
            { Instances: [{ InstanceType: resourceType = undefined, ImageId: imageId = undefined } = {}] = [] } = {}
        ] = []
    } = ec2Info;
    const amiInfo = await getAmis(credentialsId, region, { ImageIds: [imageId!] });
    logger.debug('Estimation info for AMI:', amiInfo);

    const { Images: [{ PlatformDetails: sqlPlatform = '' } = {}] = [] } = amiInfo;

    let sqlSoftwareType: string;

    switch (sqlPlatform) {
        case 'Windows with SQL Server Standard':
            sqlSoftwareType = SQL_STD;
            break;
        case 'Windows with SQL Server Enterprise':
            sqlSoftwareType = SQL_ENT;
            break;
        case 'Windows with SQL Server Web':
            sqlSoftwareType = SQL_WEB;
            break;
        default:
            sqlSoftwareType = CUSTOM;
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
    logger.info('Getting FSx resource info:', { credentialsId, region, filesystemId });

    const fsxInfo = await describeFSx(credentialsId, region, { FileSystemIds: [filesystemId] });
    logger.info('Estimation info for FSx:', fsxInfo);

    const [{ StorageCapacity, OntapConfiguration, StorageType, WindowsConfiguration }] = fsxInfo?.FileSystems || [];
    const storageCapacity = StorageCapacity || 0;
    const throughput = OntapConfiguration?.ThroughputCapacity || WindowsConfiguration?.ThroughputCapacity;
    const iops = OntapConfiguration?.DiskIopsConfiguration?.Iops || WindowsConfiguration?.DiskIopsConfiguration?.Iops;
    const deploymentOption = OntapConfiguration?.DeploymentType || WindowsConfiguration?.DeploymentType;

    return {
        storageCapacity,
        throughput: throughput!,
        iops: iops!,
        deploymentOption: deploymentOption!,
        storageType: StorageType!
    };
}

async function getEbsResourceInfo(
    credentialsId: string,
    region: string,
    ebsVolumeIds: string[]
): Promise<EstimationEbsType> {
    logger.info('Getting EBS resource info:', { credentialsId, region, ebsVolumeIds });

    const volumes = await describeVolumes(credentialsId, region, { VolumeIds: ebsVolumeIds });
    if (!volumes.Volumes || volumes.Volumes.length === 0) {
        throw new Error(`Volumes ${ebsVolumeIds} not found`);
    }

    const ebsVolumes = volumes?.Volumes || [];
    return ebsVolumes.map(({ VolumeId, Size: size, VolumeType: volumeType, Iops: iops, Throughput: throughput }) => ({
        id: VolumeId!,
        size: size!,
        throughput: throughput!,
        iops: iops!,
        volumeType: volumeType!
    }));
}

async function getDatabaseHostsSummary(
    accountId: string,
    fields?: string,
    nextToken?: string,
    awsRegion?: string,
    customerCredentialsId?: string,
    vpcId?: string,
    fsxId?: string
): Promise<DatabaseHostSummaryPerStorageTypeListResponseType> {
    logger.info(
        'Fetching all database hosts deployed in account ',
        accountId,
        fields,
        nextToken,
        awsRegion,
        customerCredentialsId,
        vpcId,
        fsxId
    );

    const resourceDetails = await listResources(
        accountId,
        undefined,
        customerCredentialsId,
        awsRegion,
        RESOURCESTYPE.MSSQL,
        fsxId,
        undefined,
        API_PAGE_SIZE,
        nextToken
    );

    if (isEmpty(resourceDetails)) {
        logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    const databaseHosts: DatabaseHostSummaryPerStorageTypeResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails.map(async resourceDetail => {
                const { resource_id: resourceId } = resourceDetail;

                const databaseHostDetails = await getDatabaseHostSummary(accountId, resourceId, fields, resourceDetail);
                if (!vpcId || vpcId === databaseHostDetails?.topology?.vpcId) {
                    databaseHosts.push(databaseHostDetails);
                }
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
    resourceDetail?: ResourceDetails,
    isManagedResource: boolean = true
): Promise<DatabaseHostSummaryPerStorageTypeResponseType> {
    logger.info('Fetching details about a database installtion ', accountId, databaseHostId, fields, isManagedResource);

    if (isEmpty(resourceDetail)) {
        [resourceDetail] = await listResources(accountId, databaseHostId);
    }
    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }

    const databaseHostDetails: DatabaseHostSummaryPerStorageTypeResponseType = {
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

    const shouldQueryServerDetails = fieldsValues?.includes(
        DatabaseHostsQueryFields.SERVER_DETAILS.toLocaleLowerCase()
    );
    const shouldQueryTopology = fieldsValues?.includes(DatabaseHostsQueryFields.TOPOLOGY);
    const getPerformance = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE);
    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE);
    const getUsageEstimation = fieldsValues?.includes(DatabaseHostsQueryFields.USAGE_ESTIMATION.toLocaleLowerCase());
    const getResourceutilization = fieldsValues?.includes(
        DatabaseHostsQueryFields.RESOURCE_UTILIZATION.toLocaleLowerCase()
    );
    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);

    const {
        resource_id: resourceId,
        resource_name: resourceName,
        region,
        credentials_id: credentialsId,
        metadata
    } = resourceDetail;
    try {
        const { node1InstanceId, node2InstanceId, creationDate, userDatabase = [] } = metadata as unknown as Metadata;
        // Check SSM Connection status
        const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId, instanceName } = await getActiveSqlNode(
            credentialsId,
            region!,
            node1InstanceId,
            node2InstanceId,
            resourceId
        );
        let serverDetails: any;
        let topologyData: any;
        let performanceData: any;
        let storageData: any;
        let usageEstimationData: any;
        let resourceUtilizationData: any;
        let protectionData: any;
        const errormessages: { [index: string]: string } = {};
        if (credentialsId && region) {
            [
                serverDetails,
                topologyData,
                performanceData,
                storageData,
                protectionData,
                usageEstimationData,
                resourceUtilizationData
            ] = await Promise.all(
                [
                    ...(isSSMConnected && activeNodeInstanceId && shouldQueryServerDetails
                        ? [getServerDetails(credentialsId, region, activeNodeInstanceId, instanceName)]
                        : [Promise.resolve()]), // Fetch server metadata
                    ...[
                        getTopology(
                            accountId,
                            region,
                            resourceId,
                            resourceDetail,
                            activeNodeInstanceId!,
                            standbyNodeInstanceId,
                            shouldQueryTopology
                        )
                    ],
                    ...(isSSMConnected && getPerformance && activeNodeInstanceId
                        ? [getPerformanceMetrics(credentialsId, region, activeNodeInstanceId, instanceName)]
                        : [Promise.resolve()]), // Fetch io latency data
                    ...(isSSMConnected && getStorageSavings ? [getStorageData(resourceDetail)] : [Promise.resolve()]), // Fetch storage savings data
                    ...(isSSMConnected && getProtection && activeNodeInstanceId
                        ? [getProtectionStatus(activeNodeInstanceId, instanceName, resourceDetail)]
                        : [Promise.resolve()]), // Fetch protection status
                    ...(getUsageEstimation
                        ? [getBillingOrPriceEstimation(resourceDetail, activeNodeInstanceId, isManagedResource)]
                        : [Promise.resolve()]), // Fetch pricing estimate data
                    ...(isSSMConnected && getResourceutilization && activeNodeInstanceId
                        ? [getAllResourceUtilisationDetails(credentialsId, region, activeNodeInstanceId, instanceName)]
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
            if (
                (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') &&
                shouldQueryServerDetails &&
                shouldQueryTopology
            ) {
                serverDetails.dbCount = serverDetails?.dbCount || 0;
                serverDetails.dbCount += userDatabase.length;
                if (topologyData?.serverInstallationMode === SqlServerDeploymentModel.SQL_STANDALONE_SHORT) {
                    delete serverDetails?.clusterName;
                    serverDetails.activeNode = resourceName || '';
                    serverDetails.nodeNames = [resourceName || ''];
                } else {
                    serverDetails.clusterName = resourceName || '';
                }
            }
            databaseHostDetails.status = isSSMConnected ? ServerState.UP : ServerState.DOWN;
            if (shouldQueryServerDetails && serverDetails) {
                databaseHostDetails.databaseCount = serverDetails?.dbCount || 0;
                databaseHostDetails.databaseServer = serverDetails;
                serverDetails.creationDate = creationDate || '';
                // CreationDate needs to be picked up from resource table: https://jira.ngage.netapp.com/browse/DBS-1586
            }
            databaseHostDetails.id = resourceId;
            databaseHostDetails.name = resourceName || '';
            databaseHostDetails.topology = topologyData!;
            databaseHostDetails.performance = getPerformance
                ? { assessment: performanceData?.assessment, rwMetrics: performanceData! }
                : {};
            databaseHostDetails.storage = storageData!;
            databaseHostDetails.estimatedUsageCost = usageEstimationData!;
            databaseHostDetails.ebsResourceInfo = usageEstimationData?.storage?.ebsBreakdownByVolumeType || [];
            databaseHostDetails.sqlServerDeploymentType = resourceDetail?.sqlServerDeploymentType || '';
            if (resourceDetail?.clusterNodeDetails && resourceDetail?.clusterNodeDetails?.length > 0) {
                databaseHostDetails.clusterNodeDetails = resourceDetail?.clusterNodeDetails;
            }
            if (getResourceutilization && resourceUtilizationData) {
                databaseHostDetails.resourceUtilization = {
                    cpu: resourceUtilizationData.cpuUtilization! || {},
                    memory: resourceUtilizationData.memoryUtilization! || {},
                    disk: resourceUtilizationData.diskUtilization! || {}
                };
            }
            if (getProtection && protectionData) {
                databaseHostDetails.protection = protectionData;
            }
            if (!isEmpty(errormessages)) {
                databaseHostDetails.errors = errormessages;
            }
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
    const { node1InstanceId, node2InstanceId, userDatabase = [] } = metadata as unknown as Metadata;
    if (!region) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Region not found for ${databaseHostId}`);
    }

    if (!fileSystemId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `FSX ID not found for ${databaseHostId}`);
    }

    // Check SSM Connection status
    const { isSSMConnected, activeNodeInstanceId, instanceName } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );

    if (!isSSMConnected) {
        const errorMessage = `Error while fetching database details for ${accountId} ${databaseHostId} due to SSM connection issues.`;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }

    const [{ databases }, backedupDatabases, awsBackup, ontapBackup] = await Promise.all(
        [
            getDataBasesSummary(databaseHostId, activeNodeInstanceId!, instanceName),
            getNativeSQLBackedupDatabases(databaseHostId, activeNodeInstanceId, instanceName),
            isFsxnAwsBackupEnabled(credentialsId, region, fileSystemId, activeNodeInstanceId),
            getOntapVolumesSnapshotCount(credentialsId, region, fileSystemId, activeNodeInstanceId)
        ].map(p => p.catch(error => logger.error(`Error while fetching data: ${error}.`)))
    );
    try {
        const response = databases.map(
            (database: {
                databaseName: string;
                databaseSize: number;
                databaseStatus: string;
                collationName: string;
            }) => ({
                name: database.databaseName,
                size: database.databaseSize,
                status: database.databaseStatus,
                collation: database.collationName,
                type: MSSQL_SYSTEM_DATABASES.includes(database.databaseName.toLowerCase())
                    ? MSSQL_DATABASE_TYPES.SYSTEM
                    : MSSQL_DATABASE_TYPES.USER,
                protection: {
                    isAwsBackupEnabled: {
                        fsxn: awsBackup
                    },
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

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            const demoResponse = [...response, ...userDatabase];
            return {
                count: demoResponse.length,
                nextToken: '',
                items: demoResponse
            };
        }
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

async function getNodeTopology(
    accountId: string,
    region: string,
    resourceId: string,
    resourceData: ResourceDetails,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string,
    shouldQueryFullTopology: boolean = false
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

    const { credentials_id: credentialsId, cloud_provider_account_id: awsAccountId, metadata } = resourceData;

    const { node1InstanceId, node2InstanceId, activeDirectoryName, activeDirectoryAddress } =
        metadata as unknown as Metadata;

    let nodeTopologyData: any = {
        awsAccount: awsAccountId || '',
        region: AWS_REGIONS.has(region) ? AWS_REGIONS.get(region)! : region,
        vpcId: undefined,
        ec2Details: []
    };

    if (node1InstanceId && shouldQueryFullTopology) {
        let vpcId: string | undefined;
        let vpcCidr: string | undefined;
        let nodeStatus: string | undefined;
        try {
            if (activeNodeInstanceId) {
                const ec2InstanceDetails = await describeInstance(credentialsId, region, {
                    InstanceIds: [activeNodeInstanceId]
                });
                const reservations = ec2InstanceDetails?.Reservations || []; // first item in the list
                if (reservations.length > 0) {
                    const instances = reservations[0].Instances || [];
                    if (instances.length > 0) {
                        vpcId = instances[0].VpcId;
                        nodeStatus = instances[0].State?.Name;
                    }
                }
                const vpcParams: DescribeVpcsCommandInput = {
                    VpcIds: [vpcId!]
                };

                const { Vpcs: [vpc = {}] = [] } = await describeVpc(credentialsId, region, vpcParams);
                vpcCidr = vpc?.CidrBlock;
            } else {
                logger.error(`FSX ID not found for resource ${resourceId}`);
            }
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
                        const [firstBlockDeviceMapping = {}] = standbyNode.BlockDeviceMappings || [];
                        ({ Ebs: { VolumeId: standbyVolumeId = undefined } = {} } = firstBlockDeviceMapping);
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
            const { Vpcs: [firstVpc = {}] = [] } = await describeVpc(credentialsId, region, {
                VpcIds: [vpcId]
            });
            vpcName = findResourceNameFromTags(firstVpc?.Tags);
        }
        nodeTopologyData = {
            awsAccount: awsAccountId || '',
            region: AWS_REGIONS.has(region) ? AWS_REGIONS.get(region)! : region,
            ...(vpcId && { vpcId }),
            ...(vpcName && { vpcName }),
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
                        ...(activeSubnetId && { subnetId: activeSubnetId }),
                        ...(nodeStatus && { status: nodeStatus })
                    }
                ]
            }),
            ...(activeDirectoryDetails && { activeDirectoryDetails })
        };
        if (activeNodeInstanceId && standbyNodeInstanceId) {
            nodeTopologyData.ec2Details?.push({
                id: standbyNodeInstanceId!,
                name: standbyNodeInstanceName,
                ebsVolumeId: standbyVolumeId || '',
                ...(standbyInstanceType && { instanceType: standbyInstanceType }),
                ...(standbyAvailabilityZone && { availabilityZone: standbyAvailabilityZone }),
                ...(standbySubnetId && { subnetId: standbySubnetId })
            });
        }
    }
    logger.debug('Topology data', nodeTopologyData);
    return nodeTopologyData;
}

async function getDatabaseHostsSummaryV2(
    accountId: string,
    fields?: string,
    nextToken?: string,
    awsRegion?: string,
    customerCredentialsId?: string,
    vpcId?: string,
    fsxId?: string
) {
    logger.info(
        'Fetching all database hosts deployed in account ',
        accountId,
        fields,
        nextToken,
        awsRegion,
        customerCredentialsId,
        vpcId,
        fsxId
    );

    const resourceDetails = await listResources(
        accountId,
        undefined,
        customerCredentialsId,
        awsRegion,
        RESOURCESTYPE.MSSQL,
        fsxId,
        undefined,
        API_PAGE_SIZE,
        nextToken
    );

    if (isEmpty(resourceDetails)) {
        logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    const databaseHosts: DatabaseHostSummaryForMultiInstanceResponseType[] = [];
    try {
        await Promise.all(
            resourceDetails.map(async resourceDetail => {
                const { resource_id: resourceId } = resourceDetail;

                const databaseHostDetails: any = await getDatabaseHostSummaryV2(
                    accountId,
                    resourceId,
                    fields,
                    resourceDetail
                );
                databaseHosts.push(databaseHostDetails);
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

async function getDatabaseInstanceTopology(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseInstances: any,
    shouldQueryFullTopology: boolean = false
) {
    logger.info(
        'Fetching database topology data',
        accountId,
        credentialsId,
        activeNodeInstanceId,
        databaseInstances.instance_name
    );

    const {
        fsxn_ids: fileSystemId,
        storageType,
        database_instance_id: databaseInstanceDetails,
        database_deployment_type: databaseDeploymentType,
        database_type: databaseType
    } = databaseInstances;

    let topologyData = {
        serverType: databaseType,
        serverInstallationMode: databaseDeploymentType !== undefined ? databaseDeploymentType : '',
        fileSystemId: fileSystemId!,
        fileSystemType:
            storageType !== undefined
                ? storageType === STORAGE_TYPE.FSXN
                    ? FileSystemTypes.FSXONTAP
                    : storageType
                : FileSystemTypes.FSXONTAP
    };
    if (activeNodeInstanceId && shouldQueryFullTopology) {
        let fileSystemStatus;
        let fileSystemName;
        let fileSystemDeploymentMode;
        let fileSystemStorageCapacity;
        let fileSystemThroughputCapacity;
        let subnetIds;
        let availabilityZones: Array<string> | undefined;
        let fileSystemTags;
        try {
            if (fileSystemId) {
                const fsxInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] });
                const [fileSystem = {}] = fsxInfo?.FileSystems || []; // first item in the list
                ({
                    Tags: fileSystemTags,
                    OntapConfiguration: {
                        DeploymentType: fileSystemDeploymentMode = undefined,
                        ThroughputCapacity: fileSystemThroughputCapacity = undefined
                    } = {},
                    Lifecycle: fileSystemStatus,
                    StorageCapacity: fileSystemStorageCapacity,
                    SubnetIds: subnetIds
                } = fileSystem);

                fileSystemName = fileSystemTags?.reduce((a = '', tag) => (tag.Key === 'Name' ? tag.Value : a), '');

                const { Subnets: subnets } = await describeSubnets(credentialsId, region, {
                    SubnetIds: subnetIds
                });
                availabilityZones = subnets?.map(subnetId => subnetId?.AvailabilityZone as string);

                logger.info('availabilityZones', availabilityZones);
            } else {
                logger.error(`FSX ID not found for resource ${databaseInstanceDetails}`);
            }
        } catch (error) {
            logger.error(`Error while fetching details for fsx. Error: ${error}`);
        }

        topologyData = {
            ...topologyData,
            ...(fileSystemName && { fileSystemName }),
            ...(fileSystemDeploymentMode && { fileSystemDeploymentMode }),
            ...(fileSystemStatus && { fileSystemStatus }),
            ...(fileSystemStorageCapacity && { fileSystemStorageCapacity }),
            ...(fileSystemThroughputCapacity && { fileSystemThroughputCapacity }),
            ...(availabilityZones && { availabilityZone: availabilityZones })
        };
    }
    return topologyData;
}

async function getDatabseInstanceSummary(
    accountId: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    region: string,
    databaseInstances: DatabaseInstance,
    fields?: string
) {
    logger.info(
        'Fetching summary of database instance',
        accountId,
        credentialsId,
        activeNodeInstanceId,
        region,
        databaseInstances,
        fields
    );

    const {
        database_instance_id: databaseInstanceId,
        database_instance_name: savedDatabaseInstanceName,
        is_default: isdefaultInstance,
        metadata,
        created_time: creationDate,
        database_deployment_type: databaseDeploymentType,
        instanceState
    } = databaseInstances;

    const { userDatabase = [] } = metadata as unknown as Metadata;

    const databaseInstanceName = getDatabsaeInstanceName(savedDatabaseInstanceName, isdefaultInstance);

    let fieldsValues: Array<string> = [];

    if (fields) {
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const shouldQueryTopology = fieldsValues?.includes(DatabaseHostsQueryFields.TOPOLOGY);

    const shouldQueryServerDetails = fieldsValues?.includes(
        DatabaseHostsQueryFields.SERVER_DETAILS.toLocaleLowerCase()
    );
    const shouldQueryDatabaseTopology = fieldsValues?.includes(
        DatabaseHostsQueryFields.DATABASE_INSTANCE_TOPOLOGY.toLocaleLowerCase()
    );
    const getPerformance = fieldsValues?.includes(DatabaseHostsQueryFields.PERFORMANCE);
    const getStorageSavings = fieldsValues?.includes(DatabaseHostsQueryFields.STORAGE);
    const getResourceutilization = fieldsValues?.includes(
        DatabaseHostsQueryFields.RESOURCE_UTILIZATION.toLocaleLowerCase()
    );
    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);

    const databaseInstanceDetails: DatabaseHostInstanceSummaryResponseType = {
        databaseInstanceId,
        databaseInstanceName: savedDatabaseInstanceName,
        status: '',
        databaseCount: 0
    };

    let serverDetails: any;
    let databaseInstancetopologyData: any;
    let performanceData: any;
    let storageData: any;
    let resourceUtilizationData: any;
    let protectionData: any;
    const errormessages: { [index: string]: string } = {};

    try {
        [
            serverDetails,
            databaseInstancetopologyData,
            performanceData,
            storageData,
            protectionData,
            resourceUtilizationData
        ] = await Promise.all(
            [
                ...(shouldQueryServerDetails && instanceState.toLocaleLowerCase() === 'running'
                    ? [getServerDetails(credentialsId, region, activeNodeInstanceId, databaseInstanceName)]
                    : [Promise.resolve()]), // Fetch server metadata
                ...(shouldQueryDatabaseTopology
                    ? [
                          getDatabaseInstanceTopology(
                              accountId,
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              databaseInstances,
                              shouldQueryTopology
                          )
                      ]
                    : [Promise.resolve()]),
                ...(getPerformance && instanceState.toLocaleLowerCase() === 'running'
                    ? [getPerformanceMetrics(credentialsId, region, activeNodeInstanceId, databaseInstanceName)]
                    : [Promise.resolve()]), // Fetch io latency data
                ...(getStorageSavings
                    ? [getStorageData(undefined, databaseInstances, VERSION_2_0)]
                    : [Promise.resolve()]), // Fetch storage savings data
                ...(getProtection
                    ? [
                          getProtectionStatus(
                              activeNodeInstanceId,
                              databaseInstanceName,
                              undefined,
                              databaseInstances,
                              VERSION_2_0,
                              instanceState.toLocaleLowerCase() === 'running'
                          )
                      ]
                    : [Promise.resolve()]), // Fetch protection status
                ...(getResourceutilization && instanceState.toLocaleLowerCase() === 'running'
                    ? [
                          getAllResourceUtilisationDetails(
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              databaseInstanceName
                          )
                      ]
                    : [Promise.resolve()])
            ].map((p, index) =>
                p.catch(error => {
                    if (DATABASE_INSTANCE_INDEX_MAPPING[index]) {
                        errormessages[DATABASE_INSTANCE_INDEX_MAPPING[index]] = JSON.stringify(error);
                    }
                    logger.error(`Error while fetching data: ${error}.`);
                })
            )
        );
    } catch (error) {
        logger.error(
            `Error while fetching database instance summary ${accountId}, ${databaseInstanceId},  ${savedDatabaseInstanceName}, ${error}`
        );
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database instance summary ${accountId},${databaseInstanceId}, ${savedDatabaseInstanceName} ${error}`
        );
    }

    if (
        (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') &&
        shouldQueryServerDetails &&
        shouldQueryTopology
    ) {
        serverDetails.dbCount = serverDetails?.dbCount || 0;
        serverDetails.dbCount += userDatabase.length;
    }
    databaseInstanceDetails.status = ServerState.UP;
    if (shouldQueryServerDetails && serverDetails) {
        databaseInstanceDetails.databaseCount = serverDetails?.dbCount || 0;
        databaseInstanceDetails.databaseServer = serverDetails;
        serverDetails.creationDate = creationDate || '';
    }

    databaseInstanceDetails.databaseInstanceTopology = databaseInstancetopologyData;
    databaseInstanceDetails.performance = getPerformance
        ? { assessment: performanceData?.assessment, rwMetrics: performanceData! }
        : {};
    databaseInstanceDetails.storage = storageData!;
    databaseInstanceDetails.sqlServerDeploymentType = databaseDeploymentType || '';

    if (getResourceutilization && resourceUtilizationData) {
        databaseInstanceDetails.resourceUtilization = {
            cpu: resourceUtilizationData.cpuUtilization! || {},
            memory: resourceUtilizationData.memoryUtilization! || {},
            disk: resourceUtilizationData.diskUtilization! || {}
        };
    }
    if (getProtection && protectionData) {
        databaseInstanceDetails.protection = protectionData;
    }
    if (!isEmpty(errormessages)) {
        databaseInstanceDetails.errors = errormessages;
    }

    return databaseInstanceDetails;
}

async function getDatabaseInstancesDetails(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instancesManaged: Array<{ database_instance_name: string; is_default: boolean }>,
    resourceId?: string
) {
    logger.info('Getting database Instances details for resource', {
        credentialsId,
        region,
        activeNodeInstanceId,
        instancesManaged,
        resourceId
    });
    const instanceDetails = await getAllInstanceDetails(credentialsId, region, [activeNodeInstanceId]);
    const managedInstancesName = instancesManaged.map(
        (item: { database_instance_name: string; is_default: boolean }) => ({
            instanceName: item.database_instance_name,
            isDefault: item.is_default
        })
    );

    const updatedInstanceDetails = instanceDetails.map((item: { instanceName: string }) => {
        const managedInstance = managedInstancesName.find(
            (managedItem: { instanceName: string }) => managedItem.instanceName === item.instanceName
        );
        const isManaged = !!managedInstance;
        const isDefault = isManaged && managedInstance.isDefault;
        return { ...item, isManaged, isDefault };
    });
    logger.debug('Database instances details', updatedInstanceDetails);
    return updatedInstanceDetails;
}

async function getDatabaseHostSummaryV2(
    accountId: string,
    databaseHostId: string,
    fields?: string,
    resourceDetail?: ResourceDetails,
    isManagedResource: boolean = true
) {
    logger.info('Fetching details about a database host ', accountId, databaseHostId, fields, isManagedResource);
    if (isEmpty(resourceDetail)) {
        [resourceDetail] = await listResources(accountId, databaseHostId);
    }
    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }

    const {
        resource_id: resourceId,
        resource_name: resourceName,
        region,
        credentials_id: credentialsId,
        metadata
    } = resourceDetail;

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const shouldQueryNodeTopology = fieldsValues?.includes(DatabaseHostsQueryFields.NODE_TOPOLOGY.toLocaleLowerCase());
    const getUsageEstimation = fieldsValues?.includes(DatabaseHostsQueryFields.USAGE_ESTIMATION.toLocaleLowerCase());
    const getInstancesDetails = fieldsValues?.includes(DatabaseHostsQueryFields.INSTANCE_DETAILS.toLocaleLowerCase());

    const instancesManaged = await listDatabaseInstances(accountId, { resourceId, credentialsId, region });

    const errormessages: { [index: string]: string } = {};

    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
    const { activeNodeInstanceId, standbyNodeInstanceId, ssmConnectionSatus } = await getActiveSqlNode(
        credentialsId,
        region!,
        node1InstanceId,
        node2InstanceId,
        resourceId
    );

    const databaseHostDetails: DatabaseHostSummaryForMultiInstanceResponseType = {
        id: resourceId,
        name: resourceName || '',
        nodeStatus: 'N/A',
        ssmStatus: ssmConnectionSatus || 'N/A'
    };

    let nodeTopology: any;
    let usageEstimationData: any;
    let databaseInstancesDetail: any;
    try {
        if (credentialsId && region) {
            [databaseInstancesDetail, nodeTopology, usageEstimationData] = await Promise.all(
                [
                    ...(activeNodeInstanceId
                        ? [
                              getDatabaseInstancesDetails(
                                  credentialsId,
                                  region,
                                  activeNodeInstanceId,
                                  instancesManaged,
                                  resourceId
                              )
                          ]
                        : [Promise.resolve()]),
                    ...(shouldQueryNodeTopology && activeNodeInstanceId
                        ? [
                              getNodeTopology(
                                  accountId,
                                  region,
                                  resourceId,
                                  resourceDetail,
                                  activeNodeInstanceId,
                                  standbyNodeInstanceId,
                                  shouldQueryNodeTopology
                              )
                          ]
                        : [Promise.resolve()]),
                    ...(getUsageEstimation && activeNodeInstanceId
                        ? [getBillingOrPriceEstimation(resourceDetail, activeNodeInstanceId, isManagedResource)]
                        : [Promise.resolve()]) // Fetch pricing estimate data
                ].map((p, index) =>
                    p.catch(error => {
                        if (DATABASE_HOSTS_INDEX_MAPPING_V2[index]) {
                            errormessages[DATABASE_HOSTS_INDEX_MAPPING_V2[index]] = JSON.stringify(error);
                        }
                        logger.error(`Error while fetching data: ${error}.`);
                    })
                )
            );

            if (resourceDetail?.clusterNodeDetails && resourceDetail?.clusterNodeDetails?.length > 0 && nodeTopology) {
                const clusterNodeDetails = resourceDetail?.clusterNodeDetails;

                nodeTopology = clusterNodeDetails.map(
                    (node: { ec2InstanceId: any; ec2InstancePrivateIpAddress: any }) => {
                        const correspondingNodeTopology = nodeTopology.find(
                            (topology: { id: string }) => topology.id === node.ec2InstanceId
                        );

                        if (correspondingNodeTopology) {
                            correspondingNodeTopology.privateIpAddress = node.ec2InstancePrivateIpAddress;
                        }

                        return correspondingNodeTopology;
                    }
                );
            }
            databaseHostDetails.nodeStatus = nodeTopology.ec2Details[0].status || 'N/A';
            databaseHostDetails.ssmStatus = 'ONLINE';
            databaseHostDetails.ebsResourceInfo = usageEstimationData?.storage?.ebsBreakdownByVolumeType || [];

            databaseHostDetails.estimatedUsageCost = usageEstimationData;
            if (shouldQueryNodeTopology && nodeTopology) {
                databaseHostDetails.nodeTopology = nodeTopology;
            }
            databaseHostDetails.databaseInstanceDetails = databaseInstancesDetail;
            let instanceResults: any;

            if (
                getInstancesDetails &&
                activeNodeInstanceId &&
                databaseInstancesDetail.length > 0 &&
                credentialsId &&
                region
            ) {
                const runningDatabaseInstances = instancesManaged
                    .filter(instance => {
                        const matchingInstance = databaseInstancesDetail.find(
                            (dbInstance: { instanceName: string; instanceState: string }) =>
                                dbInstance.instanceName === instance.database_instance_name
                        );
                        return matchingInstance !== undefined;
                    })
                    .map(instance => ({
                        ...instance,
                        ...databaseInstancesDetail.find(
                            (dbInstance: { instanceName: string; instanceState: string }) =>
                                dbInstance.instanceState === 'Running'
                        )
                    }));
                if (runningDatabaseInstances.length > 0) {
                    const instancePromises = runningDatabaseInstances.map(async (instance: DatabaseInstance) => {
                        const instanceResult = await getDatabseInstanceSummary(
                            accountId,
                            credentialsId,
                            activeNodeInstanceId,
                            region,
                            instance,
                            fields
                        );
                        return instanceResult;
                    });

                    instanceResults = await Promise.all(instancePromises);
                }
            }

            databaseHostDetails.databaseInstancesSummary = instanceResults;
            return databaseHostDetails;
        }
    } catch (error) {
        logger.error(`Error while fetching database hosts details ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database hosts details ${accountId}, ${error}`
        );
    }
}

export { getDatabaseHostsSummary, getDatabaseHostSummary, getDatabases, getDatabaseHostsSummaryV2, getDatabaseHostSummaryV2 };
