import throat from 'throat';
import { describeRegions } from '../../lib/aws/ec2';
import { createTopic, listTopics, subscribeTopic } from '../../lib/aws/sns';
import { createQueue } from '../../lib/aws/sqs';
import { AWS_RESOURCE_NAME_TAG, SQS_MSG_RETENTION, WLMDB } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { derivePropertiesFromARN, getArnPartition, getDefaultRegion, getQueueArn } from '../../utils/utils';

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

async function getSnsTopics(region: string, credentialsId?: string) {
    logger.info('List SNS topics in a region', { credentialsId, region });

    const { Topics } = await listTopics(region, credentialsId);

    if (!Topics) {
        return { topics: [] };
    }
    const regexPattern = /(?<=:)[^:]+$/;
    const updatedTopics = Topics.filter(({ TopicArn }) => TopicArn && !TopicArn.endsWith('.fifo')).map(
        ({ TopicArn }) => ({
            topicArn: TopicArn,
            topicName: TopicArn?.match(regexPattern)?.[0] || '-'
        })
    );

    return { topics: updatedTopics };
}

async function createAndSubscribeToSnsTopicInAllRegions() {
    logger.info('Create and subscribe to SNS topics in all region');

    const { Regions: regions } = await describeRegions({});
    try {
        if (process.env.AWS_ROLE_ARN) {
            const { awsAccountId } = derivePropertiesFromARN(process.env.AWS_ROLE_ARN) || {};
            const queueName = WLMDB;
            const region = getDefaultRegion();
            const partition = getArnPartition();
            const { QueueUrl } = await createQueue(region, {
                QueueName: queueName,
                Attributes: {
                    MessageRetentionPeriod: SQS_MSG_RETENTION,
                    Policy: JSON.stringify({
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Sid: '__owner_statement',
                                Effect: 'Allow',
                                Principal: {
                                    AWS: `arn:${partition}:iam::${awsAccountId}:root`
                                },
                                Action: 'SQS:*',
                                Resource: `arn:${partition}:sqs:${region}:${awsAccountId}:${queueName}`
                            },
                            {
                                Sid: 'sns-topic-subscription',
                                Effect: 'Allow',
                                Principal: {
                                    AWS: '*'
                                },
                                Action: 'SQS:SendMessage',
                                Resource: `arn:${partition}:sqs:${region}:${awsAccountId}:${queueName}`,
                                Condition: {
                                    ArnLike: {
                                        'aws:SourceArn': `arn:${partition}:sns:*:${awsAccountId}:${queueName}`
                                    }
                                }
                            }
                        ]
                    })
                },
                tags: {
                    Name: WLMDB
                }
            });
            if (regions && QueueUrl) {
                await Promise.all(
                    regions.map(
                        throat(3, async ({ RegionName: code }) => {
                            if (code) {
                                const policyStatement = {
                                    Version: '2012-10-17',
                                    Statement: [
                                        {
                                            Sid: 'AllowSNSNotifications',
                                            Effect: 'Allow',
                                            Principal: {
                                                AWS: '*'
                                            },
                                            Action: ['SNS:Publish', 'SNS:Subscribe'],
                                            Resource: `arn:${partition}:sns:${code}:${awsAccountId}:${queueName}`
                                        }
                                    ]
                                };
                                const wlmdbTopicArn = await checkAndCreateTopic(code, queueName, policyStatement);

                                const accountId = QueueUrl?.split('/')[3];
                                const queueArn = getQueueArn(accountId, queueName);

                                await subscribeTopic(code, {
                                    Protocol: 'sqs',
                                    TopicArn: wlmdbTopicArn,
                                    Endpoint: queueArn
                                });
                            }
                        })
                    )
                );
            }
        }
    } catch (error) {
        logger.error('Failed to create and subscribe to SNS topics', error);
    }
}

async function checkAndCreateTopic(region: string, queueName: string, policyStatement: any) {
    logger.info('Check and create sns topic', region, queueName, policyStatement);
    let wlmdbTopicArn;

    try {
        const existingTopics = await getSnsTopics(region);

        const matchingTopic = existingTopics.topics.find(topic => topic.topicName === queueName);

        if (matchingTopic) {
            wlmdbTopicArn = matchingTopic.topicArn;
            logger.debug('Topic already exists at region', region);
        }
    } catch (error) {
        logger.error('Error occurred while calling getSnsTopics:', error);
    }

    if (!wlmdbTopicArn && process.env.KEY_ALIAS) {
        const { TopicArn } = await createTopic(region, {
            Name: queueName,
            Attributes: {
                Policy: JSON.stringify(policyStatement),
                KmsMasterKeyId: process.env.KEY_ALIAS
            },
            Tags: [{ Key: AWS_RESOURCE_NAME_TAG, Value: WLMDB }]
        });
        wlmdbTopicArn = TopicArn;
    }

    return wlmdbTopicArn;
}
export { getSnsTopics, checkAndCreateTopic, createAndSubscribeToSnsTopicInAllRegions, transformStackEventMessage };
