// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    SQSClient,
    CreateQueueCommand,
    ReceiveMessageCommand,
    paginateListQueues,
    DeleteMessageCommand
} from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import createQueueResponse from '../../responses/aws/create-queue.json';
import receiveMessageResponse from '../../responses/aws/receive-message.json';
import deleteMessageResponse from '../../responses/aws/delete-message.json';

const sqsMock = mockClient(SQSClient);

const mockListQueues = {
    eachPage: callback => {
        callback({ QueueUrls: ['queue1', 'queue2'] });
    }
};

sqsMock.on(CreateQueueCommand).resolves(createQueueResponse);
sqsMock.on(paginateListQueues).resolves(mockListQueues);
sqsMock.on(ReceiveMessageCommand).resolves(receiveMessageResponse);
sqsMock.on(DeleteMessageCommand).resolves(deleteMessageResponse);
