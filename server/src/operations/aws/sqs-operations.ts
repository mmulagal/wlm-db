import ms from 'ms';
import { isEmpty } from 'lodash-es';
import config from 'config';
import { randomUUID } from 'crypto';
import { Message, ReceiveMessageCommandInput } from '@aws-sdk/client-sqs';
import { DEPLOYMENT_MODEL, DEPLOYMENT_STATUS, JOBSTATUS, JOBTYPE, job } from '@prisma/client';
import { inspect } from 'util';
import { JSONObject } from '@fastify/swagger';
import { sendCfnResponse } from '../../lib/aws/cloud-formation';
import { deleteMessage, getQueueAttribute, receiveMessage } from '../../lib/aws/sqs';
import {
    CF_CUSTOM_RESOURCE_CODES,
    CF_NOTIFICATION,
    CloudProviders,
    DEFAULT_AWS_REGION,
    ERROR_CODE_SQS_INVALID_TOKEN,
    ERROR_CODE_SQS_NON_EXISTENT_QUEUE,
    RESOURCESTYPE,
    TRACK_STATUS_CUSTOM_RESOURCE,
    WLMDB,
    WF,
    DEPLOYMENT_JOBS_FAILED_STATUS,
    WLMDB_COST_ALLOCATION_TAG
} from '../../utils/consts';
import { checkAndRetrieveJsonObject, derivePropertiesFromARN, getQueueUrl } from '../../utils/utils';
import getLogger from '../../utils/logger';
import { transformStackEventMessage } from './sns-operations';
import {
    createDeployment,
    createEvent,
    createResource,
    updateDeployment,
    upsertDeployment
} from '../../lib/database/db';
import { verifyAuthToken } from '../../lib/cloud-manager/tenancy';
import { getMsSqlResourceId } from '../workloads/mssql/mssql-operations';
// import { handleNotification } from '../cloud-manager/notification-operations';
import { lookupCredentials } from '../cloud-manager/credentials-operations';
import { associateResource } from '../../lib/cloud-manager/credentials';
import { getDeployments, getResources } from '../database/database-operations';
import { tagEc2Resource } from './ec2-operations';
import { tagFsxResource } from './fsx-operations';
import { decryptString } from './kms-operations';
import { registerFsxOntapCredentials } from '../../lib/cloud-manager/fsx-core';
import { createJobs, listJobs } from '../../lib/database/job';
import { updateJobDetails } from '../database/job-operations';

const logger = getLogger();

async function getSqsMessages(region: string, queueUrl: string) {
    logger.info('Get SQS messages', { region, queueUrl });
    const sqsMessages: (Message[] | undefined)[] = [];
    const input: ReceiveMessageCommandInput = {
        AttributeNames: ['SentTimestamp'], // We should remove this property and use MessageSystemAttributeName.SentTimestamponce once aws resolves this bug https://github.com/aws/aws-sdk-js-v3/issues/5403 in latest sqs client
        MaxNumberOfMessages: 10,
        MessageAttributeNames: ['All'],
        QueueUrl: queueUrl,
        // The duration (in seconds) for which the call waits for a message
        // to arrive in the queue before returning. If a message is available,
        // the call returns sooner than WaitTimeSeconds. If no messages are
        // available and the wait time expires, the call returns successfully
        // with an empty list of messages.
        // https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html#API_ReceiveMessage_RequestSyntax
        WaitTimeSeconds: 20,
        /*
         * The duration (in seconds) that the received messages are hidden from subsequent
         * retrieve requests after being retrieved by a <code>ReceiveMessage</code> request
         */
        VisibilityTimeout: 60
    };

    const { Messages } = await receiveMessage(region, input);
    sqsMessages.push(Messages);

    return sqsMessages.flat();
}

async function getMatchingMasterStackDeployment(stackName: string) {
    const MASTER_STACK_NAME_PATTERN = /WLMDB-(.+[a-zA-Z])-(\d{13})/;
    const matchingMasterStack = stackName.match(MASTER_STACK_NAME_PATTERN);
    if (matchingMasterStack) {
        const [masterStackName] = matchingMasterStack;
        const [masterStackDeployment] = await getDeployments(undefined, undefined, masterStackName);
        return masterStackDeployment;
    }
}

async function getMatchingMasterJob(accountId: string, stackName: string) {
    const MASTER_JOB_NAME_PATTERN = /Microsoft SQL server deployment with stack WLMDB-(.+[a-zA-Z])-(\d{13})/;
    const matchingMasterJob = stackName.match(MASTER_JOB_NAME_PATTERN);
    if (matchingMasterJob) {
        const [masterJobName] = matchingMasterJob;
        const [masterJob] = await listJobs(accountId, undefined, 'start_time', 'desc', masterJobName);
        return masterJob;
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

async function tagResources(
    credentialsId: string,
    region: string,
    awsAccountId: string,
    accountId: string,
    fsxId: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string
) {
    const tagFsxPromise = tagFsxResource(credentialsId, region, awsAccountId, accountId, fsxId, [
        { Key: WLMDB_COST_ALLOCATION_TAG, Value: fsxId }
    ]);

    const tagEc2Promise = tagEc2Resource(
        credentialsId,
        region,
        accountId,
        [activeNodeInstanceId],
        [{ Key: WLMDB_COST_ALLOCATION_TAG, Value: activeNodeInstanceId }]
    );

    const promises = [tagFsxPromise, tagEc2Promise];

    if (standbyNodeInstanceId) {
        const tagStandbyPromise = tagEc2Resource(
            credentialsId,
            region,
            accountId,
            [standbyNodeInstanceId],
            [{ Key: WLMDB_COST_ALLOCATION_TAG, Value: standbyNodeInstanceId }]
        );
        promises.push(tagStandbyPromise);
    }

    await Promise.all(promises);
}

async function modifyMasterJobStatus(
    accountId: string,
    databaseType: string,
    stackName: string,
    jobStatus: JOBSTATUS,
    timestamp: number,
    masterJob?: job,
    resourceStatusReason?: string
) {
    const masterJobName = masterJob?.name ? masterJob.name : `${databaseType} deployment with stack ${stackName}`;
    if (isEmpty(masterJob)) {
        masterJob = await getMatchingMasterJob(accountId, masterJobName);
        if (!masterJob) {
            logger.error('No entry in database job table for stackname:', masterJobName);
            return;
        }
    }

    logger.info('Update job to status failed:', masterJob?.id, masterJobName);
    const response = await updateJobDetails(accountId, masterJob.id, {
        status: jobStatus,
        endTime: new Date(timestamp).valueOf(),
        error: jobStatus === JOBSTATUS.FAILED ? resourceStatusReason : undefined
    });
    logger.debug('Update job response:', response);
}

async function createOrUpdateChildJobs(
    accountId: string,
    parentJob: job,
    childJobName: string,
    jobStatus: JOBSTATUS,
    timestamp: number,
    resourceStatusReason: string,
    physicalResourceId: string,
    logicalResourceId: string
) {
    const [childJob] = await listJobs(accountId, parentJob.id, undefined, undefined, childJobName);
    if (!childJob && parentJob.name !== `Deploying ${logicalResourceId}`) {
        logger.info('Create child level job:', {
            parentJobId: parentJob.id,
            parentJobName: parentJob.name,
            childJobName,
            jobStatus
        });
        await createJobs(accountId, [
            // Level 2 Job
            {
                account_id: accountId,
                type: JOBTYPE.DEPLOYMENT,
                status: jobStatus,
                resource_name: parentJob.resource_name,
                name: childJobName,
                parent_job_id: parentJob.id,
                description: physicalResourceId ? `Creating resource ${physicalResourceId}` : '',
                start_time: new Date(timestamp)
            }
        ]);
    } else if (
        (childJob && parentJob.name !== `Deploying ${logicalResourceId}`) ||
        (childJob && childJobName === childJob.name)
    ) {
        try {
            logger.info('Update child job:', {
                parentJobId: parentJob.id,
                parentJobName: parentJob.name,
                childJobId: childJob.id,
                childJobName: childJob.name,
                jobStatus
            });
            const response = await updateJobDetails(accountId, childJob.id, {
                status: jobStatus,
                error: jobStatus === JOBSTATUS.FAILED ? resourceStatusReason : undefined,
                endTime: new Date(timestamp).valueOf()
            });
            logger.debug('Update child job response:', response);
        } catch (error) {
            logger.error('Error while updating child job with status:', {
                parentJobId: parentJob.id,
                parentJobName: parentJob.name,
                childJobId: childJob.id,
                childJobName,
                jobStatus,
                error
            });
        }
    }
}
async function processCloudFormationMessages() {
    logger.info('Processing cloud formation messages');
    // eslint-disable-next-line no-constant-condition
    if (process.env.AWS_ROLE_ARN) {
        const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN) || {};
        const queueUrl = awsAccountId ? getQueueUrl(awsAccountId, WLMDB) : '';
        try {
            const queueAttributes = await getQueueAttribute(DEFAULT_AWS_REGION, {
                QueueUrl: queueUrl,
                AttributeNames: ['All']
            });
            logger.info(`Queue attributes: ${JSON.stringify(queueAttributes)}`);
        } catch (e) {
            logger.error(`Queue attributes error: ${e}`);
        }
        try {
            const sqsMessages = await getSqsMessages(DEFAULT_AWS_REGION, queueUrl);
            logger.info(`>>>SQS MESSAGES @ ${Date.now()}`, { sqsMessages }); // TODO : REMOVE ME, i print a lot of logs
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
                                        FileSystemType: trackfileSystemType,
                                        MetadataParam: trackMetadataParam
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
                                                        fileSystemType: trackfileSystemType,
                                                        metadataParam: trackMetadataParam
                                                    }
                                                });

                                                // Create master job
                                                const masterJobName = `${trackdatabaseType} deployment with stack ${stackName}`;
                                                logger.info('Creating master job:', masterJobName);
                                                await createJobs(accountId, [
                                                    {
                                                        account_id: accountId,
                                                        type: JOBTYPE.DEPLOYMENT,
                                                        status: JOBSTATUS.IN_PROGRESS,
                                                        resource_name: trackresourceName,
                                                        name: masterJobName,
                                                        start_time: new Date(messageTimestamp)
                                                    }
                                                ]);
                                            } else {
                                                // Post deployment completion another custom resource is Created, to mark the successful completion of deployment
                                                // CREATE_FAILED event for any underlying resource is considered as a failure event for master deployment; the same is updated later in the code execution flow
                                                const [masterStackDeployment] = await getDeployments(
                                                    undefined,
                                                    undefined,
                                                    stackName
                                                );
                                                if (
                                                    masterStackDeployment &&
                                                    masterStackDeployment.deployment_status !==
                                                        DEPLOYMENT_STATUS.CREATE_COMPLETE
                                                ) {
                                                    await updateDeployment(accountId, masterStackDeployment.id, {
                                                        deploymentStatus: DEPLOYMENT_STATUS.CREATE_COMPLETE,
                                                        endTime: new Date(messageTimestamp).valueOf(),
                                                        data: resourceProperties
                                                    });

                                                    // Update master job with completion status
                                                    const masterJobName = `${trackdatabaseType} deployment with stack ${stackName}`;
                                                    const [masterJob] = await listJobs(
                                                        accountId,
                                                        undefined,
                                                        undefined,
                                                        undefined,
                                                        masterJobName
                                                    );

                                                    logger.info(
                                                        'Update master job to status completed:',
                                                        masterJob.id,
                                                        masterJobName
                                                    );
                                                    const response = await updateJobDetails(accountId, masterJob.id, {
                                                        status: JOBSTATUS.COMPLETED,
                                                        endTime: new Date(messageTimestamp).valueOf()
                                                    });
                                                    logger.debug('Update master job response:', response);

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
                                                        SQLServiceAccountSecret: sqlServiceAccountSecret,
                                                        ActiveDirectoryName: activeDirectoryName,
                                                        ActiveDirectoryAddress: activeDirectoryAddress,
                                                        EncryptedFsxPassword: encryptedFsxPassword
                                                    } = resourceProperties;
                                                    const [resourceDetails] = await getResources(
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

                                                    if (encryptedFsxPassword) {
                                                        const {
                                                            credentials_id: deploymentCredentialId,
                                                            region: deploymentRegion
                                                        } = masterStackDeployment;
                                                        const decryptedPassword = await decryptString(
                                                            encryptedFsxPassword
                                                        );
                                                        if (decryptedPassword) {
                                                            await registerFsxOntapCredentials(
                                                                accountId,
                                                                deploymentCredentialId,
                                                                deploymentRegion,
                                                                fsxId,
                                                                decryptedPassword
                                                            );
                                                        }
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
                                                            creationDate: Date.now(),
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
                                                            sqlServiceAccountSecret,
                                                            activeDirectoryName,
                                                            activeDirectoryAddress
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
                                                    try {
                                                        await tagResources(
                                                            credentialsId,
                                                            region,
                                                            cloudProviderAccountId,
                                                            accountId,
                                                            fsxId,
                                                            activeNodeInstanceId,
                                                            standbyNodeInstanceId
                                                        );
                                                    } catch (error) {
                                                        logger.error('Error while tagging resource', error);
                                                    }
                                                    // commented for now until we fix the queue issue of getting triggered multiple times for the same stack status
                                                    // const notificationData = {
                                                    //     notificationAction: STANDARD_DEPLOYMENT_ACTION,
                                                    //     subject: SQL_DEPLOYMENT_COMPLETED_SUBJECT,
                                                    //     uiNotificationDescription: `Microsoft SQL Server and FSxN for ONTAP deployment with stack name ${stackName} has been deployed successfully`,
                                                    //     actionLabel: SQL_DEPLOYMENT_COMPLETED_SUBJECT,
                                                    //     redirectURL: `${REDIRECT_URL}/${resourceId}`,
                                                    //     label: ACTION_BUTTON_DASHBOARD,
                                                    //     priority: SUCCESS,
                                                    //     accountId
                                                    // };
                                                    // await handleNotification(notificationData, {
                                                    //     uiNotification: true,
                                                    //     emailNotification: true
                                                    // });
                                                }
                                            }
                                        } else {
                                            const [masterStackDeployment] = await getDeployments(
                                                undefined,
                                                undefined,
                                                stackName
                                            );
                                            if (
                                                masterStackDeployment &&
                                                masterStackDeployment.deployment_status !==
                                                    DEPLOYMENT_STATUS.CREATE_FAILED
                                            ) {
                                                await updateDeployment(accountId, masterStackDeployment.id, {
                                                    deploymentStatus: DEPLOYMENT_STATUS.CREATE_FAILED,
                                                    endTime: Date.now()
                                                });

                                                // Update master job with failed status
                                                await modifyMasterJobStatus(
                                                    accountId,
                                                    trackdatabaseType,
                                                    stackName,
                                                    JOBSTATUS.FAILED,
                                                    messageTimestamp
                                                );

                                                // commented for now until we fix the queue issue of getting triggered multiple times for the same stack status
                                                // const notificationData = {
                                                //     notificationAction: STANDARD_DEPLOYMENT_ACTION,
                                                //     subject: SQL_DEPLOYMENT_FAILED_SUBJECT,
                                                //     uiNotificationDescription: `Microsoft SQL Server and FSxN for ONTAP deployment with stack name ${stackName} has been failed to deploy`,
                                                //     actionLabel: SQL_DEPLOYMENT_FAILED_SUBJECT,
                                                //     redirectURL: '/',
                                                //     label: ACTION_BUTTON_DASHBOARD,
                                                //     priority: CRITICAL,
                                                //     accountId
                                                // };
                                                // await handleNotification(notificationData, {
                                                //     uiNotification: true,
                                                //     emailNotification: true
                                                // });
                                            }
                                        }
                                    } catch (error) {
                                        logger.error('Failed to track deployment in WLMDB', error);
                                        const masterStackDeployment = await getMatchingMasterStackDeployment(stackName);
                                        if (
                                            masterStackDeployment &&
                                            masterStackDeployment.deployment_status !== DEPLOYMENT_STATUS.CREATE_FAILED
                                        ) {
                                            await updateDeployment(accountId, masterStackDeployment.id, {
                                                deploymentStatus: DEPLOYMENT_STATUS.CREATE_FAILED,
                                                endTime: Date.now()
                                            });

                                            // Update master job with failed status
                                            await modifyMasterJobStatus(
                                                accountId,
                                                trackdatabaseType,
                                                stackName,
                                                JOBSTATUS.FAILED,
                                                messageTimestamp
                                            );

                                            // commented for now until we fix the queue issue of getting triggered multiple times for the same stack status
                                            // const notificationData = {
                                            //     notificationAction: STANDARD_DEPLOYMENT_ACTION,
                                            //     subject: SQL_DEPLOYMENT_FAILED_SUBJECT,
                                            //     uiNotificationDescription: `Microsoft SQL Server and FSxN for ONTAP deployment with stack name ${stackName} has been failed to deploy`,
                                            //     actionLabel: SQL_DEPLOYMENT_FAILED_SUBJECT,
                                            //     redirectURL: '/',
                                            //     label: ACTION_BUTTON_DASHBOARD,
                                            //     priority: CRITICAL,
                                            //     accountId
                                            // };
                                            // await handleNotification(notificationData, {
                                            //     uiNotification: true,
                                            //     emailNotification: true
                                            // });
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
                                PhysicalResourceId: physicalResourceId,
                                LogicalResourceId: logicalResourceId,
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

                                    const jobStatus = resourceStatus.includes('COMPLETE')
                                        ? JOBSTATUS.COMPLETED
                                        : resourceStatus.includes('IN_PROGRESS')
                                        ? JOBSTATUS.IN_PROGRESS
                                        : JOBSTATUS.FAILED;

                                    const { databaseType } = data as JSONObject;
                                    const masterJobName = `${databaseType} deployment with stack ${stackName}`;
                                    const masterJob = await getMatchingMasterJob(accountId, masterJobName);
                                    if (!masterJob) {
                                        logger.error('No entry found in database for job with name', masterJobName);
                                    } else {
                                        const level2JobName = `Deploying ${stackName}`;
                                        await createOrUpdateChildJobs(
                                            accountId,
                                            masterJob,
                                            level2JobName,
                                            jobStatus,
                                            messageTimestamp,
                                            resourceStatusReason,
                                            physicalResourceId,
                                            logicalResourceId
                                        );
                                    }
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
                                        try {
                                            await updateDeployment(accountId, id, {
                                                deploymentStatus: resourceStatus as DEPLOYMENT_STATUS,
                                                endTime: DEPLOYMENT_JOBS_FAILED_STATUS.includes(resourceStatus)
                                                    ? new Date(timestamp).valueOf()
                                                    : undefined
                                            });
                                        } catch (error) {
                                            logger.error(
                                                `Error while updating main stack with failed status: ${id} ${resourceStatus} ${stackName}. Error: ${JSON.stringify(
                                                    error
                                                )}`
                                            );
                                        }

                                        // Update master job for retry scenarios
                                        if (masterJob) {
                                            await modifyMasterJobStatus(
                                                accountId,
                                                String(databaseType),
                                                stackName,
                                                jobStatus,
                                                messageTimestamp,
                                                masterJob,
                                                resourceStatusReason
                                            );
                                        }
                                    } else if (
                                        !masterDeploymentStatus.startsWith(mainCFStatusClass) &&
                                        !masterDeploymentStatus.includes('FAILED')
                                    ) {
                                        try {
                                            await updateDeployment(accountId, id, {
                                                deploymentStatus: resourceStatus as DEPLOYMENT_STATUS,
                                                deploymentStatusReason: resourceStatusReason
                                            });
                                        } catch (error) {
                                            logger.error(
                                                `Error while updating block main stack with non-failed status: ${id} ${resourceStatus} ${stackName}. Error: ${JSON.stringify(
                                                    error
                                                )}`
                                            );
                                        }

                                        // Update master job for retry scenarios
                                        if (masterJob) {
                                            await modifyMasterJobStatus(
                                                accountId,
                                                String(databaseType),
                                                stackName,
                                                jobStatus,
                                                messageTimestamp,
                                                masterJob,
                                                resourceStatusReason
                                            );
                                        }
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

                                    // Update level 3 job
                                    const level2JobName = `Deploying ${stackName}`;
                                    const [level2Job] = await listJobs(
                                        accountId,
                                        masterJob?.id,
                                        undefined,
                                        undefined,
                                        level2JobName
                                    );
                                    const level3JobName = `Deploying ${logicalResourceId}(${resourceType})`;
                                    await createOrUpdateChildJobs(
                                        accountId,
                                        level2Job,
                                        level3JobName,
                                        jobStatus,
                                        messageTimestamp,
                                        resourceStatusReason,
                                        physicalResourceId,
                                        logicalResourceId
                                    );
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
                logger.warn(`Delaying polling for SQS queue '${queueUrl}' due to error`, inspect(err));
                logger.warn(`Delaying polling for SQS queue '${queueUrl}' due to error`, err.code);
                logger.warn(
                    `Delaying polling for SQS queue '${queueUrl}' due to error with messsage`,
                    JSON.stringify(err)
                );
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
