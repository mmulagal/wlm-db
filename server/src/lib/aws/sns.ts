import { SNSClient, ListTopicsCommand } from '@aws-sdk/client-sns';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSNS(region: string, credentialsId: string) {
    logger.debug('Getting SNS client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new SNSClient({ credentials, region });
}

async function listTopics(credentialsId: string, region: string) {
    logger.info('List SNS topics', { region });

    const sns = await getSNS(region, credentialsId);
    const resp = await sns.send(new ListTopicsCommand({}));
    logger.debug('ListTopicsCommand response', resp);

    return resp;
}

export { listTopics };
