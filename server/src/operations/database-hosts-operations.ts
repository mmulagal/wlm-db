import { STORAGE_TYPE } from '@prisma/client';
import randomize from 'randomatic';
import numeral from 'numeral';
import { DescribeInstancesCommandOutput, DescribeVolumesResult, DescribeVpcsCommandInput } from '@aws-sdk/client-ec2';
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
    VERSION_2_0,
    V2_API_PAGE_SIZE,
    NOT_AVAILABLE,
    ONLINE,
    OFFLINE,
    SQL_SERVICE_STATE,
    UNKNOWN,
    WIN_SQL_EC2_USAGE_OPERATION
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
    getDatabasesCount,
    getActiveNodeAndInstanceDetails
} from './workloads/mssql/mssql-operations';
import {
    isFsxnAwsBackupEnabled,
    getOntapVolumesSnapshotCount,
    getCostAllocationTagFsxResource,
    isFsxwAwsBackupEnabled,
    getMappedOntapVolumes
} from './aws/fsx-operations';
import {
    DatabaseInstance,
    InstanceDetails,
    Metadata,
    ResourceDetails,
    databaseInstanceMetadata
} from '../utils/common-types';
import { calculateBilling, getCostAllocationTags } from './aws/cost-explorer-operations';
import { getCostAllocationTagEC2Resource, isEbsAwsBackupEnabled } from './aws/ec2-operations';
import {
    calculateFsxnStorageEfficiencyUsingCloudwatch,
    calculateFsxwStorageEfficiencyUsingCloudwatch
} from './aws/cloud-watch-operations';
import { convertToBytes, getDatabaseInstanceName, getResourceNameFromTags, isDemo } from '../utils/utils';
import { getEBSVolumesForDemo } from './demo-operations';

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
    0: 'nodeTopology',
    1: 'billing/pricing',
    2: 'instanceSummary'
};
const DATABASE_INSTANCE_INDEX_MAPPING: { [index: number]: string } = {
    0: 'serverDetails',
    1: 'databaseInstancetopologyData',
    2: 'performance',
    3: 'storage',
    4: 'protection',
    5: 'resourceUtilization',
    6: 'databasesCount',
    7: 'nodeTopology'
};

interface MappedOnTapVolumeResponse {
    volumeUuids: string[];
    volumeDBMap: any;
}

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
    id: string;
    storageCapacity: number;
    throughput: number;
    iops: number;
    deploymentOption: string;
    storageType: string;
    diskSize?: number;
}[];

type EstimationEbsType = {
    id: string;
    size: number;
    throughput: number;
    iops: number;
    volumeType: string;
}[];

interface BackupType {
    [key: string]: boolean;
}

const isDemoFlow = isDemo();

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
                    activeNodeInstanceName = isDemo()
                        ? `sqlnode-${randomize('0', 5)}`
                        : getResourceNameFromTags(activeNode.Tags);

                    if (!isEmpty(standbyNode)) {
                        standbyInstanceType = standbyNode.InstanceType;
                        standbyAvailabilityZone = standbyNode.Placement?.AvailabilityZone;
                        standbySubnetId = standbyNode.SubnetId;
                        const [firstBlockDeviceMapping = {}] = standbyNode.BlockDeviceMappings || [];
                        ({ Ebs: { VolumeId: standbyVolumeId = undefined } = {} } = firstBlockDeviceMapping);
                        standbyNodeInstanceName = isDemo()
                            ? `sqlnode-${randomize('0', 5)}`
                            : getResourceNameFromTags(standbyNode.Tags);
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
            vpcName = getResourceNameFromTags(firstVpc?.Tags);
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
            const storageData = await getEbsResourceInfo(credentialsId, region, ebsVolumeIds, [
                databaseInstanceDetails
            ]);
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
    sqlAuthEnabled: boolean = false
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
        const [nativeSqlProtection, protectionResponse, fsxwBackup, ebsBackup] = await Promise.all([
            getNativeSQLProtection(credentialsId, region, activeNodeInstanceId, instanceName, sqlAuthEnabled),
            fsxnId
                ? getProtectionDetails(credentialsId, region, fsxnId, true, activeNodeInstanceId)
                : Promise.resolve(),
            fsxwId ? isFsxwAwsBackupEnabled(credentialsId, region, fsxwId) : Promise.resolve(),
            ebsVolumeIds ? isEbsAwsBackupEnabled(credentialsId, region, ebsVolumeIds) : Promise.resolve() // returns true if backup is enabled on any of the ebs ID associated with the resource; revisit this to return information for each ebs
        ]);

        const awsBackup = protectionResponse ? protectionResponse.awsBackup : {};
        const ontapBackup = protectionResponse ? protectionResponse.ontapBackup : {};
        return {
            isSqlNativeEnabled: Boolean(nativeSqlProtection),
            isAwsBackupEnabled: {
                fsxn: isDemoFlow ? true : checkAllTrue(awsBackup),
                fsxw: Boolean(fsxwBackup),
                ebs: Boolean(ebsBackup)
            },
            isFsxOntapSnapshotsEnabled: isDemoFlow ? true : checkAllTrue(ontapBackup),
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

        const fsxnIds = fsxnId
            ? [fsxnId]
            : resourceDetail.databaseInstanceDetails?.flatMap(f => (f.fsxn_ids ? [f.fsxn_ids] : []));
        const fsxwIds = fsxwId
            ? [fsxwId]
            : resourceDetail.databaseInstanceDetails?.flatMap(f => (f.fsxwId ? [f.fsxwId] : []));

        const [ec2Info, fsxnInfo, ebsInfo, fsxwInfo] = await Promise.all([
            getEc2ResourceInfo(credentialsId, region, activeNodeInstanceId),
            ...(fsxnIds && !isEmpty(fsxnIds)
                ? [getFsxResourceInfo(credentialsId, region, [...new Set(fsxnIds!)])]
                : [Promise.resolve()]),
            ...(ebsVolumeIds && !isEmpty(ebsVolumeIds)
                ? [getEbsResourceInfo(credentialsId, region, ebsVolumeIds, resourceDetail?.databaseInstanceDetails)]
                : [Promise.resolve()]),
            ...(fsxwIds && !isEmpty(fsxwIds)
                ? [getFsxResourceInfo(credentialsId, region, [...new Set(fsxwIds!)])]
                : [Promise.resolve()])
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
                    fsxnResourceInfo: fsxnResourceInfo || []
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
                    fsxwResourceInfo: fsxwResourceInfo || []
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
                fsxn: pricingResponse?.fsxnStorage?.fsxStorageCost,
                fsxw: pricingResponse?.fsxwStorage?.fsxwStorageCost,
                ebs: pricingResponse.ebsStorage?.ebsStorageCost,
                ebsBreakdownByVolumeType: pricingResponse.ebsStorage?.ebsBreakdownByVolumeType,
                fsxnBreakDownById: pricingResponse?.fsxnStorage?.fsxnCostBreakdownById.map(id => ({
                    ...id,
                    size: convertToBytes(id.size!.total, 'GiB')
                })),
                fsxwBreakDownById: pricingResponse?.fsxwStorage?.fsxwCostBreakdownById.map(id => ({
                    ...id,
                    size: convertToBytes(id.size!, 'GiB')
                }))
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
    filesystemIds: string[]
): Promise<EstimationFSxType> {
    logger.info('Getting FSx resource info:', { credentialsId, region, filesystemIds });

    const fsxInfo = await describeFSx(credentialsId, region, { FileSystemIds: filesystemIds });
    logger.info('Estimation info for FSx:', fsxInfo);

    const filesystems = fsxInfo?.FileSystems || [];
    const response = filesystems.map(
        ({ FileSystemId, StorageCapacity, OntapConfiguration, StorageType, WindowsConfiguration }) => {
            const storageCapacity = StorageCapacity || 0;
            const throughput = OntapConfiguration?.ThroughputCapacity || WindowsConfiguration?.ThroughputCapacity;
            const iops =
                OntapConfiguration?.DiskIopsConfiguration?.Iops || WindowsConfiguration?.DiskIopsConfiguration?.Iops;
            const deploymentOption = OntapConfiguration?.DeploymentType || WindowsConfiguration?.DeploymentType;

            return {
                id: FileSystemId!,
                storageCapacity,
                throughput: throughput!,
                iops: iops!,
                deploymentOption: deploymentOption!,
                storageType: StorageType!
            };
        }
    );

    return response;
}

async function getEbsResourceInfo(
    credentialsId: string,
    region: string,
    ebsVolumeIds: string[],
    databaseInstanceDetails?: any
): Promise<EstimationEbsType> {
    logger.info('Getting EBS resource info:', { credentialsId, region, ebsVolumeIds, databaseInstanceDetails });

    let volumes;
    if (isDemo()) {
        const sqlServerDeploymentType = databaseInstanceDetails?.length
            ? databaseInstanceDetails[0].database_deployment_type
            : '';
        if (
            sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT ||
            sqlServerDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT
        ) {
            volumes = (await getEBSVolumesForDemo(
                sqlServerDeploymentType,
                ebsVolumeIds,
                databaseInstanceDetails
            )) as DescribeVolumesResult;
        } else {
            volumes = await describeVolumes(credentialsId, region, { VolumeIds: ebsVolumeIds });
        }
    } else {
        volumes = await describeVolumes(credentialsId, region, { VolumeIds: ebsVolumeIds });
    }

    if (!volumes?.Volumes || volumes.Volumes.length === 0) {
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
            if (isDemo() && shouldQueryServerDetails && shouldQueryTopology) {
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

async function getDatabases(
    accountId: string,
    databaseHostId: string,
    fields?: string
): Promise<DatabasesListResponseType> {
    logger.info('Getting database list', accountId, databaseHostId, fields);

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

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);

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
    try {
        return await getDatabaseDetails(
            accountId,
            region,
            credentialsId,
            databaseHostId,
            fileSystemId,
            getProtection,
            userDatabase,
            activeNodeInstanceId,
            instanceName
        );
    } catch (error) {
        const errorMessage = `Error while fetching database details for host ${databaseHostId} in account ${accountId} , ${error}`;
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

    const { credentials_id: credentialsId, cloud_provider_account_id: awsAccountId, metadata } = resourceData;

    const { node1InstanceId, node2InstanceId, activeDirectoryName, activeDirectoryAddress } =
        metadata as unknown as Metadata;

    let nodeTopologyData: any = {
        awsAccount: awsAccountId || '',
        region: AWS_REGIONS.has(region) ? AWS_REGIONS.get(region)! : region,
        vpcId: undefined,
        vpcName: undefined,
        ec2Details: []
    };

    if (node1InstanceId && activeNodeInstanceId) {
        const instanceIds = node2InstanceId ? [node1InstanceId, node2InstanceId] : [node1InstanceId];

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
        let vpcId: string | undefined;
        let vpcCidr: string | undefined;
        let vpcName: string | undefined;
        let activeNodeStatus: string | undefined;
        let standbyNodeStatus: string | undefined;

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
                    activeNodeInstanceName = isDemo()
                        ? `sqlnode-${randomize('0', 5)}`
                        : getResourceNameFromTags(activeNode.Tags);
                    vpcId = activeNode.VpcId;
                    vpcCidr = activeNode.VpcId;
                    activeNodeStatus = activeNode.State?.Name;

                    const vpcParams: DescribeVpcsCommandInput = {
                        VpcIds: [vpcId!]
                    };
                    const { Vpcs: [vpc = {}] = [] } = await describeVpc(credentialsId, region, vpcParams);
                    vpcCidr = vpc?.CidrBlock;
                    const vpcTags = vpc.Tags || [];

                    vpcName = vpcTags.find(keyValuePair => keyValuePair.Key === 'Name')?.Value;

                    if (!isEmpty(standbyNode)) {
                        standbyInstanceType = standbyNode.InstanceType;
                        standbyAvailabilityZone = standbyNode.Placement?.AvailabilityZone;
                        standbySubnetId = standbyNode.SubnetId;
                        standbyNodeStatus = standbyNode.State?.Name;
                        const [firstBlockDeviceMapping = {}] = standbyNode.BlockDeviceMappings || [];
                        ({ Ebs: { VolumeId: standbyVolumeId = undefined } = {} } = firstBlockDeviceMapping);
                        standbyNodeInstanceName = isDemo()
                            ? `sqlnode-${randomize('0', 5)}`
                            : getResourceNameFromTags(standbyNode.Tags);
                    }
                }
            } catch (error) {
                logger.error(
                    `Error while fetching details for EC2 for node ${activeNodeInstanceId} in account ${accountId} Error: ${error}`
                );
            }
        }
        const activeDirectoryDetails = {
            name: activeDirectoryName || '',
            address: activeDirectoryAddress || ''
        };

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
                        ...(activeNodeStatus && { nodeStatus: activeNodeStatus })
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
                ...(standbySubnetId && { subnetId: standbySubnetId }),
                ...(standbyNodeStatus && { nodeStatus: standbyNodeStatus })
            });
        }
    } else {
        logger.error(
            `Error while fetching details for EC2 for node ${node1InstanceId} , ${node2InstanceId} in account ${accountId} as no active node was found.`
        );
    }

    logger.debug('Topology data', nodeTopologyData);
    return nodeTopologyData;
}

async function getDatabaseHostsSummaryV2(
    accountId: string,
    awsRegion: string,
    customerCredentialsId: string,
    fields?: string,
    nextToken?: string,
    vpcId?: string,
    fsxId?: string,
    pageSize?: number
) {
    logger.info(
        'Fetching all database hosts deployed in account ',
        accountId,
        fields,
        nextToken,
        awsRegion,
        customerCredentialsId,
        vpcId,
        fsxId,
        pageSize
    );

    const apiPageSize = pageSize || V2_API_PAGE_SIZE;

    const resourceDetails = await listResources(
        accountId,
        undefined,
        customerCredentialsId,
        awsRegion,
        RESOURCESTYPE.MSSQL,
        fsxId,
        undefined,
        apiPageSize,
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
                    customerCredentialsId,
                    awsRegion,
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
        nextToken: resourceDetails?.length === apiPageSize ? resourceDetails[resourceDetails.length - 1].id : undefined
    };
}

async function getDatabaseInstanceTopology(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseInstances: any
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
        storage_type: storageType,
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
                    : storageType === STORAGE_TYPE.FSXW
                    ? FileSystemTypes.FSXWINDOWS
                    : storageType
                : NOT_AVAILABLE
    };
    if (activeNodeInstanceId) {
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

async function getDatabaseInstanceSummary(
    accountId: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    region: string,
    databaseInstances: DatabaseInstance,
    fields?: string,
    resourceDetails?: ResourceDetails
    /*
    resource detail is used to fetch node Topology for host its optional in instance summary
    as its returned at host level for database-hosts api(inventory) and
    at instance level for database-instances api (resource page)
    */
) {
    logger.info(
        'Fetching summary of database instance',
        accountId,
        credentialsId,
        activeNodeInstanceId,
        region,
        databaseInstances,
        fields,
        resourceDetails
    );

    const {
        database_instance_id: databaseInstanceId,
        database_instance_name: savedDatabaseInstanceName,
        is_default: isdefaultInstance,
        metadata,
        created_time: creationDate,
        database_deployment_type: databaseDeploymentType,
        sqlAuthEnabled
    } = databaseInstances;

    const { userDatabase = [] } = metadata as unknown as Metadata;

    const databaseInstanceName = getDatabaseInstanceName(savedDatabaseInstanceName, isdefaultInstance);

    let fieldsValues: Array<string> = [];

    if (fields) {
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

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
    const getDbCount = fieldsValues?.includes(DatabaseHostsQueryFields.DB_COUNT.toLocaleLowerCase());
    const shouldQueryNodeTopology = fieldsValues?.includes(DatabaseHostsQueryFields.NODE_TOPOLOGY.toLocaleLowerCase());

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
    let databasesCount: any;
    let nodeTopologyData: any;
    const errormessages: { [index: string]: string } = {};

    try {
        [
            serverDetails,
            databaseInstancetopologyData,
            performanceData,
            storageData,
            protectionData,
            resourceUtilizationData,
            databasesCount,
            nodeTopologyData
        ] = await Promise.all(
            [
                ...(shouldQueryServerDetails
                    ? [
                          getServerDetails(
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              databaseInstanceName,
                              sqlAuthEnabled
                          )
                      ]
                    : [Promise.resolve()]), // Fetch server metadata
                ...(shouldQueryDatabaseTopology
                    ? [
                          getDatabaseInstanceTopology(
                              accountId,
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              databaseInstances
                          )
                      ]
                    : [Promise.resolve()]),
                ...(getPerformance
                    ? [
                          getPerformanceMetrics(
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              databaseInstanceName,
                              sqlAuthEnabled
                          )
                      ]
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
                              sqlAuthEnabled
                          )
                      ]
                    : [Promise.resolve()]), // Fetch protection status
                ...(getResourceutilization
                    ? [
                          getAllResourceUtilisationDetails(
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              databaseInstanceName
                          )
                      ]
                    : [Promise.resolve()]),
                ...(getDbCount
                    ? [
                          getDatabasesCount(
                              credentialsId,
                              region,
                              activeNodeInstanceId,
                              databaseInstanceName,
                              sqlAuthEnabled
                          )
                      ]
                    : [Promise.resolve()]),
                ...(shouldQueryNodeTopology && resourceDetails
                    ? [getNodeTopology(accountId, region, databaseInstanceId, resourceDetails, activeNodeInstanceId)]
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

    databaseInstanceDetails.status = ServerState.UP;
    if (shouldQueryServerDetails && serverDetails) {
        serverDetails.creationDate = creationDate ? Date.parse(creationDate.toString()) : '';
        databaseInstanceDetails.databaseServer = serverDetails;
    }

    if (isDemo() && databasesCount && getDbCount) {
        databasesCount.totalCount += userDatabase.length;
    }

    if (getDbCount && databasesCount?.totalCount) {
        databaseInstanceDetails.databaseCount = databasesCount?.totalCount || 0;
    }

    if (shouldQueryNodeTopology && nodeTopologyData) {
        databaseInstanceDetails.nodeTopology = nodeTopologyData;
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
    instancesManaged: DatabaseInstance[],
    resourceId: string,
    instanceDetails?: InstanceDetails[] | undefined
) {
    logger.info('Getting database Instances details for resource', {
        credentialsId,
        region,
        instancesManaged,
        resourceId
    });
    const managedInstancesName = instancesManaged.map((item: DatabaseInstance) => ({
        instanceName: item.database_instance_name,
        isDefault: item.is_default,
        instanceState: ServerState.DOWN,
        isManaged: true,
        databaseInstanceId: item.database_instance_id
    }));

    const existingInstanceNames = new Set(instanceDetails?.map(({ instanceName }) => instanceName));
    const updatedInstanceDetails = [
        ...(instanceDetails ?? []).map(({ instanceName, instanceState, isDefault, sqlAuthEnabled }) => {
            const managedInstance = managedInstancesName.find(
                ({ instanceName: managedInstanceName }) => managedInstanceName === instanceName
            );
            const isManaged = Boolean(managedInstance);
            const updatedInstanceState =
                instanceState === SQL_SERVICE_STATE.RUNNING ? ServerState.UP : ServerState.DOWN;
            const databaseInstanceId = managedInstance?.databaseInstanceId;

            return {
                instanceName,
                instanceState: updatedInstanceState,
                isManaged,
                isDefault,
                databaseInstanceId,
                sqlAuthEnabled
            };
        }),
        ...managedInstancesName.filter(({ instanceName }) => !existingInstanceNames.has(instanceName))
    ];
    logger.debug('Database instances details', updatedInstanceDetails);
    return updatedInstanceDetails;
}

async function getDatabaseHostSummaryV2(
    accountId: string,
    databaseHostId: string,
    customerCredentialsId: string,
    awsRegion: string,
    fields?: string,
    resourceDetail?: ResourceDetails,
    isManagedResource: boolean = true
) {
    logger.info('Fetching details about a database host ', accountId, databaseHostId, fields, isManagedResource);
    if (isEmpty(resourceDetail)) {
        [resourceDetail] = await listResources(accountId, databaseHostId, customerCredentialsId, awsRegion);
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
        metadata,
        ec2UsageOperation
    } = resourceDetail;

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const shouldQueryNodeTopology = fieldsValues?.includes(DatabaseHostsQueryFields.NODE_TOPOLOGY.toLocaleLowerCase());
    const getUsageEstimation = fieldsValues?.includes(DatabaseHostsQueryFields.USAGE_ESTIMATION.toLocaleLowerCase());

    let instancesManaged = await listDatabaseInstances(accountId, { resourceId, credentialsId, region });

    if (isDemo()) {
        instancesManaged.map(instance => {
            const hostResourceName = resourceDetail?.resource_name || '';

            if (!instance.is_default) {
                instance.database_instance_name = instance.database_instance_name.replace(hostResourceName, '');
            }
            return instance;
        });
    }
    // Update the database instances detail to include storage type as FSXN
    instancesManaged = instancesManaged.map(instance => ({
        ...instance,
        storage_type: STORAGE_TYPE.FSXN
    }));
    const errormessages: { [index: string]: string } = {};
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
    let { ssmConnectionStatus, activeNodeInstanceId, standbyNodeInstanceId, instancesDetails } = await getActiveSqlNode(
        credentialsId,
        region!,
        node1InstanceId,
        node2InstanceId,
        resourceId
    );
    const databaseHostDetails: DatabaseHostSummaryForMultiInstanceResponseType = {
        id: resourceId,
        name: resourceName || '',
        databaseHostStatus: activeNodeInstanceId ? ONLINE : instancesDetails ? OFFLINE : UNKNOWN,
        ssmStatus: ssmConnectionStatus || NOT_AVAILABLE
    };

    let nodeTopology: any;
    let usageEstimationData: any;
    let databaseInstancesDetail: any;

    try {
        if (credentialsId && region) {
            if (isDemo()) {
                const hostResourceName = resourceDetail?.resource_name || '';
                instancesDetails = instancesDetails!
                    .filter((instance: { instanceName: string | (string | null)[] }) => {
                        if (instance.instanceName.includes('$')) {
                            return true; // Exclude instances with '$' from filtering
                        }
                        return (
                            instance.instanceName.includes(hostResourceName) || instance.instanceName === 'MSSQLSERVER'
                        );
                    })
                    .map((instance: { instanceName: { replace: (arg0: string | null, arg1: string) => any } }) => ({
                        ...instance,
                        instanceName: instance.instanceName.replace(resourceName, '')
                    }));
            }

            databaseInstancesDetail = await getDatabaseInstancesDetails(
                credentialsId,
                region,
                instancesManaged,
                resourceId,
                instancesDetails
            );

            databaseHostDetails.databaseInstanceDetails = databaseInstancesDetail;
            const promises = [];

            if (shouldQueryNodeTopology) {
                promises.push(
                    getNodeTopology(
                        accountId,
                        region,
                        resourceId,
                        resourceDetail,
                        activeNodeInstanceId || node1InstanceId,
                        standbyNodeInstanceId || node2InstanceId
                    ).catch(error => {
                        logger.error(`Error while fetching data: ${error}.`);
                        if (DATABASE_HOSTS_INDEX_MAPPING_V2[promises.length - 1]) {
                            errormessages[DATABASE_HOSTS_INDEX_MAPPING_V2[promises.length - 1]] = JSON.stringify(error);
                        }
                    })
                );
            } else {
                promises.push(Promise.resolve());
            }

            if (getUsageEstimation && activeNodeInstanceId) {
                promises.push(
                    getBillingOrPriceEstimation(resourceDetail, activeNodeInstanceId, isManagedResource).catch(
                        error => {
                            logger.error(`Error while fetching data: ${error}.`);
                            if (DATABASE_HOSTS_INDEX_MAPPING_V2[promises.length - 1]) {
                                errormessages[DATABASE_HOSTS_INDEX_MAPPING_V2[promises.length - 1]] =
                                    JSON.stringify(error);
                            }
                        }
                    )
                );
            } else {
                promises.push(Promise.resolve());
            }

            let instanceResults: any;

            if (activeNodeInstanceId && databaseInstancesDetail.length > 0 && credentialsId && region) {
                let runningDatabaseInstances: DatabaseInstance[] = [];
                if (isManagedResource) {
                    runningDatabaseInstances = instancesManaged.filter(resource =>
                        databaseInstancesDetail.some(
                            (instance: InstanceDetails) =>
                                instance.instanceState === ServerState.UP &&
                                instance.instanceName === resource.database_instance_name
                        )
                    );
                } else {
                    runningDatabaseInstances =
                        resourceDetail.databaseInstanceDetails?.filter(
                            instance => instance.instanceState === 'Running'
                        ) ?? [];
                }
                if (runningDatabaseInstances.length > 0) {
                    const instancePromises = runningDatabaseInstances.map(async (instance: DatabaseInstance) => {
                        const instanceDetail = databaseInstancesDetail?.find(
                            (e: InstanceDetails) => e.instanceName === instance.database_instance_name
                        );
                        instance.sqlAuthEnabled = instanceDetail[0].sqlAuthEnabled;
                        const instanceResult = await getDatabaseInstanceSummary(
                            accountId,
                            credentialsId,
                            activeNodeInstanceId!,
                            region,
                            instance,
                            fields
                        );
                        return instanceResult;
                    });

                    promises.push(Promise.all(instancePromises));
                } else {
                    promises.push(Promise.resolve());
                }
            }
            [nodeTopology, usageEstimationData, instanceResults] = await Promise.all(promises);

            databaseHostDetails.ssmStatus = ssmConnectionStatus || NOT_AVAILABLE;

            if (getUsageEstimation && usageEstimationData) {
                databaseHostDetails.ebsResourceInfo = usageEstimationData?.storage?.ebsBreakdownByVolumeType;
                databaseHostDetails.fsxnResourceInfo = usageEstimationData?.storage?.fsxnBreakDownById;
                databaseHostDetails.fsxwResourceInfo = usageEstimationData?.storage?.fsxwBreakDownById;
                databaseHostDetails.estimatedUsageCost = usageEstimationData;

                // Aggregate FSxN storage
                let totalFsxnSize = 0;
                databaseHostDetails.fsxnResourceInfo?.forEach(resource => {
                    totalFsxnSize += resource.size!;
                });

                // Aggregate FSxW storage
                let totalFsxwSize = 0;
                databaseHostDetails.fsxwResourceInfo?.forEach(resource => {
                    totalFsxwSize += resource.size!;
                });

                // Aggregate EBS storage
                let totalEbsSize = 0;
                databaseHostDetails.ebsResourceInfo?.forEach(resource => {
                    totalEbsSize += resource.size!;
                });

                databaseHostDetails.storageAllocation = { fsxn: totalFsxnSize, fsxw: totalFsxwSize, ebs: totalEbsSize };
            }

            if (shouldQueryNodeTopology && nodeTopology && nodeTopology.ec2Details.length > 0) {
                if (isDemo()) {
                    // updating the instance type only for explore savings demo
                    if (resourceDetail?.resource_name === 'app-server-15') {
                        const modifiedEc2Details = nodeTopology.ec2Details?.map((ec2: any) => ({
                            ...ec2,
                            instanceType: 'm5.xlarge'
                        }));
                        nodeTopology.ec2Details = modifiedEc2Details;
                    } else if (resourceDetail?.resource_name === 'app-server-14' && instanceResults?.length) {
                        instanceResults = instanceResults.map((item: any) => ({
                            ...item,
                            databaseServer: {
                                ...item.databaseServer,
                                serverEdition: 'SQL Server Enterprise Edition'
                            }
                        }));
                    }
                }
                databaseHostDetails.nodeTopology = nodeTopology;
            }

            databaseHostDetails.databaseInstanceDetails = databaseInstancesDetail;

            databaseHostDetails.databaseInstancesSummary = instanceResults;

            // ClusterNodeDetails is used in TCO
            if (resourceDetail?.clusterNodeDetails && resourceDetail?.clusterNodeDetails?.length > 0) {
                if (isDemo()) {
                    resourceDetail.clusterNodeDetails = resourceDetail?.clusterNodeDetails?.map(node => ({
                        ...node,
                        ec2InstanceType: 'm5.xlarge'
                    }));
                }
                databaseHostDetails.clusterNodeDetails = resourceDetail?.clusterNodeDetails;
            }
        }
    } catch (error) {
        logger.error(`Error while fetching database hosts details ${accountId}, ${error}`);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching database hosts details ${accountId}, ${error}`
        );
    }
    databaseHostDetails.sqlLicenseIncluded = WIN_SQL_EC2_USAGE_OPERATION.includes(ec2UsageOperation!) || false;
    return databaseHostDetails;
}

async function getDatabaseHostInstanceSummary(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
) {
    logger.info('Fetching details about a database host instance ', accountId, databaseHostId, databaseInstanceId);

    const { activeNodeInstanceId, newDatabaseInstanceDetails } = await getInstanceDetails(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );

    const [resourceDetails] = await listResources(accountId, databaseHostId, credentialsId, region);

    const databaseInstanceSummary = await getDatabaseInstanceSummary(
        accountId,
        credentialsId,
        activeNodeInstanceId,
        region,
        newDatabaseInstanceDetails,
        fields,
        resourceDetails
    );
    logger.debug('Database host instance details', databaseInstanceSummary);
    return databaseInstanceSummary;
}

async function getDatabasesV2(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string
): Promise<DatabasesListResponseType> {
    logger.info('Getting v2 database list', accountId, region, databaseHostId, databaseInstanceId, fields);

    const { activeNodeInstanceId, newDatabaseInstanceDetails } = await getInstanceDetails(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );
    const {
        database_instance_name: savedInstanceName,
        fsxn_ids: fileSystemId,
        metadata,
        is_default: isdefaultInstance
    } = newDatabaseInstanceDetails;
    const { userDatabase = [] } = metadata as unknown as databaseInstanceMetadata;
    const instanceName = getDatabaseInstanceName(savedInstanceName, isdefaultInstance);

    let fieldsValues: Array<string> = [];

    if (fields) {
        // remove the empty spaces in the string & split the fields by comma separated array values
        fieldsValues = fields?.toLowerCase()?.replace(/\s+/g, '')?.split(',');
    }

    const getProtection = fieldsValues?.includes(DatabaseHostsQueryFields.PROTECTION);

    try {
        return await getDatabaseDetails(
            accountId,
            region,
            credentialsId,
            databaseHostId,
            fileSystemId,
            getProtection,
            userDatabase,
            activeNodeInstanceId,
            instanceName
        );
    } catch (error) {
        const errorMessage = `Error while fetching database details for host ${databaseHostId} in account ${accountId} , ${error}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }
}

async function getProtectionDetails(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    isSystemDatabase: boolean = false,
    activeNodeInstanceId?: string,
    instanceName?: string
): Promise<{ awsBackup: BackupType; ontapBackup: BackupType }> {
    logger.info('Getting Proteciton details', {
        credentialsId,
        region,
        fileSystemId,
        activeNodeInstanceId,
        instanceName
    });

    // Getting the map between database name and associated volume uuid
    const { volumeUuids, volumeDBMap } = ((await getMappedOntapVolumes(
        credentialsId,
        region,
        fileSystemId,
        isSystemDatabase,
        activeNodeInstanceId,
        instanceName
    )) as MappedOnTapVolumeResponse) || { volumeUuids: [], volumeDBMap: {} };

    const [awsBackup = {}, ontapBackup = {}] = await Promise.all([
        isFsxnAwsBackupEnabled(credentialsId, region, fileSystemId, volumeUuids, volumeDBMap, activeNodeInstanceId),
        getOntapVolumesSnapshotCount(
            credentialsId,
            region,
            fileSystemId,
            volumeUuids,
            volumeDBMap,
            activeNodeInstanceId
        )
    ]);

    return { awsBackup, ontapBackup };
}

async function getInstanceDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    const [[resourceDetails], [instanceDetails]] = await Promise.all([
        listResources(accountId, databaseHostId, credentialsId, region),
        listDatabaseInstances(accountId, {
            resourceId: databaseHostId,
            credentialsId,
            sqlInstanceId: databaseInstanceId
        })
    ]);

    // Update the database instance details to include storage type as FSXN
    const databaseInstanceDetails = {
        ...instanceDetails,
        storage_type: STORAGE_TYPE.FSXN
    };

    if (isEmpty(resourceDetails) || isEmpty(databaseInstanceDetails)) {
        const errorMessage = `No database host by id ${databaseHostId} or instance by instance id ${databaseInstanceDetails} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const activeNodeResponse = await getActiveNodeAndInstanceDetails(
        accountId,
        credentialsId,
        region,
        resourceDetails,
        databaseInstanceDetails as unknown as DatabaseInstance
    );
    const { nodeId: activeNodeInstanceId, matchingInstance } = activeNodeResponse;
    const { instanceName, instanceState } = matchingInstance;
    if (instanceState !== SQL_SERVICE_STATE.RUNNING) {
        const errorMessage = `Instance id ${databaseInstanceId} is not running on host ${databaseHostId}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }
    const newDatabaseInstanceDetails = {
        ...databaseInstanceDetails,
        instanceName,
        instanceState
    } as unknown as DatabaseInstance;

    return { activeNodeInstanceId, newDatabaseInstanceDetails };
}

async function getDatabaseDetails(
    accountId: string,
    region: string,
    credentialsId: string,
    databaseHostId: string,
    fileSystemId: string,
    getProtection: boolean,
    userDatabase: any,
    activeNodeInstanceId?: string,
    instanceName?: string
) {
    logger.info('Getting database details', {
        accountId,
        region,
        credentialsId,
        databaseHostId,
        fileSystemId,
        activeNodeInstanceId,
        instanceName,
        getProtection
    });

    try {
        const [{ databases } = { databases: [] }, backedupDatabases, { awsBackup = {}, ontapBackup = {} } = {}] =
            await Promise.all(
                [
                    getDataBasesSummary(databaseHostId, activeNodeInstanceId!, instanceName),
                    ...(activeNodeInstanceId && getProtection
                        ? [getNativeSQLBackedupDatabases(databaseHostId, activeNodeInstanceId, instanceName)]
                        : [Promise.resolve()]), // Fetch native sql protection status
                    ...(activeNodeInstanceId && getProtection
                        ? [
                              getProtectionDetails(
                                  credentialsId,
                                  region,
                                  fileSystemId,
                                  false,
                                  activeNodeInstanceId,
                                  instanceName
                              )
                          ]
                        : [Promise.resolve()]) // Fetch protection status
                ].map(p =>
                    p.catch(error => {
                        logger.error(`Error while fetching database details: ${error?.message}.`);
                    })
                )
            );
        // protection status added for each database
        const response = databases?.map(
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
                ...(getProtection && {
                    protection: {
                        isAwsBackupEnabled: {
                            fsxn: isDemoFlow ? true : checkKey(awsBackup, database.databaseName)
                        },
                        isFsxOntapSnapshotsEnabled: isDemoFlow ? true : checkKey(ontapBackup, database.databaseName),
                        isSqlNativeEnabled: Boolean(
                            backedupDatabases &&
                                backedupDatabases?.find(
                                    (e: { backedupDatabases: string }) => e.backedupDatabases === database.databaseName
                                )
                        )
                    }
                })
            })
        );

        if (isDemo()) {
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
    } catch (error: any) {
        const errorMessage = error.message;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
    }
}

function checkKey(obj: any, key: string) {
    if (obj && key in obj) {
        return obj[key];
    }
    return 'N/A';
}

function checkAllTrue(obj: { [key: string]: boolean }) {
    if (!obj || Object.keys(obj).length === 0) {
        return 'N/A';
    }
    return Object.values(obj).every(value => value === true);
}

export {
    getDatabaseHostsSummary,
    getDatabaseHostSummary,
    getDatabases,
    getDatabaseHostsSummaryV2,
    getDatabaseHostSummaryV2,
    getDatabaseHostInstanceSummary,
    getDatabasesV2,
    getInstanceDetails
};
