import {
    GetResourcesCommand,
    GetResourcesCommandInput,
    GetResourcesCommandOutput,
    ResourceGroupsTaggingAPIClient
} from '@aws-sdk/client-resource-groups-tagging-api';
import { WLMDB_COST_ALLOCATION_TAG } from '../../utils/consts';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';

import getLogger from '../../utils/logger';

const logger = getLogger();
const EC2RESOURCEFILTER = 'ec2:instance';
const FSXRESOURCEFILTER = 'fsx:file-system';

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

async function getResourcesWithCostAllocationTag(credentialsId: string, region: string, tagValues: Array<string>) {
    logger.info('Getting tags attached to  resource', credentialsId, region, tagValues);

    const client = await getResourceClient(region, credentialsId);

    // Note: - Either ResourceARNList or TagFilters can be passed as filter
    const params: GetResourcesCommandInput = {
        // ResourceARNList: resourceArn
        ResourceTypeFilters: [EC2RESOURCEFILTER, FSXRESOURCEFILTER],
        TagFilters: [
            {
                Key: WLMDB_COST_ALLOCATION_TAG,
                Values: tagValues
            }
        ]
    };

    try {
        const command = new GetResourcesCommand(params);
        const response: GetResourcesCommandOutput = await client.send(command);
        logger.debug('Resource tags fetched successfully:', response);
        return response;
    } catch (error) {
        logger.error('Error tagging resource:', error);
        throw error;
    }
}

export { getResourcesWithCostAllocationTag };
