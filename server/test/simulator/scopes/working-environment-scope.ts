import nock from 'nock';
import { WLMDB_ENDPOINT } from '../../../src/utils/consts';
import relationshipsResponse from '../responses/working-environment/relationships.json';

const weScope = nock(`${WLMDB_ENDPOINT}`)
    .persist(true)
    .get(/^\/wlmdb\/accounts\/(.+)\/api\/v1\/relationships$/)
    .reply(() => [200, relationshipsResponse]);

export default weScope;