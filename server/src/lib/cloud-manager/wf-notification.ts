import createError from 'http-errors';
import { WORKLOAD_FACTORY_ENDPOINT, HEADERS, WF_SVC_TOKEN_TYPE, WLMDB } from '../../utils/consts';
import { gotInstanceForInternalRequest, isHTTPError } from '../../utils/got';
import getLogger from '../../utils/logger';
import { deleteFromCache } from '../../utils/cache';
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

interface ChannelProperty {
    key: string;
    value: string;
}

interface NotificationChannel {
    type: string;
    active: boolean;
    channelProperties: ChannelProperty[];
}

interface ChannelsApiResponse {
    channels: NotificationChannel[];
}

async function sendWFNotification(accountId: string, requestBody: WFNotification) {
    logger.info('Sending workload factory notification:', { accountId, requestBody });
    try {
        const { token } = await getWfServiceToken();
        return await gotInstanceForInternalRequest.post(
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
        if (err instanceof Error && isHTTPError(err) && err.response.statusCode === 401) {
            logger.warn('WF notification send failed with 401, clearing cached token and retrying', { accountId });
            deleteFromCache(WF_SVC_TOKEN_TYPE, WLMDB);
            try {
                const { token: freshToken } = await getWfServiceToken();
                return await gotInstanceForInternalRequest.post(
                    `${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/notification/v1/send`,
                    {
                        headers: {
                            [HEADERS.AUTHORIZATION]: freshToken
                        },
                        json: requestBody,
                        resolveBodyOnly: false
                    }
                );
            } catch (retryErr) {
                throw createError(
                    500,
                    `Error occurred while sending Workload factory notification after token refresh, ${retryErr}`
                );
            }
        }
        throw createError(500, `Error occurred while sending Workload factory notification, ${err}`);
    }
}

// TODO: We may have to remove this if its not supported with the service token
async function getChannels(accountId: string) {
    logger.info('Get Channels:', { accountId });
    try {
        const { token } = await getWfServiceToken();
        return gotInstanceForInternalRequest
            .get(`${WORKLOAD_FACTORY_ENDPOINT}/accounts/${accountId}/notification/v1/channels`, {
                headers: {
                    [HEADERS.AUTHORIZATION]: token
                }
            })
            .json<ChannelsApiResponse>();
    } catch (err) {
        throw createError(500, `Error occurred while getting notification channels, ${err}`);
    }
}

export { sendWFNotification, WFNotification, getChannels };
