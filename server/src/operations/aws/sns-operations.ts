import { listTopics } from '../../lib/aws/sns';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSnsTopics(credentialsId: string, region: string) {
    logger.info('List SNS topics in a region', { credentialsId, region });

    const { Topics } = await listTopics(credentialsId, region);

    if (!Topics) {
        return { Topics: [] };
    }
    const regexPattern = /(?<=:)[^:]+$/;
    const updatedTopics = Topics.map(({ TopicArn }) => ({
        topicArn: TopicArn,
        topicName: TopicArn?.match(regexPattern)?.[0] || '-'
    }));

    return { Topics: updatedTopics };
}

export { getSnsTopics };
