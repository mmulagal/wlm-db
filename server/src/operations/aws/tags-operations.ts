import { getResourcesWithCostAllocationTag } from '../../lib/aws/tags';
import getLogger from '../../utils/logger';
import { Metadata, ResourceDetails } from '../../utils/common-types';

const logger = getLogger();

async function getCostAllocationTagResources(resourceDetail: ResourceDetails) {
    logger.debug(' Get Resources which has cost allocation tag attached', resourceDetail);
    try {
        const { region, co_relation_id: fileSystemId, credentials_id: credentialsId, metadata } = resourceDetail;
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

        const tagValues: Array<string> = [fileSystemId!, node1InstanceId];
        if (node2InstanceId !== undefined) {
            tagValues.push(node2InstanceId);
        }
        const resources = await getResourcesWithCostAllocationTag(credentialsId, region!, tagValues);
        return resources;
    } catch (error) {
        logger.error('Error tagging resource:', error);
        throw error;
    }
}

export { getCostAllocationTagResources };
