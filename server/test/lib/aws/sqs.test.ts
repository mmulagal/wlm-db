import { QueueAttributeName } from '@aws-sdk/client-sqs';
import { createQueue, listQueues, receiveMessage } from '../../../src/lib/aws/sqs';

// import '../../simulator/scopes/aws/sqs-scope';

describe('SQS lib functions', () => {
    it('should create of SQS queue', async () => {
        const resp = await createQueue('us-east-1', {
            QueueName: 'test-sg',
            Attributes: {
                SqsManagedSseEnabled: 'true'
            }
        });
        expect(resp).toBeDefined();
    });

    it.skip('should return a list of SQS queues', async () => {
        const resp = await listQueues('us-east-1', {
            QueueNamePrefix: 'WLMDB'
        });
        expect(resp).toBeDefined();
    });

    it.skip('should receive a SQS queue messages', async () => {
        const resp = await receiveMessage('us-east-1', {
            AttributeNames: ['SentTimestamp' as QueueAttributeName],
            MaxNumberOfMessages: 1,
            MessageAttributeNames: ['All'],
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/464262061435/SGTESTQ',
            // The duration (in seconds) for which the call waits for a message
            // to arrive in the queue before returning. If a message is available,
            // the call returns sooner than WaitTimeSeconds. If no messages are
            // available and the wait time expires, the call returns successfully
            // with an empty list of messages.
            // https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html#API_ReceiveMessage_RequestSyntax
            WaitTimeSeconds: 20
        });
        expect(resp).toBeDefined();
    });
});
