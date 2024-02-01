import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import wlmdbPolicyResponse from '../../responses/cloud-manager/wlmdb-policy.json';

nock(`${WORKLOAD_FACTORY_ENDPOINT}`)
    .persist(true)
    .get(/wlmdb\/workload-policies.json/)
    .reply(() => [200, wlmdbPolicyResponse]);
