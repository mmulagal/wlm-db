import nock from 'nock';
import { CREDENTIALS_ENDPOINT } from '../../../../src/utils/consts.js';
import cloudManagerAwsCredentials from '../../responses/cloud-manager/cloud-manager-aws-credentials.json';
import cloudManagerAllAwsCredentials from '../../responses/cloud-manager/cloud-manager-aws-all-credentials.json';

const cloudManagerCredentialsScope = nock(`${CREDENTIALS_ENDPOINT}`)
    .persist(true)
    .get(/^\/credentials\/accounts\/(.+)\/credentials$/)
    .reply(() => [200, cloudManagerAllAwsCredentials])
    .get(/^\/credentials\/accounts\/(.+)\/credentials\/(.+)$/)
    .reply(() => [200, cloudManagerAwsCredentials]);

export default cloudManagerCredentialsScope;
