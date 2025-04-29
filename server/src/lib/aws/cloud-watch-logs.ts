import {
    CloudWatchLogsClient,
    GetLogEventsCommandInput,
    paginateGetLogEvents,
    PutRetentionPolicyCommand
} from '@aws-sdk/client-cloudwatch-logs';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import { CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE } from '../../utils/consts';

const logger = getLogger();

async function getCloudWatchLogsClient(region: string, credentialsId: string) {
    logger.debug('Getting cloud watch logs client:', region, credentialsId);
    try {
        const {
            credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
        } = await getCredentialsDetails(credentialsId);
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
    input: GetLogEventsCommandInput
): Promise<string[]> {
    logger.info('Getting paginated cloud watch logs:', credentialsId, region, input);
    const client = await getCloudWatchLogsClient(region, credentialsId);
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

// Function to set the retention policy for a log group
async function setLogGroupRetentionPolicy(
    credentialsId: string,
    region: string,
    logGroupName = CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE,
    retentionInDays = 1
): Promise<void> {
    logger.info('Setting log group retention policy:', { region, credentialsId, logGroupName, retentionInDays });
    const client = await getCloudWatchLogsClient(region, credentialsId);
    const command = new PutRetentionPolicyCommand({
        logGroupName,
        retentionInDays
    });
    await client.send(command);
    logger.debug('Log group retention policy set successfully:', { logGroupName, retentionInDays });
}

export { getPaginatedCloudwatchLogs, setLogGroupRetentionPolicy };
