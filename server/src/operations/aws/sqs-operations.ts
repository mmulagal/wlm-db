import ms from 'ms';
import config from 'config';
import Promise from 'bluebird';
import { randomUUID } from 'crypto';
import { Message } from '@aws-sdk/client-sqs';
import { sendCfnResponse } from '../../lib/aws/cloud-formation';
import { deleteMessage, receiveMessage } from '../../lib/aws/sqs';
import {
    CF_CUSTOM_RESOURCE_CODES,
    CloudProviders,
    DEFAULT_AWS_REGION,
    TRACK_STATUS_CUSTOM_RESOURCE,
    WLMDB
} from '../../utils/consts';
import { derivePropertiesFromARN, getQueueUrl, isValidJsonString } from '../../utils/utils';
import getLogger from '../../utils/logger';
import { transformStackEventMessage } from './sns-operations';
import {
    createDeployment,
    createEvent,
    listDeployments,
    updateDeployment,
    upsertDeployment
} from '../../lib/database/db';
import { DEPLOYMENT_STATUS } from '@prisma/client';
import { verifyAuthToken } from '../../lib/cloud-manager/tenancy';

const logger = getLogger();

async function getSqsMessages(region: string, queueUrl: string) {
    logger.info('Get SQS messages', { region, queueUrl });

    const sqsMessages: (Message[] | undefined)[] = [];

    const { Messages } = await receiveMessage(region, {
        AttributeNames: ['SentTimestamp'],
        MaxNumberOfMessages: 10,
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
    logger.info('Processing cloud formation messages');
    if (process.env.AWS_ROLE_ARN) {
        const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN) || {};
        const queueUrl = awsAccountId ? getQueueUrl(awsAccountId, WLMDB) : '';

        try {
            const sqsMessages = await getSqsMessages(DEFAULT_AWS_REGION, queueUrl);
            if (sqsMessages) {
                await Promise.map(
                    sqsMessages,
                    async sqsMessage => {
                        const {
                            message: { Message = undefined, Timestamp: timestamp }
                        } = isValidJsonString(sqsMessage?.Body) || {};
                        const { message: jsonMessage } = isValidJsonString(Message) || {};
                        if (jsonMessage) {
                            const {
                                StackId: stackId,
                                RequestType: requestType,
                                ResponseURL: responseUrl,
                                ResourceProperties: resourceProperties,
                                LogicalResourceId: logicalResourceId
                            } = jsonMessage;
                            if (
                                requestType === CF_CUSTOM_RESOURCE_CODES.CREATE ||
                                requestType === CF_CUSTOM_RESOURCE_CODES.DELETE
                            ) {
                                //a custom resource create event marks the beginning of master template deployment
                                if (resourceProperties) {
                                    const {
                                        AccountId: accountId,
                                        CloudProviderAccountId: cloudProviderAccountId,
                                        CredentialsId: credentialsId,
                                        Region: region,
                                        StackName: stackName,
                                        JWTToken: jwtToken
                                    } = resourceProperties;

                                    logger.debug('>>JWT TOKEN', jwtToken);
                                    try {
                                        verifyAuthToken(jwtToken);
                                    } catch (error) {
                                        logger.error('Cloud formation token verification failed', error);
                                        const cfnResponse =
                                            requestType === CF_CUSTOM_RESOURCE_CODES.CREATE
                                                ? createStackAck(jsonMessage, CF_CUSTOM_RESOURCE_CODES.FAILED)
                                                : modifyStackAck(jsonMessage, CF_CUSTOM_RESOURCE_CODES.FAILED);
                                        await deleteMessage(DEFAULT_AWS_REGION, {
                                            QueueUrl: queueUrl,
                                            ReceiptHandle: sqsMessage?.ReceiptHandle
                                        });
                                        return sendCfnResponse(responseUrl, cfnResponse);
                                    }
                                    if (requestType === CF_CUSTOM_RESOURCE_CODES.CREATE) {
                                        if (logicalResourceId === TRACK_STATUS_CUSTOM_RESOURCE) {
                                            //TRACK_STATUS_CUSTOM_RESOURCE is a custom resource created during start of a deployment
                                            await createDeployment(accountId, {
                                                deploymentId: stackId,
                                                cloudProviderAccountId: cloudProviderAccountId,
                                                cloudProviderName: CloudProviders.AWS,
                                                credentialsId: credentialsId,
                                                deploymentStatus: DEPLOYMENT_STATUS.CREATE_IN_PROGRESS,
                                                startTime: new Date(timestamp).valueOf(),
                                                region: region,
                                                deploymentName: stackName
                                            });
                                        } else {
                                            // Post deployment completion another custom resource is Created, to mark the successful completion of deployment
                                            // CREATE_FAILED event for any underlying resource is considered as a failure event for master deployment; the same is updated later in the code execution flow
                                            const [masterStackDeployment] = await listDeployments(
                                                undefined,
                                                undefined,
                                                stackName
                                            );
                                            if (masterStackDeployment) {
                                                await updateDeployment(accountId, masterStackDeployment.id, {
                                                    deploymentStatus: DEPLOYMENT_STATUS.CREATE_COMPLETE,
                                                    endTime: new Date(timestamp).valueOf(),
                                                    data: resourceProperties
                                                });
                                            }
                                        }
                                    } else {
                                        const [masterStackDeployment] = await listDeployments(
                                            undefined,
                                            undefined,
                                            stackName
                                        );
                                        if (masterStackDeployment) {
                                            await updateDeployment(accountId, masterStackDeployment.id, {
                                                deploymentStatus: DEPLOYMENT_STATUS.CREATE_FAILED,
                                                endTime: Date.now()
                                            });
                                        }
                                    }
                                }
                                const cfnResponse =
                                    requestType === CF_CUSTOM_RESOURCE_CODES.CREATE
                                        ? createStackAck(jsonMessage, CF_CUSTOM_RESOURCE_CODES.SUCCESS)
                                        : modifyStackAck(jsonMessage, CF_CUSTOM_RESOURCE_CODES.SUCCESS);
                                await sendCfnResponse(responseUrl, cfnResponse);

                                await deleteMessage(DEFAULT_AWS_REGION, {
                                    // after processing the message , clear the message from queue so next processing is on a limited data set
                                    QueueUrl: queueUrl,
                                    ReceiptHandle: sqsMessage?.ReceiptHandle
                                });
                            }
                        } else if (sqsMessage?.Body?.includes('AWS CloudFormation Notification')) {
                            const stackMessage = transformStackEventMessage(Message);
                            logger.debug('STACK MESSAGE', stackMessage);
                            const {
                                StackId: stackId,
                                StackName: stackName,
                                ResourceType: resourceType,
                                Timestamp: timestamp,
                                EventId: eventId,
                                ResourceStatus: resourceStatus,
                                ResourceStatusReason: resourceStatusReason,
                                ResourceProperties: resourceProperties
                            } = stackMessage;
                            if (stackId) {
                                const { isValid, message } = isValidJsonString(resourceProperties);
                                try {
                                    await createEvent({
                                        deploymentId: stackId,
                                        deploymentName: stackName,
                                        resourceType: resourceType,
                                        time: new Date(timestamp).valueOf(),
                                        eventId: eventId,
                                        eventStatus: resourceStatus as DEPLOYMENT_STATUS,
                                        eventStatusReason: resourceStatusReason,
                                        data: isValid ? message : {}
                                    });
                                } catch (error) {
                                    logger.error('Failed to create event', error);
                                }
                                const MASTER_STACK_NAME_PATTERN = /WLMDB-SQLFCIStack-(\d{13})/;
                                const matchingMasterStack = stackName.match(MASTER_STACK_NAME_PATTERN);
                                if (matchingMasterStack) {
                                    const [masterStackName] = matchingMasterStack;
                                    const [masterStackDeployment] = await listDeployments(
                                        undefined,
                                        undefined,
                                        masterStackName
                                    );
                                    if (masterStackDeployment) {
                                        const {
                                            id,
                                            account_id: accountId,
                                            region,
                                            deployment_id: masterDeploymentId,
                                            cloud_provider_account_id: cloudProviderAccountId,
                                            cloud_provider_name: cloudProviderName,
                                            credentials_id: credentialsId,
                                            deployment_name: masterDeploymentName,
                                            deployment_status: masterDeploymentStatus
                                        } = masterStackDeployment;

                                        /**
                                             a master stack deployment record is created as part of the custom resource definition in master       template. As part of stack message additional deployment details for the master template deployment are  available.
                                             *In addition, all nested stack deployment messages are also available, if its master template related message then update the existing record, otherwise if its related to nested deployment insert a deployment record; a master template may have a set of nested templates deployed;
                                        **/
                                        if (
                                            stackName === masterDeploymentName &&
                                            masterDeploymentStatus !== DEPLOYMENT_STATUS.CREATE_FAILED
                                        ) {
                                            await updateDeployment(accountId, id, {
                                                deploymentName: stackName,
                                                deploymentStatus: resourceStatus as DEPLOYMENT_STATUS,
                                                deploymentStatusReason: resourceStatusReason
                                            });
                                        } else {
                                            // there may be several events related to the same deployment, so upserting deployment information
                                            await upsertDeployment(accountId, {
                                                deploymentId: stackId,
                                                deploymentName: stackName,
                                                deploymentStatus: resourceStatus as DEPLOYMENT_STATUS,
                                                deploymentStatusReason: resourceStatusReason,
                                                cloudProviderAccountId: cloudProviderAccountId || '',
                                                cloudProviderName: cloudProviderName || CloudProviders.AWS,
                                                region,
                                                parentDeploymentId:
                                                    masterDeploymentId === stackId ? undefined : masterDeploymentId, // if the stack ID not matching master stack ID, update the parentDeploymentId to be that of the master stack
                                                credentialsId: credentialsId,
                                                startTime: new Date(timestamp).valueOf()
                                            });
                                            if (resourceStatus === DEPLOYMENT_STATUS.CREATE_FAILED) {
                                                // if any of the underlying resource is in CREATE_FAILED, mark the parent stack stack status as FAILED
                                                await updateDeployment(accountId, id, {
                                                    deploymentStatus: resourceStatus as DEPLOYMENT_STATUS,
                                                    endTime: new Date(timestamp).valueOf()
                                                });
                                            }
                                        }

                                        await deleteMessage(DEFAULT_AWS_REGION, {
                                            // after processing the message , clear the message from queue so next processing is on a limited data set
                                            QueueUrl: queueUrl,
                                            ReceiptHandle: sqsMessage?.ReceiptHandle
                                        });
                                    }
                                }
                            }
                        }
                    },
                    { concurrency: 3 }
                );
            }
        } catch (err: any) {
            if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
                logger.warn(`'${queueUrl}' queue does not exist. Not polling for messages`);
            } else if (err.code === 'InvalidClientTokenId') {
                // data broker user was deleted
                logger.warn(`'${queueUrl}' queue invalid client token. Not polling for messages`);
            } else {
                logger.debug('Possibly no new messages in queue');
                logger.warn(`Delaying polling for SQS queue '${queueUrl}' due to error`, err);
                setTimeout(() => processCloudFormationMessages(), ms(config.get<string>('sqs-poll-interval')));
            }
        }
    }
}

function createStackAck(message: { StackId: string; RequestId: string; LogicalResourceId: string }, status: string) {
    const { StackId, RequestId, LogicalResourceId } = message;
    return {
        Status: status,
        StackId,
        RequestId,
        LogicalResourceId,
        PhysicalResourceId: randomUUID()
    };
}
//used for both stack Delete and Update events
function modifyStackAck(
    message: {
        StackId: string;
        RequestId: string;
        LogicalResourceId: string;
        PhysicalResourceId: string;
    },
    status: string
) {
    const { StackId, RequestId, LogicalResourceId, PhysicalResourceId } = message;
    return {
        Status: status,
        StackId,
        RequestId,
        LogicalResourceId,
        PhysicalResourceId
    };
}
export { processCloudFormationMessages };
