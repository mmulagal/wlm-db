import { describeFSxFileSystems /*, describeFSxVolumes */ } from '../../lib/aws/fsx';
import getLogger from '../../utils/logger';
import { Static } from '@sinclair/typebox';
import { FSxFileSystemSchema } from '../../routes/types/aws.types';

const logger = getLogger();

type FSxFileSystem = Static<typeof FSxFileSystemSchema>;

/*
 * Return Amazon FSx for NetApp ONTAP filesystems in the given AWS region
 * and also available from the given VPC.
 */
async function getFSxFileSystemsList(
    credentialsId: string,
    region: string,
    vpcId: string
): Promise<{ filesystems: FSxFileSystem[] }> {
    logger.info('List FSx ONTAP of type SSD', Array.from(arguments)); // eslint-disable-line

    let { FileSystems: fsxFilesystems } = await describeFSxFileSystems(credentialsId, region);
    var ontapFSxFilesystems: Array<FSxFileSystem> = []; // eslint-disable-line

    // 1. We are supporting only Amazon FSx for NetApp ONTAP filesystems, which
    //    are always of storageType == SSD and fileSystemType == ONTAP.
    // 2. The returned FileSystemIds need to be always defined and unique, so
    //    that the API caller always gets unique records.  Though AWs alway
    //    returns unique FileSystemIds, the field type is string|undefined.
    //    We shall avoid any records with undefined FileSystemId.
    // 3. DescribeFSxFileSystems() always returns all filesystems within
    //    a given AWS region.  We shall avoid returning any filesystems not
    //    in the given VPC.
    fsxFilesystems = fsxFilesystems?.filter(({ FileSystemType, FileSystemId, VpcId, StorageType }) => {
        return (
            FileSystemType &&
            FileSystemType === 'ONTAP' &&
            FileSystemId &&
            FileSystemId.length > 0 &&
            VpcId &&
            vpcId === VpcId &&
            StorageType &&
            StorageType === 'SSD'
        );
    });

    fsxFilesystems?.forEach(async fs => {
        const volumesList: FSxFileSystem['volumes'] = [];

        /* NOTE TO REVIEWERS:  HAVING ISSUES WHILE PROCESSING VOLUME ATTRIBUTES OF A FILESYSTEM.
            SENDING THE REMAINING CODE SO THAT REVIEW CAN BE IN PROGRESS.
        /*
            This block of code is causing no FSx filesystem details in API response.
        const { Volumes: fsxVolumes } = await describeFSxVolumes(credentialsId, region, fs.FileSystemId!);

        fsxVolumes?.forEach(vol => {
            volumesList.push({
                volumeId: vol.VolumeId!,
                volumeType: vol.VolumeType,
                securityStyle: vol.OntapConfiguration?.SecurityStyle,
                sizeInMegabytes: vol.OntapConfiguration?.SizeInMegabytes,
                storageEfficiencyEnabled: vol.OntapConfiguration?.StorageEfficiencyEnabled,
                storageVirtualMachineId: vol.OntapConfiguration?.StorageVirtualMachineId,
                ontapVolumeType: vol.OntapConfiguration?.OntapVolumeType
            });
        });
        */

        /*
            This block of code returns FSx filesystem + volume details in API response.
        volumesList.push({
            volumeId: '1volumeID',
            volumeType: '1volumeType',
            securityStyle: '1securityStyle',
            sizeInMegabytes: 100,
            storageEfficiencyEnabled: false,
            storageVirtualMachineId: '1svmId',
            ontapVolumeType: '1RW'
        });
        volumesList.push({
            volumeId: '2volumeID',
            volumeType: '2volumeType',
            securityStyle: '2securityStyle',
            sizeInMegabytes: 100,
            storageEfficiencyEnabled: false,
            storageVirtualMachineId: '2svmId',
            ontapVolumeType: '2RW'
        });
*/
        ontapFSxFilesystems.push({
            fileSystemId: fs.FileSystemId!,
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
                endPoints: {
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
    });

    return { filesystems: ontapFSxFilesystems };
}

export { getFSxFileSystemsList };
