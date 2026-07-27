import { faker } from '@faker-js/faker';
import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';

const PROXY_PATH_REGEX = /^\/accounts\/([^/]+)\/proxy\/v1\/targets\/([^/]+)\/https\/([^?]+)(?:\?.*)?$/;

function parseProxyUri(uri: string): { targetId: string; ontapPath: string } | undefined {
    const match = PROXY_PATH_REGEX.exec(uri);
    if (!match) {
        return undefined;
    }
    const [, , targetId, ontapPath] = match;
    return { targetId, ontapPath };
}

function isErrorTarget(uri: string): boolean {
    return parseProxyUri(uri)?.targetId === 'error-target';
}

/** Standard error-target-aware reply for mutating methods (POST/PATCH/PUT/DELETE). */
function mutationReply(uri: string, okBody: unknown = {}): [number, unknown] {
    return isErrorTarget(uri) ? [500, { errorMessage: 'Internal server error' }] : [200, okBody];
}

// Per-test GET override registry keyed by `${targetId}|${ontapPath}`. A single registered
// response is just a one-element queue that repeats forever; a registered sequence (e.g. for
// polling loops) is consumed in order, with the last entry repeating once exhausted. Tests
// register responses via registerProxyGetResponse()/registerProxyGetResponseSequence() and clear
// them via resetProxyOverrides().
type ProxyGetOverride = { status: number; body: unknown };
const overrides = new Map<string, ProxyGetOverride[]>();

/** Captured GET request URIs (path + query) for assertions; cleared by `resetProxyOverrides`. */
const capturedProxyGetUris: string[] = [];

function overrideKey({ targetId, ontapPath }: { targetId: string; ontapPath: string }): string {
    return `${targetId}|${ontapPath.replace(/^\/+/, '')}`;
}

function registerProxyGetResponse(opts: { targetId: string; ontapPath: string; status?: number; body: unknown }): void {
    const { targetId, ontapPath, status = 200, body } = opts;
    overrides.set(overrideKey({ targetId, ontapPath }), [{ status, body }]);
}

/**
 * Registers a sequence of GET responses for the same `targetId`+`ontapPath`, returned one per
 * call in order (the last response repeats for any calls beyond the sequence's length). Use for
 * polling loops (e.g. `getClusterJobStatus`) that call the same endpoint multiple times.
 */
function registerProxyGetResponseSequence(opts: {
    targetId: string;
    ontapPath: string;
    responses: Array<{ status?: number; body: unknown }>;
}): void {
    const { targetId, ontapPath, responses } = opts;
    overrides.set(
        overrideKey({ targetId, ontapPath }),
        responses.map(({ status = 200, body }) => ({ status, body }))
    );
}

function resetProxyOverrides(): void {
    overrides.clear();
    capturedProxyGetUris.length = 0;
}

function getCapturedProxyGetUris(): readonly string[] {
    return capturedProxyGetUris;
}

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(PROXY_PATH_REGEX)
    .reply(uri => {
        capturedProxyGetUris.push(uri);
        const parsed = parseProxyUri(uri);
        const queue = parsed && overrides.get(overrideKey(parsed));
        if (queue?.length) {
            const next = queue.length > 1 ? queue.shift()! : queue[0];
            return [next.status, next.body];
        }
        return isErrorTarget(uri)
            ? [500, { errorMessage: 'Internal server error' }]
            : [200, { records: [], num_records: 0 }];
    })
    .post(PROXY_PATH_REGEX)
    .reply(uri => mutationReply(uri, { job: { uuid: faker.string.uuid() } }))
    .patch(PROXY_PATH_REGEX)
    .reply(uri => mutationReply(uri))
    .put(PROXY_PATH_REGEX)
    .reply(uri => mutationReply(uri))
    .delete(PROXY_PATH_REGEX)
    .reply(uri => mutationReply(uri))
    .head(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, {}] : [200, {}]));

export { registerProxyGetResponse, registerProxyGetResponseSequence, resetProxyOverrides, getCapturedProxyGetUris };
