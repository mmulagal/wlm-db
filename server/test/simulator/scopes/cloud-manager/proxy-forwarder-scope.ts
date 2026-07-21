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

// Per-test override registry keyed by `${targetId}|${ontapPath}`.
// Tests register GET responses via registerProxyGetResponse() and clear them via resetProxyOverrides().
type ProxyGetOverride = { status: number; body: unknown };
const getOverrides = new Map<string, ProxyGetOverride>();

// Per-test override registry for multi-call sequences (e.g. polling loops), keyed the same way.
// Responses are consumed in order; the last entry is returned for any further calls once exhausted.
const getOverrideSequences = new Map<string, ProxyGetOverride[]>();

function overrideKey({ targetId, ontapPath }: { targetId: string; ontapPath: string }): string {
    return `${targetId}|${ontapPath.replace(/^\/+/, '')}`;
}

function registerProxyGetResponse(opts: { targetId: string; ontapPath: string; status?: number; body: unknown }): void {
    const { targetId, ontapPath, status = 200, body } = opts;
    getOverrides.set(overrideKey({ targetId, ontapPath }), { status, body });
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
    getOverrideSequences.set(
        overrideKey({ targetId, ontapPath }),
        responses.map(({ status = 200, body }) => ({ status, body }))
    );
}

function resetProxyOverrides(): void {
    getOverrides.clear();
    getOverrideSequences.clear();
}

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(PROXY_PATH_REGEX)
    .reply(uri => {
        const parsed = parseProxyUri(uri);
        if (parsed) {
            const key = overrideKey(parsed);
            const sequence = getOverrideSequences.get(key);
            if (sequence?.length) {
                const next = sequence.length > 1 ? sequence.shift()! : sequence[0];
                return [next.status, next.body];
            }
            const override = getOverrides.get(key);
            if (override) {
                return [override.status, override.body];
            }
        }
        return isErrorTarget(uri)
            ? [500, { errorMessage: 'Internal server error' }]
            : [200, { records: [], num_records: 0 }];
    })
    .post(PROXY_PATH_REGEX)
    .reply(uri =>
        isErrorTarget(uri)
            ? [500, { errorMessage: 'Internal server error' }]
            : [200, { job: { uuid: faker.string.uuid() } }]
    )
    .patch(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, { errorMessage: 'Internal server error' }] : [200, {}]))
    .put(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, { errorMessage: 'Internal server error' }] : [200, {}]))
    .delete(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, { errorMessage: 'Internal server error' }] : [200, {}]))
    .head(PROXY_PATH_REGEX)
    .reply(uri => (isErrorTarget(uri) ? [500, {}] : [200, {}]));

export { registerProxyGetResponse, registerProxyGetResponseSequence, resetProxyOverrides };
