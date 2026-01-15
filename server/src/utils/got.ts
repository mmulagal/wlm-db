import got, { Hooks, HTTPError, RequestError, TimeoutError } from 'got';
import ms, { StringValue } from 'ms';
import config from 'config';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import getLogger, { getTraceData } from './logger';
import { HEADERS, WLMDB } from './consts';

const logger = getLogger('got');

const LOGGING_BODY_MAX_LEN = 1000;

const hooks: Hooks = {
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
    beforeCache: [],
    init: [],
    beforeRedirect: [],
    beforeRequest: [
        options => {
            options.headers[HEADERS.REFERER] = WLMDB;
            options.headers[HEADERS.ACTIVE_TRACE_ID] = getTraceData()?.traceId || 'unknown';
        }
    ]
};

function isHTTPError(error: Error): error is HTTPError {
    return (error as HTTPError).response !== undefined;
}

function isTimeoutError(error: Error): error is TimeoutError {
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

const gotInstanceForInternalRequest = got.extend({
    retry: {
        limit: config.get<number>('got.internal.retry-count'),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
        errorCodes: [
            'ETIMEDOUT',
            'ECONNRESET',
            'EADDRINUSE',
            'ECONNREFUSED',
            'EPIPE',
            'ENOTFOUND',
            'ENETUNREACH',
            'EAI_AGAIN',
            'EINVAL'
        ]
    },
    timeout: {
        lookup: ms(config.get<StringValue>('got.internal.lookup-timeout')),
        connect: ms(config.get<StringValue>('got.internal.connect-timeout')),
        response: ms(config.get<StringValue>('got.internal.response-timeout'))
    },
    agent: {
        http: new HttpAgent({
            keepAlive: true,
            keepAliveMsecs: 30000, // 30 seconds
            maxSockets: 50, // Max connections per host
            maxFreeSockets: 10, // Keep up to 10 idle connections
            timeout: 60000 // Socket timeout: 60 seconds
        }),
        https: new HttpsAgent({
            keepAlive: true,
            keepAliveMsecs: 30000, // 30 seconds
            maxSockets: 50, // Max connections per host
            maxFreeSockets: 10, // Keep up to 10 idle connections
            timeout: 60000 // Socket timeout: 60 seconds
        })
    },
    resolveBodyOnly: true,
    responseType: 'json',
    hooks
});

const gotInstanceForExternalRequest = got.extend({
    retry: {
        limit: config.get<number>('got.external.retry-count')
    },
    timeout: {
        lookup: ms(config.get<StringValue>('got.external.lookup-timeout')),
        connect: ms(config.get<StringValue>('got.external.connect-timeout')),
        response: ms(config.get<StringValue>('got.external.response-timeout'))
    },
    resolveBodyOnly: true,
    responseType: 'json',
    hooks
});

const gotInstanceForTextResponse = got.extend({
    retry: {
        limit: config.get<number>('got.external.retry-count')
    },
    timeout: {
        lookup: ms(config.get<StringValue>('got.external.lookup-timeout')),
        connect: ms(config.get<StringValue>('got.external.connect-timeout')),
        response: ms(config.get<StringValue>('got.external.response-timeout'))
    },
    resolveBodyOnly: true,
    responseType: 'text',
    hooks
});

const gotInstanceForBatchRequest = got.extend({
    retry: {
        limit: config.get<number>('got.batch.retry-count')
    },
    timeout: {
        lookup: ms(config.get<StringValue>('got.batch.lookup-timeout')),
        connect: ms(config.get<StringValue>('got.batch.connect-timeout')),
        response: ms(config.get<StringValue>('got.batch.response-timeout'))
    },
    resolveBodyOnly: true,
    responseType: 'json',
    hooks
});

export {
    isHTTPError,
    isTimeoutError,
    gotInstanceForInternalRequest,
    gotInstanceForExternalRequest,
    gotInstanceForBatchRequest,
    gotInstanceForTextResponse
};
