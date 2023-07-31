import { getVpcsList } from '../operations/aws/ec2-operations';
import { regionQuotas } from '../operations/aws/service-quotas-operations';
import { currentCfStacksCount } from '../operations/aws/cloud-formation-operations';
import getLogger from './logger';

const logger = getLogger();

async function isVpcQuotaReached(credentialsId: string, region: string) {
    logger.info('Performing vpc quota check in region ', { credentialsId, region });
    const quotaDetails = await regionQuotas(region);
    const currentVpcCount = (await getVpcsList(credentialsId, region)).vpcs.length;
    if (currentVpcCount == quotaDetails.vpcCountQuota) {
        return true;
    }
    return false;
}

async function isCfStackQuotaReached(region: string) {
    logger.info('Performing cloudformation stacks quota check in region ', region);
    const quotaDetails = await regionQuotas(region);
    const stacksCount = await currentCfStacksCount(region);
    if (
        stacksCount.currentStacksCount == quotaDetails.cfCountQuota ||
        quotaDetails.cfCountQuota - stacksCount.currentStacksCount < 5
    ) {
        return true;
    }
    return false;
}

export { isVpcQuotaReached, isCfStackQuotaReached };
