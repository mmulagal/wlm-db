import { CLOUD_MANAGER_ENDPOINT } from '../../../src/utils/consts';
import nock from 'nock';
import deployTemplateResponse from '../responses/deployment/deploy-template-response.json';

const apiPath = '/wlm-db/accounts/:accountId/api';
const CLOUD_MANAGER = CLOUD_MANAGER_ENDPOINT + apiPath;

function escapeForwardSlash(input: string) {
    return new RegExp(input.replace(/\//g, '\\/'));
}

export const connectorDatabaseScope = nock(CLOUD_MANAGER, {
    allowUnmocked: true
})
    .persist(true)
    .post(escapeForwardSlash('/v1/credentials/:credentialsId/regions/:region/template/deploy'))
    .reply(() => [200, deployTemplateResponse]);
