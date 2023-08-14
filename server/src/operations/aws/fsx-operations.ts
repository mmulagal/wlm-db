import { describeFSxFileSystems, describeFSxVolumes } from '../../lib/aws/fsx';
import getLogger from '../../utils/logger';
import { Static } from '@fastify/type-provider-typebox';
import { FSxFileSystemSchema } from '../../routes/types/aws.types';
import { FSX_FILESYSTEM_TYPE, FSX_STORAGE_TYPE, AWS_RESOURCE_NAME_TAG } from '../../utils/consts';

const logger = getLogger();

type FSxFileSystemType = Static<typeof FSxFileSystemSchema>;

/*
 * Return Amazon FSx for NetApp ONTAP filesystems in the given AWS region
 * and also available from the given VPC.
 */
async function getFSxFileSystemsList(
    credentialsId: string,
    region: string,
    vpcId: string
): Promise<{ filesystems: FSxFileSystemType[] }> {
    logger.info('List FSx ONTAP of type SSD', { credentialsId, region, vpcId });

    let { FileSystems: allFSxFilesystems } = await describeFSxFileSystems(credentialsId, region);
    const ontapFSxFilesystems: FSxFileSystemType[] = [];

    // 1. We are supporting only Amazon FSx for NetApp ONTAP filesystems, which
    //    are always of storageType == SSD and fileSystemType == ONTAP.
    // 2. The returned FileSystemIds need to be always defined and unique, so
    //    that the API caller always gets unique records.  Though AWS always
    //    returns unique FileSystemIds, the field type is string|undefined.
    //    We shall avoid any records with undefined FileSystemId.
    // 3. DescribeFSxFileSystems() returns all filesystems in a given AWS
    //    region, spanning different VPCs. We shall return only the filesystems
    //    in the given VPC.
    allFSxFilesystems = allFSxFilesystems?.filter(({ FileSystemType, FileSystemId, VpcId, StorageType }) => {
        return (
            FileSystemType &&
            FileSystemType === FSX_FILESYSTEM_TYPE &&
            FileSystemId &&
            FileSystemId.length > 0 &&
            VpcId &&
            vpcId === VpcId &&
            StorageType &&
            StorageType === FSX_STORAGE_TYPE
        );
    });

    if (allFSxFilesystems?.length) {
        for (const fs of allFSxFilesystems) {
            const volumesList: FSxFileSystemType['volumes'] = [];

            const { Volumes: fsxVolumes } = await describeFSxVolumes(credentialsId, region, fs.FileSystemId!);

            fsxVolumes?.forEach(
                ({ VolumeId: volumeId, VolumeType: volumeType, OntapConfiguration: volumeOntapConfiguration }) => {
                    volumesList.push({
                        volumeId,
                        volumeType,
                        securityStyle: volumeOntapConfiguration?.SecurityStyle,
                        sizeInMegabytes: volumeOntapConfiguration?.SizeInMegabytes,
                        storageEfficiencyEnabled: volumeOntapConfiguration?.StorageEfficiencyEnabled,
                        storageVirtualMachineId: volumeOntapConfiguration?.StorageVirtualMachineId,
                        ontapVolumeType: volumeOntapConfiguration?.OntapVolumeType
                    });
                }
            );

            // Get the FSx filesystem name, if available.
            const { Tags: tags } = fs;
            const tag = tags?.find(({ Key: key }) => key === AWS_RESOURCE_NAME_TAG);

            ontapFSxFilesystems.push({
                fileSystemId: fs.FileSystemId!,
                name: tag?.Value,
                kmsKeyId: fs.KmsKeyId,
                networkInterfaceIds: fs.NetworkInterfaceIds,
                subnetIds: fs.SubnetIds,
                vpcId: fs.VpcId,
                ontapConfiguration: {
                    deploymentType: fs.OntapConfiguration?.DeploymentType,
                    endpointIpAddressRange: fs.OntapConfiguration?.EndpointIpAddressRange,
                    fsxAdminPassword: fs.OntapConfiguration?.FsxAdminPassword,
                    preferredSubnetId: fs.OntapConfiguration?.PreferredSubnetId,
                    routeTableIds: fs.OntapConfiguration?.RouteTableIds,
                    throughputCapacity: fs.OntapConfiguration?.ThroughputCapacity,
                    diskIopsConfiguration: {
                        iops: fs.OntapConfiguration?.DiskIopsConfiguration?.Iops,
                        mode: fs.OntapConfiguration?.DiskIopsConfiguration?.Mode
                    },
                    endpoints: {
                        intercluster: {
                            dnsName: fs.OntapConfiguration?.Endpoints?.Intercluster?.DNSName,
                            ipAddresses: fs.OntapConfiguration?.Endpoints?.Intercluster?.IpAddresses
                        },
                        management: {
                            dnsName: fs.OntapConfiguration?.Endpoints?.Management?.DNSName,
                            ipAddresses: fs.OntapConfiguration?.Endpoints?.Management?.IpAddresses
                        }
                    }
                },
                volumes: volumesList
            });
        }
    }

    return { filesystems: ontapFSxFilesystems };
}

export { getFSxFileSystemsList };
