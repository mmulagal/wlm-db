import { ServiceQuotasClient, ListServiceQuotasCommand } from '@aws-sdk/client-service-quotas';
import getLogger from '../../utils/logger';
import { AWSServiceNames } from '../../utils/consts';

const logger = getLogger();

async function getServiceQuotasClient(region: string) {
    logger.debug('Getting ServiceQuotas client:', region);
    return new ServiceQuotasClient({ region: region });
}

async function getVpcQuota(serviceQuotaClient: ServiceQuotasClient) {
    logger.info('Get VPC quota');
    const resp = await serviceQuotaClient.send(new ListServiceQuotasCommand({ ServiceCode: AWSServiceNames.VPC }));
    logger.debug('VPC quota response', resp);
    return resp;
}

async function getCloudFormationQuota(serviceQuotaClient: ServiceQuotasClient) {
    logger.info('Get Cloud Formation quota');
    const resp = await serviceQuotaClient.send(
        new ListServiceQuotasCommand({ ServiceCode: AWSServiceNames.CLOUDFORMATION })
    );
    logger.debug('Cloud Formation quota response', resp);
    return resp;
}

export { getServiceQuotasClient, getVpcQuota, getCloudFormationQuota };
