import { getResourcesWithCostAllocationTag } from '../../lib/aws/tags';
import getLogger from '../../utils/logger';
import { ResourceDetails } from '../../utils/common-types';

const logger = getLogger();

async function getCostAllocationTagResources(resourceDetail: ResourceDetails) {
    logger.debug(' Get Resources which has cost allocation tag attached', resourceDetail);
    try {
        const { region, co_relation_id: fileSystemId, metadata } = resourceDetail;
        const { credentialsId, activeNodeInstanceId, standbyNodeInstanceId } = metadata as {
            credentialsId: string;
            activeNodeInstanceId: string;
            standbyNodeInstanceId: string;
        };

        const tagValues: Array<string> = [fileSystemId!, activeNodeInstanceId];
        if (standbyNodeInstanceId !== undefined) {
            tagValues.push(standbyNodeInstanceId);
        }
        const resources = await getResourcesWithCostAllocationTag(credentialsId, region!, tagValues);
        return resources;
    } catch (error) {
        logger.error('Error tagging resource:', error);
        throw error;
    }
}

export { getCostAllocationTagResources };
