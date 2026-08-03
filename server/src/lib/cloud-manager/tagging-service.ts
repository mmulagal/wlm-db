import createError from 'http-errors';
import { HEADERS, HttpErrorCodes, TAGGING_SERVICE_API_TYPES, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest, isHTTPError } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();

async function callWlmHosts<T>(
    accountId: string,
    credentialsId: string,
    region: string,
    kind: TAGGING_SERVICE_API_TYPES
): Promise<T> {
    logger.info('Fetching wlm-hosts resources', { accountId, credentialsId, region, kind });

    const url = `accounts/${accountId}/wlm-hosts/v1/credentials/${credentialsId}/regions/${region}/${kind}`;

    try {
        const { token } = await getWfServiceToken();

        return await gotInstanceForInternalRequest
            .get(url, {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: token
                }
            })
            .json<T>();
    } catch (error: unknown) {
        const statusCode = error instanceof Error && isHTTPError(error) ? error.response.statusCode : undefined;
        logger.error('wlm-hosts request failed', { accountId, credentialsId, region, kind, statusCode, error });
        throw createError(
            statusCode ?? HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `wlm-hosts ${kind} listing for credentials ${credentialsId} in ${region} failed`
        );
    }
}

export { callWlmHosts };
