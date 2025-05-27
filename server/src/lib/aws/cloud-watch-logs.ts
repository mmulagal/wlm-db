import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    GetLogEventsCommandInput,
    LogGroup,
    paginateGetLogEvents,
    PutRetentionPolicyCommand
} from '@aws-sdk/client-cloudwatch-logs';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getCloudWatchLogsClient(region: string, credentialsId: string, accountId?: string) {
    logger.debug('Getting cloud watch logs client:', region, credentialsId, accountId);
    try {
        const {
            credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
        } = await getCredentialsDetails(credentialsId, accountId);
        const credentials = { accessKeyId, secretAccessKey, sessionToken };
        return new CloudWatchLogsClient({ region, credentials });
    } catch (error) {
        logger.error('Cloud watch logs client creation failed', error);
        throw error;
    }
}

async function getPaginatedCloudwatchLogs(
    credentialsId: string,
    region: string,
    input: GetLogEventsCommandInput,
    accountId?: string
): Promise<string[]> {
    logger.info('Getting paginated cloud watch logs:', credentialsId, region, input, accountId);
    const client = await getCloudWatchLogsClient(region, credentialsId, accountId);
    const logs: string[] = [];

    const paginator = paginateGetLogEvents(
        {
            client,
            pageSize: 200,
            stopOnSameToken: true
        },
        input
    );

    for await (const page of paginator) {
        const log = page?.events?.map(({ message }) => message).join('');
        if (log) {
            logs.push(log);
        }
    }

    logger.debug('Number of paginated logs retrieved', logs.length);
    return logs;
}

async function describeLogGroups(
    credentialsId: string,
    region: string,
    logGroupName: string
): Promise<LogGroup[] | undefined> {
    logger.info('Describing log groups:', { region, credentialsId, logGroupName });
    const client = await getCloudWatchLogsClient(region, credentialsId);

    try {
        const describeCommand = new DescribeLogGroupsCommand({ logGroupNamePrefix: logGroupName });
        const response = await client.send(describeCommand);
        logger.debug('Log groups:', response.logGroups);
        return response.logGroups;
    } catch (error) {
        logger.error('Error describing log groups:', error);
    }
}

async function putLogGroupRetentionPolicy(
    credentialsId: string,
    region: string,
    logGroupName: string,
    retentionInDays = 1
): Promise<void> {
    logger.info('Setting log group retention policy:', { region, credentialsId, logGroupName, retentionInDays });
    const client = await getCloudWatchLogsClient(region, credentialsId);

    try {
        const command = new PutRetentionPolicyCommand({
            logGroupName,
            retentionInDays
        });
        await client.send(command);
        logger.info(`Retention policy updated to ${retentionInDays} days for log group "${logGroupName}".`);
    } catch (error) {
        logger.error('Error setting retention policy:', error);
    }
}

export { getPaginatedCloudwatchLogs, describeLogGroups, putLogGroupRetentionPolicy };
