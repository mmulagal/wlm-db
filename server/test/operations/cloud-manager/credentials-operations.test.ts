import {
    getCredentials,
    getRoleDetails,
    getCredentialsDetails
} from '../../../src/operations/cloud-manager/credentials-operations';

import { ACCOUNT_ID, CREDENTIALS_ID } from '../../utils/consts';

const awsCredentialsType = 'aws_assume_role';

describe('getAwsCredentials method', () => {
    // Its not mocked as we are making actual api call
    it.skip('getAwsCredentials method should return mock data', async () => {
        const resp = await getCredentials(awsCredentialsType);
        expect(resp[0].credentialsId).toBeDefined();
    });

    it('Get Role Details method should return mock data', async () => {
        const resp = await getRoleDetails(CREDENTIALS_ID);
        expect(resp.roleArn).toBeDefined();
    });

    it('Get credentials details method should return mock data', async () => {
        const resp = await getCredentialsDetails(CREDENTIALS_ID, ACCOUNT_ID);
        expect(resp.credentials.accessKey).toBeDefined();
    });
});
