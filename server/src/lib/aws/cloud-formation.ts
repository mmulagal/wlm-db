import { CloudFormationClient, ListStacksCommand, StackStatus } from '@aws-sdk/client-cloudformation';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getCloudformationClient(credentialsId: string, region: string) {
    logger.debug('Getting cloudFormation client:', { credentialsId, region });
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    return new CloudFormationClient({ region: region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
}

async function getStacks(cloudformationClient: CloudFormationClient, stackStatusFilter?: (StackStatus | string)[]) {
    logger.info('Get cloudformation stacks ');
    const resp = await cloudformationClient.send(new ListStacksCommand({ StackStatusFilter: stackStatusFilter }));
    logger.debug('Stacks response', resp);
    return resp;
}

export { getCloudformationClient, getStacks };
