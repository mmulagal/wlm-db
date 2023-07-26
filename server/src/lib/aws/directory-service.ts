import { DirectoryServiceClient, DescribeDirectoriesCommand } from '@aws-sdk/client-directory-service';
import getLogger from '../../utils/logger';
import { getCredentialDetails } from '../cloud-manager/credentials';

const logger = getLogger();

async function getDsClient(region: string, credentialsId: string) {
    logger.debug('Getting Directory Service client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new DirectoryServiceClient({ credentials, region });
}

async function describeDirectories(credentialsId: string, region: string, params: object) {
    logger.info('Describe Active Directories', { region, params });

    const ds = await getDsClient(region, credentialsId);

    const resp = await ds.send(new DescribeDirectoriesCommand(params));
    logger.debug('Descibe Active Directory response:', resp);

    return resp;
}

export { getDsClient, describeDirectories };
