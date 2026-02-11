import {
    CloudWatchClient,
    GetMetricDataCommandInput,
    GetMetricStatisticsCommand,
    GetMetricStatisticsCommandInput,
    paginateGetMetricData
} from '@aws-sdk/client-cloudwatch';
import addCacheMiddleware from '../../utils/aws-sdk-middlewares';
import { AWSSDKCacheParams } from '../../utils/common-types';

import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getCloudWatchClient(
    region: string,
    credentialsId: string,
    accountId?: string,
    cacheParams: AWSSDKCacheParams = { useCache: true } // Default to using cache if not provided
) {
    logger.debug('Getting cloud watch client', { region, credentialsId, accountId });
    try {
        const {
            credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
        } = await getCredentialsDetails(credentialsId, accountId);
        const credentials = { accessKeyId, secretAccessKey, sessionToken };
        const client = new CloudWatchClient({ credentials, region });
        return addCacheMiddleware(client, { ...cacheParams, credentialsId });
    } catch (error) {
        logger.error('Cloud watch client creation failed', error);
        throw error;
    }
}

async function getCloudWatchMetrics(
    credentialsId: string,
    region: string,
    params: GetMetricDataCommandInput,
    accountId?: string,
    cacheParams?: AWSSDKCacheParams
) {
    logger.info('Get cloud watch metrics', { region, credentialsId, params, accountId });
    try {
        const client = await getCloudWatchClient(region, credentialsId, accountId, cacheParams);
        const paginator = paginateGetMetricData({ client }, { ...params });
        const response: any[] = [];
        for await (const page of paginator) {
            if (page.MetricDataResults) {
                response.push(...page.MetricDataResults);
            }
        }
        return response;
    } catch (error) {
        logger.error('Error getting metric data:', error);
        throw error;
    }
}

async function getMetricStatistics(
    credentialsId: string,
    region: string,
    params: GetMetricStatisticsCommandInput,
    accountId?: string
) {
    logger.info('Get metric statistics', { region, credentialsId, params, accountId });
    try {
        const client = await getCloudWatchClient(region, credentialsId, accountId);
        const command = new GetMetricStatisticsCommand(params);
        const response = await client.send(command);
        return response;
    } catch (error) {
        logger.error('Error getting metric statistics:', error);
        throw error;
    }
}

export { getMetricStatistics, getCloudWatchMetrics };
