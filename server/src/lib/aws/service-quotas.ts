import { ServiceQuotasClient, ListServiceQuotasCommand } from '@aws-sdk/client-service-quotas';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getServiceQuotasClient(credentialsId: string, region: string) {
    logger.debug('Getting ServiceQuotas client:', { credentialsId, region });
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    return new ServiceQuotasClient({ region: region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
}

async function listServiceQuota(serviceQuotaClient: ServiceQuotasClient, serviceCode: string) {
    logger.info(`List ${serviceCode} quota`);
    const resp = await serviceQuotaClient.send(new ListServiceQuotasCommand({ ServiceCode: serviceCode }));
    logger.debug(`${serviceCode} quota response ${resp}`);
    return resp;
}

export { getServiceQuotasClient, listServiceQuota };
