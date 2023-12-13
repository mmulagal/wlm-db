import { getResourcesWithCostAllocationTag, tagResource } from '../../lib/aws/tags';
import { getEc2Arn, getFsxArn } from '../../utils/utils';
import getLogger from '../../utils/logger';
import { ResourceDetails } from '../../utils/common-types';

const logger = getLogger();

async function tagFsxResource(
    credentialsId: string,
    region: string,
    awsAccountId: string,
    fsxId: string,
    tags: Record<string, string>
) {
    logger.info('Adding tag to Fsx resource', credentialsId, region, awsAccountId, fsxId);
    const fsxArn = getFsxArn(awsAccountId, region, fsxId);
    tagResource(credentialsId, region, fsxArn, tags);
}

async function tagEc2Resource(
    credentialsId: string,
    region: string,
    awsAccountId: string,
    ec2Id: string,
    tags: Record<string, string>
) {
    logger.info('Adding tag to EC2 resource', credentialsId, region, awsAccountId, ec2Id);
    const ec2Arn = getEc2Arn(awsAccountId, region, ec2Id);
    tagResource(credentialsId, region, ec2Arn, tags);
}

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

export { tagEc2Resource, tagFsxResource, getCostAllocationTagResources };
