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

function isClusterJobPath(ontapPath: string): boolean {
    return ontapPath.startsWith('api/cluster/jobs/');
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

const defaults = new Map<string, ProxyGetOverride>();

/** Captured GET request URIs (path + query) for assertions; cleared by `resetProxyOverrides`. */
const capturedProxyGetUris: string[] = [];

/** Per-test PATCH body overrides keyed the same way as GET overrides. */
const patchOverrides = new Map<string, ProxyGetOverride>();

/** Captured PATCH proxy URIs for targetId/path assertions; cleared by `resetProxyOverrides`. */
const capturedProxyPatchUris: string[] = [];

function overrideKey({ targetId, ontapPath }: { targetId: string; ontapPath: string }): string {
    return `${targetId}|${ontapPath.replace(/^\/+/, '')}`;
}

function registerProxyGetResponse(opts: { targetId: string; ontapPath: string; status?: number; body: unknown }): void {
    const { targetId, ontapPath, status = 200, body } = opts;
    overrides.set(overrideKey({ targetId, ontapPath }), [{ status, body }]);
}

function registerDefaultProxyGetResponse(opts: {
    targetId: string;
    ontapPath: string;
    status?: number;
    body: unknown;
}): void {
    const { targetId, ontapPath, status = 200, body } = opts;
    defaults.set(overrideKey({ targetId, ontapPath }), { status, body });
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

function registerProxyPatchResponse(opts: {
    targetId: string;
    ontapPath: string;
    status?: number;
    body: unknown;
}): void {
    const { targetId, ontapPath, status = 200, body } = opts;
    patchOverrides.set(overrideKey({ targetId, ontapPath }), { status, body });
}

function resetProxyOverrides(): void {
    overrides.clear();
    capturedProxyGetUris.length = 0;
    patchOverrides.clear();
    capturedProxyPatchUris.length = 0;
}

function getCapturedProxyGetUris(): readonly string[] {
    return capturedProxyGetUris;
}

function getCapturedProxyPatchUris(): readonly string[] {
    return capturedProxyPatchUris;
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
        const fixture = parsed && defaults.get(overrideKey(parsed));
        if (fixture) {
            return [fixture.status, fixture.body];
        }
        if (isErrorTarget(uri)) {
            return [500, { errorMessage: 'Internal server error' }];
        }
        // Job UUIDs returned by the default POST reply below are random, so callers polling
        // `api/cluster/jobs/{uuid}` can't pre-register an override by UUID — default to an
        // immediate success so job-polling gateway helpers don't hang for 900s in tests unless a
        // test explicitly registers a (failure/pending) override for the specific job path.
        if (parsed && isClusterJobPath(parsed.ontapPath)) {
            return [200, { state: 'success' }];
        }
        return [200, { records: [], num_records: 0 }];
    })
    .post(PROXY_PATH_REGEX)
    .reply(uri => mutationReply(uri, { job: { uuid: faker.string.uuid() } }))
    .patch(PROXY_PATH_REGEX)
    .reply(uri => {
        capturedProxyPatchUris.push(uri);
        if (isErrorTarget(uri)) {
            return [500, { errorMessage: 'Internal server error' }];
        }
        const parsed = parseProxyUri(uri);
        if (parsed) {
            const override = patchOverrides.get(overrideKey(parsed));
            if (override) {
                return [override.status, override.body];
            }
        }
        return [200, {}];
    })
    .put(PROXY_PATH_REGEX)
    .reply(uri => mutationReply(uri))
    .delete(PROXY_PATH_REGEX)
    .reply(uri => mutationReply(uri))
    .head(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, {}] : [200, {}]));

export {
    registerProxyGetResponse,
    registerDefaultProxyGetResponse,
    registerProxyGetResponseSequence,
    registerProxyPatchResponse,
    resetProxyOverrides,
    getCapturedProxyGetUris,
    getCapturedProxyPatchUris
};
