import createError from 'http-errors';
import { CLOUD_MANAGER_ENDPOINT, SERVICE_TOKEN, HEADERS } from '../../utils/consts.js';
import { gotInstanceForInternalRequest } from '../../utils/got.js';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage.js';
import getLogger from '../../utils/logger.js';
import { getServiceToken } from './tenancy';

const logger = getLogger();

export default async function sendNotification(requestBody: any) {
    logger.info('Sending Notification:', { requestBody });

    try {
        const { token } = await getServiceToken();
        return gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/pubsub/publish`, {
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(SERVICE_TOKEN) || token
            },
            json: requestBody
        });
    } catch (err) {
        throw createError(500, `Error occured while sending notification, ${err}`);
    }
}
