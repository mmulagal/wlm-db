import { faker } from '@faker-js/faker';
import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import registerCredentialsResponse from '../../responses/cloud-manager/register-credentials-fsx-core.json';

nock(`${WORKLOAD_FACTORY_ENDPOINT}`)
    .persist(true)
    .post(/^\/accounts\/(.+)\/fsx\/v2\/credentials\/(.+)\/regions\/(.+)\/file-systems\/(.+)\/ontap-credentials$/)
    .reply(() => [200, registerCredentialsResponse])
    .get(/^\/accounts\/(.+)\/fsx\/v2\/file-systems\/(.+)\/ontap-credentials$/)
    .reply(() => [
        200,
        {
            credentials: {
                ip: 'management.fs-0f32f6c69fb7e40ac.fsx.ap-southeast-1.amazonaws.com',
                userName: 'fsxadmin',
                password: `${faker.string.alphanumeric(20)}`
            }
        }
    ]);
