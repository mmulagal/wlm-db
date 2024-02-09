import nock from 'nock';
import { WF_CONSOLE_ENDPOINT } from '../../../../src/utils/consts';
import wlmdbPolicyResponse from '../../responses/cloud-manager/wlmdb-policy.json';

nock(`${WF_CONSOLE_ENDPOINT}`)
    .persist(true)
    .get(/wlmdb\/workload-policies.json/)
    .reply(() => [200, wlmdbPolicyResponse]);
