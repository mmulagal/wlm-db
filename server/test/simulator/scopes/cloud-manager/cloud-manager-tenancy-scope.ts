import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT } from '../../../../src/utils/consts.js';
import registerServiceResponse from '../../responses/cloud-manager/register-service-resource-tenancy.json';
import serviceTokenResponse from '../../responses/cloud-manager/service-token.json';
import getTenancyResourceResponse from '../../responses/cloud-manager/get-tenancy-resources-by-type.json';

nock(`${CLOUD_MANAGER_ENDPOINT}`)
    .persist(true)
    .post(/^\/tenancy\/service-resource$/)
    .reply(() => [200, registerServiceResponse])
    .post(/^\/auth\/oauth\/token$/)
    .reply(() => [200, serviceTokenResponse])
    .get(/^\/tenancy\/service-resource/)
    .query(true)
    .reply(() => [200, getTenancyResourceResponse]);
