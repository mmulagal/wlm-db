import Promise from 'bluebird';
import randomize from 'randomatic';
import createError from 'http-errors';
import { Static } from '@fastify/type-provider-typebox';
import { DescribeNetworkInterfacesRequest } from '@aws-sdk/client-ec2';
import { DescribeBackupsCommandInput, ListTagsForResourceCommandInput, Tag } from '@aws-sdk/client-fsx';
import { attempt, compact, isEmpty } from 'lodash-es';
import {
    describeFSxFileSystems,
    describeFSxVolumes,
    describeFSxStorageVirtualMachines,
    describeFSxBackups,
    listResourceTags,
    createTag,
    describeFSx
} from '../../lib/aws/fsx';
import getLogger from '../../utils/logger';
import { FSxFileSystemSchema } from '../../routes/types/aws.types';
import {
    FSX_FILESYSTEM_TYPE,
    FSX_STORAGE_TYPE,
    AWS_RESOURCE_NAME_TAG,
    FSX_BATCH_CONCURRENCY_VALUE,
    SSM_COMMAND_CACHE_TYPE,
    AWS_FSX_TYPE,
    HttpErrorCodes
} from '../../utils/consts';
import { getNetworkInterfacesList } from './ec2-operations';
import { ResourceDetails } from '../../utils/common-types';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { getFsxArn } from '../../utils/utils';
import { listFSXFileSystem } from '../../lib/cloud-manager/fsx-core';
import { callSsmExecution } from './ssm-operations';
import { getMappedOntapVolumesScript, restGetUtilForOntap } from '../workloads/mssql/ssm-script-utils';

const logger = getLogger();

interface FsxStorage {
    storage: number;
}

type FSxFileSystemType = Static<typeof FSxFileSystemSchema>;

const TWENTYFOUR_HOURS = '24h';

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
    logger.info('List FSx for ONTAP of type SSD', { credentialsId, region, vpcId });
    let allFSxFilesystems;
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        // Call the internal fsx service to get the list of fsx details
        allFSxFilesystems = await getFSXFileSystemListForDemo(credentialsId, region, vpcId);
        return { filesystems: allFSxFilesystems };
    }

    allFSxFilesystems = await describeFSxFileSystems(credentialsId, region);
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

async function getFSXFileSystemListForDemo(credentialsId: string, region: string, vpcId: string) {
    logger.info('Get FSX file systems list for demo', { credentialsId, region, vpcId });

    const items = await listFSXFileSystem(credentialsId, region, true);
    logger.debug('file system list api response', {
        items
    });
    const filteredResponse = items?.map(
        ({
            id,
            name,
            status: { status },
            networkInterfaceIds,
            vpcId: fsxVpcId,
            subnetIds,
            region: fsxRegion,
            awsAccountId,
            deploymentType
        }) => ({
            fileSystemId: id,
            name,
            lifecycle: status,
            networkInterfaceIds,
            vpcId: fsxVpcId,
            ...(deploymentType === 'SINGLE_AZ'
                ? { subnetIds: [subnetIds?.primary] }
                : { subnetIds: [subnetIds?.primary, subnetIds?.secondary] }),
            kmsKeyId: `arn:aws:kms:${fsxRegion}:${awsAccountId}:key/${randomize('A0', 17)}`
        })
    );
    return filteredResponse;
}

async function getStorageDataUsingSSM(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    apiEndpoint: string,
    apiFilter: string,
    apiQuery: string,
    activeNodeInstanceId: string
) {
    logger.info('Fetching storage savings details', credentialsId, region, activeNodeInstanceId);

    let commands;

    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        commands = [
            `C:\\SSM\\OntapRestGet.ps1 -FSxID test-fsx2345 -FSxRegion test-region -OntapResourceEndpoint '${apiEndpoint}' -OntapResourceFilter '${apiFilter}' -OntapResourceQuery '${apiQuery}'`
        ];
    } else {
        commands = [
            `C:\\SSM\\OntapRestGet.ps1  -FSxID ${fileSystemId} -FSxRegion ${region} -OntapResourceEndpoint '${apiEndpoint}' -OntapResourceFilter '${apiFilter}' -OntapResourceQuery '${apiQuery}'`
        ];
    }

    const response = await callSsmExecution(credentialsId, region, commands, activeNodeInstanceId);

    const cleanResponse = response?.replaceAll('\r\n', '');
    const jsonResponse = JSON.parse(cleanResponse!);
    return jsonResponse;
}

async function getVolumeIdsFromUuids(credentialsId: string, region: string, fsxId: string, volumeUuids: string[]) {
    logger.info('List volume ids in an fsx', {
        credentialsId,
        region,
        fsxId,
        volumeUuids
    });

    const { Volumes: volumes } = await describeFSxVolumes(credentialsId, region, fsxId);

    const volumeIds = (volumes || [])
        .filter(({ OntapConfiguration: { UUID = '' } = {} }) => volumeUuids.includes(UUID))
        .map(volume => volume.VolumeId);

    logger.debug('List volume ids in an fsx response', volumeIds);

    return compact(volumeIds);
}

async function isFsxnAwsBackupEnabled(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    activeNodeInstanceId?: string
) {
    logger.info('Check if FSX for NetApp ONTAP AWS backup is enabled', {
        credentialsId,
        region,
        fileSystemId
    });

    const volumeUuids = await getMappedOntapVolumes(credentialsId, region, fileSystemId, activeNodeInstanceId);

    if (!isEmpty(volumeUuids)) {
        const volumeIds = await getVolumeIdsFromUuids(credentialsId, region, fileSystemId, volumeUuids);
        if (!isEmpty(volumeIds)) {
            const input: DescribeBackupsCommandInput = {
                Filters: [
                    {
                        Name: 'volume-id',
                        Values: volumeIds
                    }
                ]
            };
            const backups = await describeFSxBackups(credentialsId, region, input);

            return backups.Backups?.length !== 0;
        }
        return false;
    }
}

async function isFsxwAwsBackupEnabled(credentialsId: string, region: string, fileSystemId: string) {
    logger.info('Check if FSX for Windows AWS backup is enabled', {
        credentialsId,
        region,
        fileSystemId
    });

    const input: DescribeBackupsCommandInput = {
        Filters: [
            {
                Name: 'file-system-id',
                Values: [fileSystemId]
            }
        ]
    };

    const backups = await describeFSxBackups(credentialsId, region, input);

    return backups.Backups?.length !== 0;
}

async function getOntapVolumesSnapshotCount(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    activeNodeInstanceId?: string
) {
    logger.info('Fetching ontap snapshots count ', {
        credentialsId,
        region,
        fileSystemId
    });

    try {
        const volumeUuids = await getMappedOntapVolumes(credentialsId, region, fileSystemId, activeNodeInstanceId);

        if (!isEmpty(volumeUuids)) {
            const apiEndpoint = '/storage/volumes';
            const apiFilter = `uuid=${volumeUuids?.join()}`;
            const apiQuery = 'fields=snapshot_count';
            if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
                fileSystemId = 'test-fsx2345';
                region = 'test-region';
            }

            const command = restGetUtilForOntap(fileSystemId, region, apiEndpoint, apiFilter, apiQuery);

            const response = await callSsmExecution(credentialsId, region, [command], activeNodeInstanceId!);

            const cleanResponse = response?.replaceAll('\r\n', '');
            let parsedResponse = attempt(JSON.parse, cleanResponse);

            logger.debug({ parsedResponse });
            parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;

            if (parsedResponse && !isEmpty(parsedResponse.records)) {
                const atleastOneVolumeHasSnapshots = parsedResponse.records.some(
                    ({ snapshot_count: snapshotCount }: { snapshot_count: number }) => snapshotCount
                );

                return atleastOneVolumeHasSnapshots;
            }
        }
    } catch (err) {
        logger.error('Failed executing SSM script to get ontap snapshots', { err });
    }
}

async function getMappedOntapVolumes(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    activeNodeInstanceId?: string
) {
    logger.info('Get ontap volumes mapped to data drive of all databases in a server', {
        credentialsId,
        region,
        fileSystemId,
        activeNodeInstanceId
    });

    const cacheKey = `${activeNodeInstanceId}-mapped-volumes`;
    if (hasCache(SSM_COMMAND_CACHE_TYPE, cacheKey)) {
        const response = readFromCacheByKey(SSM_COMMAND_CACHE_TYPE, cacheKey);
        return response;
    }

    try {
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            fileSystemId = 'test-fsx';
        }
        const command = getMappedOntapVolumesScript(fileSystemId, region);

        const response = await callSsmExecution(credentialsId, region!, [command], activeNodeInstanceId!);

        const cleanResponse = response?.replaceAll('\r\n', '');
        let parsedResponse = attempt(JSON.parse, cleanResponse);

        parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;
        logger.debug({ parsedResponse });

        if (parsedResponse && !isEmpty(parsedResponse.records)) {
            const volumeUuids = parsedResponse.records.map(({ uuid }: { uuid: string }) => uuid);

            writeToCache(SSM_COMMAND_CACHE_TYPE, cacheKey, volumeUuids, TWENTYFOUR_HOURS);

            return volumeUuids;
        }
    } catch (err) {
        logger.error('Failed executing SSM script to get ontap mapped volumes', { err });
    }
}

async function tagFsxResource(
    credentialsId: string,
    region: string,
    awsAccountId: string,
    accountId: string,
    fsxId: string,
    tags: Tag[]
) {
    logger.info('Adding tag to Fsx resource', credentialsId, region, awsAccountId, accountId, fsxId);
    const fsxArn = getFsxArn(awsAccountId, region, fsxId);
    createTag(credentialsId, region, accountId, fsxArn, tags);
}
async function getCostAllocationTagFsxResource(resourceDetail: ResourceDetails) {
    logger.info('Get Fsx Resources which has cost allocation tag attached');
    const {
        region,
        co_relation_id: fileSystemId,
        cloud_provider_account_id: awsAccountId,
        credentials_id: credentialsId
    } = resourceDetail;
    try {
        const resourceArn = getFsxArn(awsAccountId!, region!, fileSystemId!);
        const input: ListTagsForResourceCommandInput = {
            ResourceARN: resourceArn
        };
        const response = await listResourceTags(credentialsId, region!, input);
        return response;
    } catch (error) {
        logger.error(`Get fsx resources with cost allocation tag failed for filesystem ${fileSystemId} `, error);
    }
}

async function getFsxStorageCapacity(credentialsId: string, region: string, fsxId: string) {
    logger.info('Get FSx Storage capacity');
    const cacheKey = `${fsxId}-storage-capacity`;
    if (hasCache(AWS_FSX_TYPE, cacheKey)) {
        const response = readFromCacheByKey(AWS_FSX_TYPE, cacheKey) as FsxStorage;
        return response;
    }

    try {
        const { FileSystems: fileSystems } = await describeFSx(credentialsId, region!, {
            FileSystemIds: [fsxId]
        });

        const fsxStorage: FsxStorage = {
            storage: fileSystems![0].StorageCapacity!
        };

        writeToCache(AWS_FSX_TYPE, cacheKey, fsxStorage);
        return fsxStorage;
    } catch (error: any) {
        const errorMessage = `Unable to retrieve FSx for NetApp ONTAP storage capacity: ${error}`;
        logger.error(errorMessage);
        if (error.name === 'FileSystemNotFound') {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
    }
}

export {
    getFSxFileSystemsList,
    isFsxnAwsBackupEnabled,
    isFsxwAwsBackupEnabled,
    getOntapVolumesSnapshotCount,
    getStorageDataUsingSSM,
    getMappedOntapVolumes,
    tagFsxResource,
    getCostAllocationTagFsxResource,
    getFsxStorageCapacity,
    getFSXFileSystemListForDemo
};
