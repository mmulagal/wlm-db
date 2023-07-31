import { ServiceQuotasClient, ListServiceQuotasCommand } from '@aws-sdk/client-service-quotas';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';
import { AWSServiceNames } from '../../utils/consts';

const logger = getLogger();

async function getServiceQuotasClient(credentialsId: string, region: string) {
    logger.debug('Getting ServiceQuotas client:', { credentialsId, region });
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    return new ServiceQuotasClient({ region: region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
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
