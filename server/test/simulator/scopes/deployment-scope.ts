import '../scopes/cloud-manager/cloud-manager-credentials-scope';
import '../scopes/aws/cloud-formation-scope';
import '../scopes/aws/iam-scope';
import '../scopes/aws/secrets-manager-scope';
import '../scopes/aws/service-quota-scope';
import { CLOUD_MANAGER_ENDPOINT } from '../../../src/utils/consts';
import nock from 'nock';
import deployTemplateResponse from '../responses/deployment/deploy-template-response.json';

const apiPath = '/wlmdb/accounts/+./api';
const CLOUD_MANAGER = CLOUD_MANAGER_ENDPOINT + apiPath;

function escapeForwardSlash(input: string) {
    return new RegExp(input.replace(/\//g, '\\/'));
}

const deploymentScope = nock(CLOUD_MANAGER, {
    allowUnmocked: true
})
    .persist(true)
    .post(escapeForwardSlash('/v1/credentials/+./regions/+./cloudformation/stack'))
    .reply(() => [200, deployTemplateResponse]);

export { deploymentScope };
