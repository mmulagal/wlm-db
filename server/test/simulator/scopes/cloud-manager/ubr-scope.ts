import { faker } from '@faker-js/faker';
import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT } from '../../../../src/utils/consts';

const registerCredentialsResponse = {
    credentialsId: faker.string.uuid()
};

nock(`${CLOUD_MANAGER_ENDPOINT}`)
    .persist(true)
    .post(/\/backup-recovery\/organizations\/[^/]+\/v1\/workloads\/sql\/credentials$/)
    .reply(() => [201, registerCredentialsResponse]);
