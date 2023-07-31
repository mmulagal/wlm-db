import { getServiceQuotasClient, getVpcQuota, getCloudFormationQuota } from '../../lib/aws/service-quotas';
import getLogger from '../../utils/logger';
import { VPC_COUNT_QUOTANAME, CF_STACK_COUNT_QUOTANAME } from '../../utils/consts';

const logger = getLogger();

async function regionQuotas(credentialsId: string, region: string) {
    logger.info('Fetching quotas in region ', { credentialsId, region });
    const serviceQuotaClient = await getServiceQuotasClient(credentialsId, region);
    const vpcCountQuota =
        (await getVpcQuota(serviceQuotaClient)).Quotas?.filter(x => x.QuotaName == VPC_COUNT_QUOTANAME) || [];
    const cfCountQuota =
        (await getCloudFormationQuota(serviceQuotaClient)).Quotas?.filter(
            x => x.QuotaName == CF_STACK_COUNT_QUOTANAME
        ) || [];
    logger.debug('VPC count quota ' + vpcCountQuota + '. CF count quota ' + cfCountQuota);
    return { vpcCountQuota: vpcCountQuota[0].Value || 0, cfCountQuota: cfCountQuota[0].Value || 0 };
}

export { regionQuotas };
