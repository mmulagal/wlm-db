import {
    CostExplorerClient,
    GetCostAndUsageCommand,
    GetCostAndUsageCommandInput,
    GetTagsCommand,
    GetTagsCommandInput
} from '@aws-sdk/client-cost-explorer';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

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

async function getCostAndUsage(region: string, input: GetCostAndUsageCommandInput, credentialsId?: string) {
    logger.info('Get cost and usage :', region, credentialsId, input);
    try {
        const client = await getCostExplorerClient(region, credentialsId);
        const command = new GetCostAndUsageCommand(input);
        const response = await client.send(command);
        return response;
    } catch (error) {
        logger.error('Error retrieving billng cost and usage:', error);
        throw error;
    }
}

async function getTagsfromCostExplorer(region: string, input: GetTagsCommandInput, credentialsId?: string) {
    logger.info('Get cost allocation tag at account level :', region, credentialsId, input);
    try {
        const client = await getCostExplorerClient(region, credentialsId);
        const command = new GetTagsCommand(input);
        const response = await client.send(command);
        return response;
    } catch (error) {
        logger.error('Error retrieving cost allocation tag', error);
        throw error;
    }
}

export { getCostExplorerClient, getCostAndUsage, getTagsfromCostExplorer };
