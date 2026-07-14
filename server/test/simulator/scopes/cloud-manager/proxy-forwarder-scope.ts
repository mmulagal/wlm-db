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

function overrideKey({ targetId, ontapPath }: { targetId: string; ontapPath: string }): string {
    return `${targetId}|${ontapPath.replace(/^\/+/, '')}`;
}

function registerProxyGetResponse(opts: { targetId: string; ontapPath: string; status?: number; body: unknown }): void {
    const { targetId, ontapPath, status = 200, body } = opts;
    getOverrides.set(overrideKey({ targetId, ontapPath }), { status, body });
}

function resetProxyOverrides(): void {
    getOverrides.clear();
}

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(PROXY_PATH_REGEX)
    .reply(uri => {
        const parsed = parseProxyUri(uri);
        if (parsed) {
            const override = getOverrides.get(overrideKey(parsed));
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

export { registerProxyGetResponse, resetProxyOverrides };
