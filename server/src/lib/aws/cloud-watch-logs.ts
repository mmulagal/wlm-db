import { CloudWatchLogsClient, GetLogEventsCommandInput, paginateGetLogEvents } from '@aws-sdk/client-cloudwatch-logs';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

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

export default async function getPaginatedLogs(
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

    for await (const { events } of paginator) {
        const log = events?.map(({ message }) => message).join('');
        if (log) {
            logs.push(log);
        }
    }

    logger.debug('Number of paginated logs retrieved', logs.length);
    return logs;
}
