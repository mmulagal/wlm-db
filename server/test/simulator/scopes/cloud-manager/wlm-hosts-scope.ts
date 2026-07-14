import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';

const WLM_HOSTS_PATH_REGEX =
    /^\/accounts\/[^/]+\/wlm-hosts\/v1\/credentials\/[^/]+\/regions\/[^/]+\/(fsxs|ec2s)(?:\?.*)?$/;

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(WLM_HOSTS_PATH_REGEX)
    .reply(uri => {
        const match = WLM_HOSTS_PATH_REGEX.exec(uri);
        const kind = match?.[1];
        if (kind === 'fsxs') {
            return [200, { fsxs: [] }];
        }
        return [200, { ec2s: [] }];
    });
