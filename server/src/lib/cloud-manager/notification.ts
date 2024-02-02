import createError from 'http-errors';
import { CLOUD_MANAGER_ENDPOINT, SERVICE_TOKEN, HEADERS } from '../../utils/consts.js';
import { gotInstanceForInternalRequest } from '../../utils/got.js';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage.js';
import getLogger from '../../utils/logger.js';
import { getBxpServiceToken } from './auth.js';

const logger = getLogger();

export default async function sendNotification(requestBody: any) {
    logger.info('Sending Notification:', { requestBody });
    // Blocking for simulator
    if (process.env.NODE_ENV !== 'demo') {
        try {
            const { token } = await getBxpServiceToken();
            return gotInstanceForInternalRequest.post(`${CLOUD_MANAGER_ENDPOINT}/pubsub/publish`, {
                headers: {
                    [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(SERVICE_TOKEN) || token
                },
                json: requestBody
            });
        } catch (err) {
            throw createError(500, `Error occurred while sending notification, ${err}`);
        }
    }
}
