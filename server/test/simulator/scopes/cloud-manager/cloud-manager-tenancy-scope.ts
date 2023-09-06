import { faker } from '@faker-js/faker';
import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT } from '../../../../src/utils/consts';
import registerServiceResponse from '../../responses/cloud-manager/register-service-resource-tenancy.json';
import getTenancyResourceResponse from '../../responses/cloud-manager/get-tenancy-resources-by-type.json';

const serviceTokenResponse = {
    access_token: `${faker.string.alphanumeric(20)}`,
    expires_in: 86400,
    token_type: 'Bearer'
};

nock(`${CLOUD_MANAGER_ENDPOINT}`)
    .persist(true)
    .post(/^\/tenancy\/service-resource$/)
    .reply(() => [200, registerServiceResponse])
    .post(/^\/auth\/oauth\/token$/)
    .reply(() => [200, serviceTokenResponse])
    .get(/^\/tenancy\/service-resource/)
    .query(true)
    .reply(() => [200, getTenancyResourceResponse]);
