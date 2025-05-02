import {
    describeLogGroups,
    getPaginatedCloudwatchLogs,
    putLogGroupRetentionPolicy
} from '../../lib/aws/cloud-watch-logs';
import { CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getCloudWatchLogs(credentialsId: string, region: string, logGroupName: string, logStreamName: string) {
    logger.info('Getting cloudwatch logs response:', { region, credentialsId, logGroupName, logStreamName });

    const input = {
        logGroupName,
        logStreamName,
        startFromHead: true // Ensures fetching starts from the oldest events
    };

    try {
        const logs = await getPaginatedCloudwatchLogs(credentialsId, region, input);
        return logs;
    } catch (error) {
        logger.error('Error reading log events from CloudWatch:', error);
        throw error;
    }
}

async function setLogGroupRetentionPolicy(
    credentialsId: string,
    region: string,
    logGroupName = CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE,
    retentionInDays = 1
): Promise<void> {
    logger.info('Checking and setting log group retention policy:', {
        region,
        credentialsId,
        logGroupName,
        retentionInDays
    });

    try {
        // Check the current retention policy
        const logGroups = await describeLogGroups(credentialsId, region, logGroupName);
        const logGroup = logGroups?.find(group => group.logGroupName === logGroupName);

        if (!logGroup) {
            logger.warn(`Log group "${logGroupName}" does not exist.`);
            return;
        }

        const currentRetention = logGroup.retentionInDays;
        logger.info(`Current retention policy for "${logGroupName}": ${currentRetention ?? 'Never Expire'}`);

        // Update the retention policy only if it's different
        if (retentionInDays && retentionInDays > 0 && currentRetention !== retentionInDays) {
            await putLogGroupRetentionPolicy(credentialsId, region, logGroupName, retentionInDays);
            logger.info(`Retention policy updated to ${retentionInDays} days for log group "${logGroupName}"`);
        } else {
            logger.info(`Retention policy is invalid or already set to ${retentionInDays} days. No update needed`);
        }
    } catch (error) {
        logger.error('Error checking or updating retention policy:', error);
        // Not throwing the error here to avoid breaking the flow
    }
}

export { getCloudWatchLogs, setLogGroupRetentionPolicy, logger as cloudWatchLogsLogger };
