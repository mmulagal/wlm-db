import { describeRegions } from '../../lib/aws/ec2';
import { createTopic, listTopics, subscribeTopic } from '../../lib/aws/sns';
import { createQueue } from '../../lib/aws/sqs';
import { DEFAULT_AWS_REGION, WLMDB } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

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

    const { Regions: regions } = await describeRegions(undefined, {});
    try {
        regions?.forEach(async ({ RegionName: code }) => {
            if (code) {
                const queueName = WLMDB;
                let QueueUrl;
                if (code === DEFAULT_AWS_REGION) {
                    ({ QueueUrl } = await createQueue(code, { QueueName: queueName }));
                }
                const { TopicArn } = await createTopic(code, queueName);
                const accountId = QueueUrl?.split('/')[3];
                const queueArn = `arn:aws:sqs:${DEFAULT_AWS_REGION}:${accountId}:${queueName}`;

                await subscribeTopic(code, {
                    Protocol: 'sqs',
                    TopicArn,
                    Endpoint: queueArn
                });
            }
        });
    } catch (error) {
        logger.error('Failed to create and subscribe to SNS topics', error);
    }
}

export { getSnsTopics, createAndSubscribeToSnsTopicInAllRegions };
