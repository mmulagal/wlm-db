import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import { buildFsxItemForRegion } from './wlm-hosts-fixtures';

const WLM_HOSTS_PATH_REGEX =
    /^\/accounts\/[^/]+\/wlm-hosts\/v1\/credentials\/[^/]+\/regions\/([^/]+)\/(fsxs|ec2s)(?:\?.*)?$/;

// Real `wlm-hosts/{region}/fsxs` responses are shaped as `{ fsxs: [...] }`; `ec2s` responses are
// `{ hosts: [...] }`. `ec2s` is unused in demo mode today (fetchTaggingServiceEc2Hosts is
// short-circuited by IS_DEMO_FLOW - see discover-operations.ts), so it stays a static empty reply.
nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(WLM_HOSTS_PATH_REGEX)
    .reply(uri => {
        const match = WLM_HOSTS_PATH_REGEX.exec(uri);
        if (!match) {
            return [200, { hosts: [] }];
        }
        const [, region, kind] = match;
        if (kind === 'fsxs') {
            return [200, { fsxs: [buildFsxItemForRegion(region)] }];
        }
        return [200, { hosts: [] }];
    });
