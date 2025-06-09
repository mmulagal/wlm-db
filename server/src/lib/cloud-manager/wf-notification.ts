import createError from 'http-errors';
import { WORKLOAD_FACTORY_ENDPOINT, HEADERS } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();

export default async function sendWFNotification(accountId: string, requestBody: any) {
    logger.info('Sending workload factory notification:', { accountId, requestBody });
    try {
        const { token } = await getWfServiceToken();
        return gotInstanceForInternalRequest.post(
            `${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/notification/v1/send`,
            {
                headers: {
                    [HEADERS.AUTHORIZATION]: token
                },
                json: requestBody,
                resolveBodyOnly: false
            }
        );
    } catch (err) {
        throw createError(500, `Error occurred while sending Workload factory notification, ${err}`);
    }
}
