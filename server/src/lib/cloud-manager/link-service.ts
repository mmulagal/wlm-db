import { WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();

interface SsmLinkResponse {
    id: string;
    name: string;
}

async function registerSsmLink(
    name: string,
    arn: string,
    credentialsId: string,
    osType: 'windows' | 'linux',
    accountId: string,
    tags?: string[]
) {
    logger.info('Creating SSM link for accountId', { accountId, credentialsId, arn, name, osType, tags });

    const url = `${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/links/v1/links`;
    const { token } = await getWfServiceToken();

    try {
        const response = await gotInstanceForInternalRequest
            .post(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                json: {
                    type: 'ssm',
                    name,
                    arn,
                    tags,
                    ssmAgentInfo: {
                        credentialsId,
                        osType
                    }
                }
            })
            .json<SsmLinkResponse>();

        logger.debug('SSM link registered successfully', { arn });
        return response;
    } catch (error) {
        logger.error('Failed to register SSM link', { error, arn });
    }
}

export default registerSsmLink;
