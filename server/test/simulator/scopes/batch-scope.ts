import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../src/utils/consts.js';
import batchResponse from '../responses/batch/batch-response.json';

const batchScope = nock(WORKLOAD_FACTORY_ENDPOINT, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .get(/^\/accounts\/(.+)\/wlmdb\/v1\/mssql\/resources\/(.+)\/databases\/(.+)\/tables$/)
    .reply(() => [204, batchResponse]);

export default batchScope;
