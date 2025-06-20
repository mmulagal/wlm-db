import createError from 'http-errors';
import { WORKLOAD_FACTORY_ENDPOINT, HEADERS } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();
// Notification interface
interface WFNotification {
    content: string;
    subject: string;
    resourceType?: string;
    resourceId: string;
    workload?: string;
    priority?: string;
    resourceName: string;
    timestamp?: number;
    notificationType: string;
    actionRequired?:
        | boolean
        | {
              to: string;
              state: {
                  [key: string]: string;
              };
              label: string;
          };
    link?: {
        url: string;
        label: string;
    };
    persist?: boolean;
    ttl?: number;
    action?: string;
    userId?: string;
    service?: string;
}

async function sendWFNotification(accountId: string, requestBody: WFNotification) {
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

export { sendWFNotification, WFNotification };
