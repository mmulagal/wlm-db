import got, { Hooks, HTTPError, RequestError, TimeoutError } from 'got';
import ms from 'ms';
import config from 'config';
import getLogger from './logger';
import { HEADERS, WLMDB } from './consts';

const logger = getLogger('got');

const LOGGING_BODY_MAX_LEN = 1000;

export const hooks: Hooks = {
    beforeRetry: [
        (error: RequestError, retryCount) => {
            const {
                options: { method, url }
            } = error;
            logger.info(`Retrying ${method} request to: ${url}, retry count: ${retryCount}`, error.message);
        }
    ],
    afterResponse: [
        response => {
            const {
                statusCode,
                requestUrl,
                body,
                request: {
                    options: { method }
                },
                timings
            } = response;

            logger.info(
                `Response ${statusCode} from ${method} to ${requestUrl}, took ${timings?.phases.total} msecs, body`,
                setBodyToObject(body)
            );

            return response;
        }
    ],
    beforeError: [
        error => {
            const {
                options: { method, url }
            } = error;

            if (isHTTPError(error)) {
                const {
                    response: { statusCode, body }
                } = error;
                const bodyAsObject = setBodyToObject(body);
                logger.error(`Got error ${statusCode} from ${method} to ${url}, body`, bodyAsObject);

                Object.assign(error, {
                    statusCode,
                    message: bodyAsObject?.message ? bodyAsObject.message : error.message
                });
            } else if (isTimeoutError(error)) {
                const { event, timings } = error;
                logger.error(
                    `Got timeout event ${event} from ${method} to ${url}, took ${timings?.phases.total} msecs`
                );
            } else {
                logger.error(`Got error from ${method} to ${url}`, error.message);
            }

            return error;
        }
    ],
    init: [],
    beforeRedirect: [],
    beforeRequest: []
};

export function isHTTPError(error: Error): error is HTTPError {
    return (error as HTTPError).response !== undefined;
}

export function isTimeoutError(error: Error): error is TimeoutError {
    return (error as TimeoutError).event !== undefined;
}

function setBodyToObject(body: any) {
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (err) {
            return body.slice(0, LOGGING_BODY_MAX_LEN);
        }
    }
    return body;
}

export const gotInstanceForInternalRequest = got.extend({
    retry: {
        limit: config.get<number>('got.internal.retry-count')
    },
    timeout: {
        lookup: ms(config.get<string>('got.internal.lookup-timeout')),
        connect: ms(config.get<string>('got.internal.connect-timeout')),
        response: ms(config.get<string>('got.internal.response-timeout'))
    },
    resolveBodyOnly: true,
    responseType: 'json',
    hooks
});

export const gotInstanceForExternalRequest = got.extend({
    retry: {
        limit: config.get<number>('got.external.retry-count')
    },
    timeout: {
        lookup: ms(config.get<string>('got.external.lookup-timeout')),
        connect: ms(config.get<string>('got.external.connect-timeout')),
        response: ms(config.get<string>('got.external.response-timeout'))
    },
    resolveBodyOnly: true,
    responseType: 'json',
    hooks: {
        ...hooks,
        beforeRequest: [
            options => {
                options.headers[HEADERS.REFERER] = WLMDB;
            }
        ]
    }
});
