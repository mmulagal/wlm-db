// import { faker } from '@faker-js/faker';
import nock from 'nock';
import listmsqlmemoryUtilizations from '../../responses/databases/get-msql-memory-utilization.json';

nock('sample')
    .persist(true)
    .get(/^\/\/accounts\/(.+)\/credentials$/)
    .query(true)
    .reply(() => [200, listmsqlmemoryUtilizations]);
