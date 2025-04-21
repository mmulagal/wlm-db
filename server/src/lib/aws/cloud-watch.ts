import {
    CloudWatchClient,
    GetMetricStatisticsCommand,
    GetMetricStatisticsCommandInput
} from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient, GetLogEventsCommandInput, paginateGetLogEvents } from '@aws-sdk/client-cloudwatch-logs';

import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getCloudWatchClient(region: string, credentialsId: string) {
    logger.debug('Getting cloud watch client:', region, credentialsId);
    try {
        const {
            credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
        } = await getCredentialsDetails(credentialsId);
        const credentials = { accessKeyId, secretAccessKey, sessionToken };
        return new CloudWatchClient({ region, credentials });
    } catch (error) {
        logger.error('Cloud watch client creation failed', error);
        throw error;
    }
}

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

export default async function getMetricStatistics(
    credentialsId: string,
    region: string,
    params: GetMetricStatisticsCommandInput
) {
    logger.info('Get metric statistics :', region, credentialsId, params);
    try {
        const client = await getCloudWatchClient(region, credentialsId);
        const command = new GetMetricStatisticsCommand(params);
        const response = await client.send(command);
        return response;
    } catch (error) {
        logger.error('Error getting metric statistics:', error);
        throw error;
    }
}

async function getPaginatedLogs(
    credentialsId: string,
    region: string,
    params: GetLogEventsCommandInput
): Promise<string[]> {
    logger.info('Getting paginated cloud watch logs:', credentialsId, region, params);
    const client = await getCloudWatchLogsClient(region, credentialsId);
    const logs: string[] = [];

    const paginator = paginateGetLogEvents(
        {
            client,
            pageSize: params.limit,
            stopOnSameToken: true
        },
        {
            logGroupName: params.logGroupName,
            logStreamName: params.logStreamName
        }
    );

    for await (const { events } of paginator) {
        const log = events?.map(({ message }) => message).join();
        if (log) {
            logs.push(log);
        }
    }

    logger.info('Number of paginated logs retrieved', logs.length);
    return logs;
}

export { getPaginatedLogs };
