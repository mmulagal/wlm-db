import {
    FSxClient,
    DescribeFileSystemsCommand,
    DescribeFileSystemsCommandOutput,
    DescribeVolumesCommand,
    DescribeVolumesCommandOutput
} from '@aws-sdk/client-fsx';

import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getFSxClient(credentialsId: string, region: string) {
    logger.debug('Getting FSx client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };
    return new FSxClient({ credentials, region });
}

async function describeFSxFileSystems(
    credentialsId: string,
    region: string
): Promise<DescribeFileSystemsCommandOutput> {
    logger.info('Describe Amazon FSx for NetApp ONTAP filesystems:', { credentialsId, region });

    const client = await getFSxClient(credentialsId, region);

    const response = await client.send(new DescribeFileSystemsCommand({}));
    logger.debug('Describe Amazon FSx for NetApp ONTAp filesystem response:', response);

    return response;
}

async function describeFSxVolumes(
    credentialsId: string,
    region: string,
    fsxFsId: string
): Promise<DescribeVolumesCommandOutput> {
    logger.info('Describe Amazon FSx for NetApp ONTAP volumes:', Array.from(arguments)); // eslint-disable-line
    const input = { Filters: [{ Name: 'file-system-id', Values: [fsxFsId] }] };

    const client = await getFSxClient(credentialsId, region);

    const response = await client.send(new DescribeVolumesCommand(input));
    logger.debug('Decribe Amazon FSx for NetApp ONTAP volumes response:', response);

    return response;
}
export { describeFSxFileSystems, describeFSxVolumes };
