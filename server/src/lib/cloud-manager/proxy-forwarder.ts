import createError from 'http-errors';
import { HEADERS, HttpErrorCodes, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts';
import { gotInstanceForInternalRequest, isHTTPError } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();

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

        const headers: Record<string, string> = {
            [HEADERS.AUTHORIZATION]: token,
            [HEADERS.ENDPOINT]: endpoint
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
        logger.error('Proxy-forwarder request failed', {
            error,
            accountId,
            targetId,
            ontapPath: normalizedPath,
            endpoint,
            method,
            statusCode
        });
        throw createError(
            statusCode ?? HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Proxy-forwarder ${method} to target ${targetId} (${normalizedPath}) failed`
        );
    }
}

export { callProxyForwarder };
