import ms from 'ms';
import { isEmpty } from 'lodash-es';
import config from 'config';
import { randomUUID } from 'crypto';
import { Message } from '@aws-sdk/client-sqs';
import { DEPLOYMENT_MODEL, DEPLOYMENT_STATUS } from '@prisma/client';
import { sendCfnResponse } from '../../lib/aws/cloud-formation';
import { deleteMessage, getQueueAttribute, receiveMessage } from '../../lib/aws/sqs';
import {
    ACTION_BUTTON_DASHBOARD,
    CF_CUSTOM_RESOURCE_CODES,
    CF_NOTIFICATION,
    CRITICAL,
    CloudProviders,
    DEFAULT_AWS_REGION,
    ERROR_CODE_SQS_INVALID_TOKEN,
    ERROR_CODE_SQS_NON_EXISTENT_QUEUE,
    REDIRECT_URL,
    RESOURCESTYPE,
    SQL_DEPLOYMENT_COMPLETED_SUBJECT,
    SQL_DEPLOYMENT_FAILED_SUBJECT,
    STANDARD_DEPLOYMENT_ACTION,
    SUCCESS,
    TRACK_STATUS_CUSTOM_RESOURCE,
    WLMDB,
    WF,
    DEPLOYMENT_JOBS_FAILED_STATUS
} from '../../utils/consts';
import { derivePropertiesFromARN, getQueueUrl, checkAndRetrieveJsonObject } from '../../utils/utils';
import getLogger from '../../utils/logger';
import { transformStackEventMessage } from './sns-operations';
import {
    createDeployment,
    createEvent,
    createResource,
    listDeployments,
    listResources,
    updateDeployment,
    upsertDeployment
} from '../../lib/database/db';
import { verifyAuthToken } from '../../lib/cloud-manager/tenancy';
import { getMsSqlResourceId } from '../workloads/mssql/mssql-operations';
import { handleNotification } from '../cloud-manager/notification-operations';
import { lookupCredentials } from '../cloud-manager/credentials-operations';
import { associateResource } from '../../lib/cloud-manager/credentials';

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

async function getMatchingMasterStackDeployment(stackName: string) {
    const MASTER_STACK_NAME_PATTERN = /WLMDB-(.+[a-zA-Z])-(\d{13})/;
    const matchingMasterStack = stackName.match(MASTER_STACK_NAME_PATTERN);
    if (matchingMasterStack) {
        const [masterStackName] = matchingMasterStack;
        const [masterStackDeployment] = await listDeployments(undefined, undefined, masterStackName);
        return masterStackDeployment;
    }
}
async function handleResourceAssociation(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    resourceName: string,
    fsxId?: string,
    fsxName?: string
) {
    logger.info('Handling credentials resource association', {
        accountId,
        credentialsId,
        resourceId,
        resourceName,
        fsxId,
        fsxName
    });

    try {
        const { source } = await lookupCredentials(credentialsId);
        if (source === WF) {
            const resourcesToAssociate = [
                {
                    id: resourceId,
                    name: resourceName,
                    type: RESOURCESTYPE.MSSQL as string
                }
            ];
            if (fsxId && fsxName) {
                resourcesToAssociate.push({
                    id: fsxId,
                    name: fsxName,
                    type: 'FSxFileSystem'
                });
            }

            await associateResource(credentialsId, accountId, resourcesToAssociate);
        }
    } catch (error) {
        logger.error('Failed to associate resource with credentials service', error);
    }
}
async function processCloudFormationMessages() {
    logger.info('Processing cloud formation messages');
    if (process.env.AWS_ROLE_ARN) {
        const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN) || {};
        const queueUrl = awsAccountId ? getQueueUrl(awsAccountId, WLMDB) : '';

        try {
            const queueAttributes = await getQueueAttribute(DEFAULT_AWS_REGION, { QueueUrl: queueUrl });

            logger.info(`Queue attributes: ${queueAttributes}`);
        } catch (e) {
            logger.error(`Queue attributes error: ${e}`);
        }
        try {
            const sqsMessages = await getSqsMessages(DEFAULT_AWS_REGION, queueUrl);
            if (sqsMessages) {
                await Promise.all(
                    sqsMessages.map(async sqsMessage => {
                        const {
                            message: { Message: messageContent = undefined, Timestamp: messageTimestamp = 0 } = {}
                        } = checkAndRetrieveJsonObject(sqsMessage?.Body) || {};
                        const { message: jsonMessage } = checkAndRetrieveJsonObject(messageContent) || {};
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
                                // a custom resource create event marks the beginning of master template deployment
                                if (resourceProperties) {
                                    const {
                                        AccountId: accountId,
                                        CloudProviderAccountId: cloudProviderAccountId,
                                        CredentialsId: credentialsId,
                                        Region: region,
                                        StackName: stackName,
                                        JWToken: jwtToken,
                                        SQLDeploymentType: trackSqlDeploymentType,
                                        DatabaseType: trackdatabaseType,
                                        ResourceName: trackresourceName,
                                        FileSystemType: trackfileSystemType
                                    } = resourceProperties;

                                    logger.debug('>>JWT TOKEN', jwtToken);
                                    try {
                                        verifyAuthToken(jwtToken);
                                    } catch (error) {
                                        logger.error('Cloud formation token verification failed', error);
                                        const cfnResponse =
                                            requestType === CF_CUSTOM_RESOURCE_CODES.CREATE
                                                ? createStackAck(jsonMessage, CF_CUSTOM_RESOURCE_CODES.FAILED)
                                                : modifyStackAck(jsonMessage, CF_CUSTOM_RESOURCE_CODES.SUCCESS);
                                        await deleteMessage(DEFAULT_AWS_REGION, {
                                            QueueUrl: queueUrl,
                                            ReceiptHandle: sqsMessage?.ReceiptHandle
                                        });
                                        return sendCfnResponse(responseUrl, cfnResponse);
                                    }
                                    try {
                                        if (requestType === CF_CUSTOM_RESOURCE_CODES.CREATE) {
                                            if (logicalResourceId === TRACK_STATUS_CUSTOM_RESOURCE) {
                                                // TRACK_STATUS_CUSTOM_RESOURCE is a custom resource created during start of a deployment
                                                await createDeployment(accountId, {
                                                    deploymentId: stackId,
                                                    cloudProviderAccountId,
                                                    cloudProviderName: CloudProviders.AWS,
                                                    credentialsId,
                                                    deploymentStatus: DEPLOYMENT_STATUS.CREATE_IN_PROGRESS,
                                                    startTime: new Date(messageTimestamp).valueOf(),
                                                    region,
                                                    deploymentName: stackName,
                                                    deploymentModel: trackSqlDeploymentType,
                                                    data: {
                                                        databaseType: trackdatabaseType,
                                                        resourceName: trackresourceName,
                                                        fileSystemType: trackfileSystemType
                                                    }
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
                                                        endTime: new Date(messageTimestamp).valueOf(),
                                                        data: resourceProperties
                                                    });

                                                    const {
                                                        ActiveInstanceId: activeNodeInstanceId,
                                                        StandbyInstanceId: standbyNodeInstanceId,
                                                        ActiveInstanceName: activeNodeInstanceName,
                                                        StandbyInstanceName: standbyNodeInstanceName,
                                                        FSxFileSystemId: fsxId,
                                                        FSxFileSystemName: fsxName,
                                                        ActiveInstanceIp: activeNodeInstanceIp,
                                                        StandbyInstanceIp: standbyNodeInstanceIp,
                                                        SQLDeploymentType: sqlDeploymentType,
                                                        ResourceName: resourceName,
                                                        FileSystemType: fileSystemType,
                                                        FSxNSecret: fsxSecret,
                                                        DomainAdminSecretName: domainAdminSecret,
                                                        SQLServiceAccountSecret: sqlServiceAccountSecret
                                                    } = resourceProperties;
                                                    const [resourceDetails] = await listResources(
                                                        accountId,
                                                        fsxId,
                                                        RESOURCESTYPE.FSX
                                                    );
                                                    if (isEmpty(resourceDetails)) {
                                                        // same fsx can be used in multiple SQL deployments, avoid creating multiple FSX resources.. Keep fsx resource unique per tenancy account
                                                        await createResource(accountId, {
                                                            resourceId: fsxId,
                                                            resourceName: fsxName,
                                                            cloudProviderAccountId,
                                                            cloudProviderName: CloudProviders.AWS,
                                                            resourceType: RESOURCESTYPE.FSX,
                                                            region
                                                        });
                                                    }
                                                    const resourceId = getMsSqlResourceId(
                                                        activeNodeInstanceId,
                                                        standbyNodeInstanceId
                                                    );
                                                    await createResource(accountId, {
                                                        resourceId,
                                                        resourceName,
                                                        cloudProviderAccountId,
                                                        cloudProviderName: CloudProviders.AWS,
                                                        resourceType: RESOURCESTYPE.MSSQL,
                                                        coRelationId: fsxId,
                                                        region,
                                                        metadata: {
                                                            credentialsId,
                                                            activeNodeInstanceId,
                                                            standbyNodeInstanceId,
                                                            activeNodeInstanceName,
                                                            standbyNodeInstanceName,
                                                            activeNodeInstanceIp,
                                                            standbyNodeInstanceIp,
                                                            sqlDeploymentType,
                                                            fileSystemType,
                                                            fsxSecret,
                                                            domainAdminSecret,
                                                            sqlServiceAccountSecret
                                                        }
                                                    });

                                                    await handleResourceAssociation(
                                                        accountId,
                                                        credentialsId,
                                                        resourceId,
                                                        resourceName,
                                                        fsxId,
                                                        fsxName
                                                    );
                                                    const notificationData = {
                                                        notificationAction: STANDARD_DEPLOYMENT_ACTION,
                                                        subject: SQL_DEPLOYMENT_COMPLETED_SUBJECT,
                                                        uiNotificationDescription: `Microsoft SQL Server and FSxN for ONTAP deployment with stack name ${stackName} has been deployed successfully`,
                                                        actionLabel: SQL_DEPLOYMENT_COMPLETED_SUBJECT,
                                                        redirectURL: `${REDIRECT_URL}/${resourceId}`,
                                                        label: ACTION_BUTTON_DASHBOARD,
                                                        priority: SUCCESS,
                                                        accountId
                                                    };
                                                    await handleNotification(notificationData, {
                                                        uiNotification: true,
                                                        emailNotification: true
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

                                                const notificationData = {
                                                    notificationAction: STANDARD_DEPLOYMENT_ACTION,
                                                    subject: SQL_DEPLOYMENT_FAILED_SUBJECT,
                                                    uiNotificationDescription: `Microsoft SQL Server and FSxN for ONTAP deployment with stack name ${stackName} has been failed to deploy`,
                                                    actionLabel: SQL_DEPLOYMENT_FAILED_SUBJECT,
                                                    redirectURL: '/',
                                                    label: ACTION_BUTTON_DASHBOARD,
                                                    priority: CRITICAL,
                                                    accountId
                                                };
                                                await handleNotification(notificationData, {
                                                    uiNotification: true,
                                                    emailNotification: true
                                                });
                                            }
                                        }
                                    } catch (error) {
                                        logger.error('Failed to track deployment in WLMDB', error);
                                        const masterStackDeployment = await getMatchingMasterStackDeployment(stackName);
                                        if (masterStackDeployment) {
                                            await updateDeployment(accountId, masterStackDeployment.id, {
                                                deploymentStatus: DEPLOYMENT_STATUS.CREATE_FAILED,
                                                endTime: Date.now()
                                            });
                                            const notificationData = {
                                                notificationAction: STANDARD_DEPLOYMENT_ACTION,
                                                subject: SQL_DEPLOYMENT_FAILED_SUBJECT,
                                                uiNotificationDescription: `Microsoft SQL Server and FSxN for ONTAP deployment with stack name ${stackName} has been failed to deploy`,
                                                actionLabel: SQL_DEPLOYMENT_FAILED_SUBJECT,
                                                redirectURL: '/',
                                                label: ACTION_BUTTON_DASHBOARD,
                                                priority: CRITICAL,
                                                accountId
                                            };
                                            await handleNotification(notificationData, {
                                                uiNotification: true,
                                                emailNotification: true
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
                        } else if (sqsMessage?.Body?.includes(CF_NOTIFICATION)) {
                            const stackMessage = transformStackEventMessage(messageContent);
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
                                const { isValid, message } = checkAndRetrieveJsonObject(resourceProperties);
                                const masterStackDeployment = await getMatchingMasterStackDeployment(stackName);
                                if (masterStackDeployment) {
                                    const {
                                        id,
                                        account_id: accountId,
                                        region,
                                        deployment_id: masterDeploymentId,
                                        cloud_provider_account_id: cloudProviderAccountId,
                                        cloud_provider_name: cloudProviderName,
                                        credentials_id: credentialsId,
                                        deployment_status: masterDeploymentStatus,
                                        deployment_model: stackSqlDeploymentType,
                                        data
                                    } = masterStackDeployment;

                                    /**
                                             a master stack deployment record is created as part of the custom resource definition in master       template. As part of stack message additional deployment details for the master template deployment are  available.
                                             *In addition, all nested stack deployment messages are also available, if its master template related message then update the existing record, otherwise if its related to nested deployment insert a deployment record; a master template may have a set of nested templates deployed;

                                             Cloudformation does not send a notfication for parent stack deployment. We rely on nested template notification to capture the status of master stack.
                                             During initial deployment, cloudformation status would begin with 'CREATE_'. If any of the nested stacks fail (CREATE_FAILED) master stack is marked as CREATE_FAILED.
                                             It could be the case other nested stacks deploy successfully, however master stack should be CREATE_FAILED since one (or more) nested stack may have failed.

                                             Retry failed stack
                                             ==================
                                             User may retry failed stack, cloudformation status would now begin with 'UPDATE_'.
                                             Master stack will be updated with 'UPDATE_' status. If any of the nested stack is 'UPDATE_FAILED', then master stack will be marked as 'UPDATE_FAILED'.
                                        * */

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
                                        credentialsId,
                                        startTime: new Date(timestamp).valueOf(),
                                        deploymentModel: stackSqlDeploymentType as DEPLOYMENT_MODEL,
                                        data: data as object
                                    });

                                    let [mainCFStatusClass] = resourceStatus.split('_'); // CREATE, UPDATE, ROLLBACK, DELETE
                                    if (resourceStatus.includes('UPDATE_ROLLBACK')) {
                                        mainCFStatusClass = 'UPDATE_ROLLBACK';
                                    }

                                    /**
                                     * mainCFStatusClass can be in CREATE, UPDATE, ROLLBACK, DELETE.
                                     * master stack status is NOT updated when it is already in '_FAILED' for the same mainCFStatusClass as in new notification
                                     * Example: masterDeploymentStatus = 'CREATE_FAILED' and resourceStatus = 'CREATE_IN_PROGRESS', then masterDeploymentStatus WILL REMAIN 'CREATE_FAILED'.
                                     * If mainCFStatusClass in master status status and new notification status DO NOT MATCH then masterDeploymentStatus is updated.
                                     * Example: masterDeploymentStatus = 'CREATE_FAILED' and resourceStatus = 'UPDATE_IN_PROGRESS', then masterDeploymentStatus WILL BE UPDATED TO 'UPDATE_IN_PROGRESS'.
                                     */

                                    if (DEPLOYMENT_JOBS_FAILED_STATUS.includes(resourceStatus)) {
                                        // if any of the underlying resource is in CREATE_FAILED, DELETE_FAILED, ROLLBACK_FAILED, UPDATE_FAILED, UPDATE_ROLLBACK_FAILED mark the parent stack stack status as FAILED
                                        await updateDeployment(accountId, id, {
                                            deploymentStatus: resourceStatus as DEPLOYMENT_STATUS,
                                            endTime: DEPLOYMENT_JOBS_FAILED_STATUS.includes(resourceStatus)
                                                ? new Date(timestamp).valueOf()
                                                : undefined
                                        });
                                    } else if (
                                        !masterDeploymentStatus.startsWith(mainCFStatusClass) &&
                                        !masterDeploymentStatus.includes('FAILED')
                                    ) {
                                        await updateDeployment(accountId, id, {
                                            deploymentName: stackName,
                                            deploymentStatus: resourceStatus as DEPLOYMENT_STATUS,
                                            deploymentStatusReason: resourceStatusReason
                                        });
                                    }

                                    try {
                                        await createEvent({
                                            deploymentId: stackId,
                                            accountId: masterStackDeployment.account_id,
                                            deploymentName: stackName,
                                            resourceType,
                                            time: new Date(timestamp).valueOf(),
                                            eventId,
                                            eventStatus: resourceStatus as DEPLOYMENT_STATUS,
                                            eventStatusReason: resourceStatusReason,
                                            data: isValid ? message : {}
                                        });
                                    } catch (error) {
                                        logger.error('Failed to create event', error);
                                    }

                                    await deleteMessage(DEFAULT_AWS_REGION, {
                                        // after processing the message , clear the message from queue so next processing is on a limited data set
                                        QueueUrl: queueUrl,
                                        ReceiptHandle: sqsMessage?.ReceiptHandle
                                    });
                                }
                            } else {
                                logger.error(
                                    'The SQS event notification does not correspond to a valid WLMDB stack deployment'
                                );
                            }
                        }
                    })
                );
                processCloudFormationMessages();
            }
        } catch (err: any) {
            if (err.code === ERROR_CODE_SQS_NON_EXISTENT_QUEUE) {
                logger.warn(`'${queueUrl}' queue does not exist. Not polling for messages`);
            } else if (err.code === ERROR_CODE_SQS_INVALID_TOKEN) {
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
// used for both stack Delete and Update events
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
