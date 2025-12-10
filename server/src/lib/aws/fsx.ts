import {
    FSxClient,
    paginateDescribeVolumes,
    paginateDescribeFileSystems,
    paginateDescribeStorageVirtualMachines,
    DescribeBackupsCommandOutput,
    DescribeBackupsCommand,
    DescribeFileSystemsCommand,
    DescribeFileSystemsCommandInput,
    DescribeFileSystemsCommandOutput,
    ListTagsForResourceCommand,
    ListTagsForResourceCommandOutput,
    TagResourceCommand,
    TagResourceCommandOutput,
    Tag,
    ListTagsForResourceCommandInput,
    DescribeVolumesCommandInput,
    DescribeStorageVirtualMachinesCommandInput,
    DescribeBackupsCommandInput,
    UpdateVolumeCommand,
    UpdateFileSystemCommand,
    UpdateFileSystemCommandInput
} from '@aws-sdk/client-fsx';

import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import addCacheMiddleware from '../../utils/aws-sdk-middlewares';
import { AWSSDKCacheParams } from '../../utils/common-types';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getFSxClient(
    credentialsId: string,
    region: string,
    accountId?: string,
    cacheParams: AWSSDKCacheParams = {}
) {
    logger.debug('Getting FSx client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return addCacheMiddleware(new FSxClient({ credentials, region }), { ...cacheParams, credentialsId });
}

async function describeFSxFileSystems(credentialsId: string, region: string, cacheParams?: AWSSDKCacheParams) {
    logger.info('Describe FSx filesystems:', { credentialsId, region });

    const client = await getFSxClient(credentialsId, region, undefined, cacheParams);

    const paginator = paginateDescribeFileSystems({ client }, {});

    const fileSystems = [];
    for await (const page of paginator) {
        if (page.FileSystems?.length) {
            fileSystems.push(...page.FileSystems);
        }
    }

    logger.debug('Describe FSx filesystem response:', fileSystems);

    return fileSystems;
}

async function describeFSx(
    credentialsId: string,
    region: string,
    input: DescribeFileSystemsCommandInput,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<DescribeFileSystemsCommandOutput> {
    logger.info('Describe a FSx filesystem:', { credentialsId, region, input, accountId });

    const client = await getFSxClient(credentialsId, region, accountId, cacheParams);
    const response = await client.send(new DescribeFileSystemsCommand(input));
    logger.debug('Describe a FSx file system response:', response);

    return response;
}

async function describeFSxVolumes(
    credentialsId: string,
    region: string,
    params: { fileSystemIds: string[]; volumeIds?: string[] } | string[],
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Describe FSx volumes:', { credentialsId, region, params, accountId });

    const { fileSystemIds, volumeIds } = Array.isArray(params) ? { fileSystemIds: params } : params;
    const input: DescribeVolumesCommandInput = {
        Filters: [{ Name: 'file-system-id', Values: fileSystemIds }],
        ...(volumeIds && { VolumeIds: volumeIds })
    };

    const client = await getFSxClient(credentialsId, region, accountId, cacheParams);
    const volumes = [];
    for await (const { Volumes = [] } of paginateDescribeVolumes({ client }, input)) {
        volumes.push(...Volumes);
    }
    logger.debug('Describe FSx volumes response:', volumes);

    return { Volumes: volumes };
}

async function describeFSxStorageVirtualMachines(
    credentialsId: string,
    region: string,
    fsxFsId?: string[],
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Describe FSx storage virtual machines:', { credentialsId, region, fsxFsId });

    let input: DescribeStorageVirtualMachinesCommandInput = {};
    if (typeof fsxFsId !== 'undefined') {
        input = { Filters: [{ Name: 'file-system-id', Values: fsxFsId }] };
    }
    const client = await getFSxClient(credentialsId, region, undefined, cacheParams);
    const paginator = paginateDescribeStorageVirtualMachines({ client }, input);
    const svms = [];
    for await (const page of paginator) {
        if (page.StorageVirtualMachines?.length) {
            svms.push(...page.StorageVirtualMachines);
        }
    }

    logger.info('Describe FSx storage virtual machines response:', svms);

    return { StorageVirtualMachines: svms };
}

async function describeFSxBackups(
    credentialsId: string,
    region: string,
    params: DescribeBackupsCommandInput,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
): Promise<DescribeBackupsCommandOutput> {
    logger.info('Describe FSx backups:', { credentialsId, region, params, accountId });

    const client = await getFSxClient(credentialsId, region, accountId, cacheParams);

    const response = await client.send(new DescribeBackupsCommand(params));

    logger.debug('Describe FSx backups:', response);

    return response;
}

async function listResourceTags(
    credentialsId: string,
    region: string,
    input: ListTagsForResourceCommandInput
): Promise<ListTagsForResourceCommandOutput | undefined> {
    logger.info('List all the resource tags by arn:', { credentialsId, region, input });

    try {
        const client = await getFSxClient(credentialsId, region);

        const command = new ListTagsForResourceCommand(input);

        const response = await client.send(command);

        logger.debug('List FSx resource tags:', response);

        return response;
    } catch (error) {
        logger.error('Error getting FSx tags', error);
    }
}

async function createTag(credentialsId: string, region: string, accountId: string, fsxArn: string, tags: Tag[]) {
    logger.info('Adding tags to resource', credentialsId, region, accountId, fsxArn, tags);

    try {
        const client = await getFSxClient(credentialsId, region, accountId);

        const params = {
            ResourceARN: fsxArn,
            Tags: tags
        };
        const command = new TagResourceCommand(params);
        const response: TagResourceCommandOutput = await client.send(command);
        logger.info('Resource tagged successfully:', response);
    } catch (error) {
        logger.error('Error tagging resource:', error);
    }
}

async function updateFsxVolumeSize(
    credentialsId: string,
    region: string,
    accountId: string,
    fsxVolumeId: string,
    fsxVolumeSizeBytes: number
) {
    logger.info('Updating FSX volume', { credentialsId, region, fsxVolumeId });

    const client = await getFSxClient(credentialsId, region, accountId);
    const response = await client.send(
        new UpdateVolumeCommand({
            VolumeId: fsxVolumeId,
            OntapConfiguration: {
                SizeInBytes: fsxVolumeSizeBytes
            }
        })
    );
    logger.debug('FSX volume updated successfully:', response);
}

async function updateFsxCapacity(
    credentialsId: string,
    region: string,
    accountId: string,
    fsxFsId: string,
    newFsxStorageCapactiyGiB: number
) {
    logger.info('Updating FSX capacity', { credentialsId, region, fsxFsId });
    try {
        const client = await getFSxClient(credentialsId, region, accountId);
        const response = await client.send(
            new UpdateFileSystemCommand({
                FileSystemId: fsxFsId,
                StorageCapacity: newFsxStorageCapactiyGiB
            })
        );
        logger.debug('FSX file system capacity updated successfully:', response);
    } catch (err) {
        logger.error('Error updating file system capacity:', err);
        throw err;
    }
}

async function updateFileSystem(
    accountId: string,
    credentialsId: string,
    region: string,
    input: UpdateFileSystemCommandInput
) {
    logger.info('Updating File System:', { accountId, credentialsId, region, input });
    const client = await getFSxClient(credentialsId, region, accountId);
    const command = new UpdateFileSystemCommand(input);
    const response = await client.send(command);
    return response;
}

export {
    describeFSxFileSystems,
    describeFSxVolumes,
    describeFSxStorageVirtualMachines,
    describeFSxBackups,
    describeFSx,
    listResourceTags,
    createTag,
    updateFsxVolumeSize,
    updateFsxCapacity,
    updateFileSystem
};
