import randomize from 'randomatic';
import createError from 'http-errors';
import { Static } from '@fastify/type-provider-typebox';
import { DescribeNetworkInterfacesRequest } from '@aws-sdk/client-ec2';
import {
    Backup,
    DescribeBackupsCommandInput,
    FileSystem,
    ListTagsForResourceCommandInput,
    Tag
} from '@aws-sdk/client-fsx';
import { attempt, compact, isEmpty } from 'lodash-es';
import ms from 'ms';
import throat from 'throat';
import {
    describeFSxFileSystems,
    describeFSxVolumes,
    describeFSxStorageVirtualMachines,
    describeFSxBackups,
    listResourceTags,
    createTag,
    describeFSx,
    updateFsxVolumeSize,
    updateFileSystem
} from '../../lib/aws/fsx';
import getLogger from '../../utils/logger';
import { FSxFileSystemSchema } from '../../routes/types/aws.types';
import {
    FSX_FILESYSTEM_TYPE,
    FSX_STORAGE_TYPE,
    AWS_RESOURCE_NAME_TAG,
    AWS_FSX_TYPE,
    HttpErrorCodes,
    DEFAULT_INSTANCE_NAME,
    HA,
    SNAPCENTER_BACKUP_SNAPSHOT_COMMENT
} from '../../utils/consts';
import { getNetworkInterfacesList } from './ec2-operations';
import {
    AwsFsxNBackupConfig,
    DatabaseInstance,
    ResourceDetails,
    VolumeSpaceRecord,
    VolumeRecord
} from '../../utils/common-types';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { convertToBytes, divideArrayIntoChunks, getFsxArn, isDemo, sleep, sqlResponseParsing } from '../../utils/utils';
import { listFSXFileSystem } from '../../lib/cloud-manager/fsx-core';
import { callSsmExecution } from './ssm-operations';
import { getMappedOntapVolumesScript } from '../workloads/mssql/ssm-script-utils';
import { demoGetFsxnVolIdsFromOntapVolIds } from '../demo-operations';
import { GET_SNAPSHOT_DETAILS, OntapRestRequestParams } from '../workloads/mssql/continuous-optimization-scripts';

const logger = getLogger();

const isDemoFlow = isDemo();

interface FsxStorage {
    storage: number;
}

type FSxFileSystemType = Static<typeof FSxFileSystemSchema>;

async function getFSXDetails(credentialsId: string, region: string, fileSystems: FileSystem[]) {
    const allFileSystems: FSxFileSystemType[] = [];
    const fileSystemChunks = divideArrayIntoChunks(fileSystems, 20);
    await Promise.all(
        fileSystemChunks.map(
            throat(3, async fileSystemChunk => {
                const fileSystemIds = fileSystemChunk.map(({ FileSystemId }) => FileSystemId!).flat();
                const enetInterfaceIds = fileSystemChunk.map(({ NetworkInterfaceIds }) => NetworkInterfaceIds!).flat();
                const enetInterfaces: DescribeNetworkInterfacesRequest = {
                    Filters: [
                        {
                            Name: 'network-interface-id',
                            Values: enetInterfaceIds
                        }
                    ]
                };
                const [{ StorageVirtualMachines: fsxSVMs }, { Volumes: fsxVolumes }, networkInterfacesList] =
                    await Promise.all([
                        describeFSxStorageVirtualMachines(credentialsId, region, fileSystemIds, { useCache: true }),
                        describeFSxVolumes(credentialsId, region, fileSystemIds, undefined, { useCache: true }),
                        getNetworkInterfacesList(credentialsId, region, enetInterfaces)
                    ]);

                fileSystemChunk.forEach(fileSys => {
                    const sgs = new Set(
                        networkInterfacesList
                            .filter(enet => fileSys.NetworkInterfaceIds.includes(enet.id))
                            .map(enet => enet.securityGroups ?? [])
                            .flat()
                    );
                    const volumesList: FSxFileSystemType['volumes'] = fsxVolumes
                        ?.filter(volume => volume.FileSystemId === fileSys.FileSystemId)
                        .map(
                            ({
                                VolumeId: volumeId,
                                VolumeType: volumeType,
                                OntapConfiguration: volumeOntapConfiguration
                            }) => ({
                                volumeId,
                                volumeType,
                                securityStyle: volumeOntapConfiguration?.SecurityStyle,
                                sizeInMegabytes: volumeOntapConfiguration?.SizeInMegabytes,
                                storageEfficiencyEnabled: volumeOntapConfiguration?.StorageEfficiencyEnabled,
                                storageVirtualMachineId: volumeOntapConfiguration?.StorageVirtualMachineId,
                                ontapVolumeType: volumeOntapConfiguration?.OntapVolumeType
                            })
                        );

                    const svmList: FSxFileSystemType['storageVirtualMachines'] = fsxSVMs
                        ?.filter(svm => svm.FileSystemId === fileSys.FileSystemId)
                        .map(
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
                    const { Tags: tags } = fileSys;
                    const tag = tags?.find((t: { Key: string }) => t.Key === AWS_RESOURCE_NAME_TAG);
                    const { OntapConfiguration: ontapConfig } = fileSys;
                    allFileSystems.push({
                        fileSystemId: fileSys.FileSystemId!,
                        name: tag?.Value,
                        kmsKeyId: fileSys.KmsKeyId,
                        lifecycle: fileSys.Lifecycle!,
                        networkInterfaceIds: fileSys.NetworkInterfaceIds,
                        subnetIds: fileSys.SubnetIds,
                        vpcId: fileSys.VpcId,
                        ontapConfiguration: {
                            deploymentType: ontapConfig?.DeploymentType,
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
                    });
                });
            })
        )
    );

    return allFileSystems;
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

    allFSxFilesystems = await describeFSxFileSystems(credentialsId, region, { useCache: true });
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

    const ontapFSxFilesystems: FSxFileSystemType[] = await getFSXDetails(credentialsId, region, allFSxFilesystems);

    // const ontapFSxFilesystems: FSxFileSystemType[] = await Promise.map(
    //     allFSxFilesystems!,
    //     async fileSystem => getFSXDetails(credentialsId, region, fileSystem),
    //     {
    //         concurrency: FSX_BATCH_CONCURRENCY_VALUE
    //     }
    // );

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
    const ssmComment = 'Fetching storage savings details';
    logger.info(ssmComment, credentialsId, region, activeNodeInstanceId);

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
    const response = await callSsmExecution(credentialsId, region, commands, activeNodeInstanceId, ssmComment);

    const cleanResponse = response?.replaceAll('\r\n', '');
    const jsonResponse = JSON.parse(cleanResponse!);
    return jsonResponse;
}

async function getFsxnVolIdsFromOntapVolIds(
    credentialsId: string,
    region: string,
    fsxId: string,
    volumeUuids: string[],
    accountId?: string
) {
    logger.info('Get the Fsxn volume ids from the ontap volume ids', {
        credentialsId,
        region,
        fsxId,
        volumeUuids,
        accountId
    });

    const { Volumes: volumes = [] } = await describeFSxVolumes(credentialsId, region, [fsxId], accountId, {
        useCache: true
    });

    const volumeIds: string[] = [];
    const uuidVolumeIdMap: Record<string, string> = {};
    if (isDemo()) {
        return demoGetFsxnVolIdsFromOntapVolIds(credentialsId, region, fsxId, volumeUuids);
    }
    volumes.forEach(volume => {
        const { OntapConfiguration: { UUID = '' } = {}, VolumeId = '' } = volume;
        if (volumeUuids.includes(UUID)) {
            volumeIds.push(VolumeId);
            uuidVolumeIdMap[VolumeId] = UUID;
        }
    });

    logger.debug('List volume ids in an fsx response', volumeIds);

    return {
        volumeIds: compact(volumeIds),
        uuidVolumeIdMap
    };
}

async function isFsxnAwsBackupEnabled(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    volumeUuids: string[],
    volumeDBMap?: any,
    activeNodeInstanceId?: string,
    accountId?: string
) {
    logger.info('Check if FSX for NetApp ONTAP AWS backup is enabled.', {
        credentialsId,
        region,
        fileSystemId,
        volumeUuidsLength: volumeUuids?.length,
        activeNodeInstanceId,
        accountId
    });

    if (!isEmpty(volumeUuids)) {
        const { volumeIds, uuidVolumeIdMap } = await getFsxnVolIdsFromOntapVolIds(
            credentialsId,
            region,
            fileSystemId,
            volumeUuids,
            accountId
        );
        let volumeDBMapWithBackupFlag;
        const backups: Backup[] = [];
        if (!isEmpty(volumeIds)) {
            const volumeChunks = divideArrayIntoChunks(volumeIds, 20);
            await Promise.all(
                volumeChunks.map(
                    throat(3, async volumeIdsChunk => {
                        const input: DescribeBackupsCommandInput = {
                            Filters: [
                                {
                                    Name: 'volume-id',
                                    Values: volumeIdsChunk
                                }
                            ]
                        };
                        const { Backups } = await describeFSxBackups(credentialsId, region, input, accountId, {
                            useCache: true
                        });
                        backups.push(...Backups!);
                    })
                )
            );

            // Update the volumeDBMap to mark the volumes that have backups.
            // And the Backup is latest by 2 days
            const volumeUuidsInBackups: string[] = [];
            const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
            const now = new Date();

            backups?.forEach(backup => {
                const volumeId = backup.Volume?.VolumeId;
                const volumeUuid = volumeId && uuidVolumeIdMap[volumeId];
                if (volumeUuid && uuidVolumeIdMap[volumeId]) {
                    if (backup.CreationTime) {
                        const backupTime = new Date(backup.CreationTime);
                        const isLatest = now.getTime() - backupTime.getTime() < twoDaysInMs;
                        if (isLatest && !volumeUuidsInBackups.includes(volumeUuid)) {
                            volumeUuidsInBackups.push(volumeUuid);
                        } else if (!isLatest) {
                            logger.debug('Found old backup', volumeUuid, backup.BackupId, backupTime);
                        }
                    }
                }
            });

            if (volumeDBMap) {
                // This function maps the volumes in the volumeDBMap to their backup status,
                // indicating whether they have backups or not. {master: true, model: true, msdb: true};
                volumeDBMapWithBackupFlag = volumeDBMap?.reduce((acc: any, volume: any) => {
                    const fsxbackup = volumeUuidsInBackups.includes(volume.ontapVolumeuuid);
                    acc[volume.databaseName] = fsxbackup;
                    return acc;
                }, {});
            }

            logger.debug('fsx backups here', backups, uuidVolumeIdMap, volumeDBMapWithBackupFlag);
            return { volumeDBMapWithBackupFlag, volumeUuidsInBackups };
        }
        return { volumeDBMapWithBackupFlag: {}, volumeUuidsInBackups: [] };
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

    const backups = await describeFSxBackups(credentialsId, region, input, undefined, { useCache: true });

    return backups.Backups?.length !== 0;
}

async function getOntapVolumesSnapshotCount(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    volumeRecords: VolumeRecord[],
    volumeDBMap: any
) {
    logger.info('Fetching ontap snapshots count ', {
        credentialsId,
        region,
        fileSystemId,
        volumeRecordsLength: volumeRecords?.length
    });

    try {
        if (!isEmpty(volumeRecords)) {
            // Update the volumeDBMap to mark the volumes that have local snapshots protected.
            // Iterate through the volumeDBMap and check if the corresponding volume in the volumesMap has a snapshot count greater than 0.
            // If so, set the localSnapshotsProtected property of the volumeDetail to true.
            const volumesMap = volumeRecords?.reduce((map: Record<string, number>, volume) => {
                map[volume.uuid] = (volume?.snapshot_count as number) || 0;
                return map;
            }, {});

            const volumeDBMapWithProtectionFlag = volumeDBMap?.reduce(
                (
                    acc: any,
                    volumeDetail: {
                        ontapVolumeuuid: string;
                        localSnapshotsProtected: boolean;
                        databaseName: string;
                    }
                ) => {
                    if (volumesMap[volumeDetail.ontapVolumeuuid] > 0) {
                        acc[volumeDetail.databaseName] = true;
                    } else {
                        acc[volumeDetail.databaseName] = false;
                    }
                    return acc;
                },
                {}
            );

            return volumeDBMapWithProtectionFlag;
        }
    } catch (err) {
        logger.error('Failed executing SSM script to get ontap snapshots', { err });
    }
}

async function getMappedOntapVolumes(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    isSystemDatabase: boolean,
    activeNodeInstanceId?: string,
    instanceNames?: string[],
    isSqlAuthEnabled = false,
    includeLogVolumes = false,
    accountId?: string,
    executionTimeout?: string,
    svmOntapUuid?: string,
    instanceOntapDetails?: Record<string, object>,
    fields: string = ''
) {
    const ssmComment = 'Get ontap volumes mapped to data drive of all databases in a server';
    logger.info(ssmComment, {
        credentialsId,
        region,
        fileSystemId,
        activeNodeInstanceId,
        isSystemDatabase,
        isSqlAuthEnabled,
        includeLogVolumes,
        accountId,
        executionTimeout,
        svmOntapUuid,
        fields
    });

    try {
        // retrieve the mapped volumes for system databases alone when isSystemDatabase is true otherwise includes user dbs also
        const psIsSystemDatabase = isSystemDatabase ? '$true' : '$false';

        const command = getMappedOntapVolumesScript(
            fileSystemId,
            region,
            psIsSystemDatabase,
            instanceNames,
            isSqlAuthEnabled,
            fields,
            includeLogVolumes,
            svmOntapUuid,
            instanceOntapDetails
        );

        const response = await callSsmExecution(
            credentialsId,
            region!,
            [command],
            activeNodeInstanceId!,
            ssmComment,
            accountId,
            true,
            executionTimeout,
            true
        );

        const cleanResponse = response?.replaceAll('\r\n', '');
        let parsedResponse = attempt(JSON.parse, cleanResponse);

        parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;
        logger.debug({ parsedResponse });

        const instancesResponse: { [key: string]: any } = {};
        instanceNames?.forEach((iName: string) => {
            const originalInstanceName = iName;
            iName = isDemoFlow ? DEFAULT_INSTANCE_NAME : iName;
            if (
                parsedResponse?.[iName] &&
                !(typeof parsedResponse?.[iName] === 'string' && parsedResponse?.[iName].includes('error'))
            ) {
                const { volumeDBMap, volumes, lunNames } = parsedResponse?.[iName] ?? {};
                const normalizedVolumeDBMap = Array.isArray(volumeDBMap)
                    ? volumeDBMap
                    : volumeDBMap
                    ? [volumeDBMap]
                    : [];
                iName = originalInstanceName;
                if (volumes && !isEmpty(volumes?.records)) {
                    instancesResponse[iName] = {
                        volumeRecords: volumes.records,
                        volumeDBMap: normalizedVolumeDBMap,
                        lunNames
                    };
                } else {
                    instancesResponse[iName] = { volumeRecords: [], volumeDBMap: [], lunNames: [] };
                }
            } else {
                logger.error('Failed to get mapped ontap volumes for the instance:', iName, parsedResponse?.[iName]);
            }
        });

        return instancesResponse;
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
        const { FileSystems: fileSystems } = await describeFSx(
            credentialsId,
            region,
            {
                FileSystemIds: [fsxId]
            },
            undefined,
            { useCache: true }
        );

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

async function getFsxStorageDetails(credentialsId: string, region: string, fileSystemId: string) {
    logger.info('Getting FSx storage details', { credentialsId, region, fileSystemId });
    const [fsxSSDCapacity, { Volumes: fsxVolumes }] = await Promise.all([
        getFsxStorageCapacity(credentialsId, region, fileSystemId),
        describeFSxVolumes(credentialsId, region, [fileSystemId], undefined, { useCache: true })
    ]);

    const { storage } = fsxSSDCapacity ?? {};
    const ssdStorageCapacityInBytes = storage ? convertToBytes(storage, 'GiB') || 0 : 0;

    const totalVolumeSizeInBytes = fsxVolumes?.reduce((total, curr) => {
        const amount = curr.OntapConfiguration?.SizeInBytes || 0;
        return total + amount;
    }, 0);

    return { fsxSSDCapacity, ssdStorageCapacityInBytes, totalVolumeSizeInBytes };
}

async function getStorageDataFromOntap(
    activeNodeInstanceId: string,
    instanceDetails: DatabaseInstance[],
    isSqlAuthEnabled: boolean
) {
    const ssmComment = 'Get storage data from ONTAP';
    logger.info(ssmComment, ':', { activeNodeInstanceId, instancesLength: instanceDetails.length, isSqlAuthEnabled });

    try {
        const managedInstances = instanceDetails.filter(
            ({ isManaged, fsxn_ids: fsxnIds }) => isManaged && fsxnIds?.length
        );
        const [{ credentials_id: credentialsId, region, fsxn_ids: fsxnId }] = managedInstances;

        const instanceNames = managedInstances.map(({ database_instance_name: instanceName }) => instanceName);
        const command = getMappedOntapVolumesScript(
            fsxnId,
            region,
            '$false',
            instanceNames,
            isSqlAuthEnabled,
            'efficiency.space_savings.total,efficiency.space_savings.total_percent,space.size,space.used'
        );
        const response = await callSsmExecution(
            credentialsId,
            region!,
            [command],
            activeNodeInstanceId,
            ssmComment,
            undefined,
            true,
            undefined,
            true
        );

        const cleanResponse = response?.replaceAll('\r\n', '');
        let parsedResponse = attempt(JSON.parse, cleanResponse);

        parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;
        logger.debug({ parsedResponse });

        const instancesResponse: { [key: string]: any } = {};
        instanceNames?.forEach((iName: string) => {
            if (
                parsedResponse?.[iName] &&
                !(typeof parsedResponse?.[iName] === 'string' && parsedResponse?.[iName].includes('error'))
            ) {
                const { volumes } = parsedResponse?.[iName] ?? {};
                if (volumes && !isEmpty(volumes?.records)) {
                    const storageSavings = volumes.records.reduce(
                        (savings: Record<string, number>, { space, efficiency }: VolumeSpaceRecord) => ({
                            size: savings.size + space.size,
                            used: savings.used + space.used,
                            spaceSavings: savings.spaceSavings + efficiency.space_savings.total
                        }),
                        {
                            size: 0,
                            used: 0,
                            spaceSavings: 0
                        } as Record<string, number>
                    );
                    // storageSavings.spaceSavingsPercent = (storageSavings.spaceSavings / storageSavings.used) * 100;
                    instancesResponse[iName] = { ...storageSavings };
                } else {
                    instancesResponse[iName] = { size: 0, used: 0, spaceSavings: 0 };
                }
            } else {
                logger.error(
                    'Failed to get storage savings from ONTAP for the instance:',
                    iName,
                    parsedResponse?.[iName]
                );
            }
        });

        return instancesResponse;
    } catch (error) {
        logger.error('Failed executing SSM script to get storage data from ONTAP', { error });
    }
}

async function getFsxVolumeDetails(credentialsId: string, region: string, fsxId: string, fsxVolumeIds: string[]) {
    logger.info('Get FSx volume details', { credentialsId, region, fsxId, fsxVolumeIds });

    const params = {
        fileSystemIds: [fsxId],
        volumeIds: fsxVolumeIds
    };

    const { Volumes: fsxVolumes } = await describeFSxVolumes(credentialsId, region, { ...params }, undefined, {
        useCache: true
    });
    if (!fsxVolumes) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get FSx volume details');
    }
    return fsxVolumes;
}

async function updateVolumeSizeAndWaitForUpdate(
    credentialsId: string,
    region: string,
    accountId: string,
    fsxId: string,
    fsxVolumeId: string,
    fsxVolumeSizeBytes: number
) {
    logger.info('Update FSx volume size and waiting for it to update', {
        credentialsId,
        region,
        accountId,
        fsxId,
        fsxVolumeId,
        fsxVolumeSizeBytes
    });

    await updateFsxVolumeSize(credentialsId, region, accountId, fsxVolumeId, fsxVolumeSizeBytes);

    let currentVolumeSizeBytes;
    const maxRetries = 10;
    const intervalSeconds = '10s';
    let retries = 0;
    while (retries < maxRetries) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const [volumeDetails] = await getFsxVolumeDetails(credentialsId, region, fsxId, [fsxVolumeId]);
            currentVolumeSizeBytes = volumeDetails?.OntapConfiguration?.SizeInBytes;
            logger.info(`Current size of volume ${fsxVolumeId}: ${currentVolumeSizeBytes} bytes`);

            if (currentVolumeSizeBytes === fsxVolumeSizeBytes || isDemo()) {
                logger.info(`Volume ${fsxVolumeId} has reached the desired size: ${fsxVolumeSizeBytes} bytes`);
                return;
            }

            retries += 1;
            logger.info(`Waiting for ${intervalSeconds} before checking again...`);
            // eslint-disable-next-line no-await-in-loop
            await sleep(ms(intervalSeconds));
        } catch (error) {
            logger.error('Error while polling volume size:', error);
            retries += 1;
            // eslint-disable-next-line no-await-in-loop
            await sleep(ms(intervalSeconds));
        }
    }

    const errMsg = `Volume ${fsxVolumeId} did not get resized to the desired size: ${fsxVolumeSizeBytes} bytes`;
    logger.error(errMsg);
    throw createError(errMsg);
}

async function getIscsiTargetAddresses(credentialsId: string, region: string, fsxId: string, svmId: string) {
    // Fetch iSCSCI target addresses
    logger.info('Fetching iSCSI target addresses', { credentialsId, region, fsxId, svmId });
    const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
        credentialsId,
        region,
        [fsxId as string],
        { useCache: true }
    );
    const {
        Endpoints: { Iscsi: { IpAddresses: iscsiTargetAddresses = [] as string[] } = { IpAddresses: [] } } = {
            Iscsi: { IpAddresses: [] }
        }
    } = fsxSVMs?.find(svm => svm.StorageVirtualMachineId === svmId) || {};
    return iscsiTargetAddresses;
}

async function updateFsxBackup(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxFileSystemId: string,
    configuration: AwsFsxNBackupConfig
) {
    logger.info('Updating FSX backup policy', { credentialsId, region, fsxFileSystemId });
    try {
        await updateFileSystem(accountId, credentialsId, region, {
            FileSystemId: fsxFileSystemId,
            OntapConfiguration: {
                AutomaticBackupRetentionDays: configuration.automaticBackupRetentionDays,
                DailyAutomaticBackupStartTime: configuration.dailyAutomaticBackupStartTime
            }
        });
    } catch (err) {
        logger.error('Error updating file system:', err);
        throw err;
    }
}

async function validateSvmCountCapacity(
    credentialsId: string,
    region: string,
    deploymentType: string,
    fsxFileSystemId?: string
) {
    logger.info('Validating SVM count capacity', { credentialsId, region, fsxFileSystemId, deploymentType });

    if (fsxFileSystemId) {
        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            [fsxFileSystemId],
            { useCache: true }
        );
        const svmCount = fsxSVMs?.length || 0;
        if (deploymentType === HA && svmCount > 4) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `There is not enough space in FSxN to create additional SVMs required for PostgreSQL HA deployment. Current count: ${svmCount}`
            );
        } else if (svmCount > 5) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `There is not enough space in FSxN to create additional SVMs required for PostgreSQL deployment. Current count: ${svmCount}`
            );
        }
    }
}

async function isInstanceAppConsistentBackupEnabled(
    credentialsId: string,
    region: string,
    fsxId: string,
    volumesToCheck: string[],
    volumeDBMap: Array<{ ontapVolumeuuid: string; databaseName: string }>,
    activeNodeInstanceid: string
) {
    logger.info(
        'Checking if app consistent backup details for MSSQL server are available in snapshot',
        fsxId,
        credentialsId,
        region
    );
    try {
        const ontapApiQueryParams: OntapRestRequestParams = {
            queryFilter: `comment=${SNAPCENTER_BACKUP_SNAPSHOT_COMMENT}&max_records=1`,
            queryFields: 'comment'
        };
        const command = [GET_SNAPSHOT_DETAILS(volumesToCheck, fsxId, region, ontapApiQueryParams)];
        const ssmComment = 'Get snapshot copy details for volumes';
        const rawResponse = await callSsmExecution(credentialsId, region, command, activeNodeInstanceid, ssmComment);
        const { response: ssmResponse, error: ssmError } = sqlResponseParsing(rawResponse);
        if (!isEmpty(ssmError) || isEmpty(ssmResponse)) {
            throw Error(
                `Error executing SSM command to retrieve snapshot copy details for volumes: ${volumesToCheck}. Error: ${ssmError}`
            );
        }
        const appConsistentBackupMap: Record<string, boolean> = {};

        for (const db of volumeDBMap) {
            const { databaseName, ontapVolumeuuid } = db;
            const { comment = '' } = ssmResponse?.[ontapVolumeuuid] ?? {};
            appConsistentBackupMap[databaseName] = isDemoFlow || comment === SNAPCENTER_BACKUP_SNAPSHOT_COMMENT;
        }

        return appConsistentBackupMap;
    } catch (error) {
        const errorMsg = `Error while fetching app consistent backup details: ${error}`;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
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
    getFSXFileSystemListForDemo,
    getFSXDetails,
    getStorageDataFromOntap,
    getFsxStorageDetails,
    getFsxVolumeDetails,
    getFsxnVolIdsFromOntapVolIds,
    updateVolumeSizeAndWaitForUpdate,
    getIscsiTargetAddresses,
    updateFsxBackup,
    validateSvmCountCapacity,
    isInstanceAppConsistentBackupEnabled
};
