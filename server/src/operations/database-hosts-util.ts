import { isEmpty } from 'lodash-es';
import numeral from 'numeral';
import { DescribeVolumesResult, DescribeVpcsCommandInput, EC2ServiceException, Instance } from '@aws-sdk/client-ec2';
import createError from 'http-errors';
import { StoragePerStorageTypeResponseType, TopologyResponseType } from '../routes/types/database-hosts.types';
import { DatabaseInstance, Metadata, ResourceDetails } from '../utils/common-types';
import getLogger from '../utils/logger';
import {
    calculateFsxnStorageEfficiencyUsingCloudwatch,
    calculateFsxwStorageEfficiencyUsingCloudwatch
} from './aws/cloud-watch-operations';
import { getEc2Hostname, IS_DEMO_FLOW } from '../utils/utils';
import { AWS_ERROR_CODES, AWS_REGIONS, DatabaseTypes, HttpErrorCodes, SqlServerDeploymentModel } from '../utils/consts';
import { getEBSVolumesForDemo, getMssqlStorageDataForDemo } from './demo-operations';
import { describeInstance, describeVolumes, describeVpc } from '../lib/aws/ec2';

const logger = getLogger();

const DATABASE_HOSTS_INDEX_MAPPING_V2: { [index: number]: string } = {
    0: 'nodeTopology',
    1: 'billing/pricing',
    2: 'instanceSummary'
};

type EstimationEc2Type = {
    resourceType: string;
    sqlSoftwareType: string;
    [key: string]: string | number;
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
    throughput?: number;
    iops?: number;
    volumeType: string;
}[];

interface BackupType {
    [key: string]: boolean;
}

interface DatabaseDetails {
    databaseId: number;
    databaseName: string;
    creationDate: string;
    databaseStatus: string;
    databaseSize: number;
    collationName: string;
}

async function getEbsResourceInfo(
    credentialsId: string,
    region: string,
    ebsVolumeIds: string[],
    databaseInstanceDetails?: any
): Promise<EstimationEbsType> {
    logger.info('Getting EBS resource info:', {
        credentialsId,
        region,
        ebsVolumeIds,
        databaseInstanceId: databaseInstanceDetails?.database_instance_id
    });

    let volumes;
    if (IS_DEMO_FLOW) {
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
        volumes = await describeVolumes(credentialsId, region, { VolumeIds: ebsVolumeIds }, { useCache: true });
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

async function getStorageData(
    resourceDetail?: ResourceDetails,
    databaseInstanceDetails?: DatabaseInstance,
    readFsxnData = false
): Promise<StoragePerStorageTypeResponseType | undefined> {
    logger.info('Getting storage data:', {
        resourceId: resourceDetail?.resource_id,
        databaseInstanceId: databaseInstanceDetails?.database_instance_id,
        readFsxnData
    });

    try {
        let region;
        let fsxnId;
        let credentialsId;
        let fsxwId;
        let ebsVolumeIds;
        let totalSize = 0;
        let totalUsed;
        let totalSpaceSavings;
        let totalSpaceSavingsPercentage;
        let storageProtocol;

        if (isEmpty(databaseInstanceDetails)) {
            logger.info('No database instance details found, returning empty storage data.');
            return;
        }

        ({
            region,
            fsxn_ids: fsxnId,
            credentials_id: credentialsId,
            fsxwId,
            ebsVolumeIds,
            storage_protocol: storageProtocol
        } = databaseInstanceDetails);

        ebsVolumeIds = ebsVolumeIds || [];
        const response = {} as StoragePerStorageTypeResponseType;
        if (
            readFsxnData &&
            fsxnId &&
            region &&
            credentialsId &&
            !(databaseInstanceDetails?.isManaged && !IS_DEMO_FLOW)
        ) {
            ({ totalSize, totalUsed, totalSpaceSavings, totalSpaceSavingsPercentage } =
                await calculateFsxnStorageEfficiencyUsingCloudwatch(region, credentialsId, fsxnId));
            response.fsxn = {
                size: numeral(`${totalSize}GiB`).value() || 0,
                used: totalUsed,
                spaceSavings: totalSpaceSavings,
                spaceSavingsPercentage: totalSpaceSavingsPercentage,
                protocol: storageProtocol ? storageProtocol.split(',') : [],
                ...(IS_DEMO_FLOW && { ...getMssqlStorageDataForDemo(totalUsed as number) })
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
        const errorMessage = `Error while getting storage savings for resource ${resourceDetail} ,databaseInstance: id: ${
            databaseInstanceDetails?.database_instance_id
        } fsxId: ${databaseInstanceDetails?.fsxn_ids} error: ${JSON.stringify(error)}`;
        let { message } = error as { message: string };
        if (message?.toLowerCase().includes('ThrottlingException: Rate exceeded'.toLowerCase())) {
            message += '. Retry the operation.';
            throw createError(HttpErrorCodes.SERVICE_UNAVAILABLE, message);
        }
        throw createError(HttpErrorCodes.SERVICE_UNAVAILABLE, errorMessage);
    }
}

async function getNodeTopology(
    accountId: string,
    region: string,
    resourceId: string,
    resourceData: ResourceDetails,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string,
    fqdn?: string,
    ipAddress?: string,
    clusterName?: string
): Promise<TopologyResponseType> {
    logger.info('Fetching topology data', {
        accountId,
        region,
        resourceId,
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
        logger.info(`Getting node ${node1InstanceId} , ${node2InstanceId} details for account ${accountId}.`);
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
        let activeNode: Instance | undefined;
        let standbyNode: Instance | undefined;

        if (!isEmpty(activeNodeInstanceId)) {
            // fetch instance details only if there is atleast one active node
            try {
                ec2InstanceDetails = await describeInstance(
                    credentialsId,
                    region,
                    { InstanceIds: instanceIds },
                    { useCache: true }
                );
                const node1 = ec2InstanceDetails.Reservations?.[0]?.Instances?.[0];
                const node2 = ec2InstanceDetails.Reservations?.[1]?.Instances?.[0];
                if (node1) {
                    [activeNode, standbyNode] =
                        node1?.InstanceId === activeNodeInstanceId ? [node1, node2] : [node2, node1];
                    if (!isEmpty(activeNode)) {
                        keyPairName = activeNode.KeyName;
                        activeInstanceType = activeNode.InstanceType;
                        activeAvailabilityZone = activeNode.Placement?.AvailabilityZone;
                        activeSubnetId = activeNode.SubnetId;
                        activeVolumeId = activeNode.BlockDeviceMappings?.[0].Ebs?.VolumeId;
                        activeNodeInstanceName = getEc2Hostname(
                            resourceData.resource_type as DatabaseTypes,
                            activeNode?.Tags
                        );
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
                            standbyNodeInstanceName = getEc2Hostname(
                                resourceData.resource_type as DatabaseTypes,
                                standbyNode?.Tags
                            );
                        }
                    }
                } else {
                    logger.warn(
                        `Instance details for ${activeNodeInstanceId} in account ${accountId} in ${region} is not found. The instance may be deleted.`
                    );
                }
            } catch (error) {
                if (error instanceof EC2ServiceException && error.toString().includes(AWS_ERROR_CODES.ec2NotFound)) {
                    logger.debug(error.toString());
                } else {
                    logger.error(
                        `Error while fetching details for EC2 for node ${activeNodeInstanceId} in account ${accountId} Error: ${error}`
                    );
                }
            }
        }
        const activeDirectoryDetails =
            resourceData?.resource_type === DatabaseTypes.PG_SQL
                ? undefined
                : {
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
                ],
                fqdn: fqdn ?? activeNode?.PrivateDnsName ?? '',
                nodeIpAddress: ipAddress ?? activeNode?.PublicIpAddress ?? '',
                ...(clusterName && { windowsClusterName: clusterName })
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
    }
    logger.debug('Topology data', nodeTopologyData);
    return nodeTopologyData;
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
    getStorageData,
    getNodeTopology,
    checkKey,
    checkAllTrue,
    getEbsResourceInfo,
    DATABASE_HOSTS_INDEX_MAPPING_V2,
    EstimationEc2Type,
    EstimationFSxType,
    EstimationEbsType,
    BackupType,
    DatabaseDetails
};
