import createError from 'http-errors';
import { listTopics } from '../../lib/aws/sns';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSnsTopics(credentialsId: string, region: string) {
    logger.info('List SNS topics in a region', { credentialsId, region });

    try {
        const { Topics } = await listTopics(credentialsId, region);

        if (!Topics) {
            return { Topics: [] };
        }
        const regexPattern = /(?<=:)[^:]+$/;
        const updatedTopics = Topics.map(topic => {
            const { TopicArn } = topic;
            const topicNameMatch = TopicArn ? TopicArn.match(regexPattern) : ' ';
            const TopicName = topicNameMatch ? topicNameMatch[0] : ' ';
            return { TopicArn, TopicName };
        });

        return { Topics: updatedTopics };
    } catch (error: any) {
        logger.error('Failed to get the SNS topics ', error.message);
        throw createError(error.statusCode || error.code || 500, error.message);
    }
}

export { getSnsTopics };
