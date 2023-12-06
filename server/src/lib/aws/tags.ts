import {
    ResourceGroupsTaggingAPIClient,
    TagResourcesCommand,
    TagResourcesCommandOutput
} from '@aws-sdk/client-resource-groups-tagging-api';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';

import getLogger from '../../utils/logger';

const logger = getLogger();

async function getResourceClient(region: string, credentialsId?: string) {
    logger.debug('Getting resource client:', region, credentialsId);
    if (!credentialsId) {
        return new ResourceGroupsTaggingAPIClient({ region });
    }
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };
    return new ResourceGroupsTaggingAPIClient({ region, credentials });
}

async function tagResource(credentialsId: string, region: string, resourceArn: string, tags: Record<string, string>) {
    logger.info('Adding tags to resource', credentialsId, region, resourceArn, tags);

    const client = await getResourceClient(region, credentialsId);

    const params = {
        ResourceARNList: [resourceArn],
        Tags: tags
    };
    try {
        const command = new TagResourcesCommand(params);
        const response: TagResourcesCommandOutput = await client.send(command);
        if (response.FailedResourcesMap) {
            throw new Error(response.FailedResourcesMap[resourceArn].ErrorMessage);
        }
        logger.debug('Resource tagged successfully:', response);
    } catch (error) {
        logger.error('Error tagging resource:', error);
    }
}

export { tagResource };
