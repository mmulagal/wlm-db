import {
    SQSClient,
    CreateQueueCommand,
    CreateQueueCommandInput,
    ListQueuesCommandInput,
    ReceiveMessageCommand,
    ReceiveMessageCommandInput,
    paginateListQueues,
    DeleteMessageCommand,
    DeleteMessageCommandInput,
    DeleteQueueCommand,
    DeleteQueueCommandInput
} from '@aws-sdk/client-sqs';
import getLogger from '../../utils/logger';

const logger = getLogger();

//Queue Creted in WLMDB account
async function createQueue(region: string, input: CreateQueueCommandInput) {
    logger.info('Create SQS queue', { region, input });

    const sqs = new SQSClient({ region });
    const resp = await sqs.send(new CreateQueueCommand(input));
    logger.info('Create queue command response', resp);

    return resp;
}

//DO NOT USE: ONLY FOR TESTING; Queue Deleted in WLMDB account
async function deleteQueue(region: string, input: DeleteQueueCommandInput) {
    logger.info('Delete SQS queue', { region, input });

    const sqs = new SQSClient({ region });
    const resp = await sqs.send(new DeleteQueueCommand(input));
    logger.info('Delete queue command response', resp);

    return resp;
}

//Queues in WLMDB account
async function listQueues(region: string, input: ListQueuesCommandInput) {
    logger.info('List SQS queues', { region, input });

    const sqs = new SQSClient({ region });
    const paginatedListQueues = paginateListQueues({ client: sqs }, input);

    const urls = [];
    for await (const page of paginatedListQueues) {
        const nextUrls = page?.QueueUrls?.filter(qurl => !!qurl) || [];
        urls.push(...nextUrls);
    }

    return urls;
}

//Receive message in WLMDB account
async function receiveMessage(region: string, input: ReceiveMessageCommandInput) {
    logger.info('Receive SQS queue message', { region, input });

    const sqs = new SQSClient({ region });
    const resp = await sqs.send(new ReceiveMessageCommand(input));
    logger.info('Receive queue message response', resp);

    return resp;
}

//Delete message in WLMDB account
async function deleteMessage(region: string, input: DeleteMessageCommandInput) {
    logger.info('Delete SQS queue message', { region, input });

    const sqs = new SQSClient({ region });
    const resp = await sqs.send(new DeleteMessageCommand(input));
    logger.info('Deleting queue message response', resp);

    return resp;
}
export { createQueue, listQueues, receiveMessage, deleteMessage, deleteQueue };
