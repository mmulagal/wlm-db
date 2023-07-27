import createError from 'http-errors';
import { listTopics } from '../../lib/aws/sns';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSnsTopics(credentialsId: string, region: string) {
    logger.info('List SNS topics in a region', { credentialsId, region });

    try {
        const { Topics: topics } = await listTopics(credentialsId, region);

        if (!topics) {
            return { Topics: [] };
        }

        return {
            Topics: topics.map(({ TopicArn }) => ({ TopicArn }))
        };
    } catch (error: any) {
        logger.error('Failed to get the SNS topics ', error.message);
        throw createError(error.statusCode || error.code || 500, error.message);
    }
}

export { getSnsTopics };
