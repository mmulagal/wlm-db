import { listServiceQuota } from '../../lib/aws/service-quotas';
import getLogger from '../../utils/logger';
import { VPC_COUNT_QUOTANAME, CF_STACK_COUNT_QUOTANAME, AWSServiceNames } from '../../utils/consts';

const logger = getLogger();

async function getVpcQuota(credentialsId: string, region: string) {
    logger.info('Fetching Vpc quotas in region ', { credentialsId, region });
    const [vpcCountQuota] =
        (await listServiceQuota(credentialsId, region, AWSServiceNames.VPC)).Quotas?.filter(
            x => x.QuotaName == VPC_COUNT_QUOTANAME
        ) || [];
    logger.debug('VPC count quota ', vpcCountQuota);
    return { vpcCountQuota: vpcCountQuota.Value! };
}

async function getCfQuota(credentialsId: string, region: string) {
    logger.info('Fetching CloudFormation quotas in region ', { credentialsId, region });
    const [cfCountQuota] =
        (await listServiceQuota(credentialsId, region, AWSServiceNames.CLOUDFORMATION)).Quotas?.filter(
            x => x.QuotaName == CF_STACK_COUNT_QUOTANAME
        ) || [];
    logger.debug('CF count quota ', cfCountQuota);
    return { cfCountQuota: cfCountQuota.Value! };
}

export { getVpcQuota, getCfQuota };
