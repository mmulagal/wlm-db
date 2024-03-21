import {
    CloudWatchClient,
    GetMetricStatisticsCommand,
    GetMetricStatisticsCommandInput
} from '@aws-sdk/client-cloudwatch';

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
