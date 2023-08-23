import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/aws/service-quota-scope';
import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/aws/secrets-manager-scope';
import { initiateSecrets, readSecretFromSecretManager } from '../../src/utils/secret';

describe('Secrets Manager', () => {
    it('Initiating secrets', async () => {
        const response = await initiateSecrets();
        expect(response).toBeUndefined();
    });
    it('Getting secrets for secret id', async () => {
        const response = await readSecretFromSecretManager();
        expect(response).toBeDefined();
    });
});
