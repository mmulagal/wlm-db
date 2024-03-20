import {
    FSxClient,
    DescribeVolumesCommand,
    DescribeVolumesCommandOutput,
    paginateDescribeFileSystems,
    DescribeStorageVirtualMachinesCommand,
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
    DescribeBackupsCommandInput
} from '@aws-sdk/client-fsx';

import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getFSxClient(credentialsId: string, region: string, accountId?: string) {
    logger.debug('Getting FSx client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new FSxClient({ credentials, region });
}

async function describeFSxFileSystems(credentialsId: string, region: string) {
    logger.info('Describe FSX filesystems:', { credentialsId, region });

    const client = await getFSxClient(credentialsId, region);

    const paginator = paginateDescribeFileSystems({ client }, {});

    const fileSystems = [];
    for await (const page of paginator) {
        if (page.FileSystems?.length) {
            fileSystems.push(...page.FileSystems);
        }
    }

    logger.debug('Describe FSX filesystem response:', fileSystems);

    return fileSystems;
}

async function describeFSx(
    credentialsId: string,
    region: string,
    input: DescribeFileSystemsCommandInput
): Promise<DescribeFileSystemsCommandOutput> {
    logger.info('Describe a FSX filesystem:', { credentialsId, region, input });

    const client = await getFSxClient(credentialsId, region);
    const response = await client.send(new DescribeFileSystemsCommand(input));
    logger.info('Describe a FSX file system response:', response);

    return response;
}

async function describeFSxVolumes(
    credentialsId: string,
    region: string,
    fsxFsId: string
): Promise<DescribeVolumesCommandOutput> {
    logger.info('Describe FSX volumes:', { credentialsId, region, fsxFsId });

    const input: DescribeVolumesCommandInput = { Filters: [{ Name: 'file-system-id', Values: [fsxFsId] }] };

    const client = await getFSxClient(credentialsId, region);

    const response = await client.send(new DescribeVolumesCommand(input));
    logger.debug('Decribe FSX volumes response:', response);

    return response;
}

async function describeFSxStorageVirtualMachines(credentialsId: string, region: string, fsxFsId?: string) {
    logger.info('Describe FSX volumes:', { credentialsId, region, fsxFsId });

    let input: DescribeStorageVirtualMachinesCommandInput = {};
    if (typeof fsxFsId !== 'undefined') {
        input = { Filters: [{ Name: 'file-system-id', Values: [fsxFsId] }] };
    }
    const client = await getFSxClient(credentialsId, region);
    const response = await client.send(new DescribeStorageVirtualMachinesCommand(input));
    logger.debug('Decribe FSX storage virtual machines  response:', response);

    return response;
}

async function describeFSxBackups(
    credentialsId: string,
    region: string,
    volumeIds: Array<string>
): Promise<DescribeBackupsCommandOutput> {
    logger.info('Describe FSx backups:', { credentialsId, region, volumeIds });

    const input: DescribeBackupsCommandInput = {
        Filters: [{ Name: 'volume-id', Values: volumeIds }]
    };

    const client = await getFSxClient(credentialsId, region);

    const response = await client.send(new DescribeBackupsCommand(input));

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

export {
    describeFSxFileSystems,
    describeFSxVolumes,
    describeFSxStorageVirtualMachines,
    describeFSxBackups,
    describeFSx,
    listResourceTags,
    createTag
};
