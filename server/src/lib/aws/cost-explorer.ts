import {
    CostExplorerClient,
    GetCostAndUsageCommand,
    GetCostAndUsageCommandInput,
    GetCostAndUsageCommandOutput,
    GetTagsCommand,
    GetTagsCommandInput,
    GetTagsCommandOutput
} from '@aws-sdk/client-cost-explorer';
import { isEmpty } from 'lodash-es';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import { generateHash } from '../../utils/utils';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { AWS_CE_TYPE, GOV_ACCOUNT } from '../../utils/consts';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';

const logger = getLogger();

async function getCostExplorerClient(region: string, credentialsId?: string) {
    logger.debug('Getting cost explorer  client:', region, credentialsId);
    try {
        const {
            credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
        } = await getCredentialsDetails(credentialsId!);
        const credentials = { accessKeyId, secretAccessKey, sessionToken };
        return new CostExplorerClient({ region, credentials });
    } catch (error) {
        logger.error('Cost explorer client creation failed', error);
        throw error;
    }
}

async function getCostAndUsage(
    region: string,
    input: GetCostAndUsageCommandInput,
    credentialsId?: string,
    readFromCache = true
) {
    const isGov = getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT);
    if (isGov) {
        logger.info('Cost Explorer API is not available for GovCloud accounts, returning empty results');
        return { ResultsByTime: [], $metadata: { httpStatusCode: 200 } } as GetCostAndUsageCommandOutput;
    }

    logger.info('Get cost and usage :', region, credentialsId, input);
    try {
        const costAndUsageHash = generateHash(JSON.stringify(input));
        if (readFromCache && hasCache(AWS_CE_TYPE, costAndUsageHash)) {
            logger.debug('Found pricing information in cache');

            return readFromCacheByKey(AWS_CE_TYPE, costAndUsageHash) as GetCostAndUsageCommandOutput;
        }
        const client = await getCostExplorerClient(region, credentialsId);
        const command = new GetCostAndUsageCommand(input);
        const response = await client.send(command);
        if (!isEmpty(response)) {
            logger.debug('Writing pricing information to cache');

            writeToCache(AWS_CE_TYPE, costAndUsageHash, response);
        }
        return response;
    } catch (error) {
        logger.error('Error retrieving billng cost and usage:', error);
        throw error;
    }
}

async function getTagsfromCostExplorer(
    region: string,
    input: GetTagsCommandInput,
    credentialsId?: string,
    readFromCache = true
) {
    const isGov = getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT);
    if (isGov) {
        logger.info('Cost Explorer API is not available for GovCloud accounts, returning empty results');
        return { Tags: [], ReturnSize: 0, TotalSize: 0, $metadata: { httpStatusCode: 200 } } as GetTagsCommandOutput;
    }

    logger.info('Get cost allocation tag at account level :', region, credentialsId, input);
    try {
        const ceTagsHash = generateHash(JSON.stringify(input));
        if (readFromCache && hasCache(AWS_CE_TYPE, ceTagsHash)) {
            logger.debug('Found pricing information in cache');

            return readFromCacheByKey(AWS_CE_TYPE, ceTagsHash) as GetTagsCommandOutput;
        }
        const client = await getCostExplorerClient(region, credentialsId);
        const command = new GetTagsCommand(input);
        const response = await client.send(command);
        if (!isEmpty(response)) {
            logger.debug('Writing pricing information to cache');

            writeToCache(AWS_CE_TYPE, ceTagsHash, response);
        }
        return response;
    } catch (error) {
        logger.error('Error retrieving cost allocation tag', error);
        throw error;
    }
}

export { getCostExplorerClient, getCostAndUsage, getTagsfromCostExplorer };
