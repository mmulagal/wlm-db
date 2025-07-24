import { faker } from '@faker-js/faker';
import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT } from '../../../../src/utils/consts';

const registerCredentialsResponse = {
    credentialsId: faker.string.uuid()
};

const listRegisteredCredentialsResponse = {
    credentials: [
        {
            credentialsName: 'wlmdomain',
            userName: 'wlm\\administrator',
            authMode: 'Windows',
            passphrase: null,
            hostName: null,
            sqlInstance: null,
            credentialsType: faker.string.alpha(10),
            credentialsId: faker.string.uuid(),
            connectorId: faker.string.uuid(),
            validationStatus: null
        }
    ],
    errorMessage: ''
};

nock(`${CLOUD_MANAGER_ENDPOINT}`)
    .persist(true)
    .post(/\/backup-recovery\/organizations\/[^/]+\/v1\/workloads\/sql\/credentials$/)
    .reply(() => [201, registerCredentialsResponse])
    .get(/\/backup-recovery\/organizations\/[^/]+\/v1\/workloads\/sql\/credentials$/)
    .reply(() => [201, listRegisteredCredentialsResponse]);
