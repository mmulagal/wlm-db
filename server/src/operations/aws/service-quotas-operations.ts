import createError from 'http-errors';
import { getServiceQuotasClient, getVpcQuota, getCloudFormationQuota } from '../../lib/aws/service-quotas';
import getLogger from '../../utils/logger';
import { VPC_COUNT_QUOTANAME, CF_STACK_COUNT_QUOTANAME, HttpErrorCodes } from '../../utils/consts';

const logger = getLogger();

async function vpcQuota(credentialsId: string, region: string) {
    logger.info('Fetching Vpc quotas in region ', { credentialsId, region });
    const serviceQuotaClient = await getServiceQuotasClient(credentialsId, region);
    const vpcCountQuota =
        (await getVpcQuota(serviceQuotaClient)).Quotas?.filter(x => x.QuotaName == VPC_COUNT_QUOTANAME) || [];
    logger.debug('VPC count quota ' + vpcCountQuota);
    if (vpcCountQuota.length < 0) {
        {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Unable to fetch Vpc count quota for region ${region} and credentials ${credentialsId}.`
            );
        }
    }
    return { vpcCountQuota: vpcCountQuota[0].Value || 0 };
}

async function cfQuota(credentialsId: string, region: string) {
    logger.info('Fetching CloudFormation quotas in region ', { credentialsId, region });
    const serviceQuotaClient = await getServiceQuotasClient(credentialsId, region);
    const cfCountQuota =
        (await getCloudFormationQuota(serviceQuotaClient)).Quotas?.filter(
            x => x.QuotaName == CF_STACK_COUNT_QUOTANAME
        ) || [];
    logger.debug('CF count quota ' + cfCountQuota);
    if (cfCountQuota.length < 0) {
        {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Unable to fetch CloudFormation stack count quota for region ${region} and credentials ${credentialsId}.`
            );
        }
    }
    return { cfCountQuota: cfCountQuota[0].Value || 0 };
}

export { vpcQuota, cfQuota };
