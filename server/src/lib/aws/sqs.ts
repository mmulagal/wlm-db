import {
    SQSClient,
    CreateQueueCommand,
    CreateQueueCommandInput,
    ListQueuesCommandInput,
    ReceiveMessageCommand,
    ReceiveMessageCommandInput,
    paginateListQueues,
    DeleteMessageCommand,
    DeleteMessageCommandInput
} from '@aws-sdk/client-sqs';
import { compact } from 'lodash-es';
import getLogger from '../../utils/logger';

const logger = getLogger();

// Queue Creted in WLMDB account
async function createQueue(region: string, input: CreateQueueCommandInput) {
    logger.info('Create SQS queue', { region, input });

    const sqs = new SQSClient({ region });
    const resp = await sqs.send(new CreateQueueCommand(input));
    logger.debug('Create queue command response', resp);

    return resp;
}

// Queues in WLMDB account
async function listQueues(region: string, input: ListQueuesCommandInput) {
    logger.info('List SQS queues', { region, input });

    const sqs = new SQSClient({ region });
    const paginatedListQueues = paginateListQueues({ client: sqs }, input);

    const urls = [];
    for await (const page of paginatedListQueues) {
        const nextUrls = compact(page?.QueueUrls) || [];
        urls.push(...nextUrls);
    }

    return urls;
}

// Receive message in WLMDB account
async function receiveMessage(region: string, input: ReceiveMessageCommandInput) {
    logger.info('Receive SQS queue message', { region, input });

    const sqs = new SQSClient({ region });
    const resp = await sqs.send(new ReceiveMessageCommand(input));
    logger.debug('Receive queue message response', resp);

    return resp;
}

// Delete message in WLMDB account
async function deleteMessage(region: string, input: DeleteMessageCommandInput) {
    logger.info('Delete SQS queue message', { region, input });

    const sqs = new SQSClient({ region });
    const resp = await sqs.send(new DeleteMessageCommand(input));
    logger.debug('Deleting queue message response', resp);

    return resp;
}

export { createQueue, listQueues, receiveMessage, deleteMessage };
