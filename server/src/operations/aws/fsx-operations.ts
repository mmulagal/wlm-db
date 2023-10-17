import Promise from 'bluebird';
import { Static } from '@fastify/type-provider-typebox';
import { DescribeNetworkInterfacesRequest } from '@aws-sdk/client-ec2';
import { describeFSxFileSystems, describeFSxVolumes, describeFSxStorageVirtualMachines } from '../../lib/aws/fsx';
import getLogger from '../../utils/logger';
import { FSxFileSystemSchema } from '../../routes/types/aws.types';
import {
    FSX_FILESYSTEM_TYPE,
    FSX_STORAGE_TYPE,
    AWS_RESOURCE_NAME_TAG,
    FSX_BATCH_CONCURRENCY_VALUE
} from '../../utils/consts';
import { getNetworkInterfacesList } from './ec2-operations';
import { callSsmExecution } from '../workloads/mssql/mssql-operations';

const logger = getLogger();

type FSxFileSystemType = Static<typeof FSxFileSystemSchema>;

async function getFSXDetails(credentialsId: string, region: string, fileSys: any) {
    const enetInterfaceIds = fileSys.NetworkInterfaceIds;
    const enetInterfaces: DescribeNetworkInterfacesRequest = {
        Filters: [
            {
                Name: 'network-interface-id',
                Values: enetInterfaceIds
            }
        ]
    };
    const [{ StorageVirtualMachines: fsxSVMs }, { Volumes: fsxVolumes }, networkInterfacesList] = await Promise.all([
        describeFSxStorageVirtualMachines(credentialsId, region, fileSys.FileSystemId!),
        describeFSxVolumes(credentialsId, region, fileSys.FileSystemId!),
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

    const svmList: FSxFileSystemType['storageVirtualMachines'] = fsxSVMs?.map(
        ({
            StorageVirtualMachineId: storageVirtualMachineId,
            Name: storageVirtualMachineName,
            ResourceARN: resourceARN,
            Subtype: subtype,
            Lifecycle: lifeCycle,
            CreationTime: creationTime,
            UUID: uuid
        }) => ({
            storageVirtualMachineId,
            storageVirtualMachineName,
            resourceARN,
            lifeCycle,
            subtype,
            creationTime,
            uuid
        })
    );
    // Get the FSx filesystem name, if available.
    const { Tags: tags } = fileSys;
    const tag = tags?.find(({ Key: key }: { Key: string }) => key === AWS_RESOURCE_NAME_TAG);
    const { OntapConfiguration: ontapConfig } = fileSys;
    return {
        fileSystemId: fileSys.FileSystemId!,
        name: tag?.Value,
        kmsKeyId: fileSys.KmsKeyId,
        lifecycle: fileSys.Lifecycle!,
        networkInterfaceIds: fileSys.NetworkInterfaceIds,
        subnetIds: fileSys.SubnetIds,
        vpcId: fileSys.VpcId,
        ontapConfiguration: {
            deploymentType: ontapConfig.DeploymentType,
            endpointIpAddressRange: ontapConfig?.EndpointIpAddressRange,
            fsxAdminPassword: ontapConfig?.FsxAdminPassword,
            preferredSubnetId: ontapConfig?.PreferredSubnetId,
            routeTableIds: ontapConfig?.RouteTableIds,
            throughputCapacity: ontapConfig?.ThroughputCapacity,
            diskIopsConfiguration: {
                iops: ontapConfig?.DiskIopsConfiguration?.Iops,
                mode: ontapConfig?.DiskIopsConfiguration?.Mode
            },
            endpoints: {
                intercluster: {
                    dnsName: ontapConfig?.Endpoints?.Intercluster?.DNSName,
                    ipAddresses: ontapConfig?.Endpoints?.Intercluster?.IpAddresses
                },
                management: {
                    dnsName: ontapConfig?.Endpoints?.Management?.DNSName,
                    ipAddresses: ontapConfig?.Endpoints?.Management?.IpAddresses
                }
            }
        },
        volumes: volumesList,
        securityGroups: Array.from(sgs),
        storageVirtualMachines: svmList
    };
}

/*
 * Return Amazon FSx for NetApp ONTAP filesystems in the given AWS region
 * and also available from the given VPC.
 */
async function getFSxFileSystemsList(credentialsId: string, region: string, vpcId: string) {
    logger.info('List FSx ONTAP of type SSD', { credentialsId, region, vpcId });

    let allFSxFilesystems = await describeFSxFileSystems(credentialsId, region);

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
        async fileSystem => getFSXDetails(credentialsId, region, fileSystem),
        {
            concurrency: FSX_BATCH_CONCURRENCY_VALUE
        }
    );

    return { filesystems: ontapFSxFilesystems };
}

async function getVolumesUuids(credentialsId: string, region: string, fsxId: string) {
    logger.info('Getting UUIDs of volumes:', { credentialsId, region, fsxId });

    const volumeUuidList: string[] = [];
    const volumeList = await describeFSxVolumes(credentialsId, region, fsxId);

    volumeList.Volumes?.forEach(volume => {
        if (volume?.OntapConfiguration?.StorageVirtualMachineRoot === false && volume?.OntapConfiguration?.UUID) {
            volumeUuidList.push(volume.OntapConfiguration.UUID);
        }
    });

    return volumeUuidList;
}

async function getStorageDataUsingSSM(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    apiEndpoint: string,
    apiFilter: string,
    apiQuery: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string
) {
    logger.info('Fetching tables total count ', credentialsId, region, activeNodeInstanceId);

    // FIXME: Use AWS secrets instead of passing FSx username/password.

    // NOTE TO REVIEWERS:
    // FSx password isn't stored in WLMDB. However, it is necessary for making
    // REST API calls. For now we are using the hardcoded credentials.
    //
    // Though we can store the passwords in the secrets manager, the same needs
    // to be updated upon password updation.
    //
    // Moreover, secrets have a limit (though it seems big enough).  So in the
    // unfortunate case of consuming the whole quota, we won't be able to make
    // REST calls with a secret.
    //
    // Once we have a reliable way of storing FSx password, the
    // username/password can be saved as secret in AWS.

    const commands = [
        `C:\\SSM\\OntapRestGet.ps1 -FSxUserName fsxadmin -FSxPassword netapp1! -FSxID ${fileSystemId} -FSxRegion ${region} -OntapResourceEndpoint '${apiEndpoint}' -OntapResourceFilter '${apiFilter}' -OntapResourceQuery '${apiQuery}'`
    ];

    const response = await callSsmExecution(
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        standbyNodeInstanceId
    );

    const cleanResponse = response?.replaceAll('\r\n', '');
    const jsonResponse = JSON.parse(cleanResponse!);
    return jsonResponse;
}
export { getFSxFileSystemsList, getVolumesUuids, getStorageDataUsingSSM };
