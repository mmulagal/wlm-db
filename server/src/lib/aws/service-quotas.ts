import { isArray } from 'lodash-es';
import { ServiceQuotasClient, paginateListServiceQuotas } from '@aws-sdk/client-service-quotas';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getServiceQuotasClient(credentialsId: string, region: string) {
    logger.debug('Getting ServiceQuotas client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId);

    return new ServiceQuotasClient({ region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
}

async function paginatedListServiceQuotas(credentialsId: string, region: string, serviceCode: string) {
    logger.info(`List paginated ${serviceCode} quotas in region ${region} with credentials ${credentialsId}.`);

    const serviceQuotaClient = await getServiceQuotasClient(credentialsId, region);
    const paginator = paginateListServiceQuotas({ client: serviceQuotaClient }, { ServiceCode: serviceCode });

    const quotas = [];
    for await (const page of paginator) {
        if (isArray(page?.Quotas)) {
            quotas.push(...page.Quotas);
        }
    }

    logger.debug(`${serviceCode} quotas response ${quotas}`);

    return quotas;
}

export { getServiceQuotasClient, paginatedListServiceQuotas };
