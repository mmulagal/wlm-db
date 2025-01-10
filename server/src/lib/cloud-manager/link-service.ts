import { CLOUD_MANAGER_ENDPOINT } from '../../utils/consts';
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
    tenancyAccId: string,
    tags?: string[]
) {
    let url = `${CLOUD_MANAGER_ENDPOINT}/accounts/${tenancyAccId}/links/v1/links`;

    const { token } = await getWfServiceToken();
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

    logger.debug('SSM link registered successfully');
    return response;
}

export { registerSsmLink };

