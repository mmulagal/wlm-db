import createError from 'http-errors';
import { listServiceQuota } from '../../lib/aws/service-quotas';
import { getVpcsList } from './ec2-operations';
import { currentCfStacksCount } from './cloud-formation-operations';
import {
    VPC_COUNT_QUOTANAME,
    CF_STACK_COUNT_QUOTANAME,
    AWSServiceNames,
    STACKS_DEPLOYED,
    HttpErrorCodes
} from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getVpcQuota(credentialsId: string, region: string) {
    logger.info('Fetching Vpc quotas in region ', { credentialsId, region });

    const [vpcCountQuota] =
        (await listServiceQuota(credentialsId, region, AWSServiceNames.VPC)).Quotas?.filter(
            x => x.QuotaName === VPC_COUNT_QUOTANAME
        ) || [];
    logger.debug('VPC count quota ', vpcCountQuota);

    return { vpcCountQuota: vpcCountQuota.Value! };
}

async function getCfQuota(credentialsId: string, region: string) {
    logger.info('Fetching CloudFormation quotas in region ', { credentialsId, region });

    const [cfCountQuota] =
        (await listServiceQuota(credentialsId, region, AWSServiceNames.CLOUDFORMATION)).Quotas?.filter(
            x => x.QuotaName === CF_STACK_COUNT_QUOTANAME
        ) || [];
    logger.debug('CF count quota ', cfCountQuota);

    return { cfCountQuota: cfCountQuota.Value! };
}

async function isVpcQuotaReached(credentialsId: string, region: string) {
    logger.info('Performing vpc quota check in region ', { credentialsId, region });
    const quotaDetails = await getVpcQuota(credentialsId, region);
    const currentVpcCount = (await getVpcsList(credentialsId, region)).vpcs.length;
    return currentVpcCount === quotaDetails.vpcCountQuota;
}

async function isCfStackQuotaReached(credentialsId: string, region: string) {
    logger.info('Performing cloudformation stacks quota check in region ', region);
    const quotaDetails = await getCfQuota(credentialsId, region);
    const stacksCount = await currentCfStacksCount(credentialsId, region);
    if (!stacksCount.currentStacksCount) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to get cloudformation stacks in region ${region} and credentials ${credentialsId}.`
        );
    }
    // We might deploy more than 1 stack and diff (cfstackquota, current deployed stacks) must be >= STACKS_DEPLOYED
    return (
        stacksCount.currentStacksCount === quotaDetails.cfCountQuota ||
        quotaDetails.cfCountQuota - stacksCount.currentStacksCount < STACKS_DEPLOYED
    );
}

export { getVpcQuota, getCfQuota, isVpcQuotaReached, isCfStackQuotaReached };
