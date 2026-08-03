import createError from 'http-errors';
import {
    AWS_SECRET_ARN_TYPE,
    GOV_ACCOUNT,
    HEADERS,
    HttpErrorCodes,
    USER_TOKEN,
    WORKLOAD_FACTORY_ENDPOINT,
    SECRET_ARN_CACHE_TTL
} from '../../utils/consts';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { gotInstanceForInternalRequest, isHTTPError } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';
import { listFsxOntapCredentials } from './fsx-core';

const logger = getLogger();

async function resolveGovCloudSecretArn(accountId: string, targetId: string) {
    logger.info('Resolving GovCloud secret ARN', { accountId, targetId });

    if (!getAsyncLocalStorageResource(USER_TOKEN)) {
        logger.warn('Skipping x-aws-secret-arn resolution — no user token in context', { accountId, targetId });
        return undefined;
    }

    const cacheKey = `${accountId}:${targetId}`;
    if (hasCache(AWS_SECRET_ARN_TYPE, cacheKey)) {
        return readFromCacheByKey(AWS_SECRET_ARN_TYPE, cacheKey) as string;
    }

    const { credentials: { password, isSecret } = {} } = await listFsxOntapCredentials(accountId, targetId);
    if (!isSecret || !password) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `GovCloud FSx ONTAP credentials for target ${targetId} did not return a secret ARN`
        );
    }

    writeToCache(AWS_SECRET_ARN_TYPE, cacheKey, password, SECRET_ARN_CACHE_TTL);
    return password;
}

function extractUpstreamErrorDetail(body: unknown): string | undefined {
    if (!body) {
        return undefined;
    }
    if (typeof body === 'string') {
        try {
            return extractUpstreamErrorDetail(JSON.parse(body));
        } catch {
            return body.slice(0, 500);
        }
    }
    if (typeof body === 'object') {
        const { message, errorMessage, error, error_description: errorDescription } = body as Record<string, unknown>;
        return String(message ?? errorMessage ?? error ?? errorDescription ?? JSON.stringify(body)).slice(0, 500);
    }
    return String(body).slice(0, 500);
}

type ProxyHttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';

const METHODS_WITH_BODY: ReadonlySet<ProxyHttpMethod> = new Set(['POST', 'PATCH', 'PUT']);

interface CallProxyForwarderOptions {
    accountId: string;
    /** Proxy target identifier — the FSx file-system ID (e.g. `fs-0abc123`) or any other target registered with the proxy-forwarder service. */
    targetId: string;
    /** ONTAP REST path appended after `/https/`, e.g. `api/storage/volumes`. Leading slash is tolerated. */
    ontapPath: string;
    /** ONTAP management endpoint hostname sent as `x-endpoint` (e.g. `management.fs-xxx.fsx.us-east-1.amazonaws.com`). Required by the proxy-forwarder to know where to forward the request. */
    endpoint: string;
    /** HTTP method to use. Defaults to `GET`. Use `POST`/`PATCH`/`PUT` for mutating ONTAP operations. */
    method?: ProxyHttpMethod;
    /** Request payload for `POST`, `PATCH`, and `PUT` requests. Ignored for other methods. */
    body?: unknown;
    /** Query parameters appended to the ONTAP REST path (e.g. `{ 'fields': 'name,uuid', 'max_records': 100 }`). */
    searchParams?: Record<string, string | number | boolean>;
}

/**
 * Generic ONTAP collector that forwards an arbitrary ONTAP REST call through the
 * Workload Factory proxy-forwarder API
 * (`/accounts/{accountId}/proxy/v1/targets/{targetId}/https/{*}`).
 *
 * Authenticates with the WF service token. FSx ONTAP credentials registered via
 * `registerFsxOntapCredentials` are resolved automatically by the proxy using the `targetId`.
 *
 * @example
 * const volumes = await callProxyForwarder<{ records: unknown[] }>({
 *     accountId,
 *     targetId: fsxId,
 *     ontapPath: 'api/storage/volumes',
 *     endpoint: 'management.fs-xxx.fsx.us-east-1.amazonaws.com'
 * });
 */
async function callProxyForwarder<T>(opts: CallProxyForwarderOptions): Promise<T> {
    const { accountId, targetId, ontapPath, endpoint, method = 'GET', body, searchParams } = opts;

    const normalizedPath = ontapPath.replace(/^\/+/, '');
    const url = `accounts/${accountId}/proxy/v1/targets/${targetId}/https/${normalizedPath}`;

    logger.info('Forwarding ONTAP request via proxy-forwarder', {
        accountId,
        targetId,
        method,
        ontapPath: normalizedPath,
        endpoint
    });

    try {
        const { token } = await getWfServiceToken();

        const secretArn = getAsyncLocalStorageResource(GOV_ACCOUNT)
            ? await resolveGovCloudSecretArn(accountId, targetId)
            : undefined;

        const headers: Record<string, string> = {
            [HEADERS.AUTHORIZATION]: token,
            [HEADERS.ENDPOINT]: endpoint,
            ...(secretArn && { [HEADERS.AWS_SECRET_ARN]: secretArn })
        };

        const requestOptions = {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            method,
            headers,
            ...(searchParams ? { searchParams } : {}),
            ...(METHODS_WITH_BODY.has(method) && body !== undefined ? { json: body } : {})
        };

        return await gotInstanceForInternalRequest(url, requestOptions).json<T>();
    } catch (error: unknown) {
        const statusCode = error instanceof Error && isHTTPError(error) ? error.response.statusCode : undefined;
        const upstreamDetail =
            error instanceof Error && isHTTPError(error) ? extractUpstreamErrorDetail(error.response.body) : undefined;
        logger.error('Proxy-forwarder request failed', {
            error,
            accountId,
            targetId,
            ontapPath: normalizedPath,
            endpoint,
            method,
            statusCode,
            upstreamDetail
        });
        const reason = upstreamDetail ?? (error instanceof Error ? error.message : String(error));
        throw createError(
            statusCode ?? HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Proxy-forwarder ${method} to target ${targetId} (${normalizedPath}) failed${
                statusCode ? ` with status ${statusCode}` : ''
            }${reason ? `: ${reason}` : ''}`
        );
    }
}

export { callProxyForwarder, type ProxyHttpMethod };
