import nock from 'nock';
import { WLMDB_ENDPOINT } from '../../../src/utils/consts.js';
import batchResponse from '../responses/batch/batch-response.json';

const batchScope = nock(WLMDB_ENDPOINT)
    .persist(true)
    .get(/^\/accounts\/(.+)\/wlmdb\/v1\/mssql\/resources\/(.+)\/databases\/(.+)\/tables$/)
    .reply(() => [204, batchResponse]);

export default batchScope;
