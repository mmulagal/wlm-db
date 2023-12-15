import {
    SNSClient,
    ListTopicsCommand,
    CreateTopicCommand,
    SubscribeCommand,
    SubscribeCommandInput,
    ConfirmSubscriptionCommand,
    ConfirmSubscriptionCommandInput,
    CreateTopicCommandInput,
    SetTopicAttributesCommandInput,
    SetTopicAttributesCommand
} from '@aws-sdk/client-sns';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSNS(region: string, credentialsId?: string) {
    logger.debug('Getting SNS client:', region, credentialsId);
    if (!credentialsId) {
        return new SNSClient({ region });
    }
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new SNSClient({ credentials, region });
}

async function listTopics(region: string, credentialsId?: string) {
    logger.info('List SNS topics', { region });

    const sns = await getSNS(region, credentialsId);
    const resp = await sns.send(new ListTopicsCommand({}));
    logger.debug('ListTopicsCommand response', resp);

    return resp;
}

// Topic Creted in WLMDB account
async function createTopic(region: string, input: CreateTopicCommandInput) {
    logger.info('Create SNS topic', { region, input });

    const sns = new SNSClient({ region });
    const resp = await sns.send(new CreateTopicCommand(input));
    logger.debug('Create topic command response', resp);

    return resp;
}

// TODO: delete me; Temporary function to update queues in staging cluster, will be removed
async function setTopicAttributes(region: string, input: SetTopicAttributesCommandInput) {
    logger.info('Set SNS topic attributes', { region, input });

    const sns = new SNSClient({ region });
    const resp = await sns.send(new SetTopicAttributesCommand(input));
    logger.debug('Set SNS topic attribute response', resp);

    return resp;
}

// Subscribe topic in WLMDB account
async function subscribeTopic(region: string, input: SubscribeCommandInput) {
    logger.info('Subscribe to  SNS topic', { region, input });

    const sns = new SNSClient({ region });
    const resp = await sns.send(new SubscribeCommand(input));
    logger.debug('Subscribe to topic command response', resp);

    return resp;
}

// Confirm subscription in WLMDB account
async function confirmSubscription(region: string, input: ConfirmSubscriptionCommandInput) {
    logger.info('Confirm subscription to  SNS topic', { region, input });

    const sns = new SNSClient({ region });
    const resp = await sns.send(new ConfirmSubscriptionCommand(input));
    logger.debug('Confirm subscription to topic command response', resp);

    return resp;
}

export { listTopics, createTopic, setTopicAttributes, subscribeTopic, confirmSubscription };
