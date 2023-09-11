import Promise from 'bluebird';
import { describeRegions } from '../../lib/aws/ec2';
import { createTopic, listTopics, setTopicAttributes, subscribeTopic } from '../../lib/aws/sns';
import { createQueue } from '../../lib/aws/sqs';
import { DEFAULT_AWS_REGION, WLMDB } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { derivePropertiesFromARN, getQueueArn } from '../../utils/utils';

const logger = getLogger();

function transformStackEventMessage(message: string) {
    logger.info('Transform stack events message', { message });

    const messagesArray = message.split('\n');
    const messageObject = new Map<string, string>();
    messagesArray.forEach(messageString => {
        // eslint-disable-next-line quotes
        const [key, value] = messageString.replaceAll("'", '').split('=');
        messageObject.set(key, value);
    });
    return Object.fromEntries(messageObject);
}

async function getSnsTopics(credentialsId: string, region: string) {
    logger.info('List SNS topics in a region', { credentialsId, region });

    const { Topics } = await listTopics(credentialsId, region);

    if (!Topics) {
        return { topics: [] };
    }
    const regexPattern = /(?<=:)[^:]+$/;
    const updatedTopics = Topics.map(({ TopicArn }) => ({
        topicArn: TopicArn,
        topicName: TopicArn?.match(regexPattern)?.[0] || '-'
    }));

    return { topics: updatedTopics };
}

async function createAndSubscribeToSnsTopicInAllRegions() {
    logger.info('Create and subscribe to SNS topics in all region');

    const { Regions: regions } = await describeRegions({});
    try {
        const queueName = WLMDB;
        const { QueueUrl } = await createQueue(DEFAULT_AWS_REGION, { QueueName: queueName });
        if (regions && QueueUrl) {
            await Promise.map(
                regions,
                async ({ RegionName: code }) => {
                    if (code && process.env.AWS_ROLE_ARN) {
                        const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN) || {};
                        const policyStatement = {
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Sid: 'AllowSNSNotifications',
                                    Effect: 'Allow',
                                    Principal: {
                                        Service: 'cloudformation.amazonaws.com' // TODO: temporary change as staging cluster has policy with above definition
                                    },
                                    Action: 'SNS:Publish',
                                    Resource: `arn:aws:sns:${code}:${awsAccountId}:${queueName}`
                                }
                            ]
                        };
                        const { TopicArn } = await createTopic(code, {
                            Name: queueName,
                            Attributes: {
                                Policy: JSON.stringify(policyStatement)
                            }
                        });

                        const accountId = QueueUrl?.split('/')[3];
                        const queueArn = getQueueArn(accountId, queueName);

                        await subscribeTopic(code, {
                            Protocol: 'sqs',
                            TopicArn,
                            Endpoint: queueArn
                        });
                    }
                },
                { concurrency: 3 }
            );
        }
    } catch (error) {
        logger.error('Failed to create and subscribe to SNS topics', error);
    }
}

// TODO: delete me; temporary function
async function updateSnsTopicAttributeInAllRegions() {
    logger.info('Update SNS topic attributes in all region');

    const { Regions: regions } = await describeRegions({});
    try {
        if (regions) {
            await Promise.map(
                regions,
                async ({ RegionName: code }) => {
                    if (code && process.env.AWS_ROLE_ARN) {
                        const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN) || {};
                        const policyStatement = {
                            Version: '2012-10-17',
                            Statement: [
                                {
                                    Sid: 'AllowSNSNotifications',
                                    Effect: 'Allow',
                                    Principal: {
                                        AWS: '*'
                                    },
                                    Action: 'SNS:Publish',
                                    Resource: `arn:aws:sns:${code}:${awsAccountId}:${WLMDB}`
                                },
                                {
                                    Sid: 'AllowSNSSubscriptions',
                                    Effect: 'Allow',
                                    Principal: {
                                        AWS: '*'
                                    },
                                    Action: 'SNS:Subscribe',
                                    Resource: `arn:aws:sns:${code}:${awsAccountId}:${WLMDB}`
                                }
                            ]
                        };
                        try {
                            await setTopicAttributes(code, {
                                TopicArn: `arn:aws:sns:${code}:${awsAccountId}:${WLMDB}`,
                                AttributeName: 'Policy',
                                AttributeValue: JSON.stringify(policyStatement)
                            });
                        } catch (error) {
                            logger.error('>>Failed to set topic attributes', error);
                        }
                    }
                },
                { concurrency: 3 }
            );
        }
    } catch (error) {
        logger.error('Failed to create and subscribe to SNS topics', error);
    }
}

export {
    getSnsTopics,
    createAndSubscribeToSnsTopicInAllRegions,
    updateSnsTopicAttributeInAllRegions,
    transformStackEventMessage
};
