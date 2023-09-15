import Promise from 'bluebird';
import { Static } from '@fastify/type-provider-typebox';
import { DescribeNetworkInterfacesRequest } from '@aws-sdk/client-ec2';
import { describeFSxFileSystems, describeFSxVolumes } from '../../lib/aws/fsx';
import getLogger from '../../utils/logger';
import { FSxFileSystemSchema } from '../../routes/types/aws.types';
import {
    FSX_FILESYSTEM_TYPE,
    FSX_STORAGE_TYPE,
    AWS_RESOURCE_NAME_TAG,
    FSX_BATCH_CONCURRENCY_VALUE
} from '../../utils/consts';
import { getNetworkInterfacesList } from './ec2-operations';

const logger = getLogger();

type FSxFileSystemType = Static<typeof FSxFileSystemSchema>;

async function getFSXDetails(credentialsId: string, region: string, filsSys: any) {
    const enetInterfaceIds = filsSys.NetworkInterfaceIds;
    const enetInterfaces: DescribeNetworkInterfacesRequest = {
        Filters: [
            {
                Name: 'network-interface-id',
                Values: enetInterfaceIds
            }
        ]
    };

    const [{ Volumes: fsxVolumes }, networkInterfacesList] = await Promise.all([
        describeFSxVolumes(credentialsId, region, filsSys.FileSystemId!),
        getNetworkInterfacesList(credentialsId, region, enetInterfaces)
    ]);
    const sgs = new Set(networkInterfacesList.map(enet => enet.securityGroups ?? []).flat());

    const volumesList: FSxFileSystemType['volumes'] = fsxVolumes?.map(
        ({ VolumeId: volumeId, VolumeType: volumeType, OntapConfiguration: volumeOntapConfiguration }) => ({
            volumeId,
            volumeType,
            securityStyle: volumeOntapConfiguration?.SecurityStyle,
            sizeInMegabytes: volumeOntapConfiguration?.SizeInMegabytes,
            storageEfficiencyEnabled: volumeOntapConfiguration?.StorageEfficiencyEnabled,
            storageVirtualMachineId: volumeOntapConfiguration?.StorageVirtualMachineId,
            ontapVolumeType: volumeOntapConfiguration?.OntapVolumeType
        })
    );

    // Get the FSx filesystem name, if available.
    const { Tags: tags } = filsSys;
    const tag = tags?.find(({ Key: key }: { Key: string }) => key === AWS_RESOURCE_NAME_TAG);

    return {
        fileSystemId: filsSys.FileSystemId!,
        name: tag?.Value,
        kmsKeyId: filsSys.KmsKeyId,
        lifecycle: filsSys.Lifecycle!,
        networkInterfaceIds: filsSys.NetworkInterfaceIds,
        subnetIds: filsSys.SubnetIds,
        vpcId: filsSys.VpcId,
        ontapConfiguration: {
            deploymentType: filsSys.OntapConfiguration?.DeploymentType,
            endpointIpAddressRange: filsSys.OntapConfiguration?.EndpointIpAddressRange,
            fsxAdminPassword: filsSys.OntapConfiguration?.FsxAdminPassword,
            preferredSubnetId: filsSys.OntapConfiguration?.PreferredSubnetId,
            routeTableIds: filsSys.OntapConfiguration?.RouteTableIds,
            throughputCapacity: filsSys.OntapConfiguration?.ThroughputCapacity,
            diskIopsConfiguration: {
                iops: filsSys.OntapConfiguration?.DiskIopsConfiguration?.Iops,
                mode: filsSys.OntapConfiguration?.DiskIopsConfiguration?.Mode
            },
            endpoints: {
                intercluster: {
                    dnsName: filsSys.OntapConfiguration?.Endpoints?.Intercluster?.DNSName,
                    ipAddresses: filsSys.OntapConfiguration?.Endpoints?.Intercluster?.IpAddresses
                },
                management: {
                    dnsName: filsSys.OntapConfiguration?.Endpoints?.Management?.DNSName,
                    ipAddresses: filsSys.OntapConfiguration?.Endpoints?.Management?.IpAddresses
                }
            }
        },
        volumes: volumesList,
        securityGroups: Array.from(sgs)
    };
}

/*
 * Return Amazon FSx for NetApp ONTAP filesystems in the given AWS region
 * and also available from the given VPC.
 */
async function getFSxFileSystemsList(credentialsId: string, region: string, vpcId: string) {
    logger.info('List FSx ONTAP of type SSD', { credentialsId, region, vpcId });

    let { FileSystems: allFSxFilesystems } = await describeFSxFileSystems(credentialsId, region);

    // 1. We are supporting only Amazon FSx for NetApp ONTAP filesystems, which
    //    are always of storageType == SSD and fileSystemType == ONTAP.
    // 2. The returned FileSystemIds need to be always defined and unique, so
    //    that the API caller always gets unique records.  Though AWS always
    //    returns unique FileSystemIds, the field type is string|undefined.
    //    We shall avoid any records with undefined FileSystemId.
    // 3. DescribeFSxFileSystems() returns all filesystems in a given AWS
    //    region, spanning different VPCs. We shall return only the filesystems
    //    in the given VPC.

    allFSxFilesystems = allFSxFilesystems?.filter(
        ({ FileSystemType, FileSystemId, VpcId, StorageType }) =>
            FileSystemType &&
            FileSystemType === FSX_FILESYSTEM_TYPE &&
            FileSystemId &&
            FileSystemId.length > 0 &&
            VpcId &&
            vpcId === VpcId &&
            StorageType &&
            StorageType === FSX_STORAGE_TYPE
    );

    const ontapFSxFilesystems: FSxFileSystemType[] = await Promise.map(
        allFSxFilesystems!,
        async fileSystems => getFSXDetails(credentialsId, region, fileSystems),
        {
            concurrency: FSX_BATCH_CONCURRENCY_VALUE
        }
    );

    return { filesystems: ontapFSxFilesystems };
}

export { getFSxFileSystemsList };
