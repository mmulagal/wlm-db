import ms from 'ms';
import config from 'config';
import Promise from 'bluebird';
import { randomUUID } from 'crypto';
import { Message } from '@aws-sdk/client-sqs';
import { sendCfnResponse } from '../../lib/aws/cloud-formation';
import { deleteMessage, listQueues, receiveMessage } from '../../lib/aws/sqs';
import { DEFAULT_AWS_REGION, WLMDB } from '../../utils/consts';
import { isValidJsonString } from '../../utils/utils';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSqsMessages(region: string, queueUrl: string) {
    logger.info('Get SQS messages', { region, queueUrl });

    const sqsMessages: (Message[] | undefined)[] = [];

    const { Messages } = await receiveMessage(region, {
        AttributeNames: ['SentTimestamp'],
        MaxNumberOfMessages: 1,
        MessageAttributeNames: ['All'],
        QueueUrl: queueUrl,
        // The duration (in seconds) for which the call waits for a message
        // to arrive in the queue before returning. If a message is available,
        // the call returns sooner than WaitTimeSeconds. If no messages are
        // available and the wait time expires, the call returns successfully
        // with an empty list of messages.
        // https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html#API_ReceiveMessage_RequestSyntax
        WaitTimeSeconds: 20
    });
    sqsMessages.push(Messages);

    return sqsMessages.flat();
}

async function processCloudFormationMessages() {
    const [queueUrl] = await listQueues(DEFAULT_AWS_REGION, {
        QueueNamePrefix: WLMDB
    });
    const sqsMessages = await getSqsMessages(DEFAULT_AWS_REGION, queueUrl);
    if (sqsMessages) {
        await Promise.map(
            sqsMessages,
            async message => {
                const {
                    message: { Message = undefined }
                } = isValidJsonString(message?.Body) || {};
                const { message: jsonMessage } = isValidJsonString(Message) || {};
                if (jsonMessage) {
                    const { RequestType, ResponseURL } = jsonMessage;
                    if (['Create', 'Update', 'Delete'].includes(RequestType)) {
                        //a cloud formation notification will have either of the above request types, so considering only those messages;
                        //in future when other types of messages needs to be processed, make change accordingly

                        //TODO: LOGIC TO PROCESS update tenancy with stack's instance ID
                        const cfnResponse =
                            RequestType === 'Create' ? createStackAck(jsonMessage) : modifyStackAck(jsonMessage);
                        await sendCfnResponse(ResponseURL, cfnResponse);
                        await deleteMessage(DEFAULT_AWS_REGION, {
                            // after processing the message , clear the message from queue so next processing is on a limited data set
                            QueueUrl: queueUrl,
                            ReceiptHandle: message?.ReceiptHandle
                        });
                    }
                }
            },
            { concurrency: 3 }
        );
    }

    setTimeout(processCloudFormationMessages, ms(config.get<string>('sqs-poll-interval')));
}

function createStackAck(message: { StackId: string; RequestId: string; LogicalResourceId: string }) {
    const { StackId, RequestId, LogicalResourceId } = message;
    return {
        Status: 'SUCCESS',
        StackId,
        RequestId,
        LogicalResourceId,
        PhysicalResourceId: randomUUID()
    };
}
//used for both stack Delete and Update events
function modifyStackAck(message: {
    StackId: string;
    RequestId: string;
    LogicalResourceId: string;
    PhysicalResourceId: string;
}) {
    const { StackId, RequestId, LogicalResourceId, PhysicalResourceId } = message;
    return {
        Status: 'SUCCESS',
        StackId,
        RequestId,
        LogicalResourceId,
        PhysicalResourceId
    };
}
export { processCloudFormationMessages };
