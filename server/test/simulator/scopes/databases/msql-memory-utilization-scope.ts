// import { faker } from '@faker-js/faker';
import nock from 'nock';
import listmsqlmemoryUtilizations from '../../responses/databases/get-msql-memory-utilization.json';
import '../../simulator/scopes/aws/ssm-scope';

nock('https://staging-netapp-cloud-account.auth0.com')
    .persist(true)
    .get(/^\/\/accounts\/(.+)\/api\/v1\/mssql\/resources\/(.+)\/utilization\/memory$/)
    .query(true)
    .reply(() => [200, listmsqlmemoryUtilizations]);
