import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';

const WLM_HOSTS_PATH_REGEX =
    /^\/accounts\/[^/]+\/wlm-hosts\/v1\/credentials\/[^/]+\/regions\/[^/]+\/(fsxs|ec2s)(?:\?.*)?$/;

// Real `wlm-hosts/{region}/{fsxs|ec2s}` responses are shaped as `{ hosts: [...] }` for both kinds.
nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(WLM_HOSTS_PATH_REGEX)
    .reply(200, { hosts: [] });
