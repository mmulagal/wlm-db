import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/aws/service-quota-scope';
import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/aws/secrets-manager-scope';
import initiateSecrets from '../../src/utils/secret';

describe('Secrets Manager', () => {
    it('Initiating secrets', async () => {
        const response = await initiateSecrets();
        expect(response).toBeUndefined();
    });
});
