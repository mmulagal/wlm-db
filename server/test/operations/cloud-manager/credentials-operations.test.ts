import { getCredentials } from '../../../src/operations/cloud-manager/credentials-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/opentelemetry-scope';

const awsCredentialsType = 'aws_assume_role';

describe('getAwsCredentials method', () => {
    it('getAwsCredentials method should return mock data', async () => {
        const resp = await getCredentials(awsCredentialsType);
        expect(resp[0].credentialsId).toBeDefined();
    });
});
