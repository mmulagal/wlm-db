import { getCredentials } from '../../../src/operations/cloud-manager/credentials-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';

const aws_credentialsType = 'aws_assume_role';

describe('getAwsCredentials method', () => {
    it('getAwsCredentials method should return mock data', async () => {
        const resp = await getCredentials(aws_credentialsType);
        expect(resp[0].credentialsId).toBeDefined();
    });
});
